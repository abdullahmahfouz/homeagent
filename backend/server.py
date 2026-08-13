"""
HomeAgent FastAPI server.

Run:
    uvicorn server:app --reload --port 8000

Abuse / cost controls live in guards.py and are all env-configurable; see
.env.example. Every endpoint that can reach Gemini is rate limited per IP and
per session, size limited, and gated behind a daily/monthly spend ceiling.
"""

import json
import logging
import os
import sys
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from google import genai
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded

import guards
from agent import run_agent, run_agent_stream

log = logging.getLogger("homeagent")

app = FastAPI(title="HomeAgent API")

# ── Request body size cap ─────────────────────────────────────────────────────
# Registered before CORS so that CORS ends up the outermost middleware and a
# 413 still carries the Access-Control-Allow-Origin header.
@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    """Reject oversized bodies up front so a huge payload never reaches the
    JSON parser, the session store, or Gemini."""
    if request.method in ("POST", "PUT", "PATCH"):
        declared = request.headers.get("content-length")
        if declared and declared.isdigit() and int(declared) > guards.MAX_BODY_BYTES:
            return JSONResponse(
                status_code=413,
                content={
                    "error": "payload_too_large",
                    "detail": f"Request body exceeds {guards.MAX_BODY_BYTES} bytes.",
                },
            )
    return await call_next(request)


# ── CORS ──────────────────────────────────────────────────────────────────────
# Explicit allow-list, never "*". Production is a single-service deploy (this
# process serves the built SPA), so same-origin requests need no entry at all;
# set ALLOWED_ORIGINS when the frontend is hosted separately, and
# ALLOW_LOCAL_ORIGINS=1 (or DEBUG=1) to add localhost for dev.
ALLOWED_ORIGINS = guards.allowed_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
    max_age=600,
)

# ── Rate limiting ─────────────────────────────────────────────────────────────
# Per-IP, enforced by the @limiter.limit decorators below. The per-session half
# lives in guards.session_limiter (slowapi can't key on a JSON body field).
limiter = Limiter(key_func=guards.client_ip, headers_enabled=True)
app.state.limiter = limiter


# User-facing copy for every "you can't call Gemini right now" case. Kept in one
# place so /chat and /chat/stream always say the same thing.
DAILY_LIMIT_MESSAGE = "Daily AI assistant limit reached — please try again tomorrow."
MINUTE_LIMIT_MESSAGE = (
    "The AI assistant is busy right now — please wait a minute and try again."
)
BUDGET_MESSAGES = {
    guards.BUDGET_DAILY: DAILY_LIMIT_MESSAGE,
    guards.BUDGET_MONTHLY: "Monthly AI assistant limit reached — please try again later.",
    guards.BUDGET_MINUTE: MINUTE_LIMIT_MESSAGE,
}


@app.exception_handler(RateLimitExceeded)
def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """slowapi 429s. A per-day window gets the friendly daily-limit copy; the
    short windows get "slow down" copy."""
    try:
        window = int(exc.limit.limit.get_expiry())
    except Exception:
        window = 60
    daily = window >= 86400
    return JSONResponse(
        status_code=429,
        content={
            "error": "daily_limit_reached" if daily else "rate_limited",
            "detail": DAILY_LIMIT_MESSAGE if daily else (
                "You're sending requests a little too quickly — "
                "please wait a moment and try again."
            ),
            "limit": str(exc.detail),
        },
        headers={"Retry-After": str(window)},
    )


# ── Gemini client ─────────────────────────────────────────────────────────────
# Key is read server-side from the environment only. It is never returned in a
# response, never logged, and never reaches the frontend bundle.
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("ERROR: GEMINI_API_KEY not set in backend/.env", file=sys.stderr)
    sys.exit(1)


class _MeteredModels:
    """Counts every real Gemini call against the account-wide budget.

    The agent loop calls the model once per tool round-trip, so a single chat
    turn is 2–3 calls. Metering here — rather than per HTTP request — is what
    keeps the count honest against the free tier's 20/day quota.
    """

    def __init__(self, models):
        self._models = models

    def generate_content(self, *args, **kwargs):
        guards.budget.record_call()
        return self._models.generate_content(*args, **kwargs)

    def generate_content_stream(self, *args, **kwargs):
        guards.budget.record_call()
        return self._models.generate_content_stream(*args, **kwargs)

    def __getattr__(self, name):
        return getattr(self._models, name)


class _MeteredClient:
    def __init__(self, inner):
        self._inner = inner
        self.models = _MeteredModels(inner.models)

    def __getattr__(self, name):
        return getattr(self._inner, name)


client = _MeteredClient(genai.Client(api_key=api_key))

# In-memory session store: session_id -> Gemini Content history
SESSIONS: dict[str, list] = {}


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


class ToolCall(BaseModel):
    name: str
    args: dict
    result: dict | list | str | int | float | None


class ChatResponse(BaseModel):
    response: str
    session_id: str
    tool_calls: list[ToolCall]


# ── Shared pre-flight for anything that can call Gemini ───────────────────────

def _validate_and_admit(req: ChatRequest) -> str:
    """Validate input, enforce per-session rate limit and the spend ceiling.

    Raises HTTPException (400 / 413 / 429 / 503). Returns the session id to use.
    Called before any Gemini request is issued.
    """
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="message is required")

    if len(req.message) > guards.MAX_MESSAGE_CHARS:
        raise HTTPException(
            status_code=413,
            detail=(
                f"Message is too long ({len(req.message)} characters). "
                f"Maximum is {guards.MAX_MESSAGE_CHARS}."
            ),
        )

    if req.session_id is not None and len(req.session_id) > guards.MAX_SESSION_ID_CHARS:
        raise HTTPException(status_code=400, detail="session_id is too long")

    session_id = req.session_id or str(uuid.uuid4())

    allowed, retry_after = guards.session_limiter.check(session_id)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=(
                "Too many requests for this session "
                f"({guards.SESSION_LIMIT_PER_MINUTE}/minute). "
                "Please wait a moment and try again."
            ),
            headers={"Retry-After": str(retry_after)},
        )

    ok, reason = guards.budget.check()
    if not ok:
        raise HTTPException(
            status_code=503,
            detail=BUDGET_MESSAGES.get(reason, DAILY_LIMIT_MESSAGE),
            headers={"Retry-After": "60" if reason == guards.BUDGET_MINUTE else "3600"},
        )

    return session_id


def _store_session(session_id: str, history: list) -> None:
    """Save history, bounding the store so it can't grow without limit."""
    if SESSIONS.pop(session_id, None) is None and len(SESSIONS) >= guards.MAX_SESSIONS:
        SESSIONS.pop(next(iter(SESSIONS)), None)  # evict least recently written
    SESSIONS[session_id] = history


def _record_tokens(message: str, history: list, response_text: str) -> None:
    """Estimated token spend for the turn. Gemini *call* counts are metered in
    _MeteredModels; this is the token half of the budget."""
    guards.budget.record_tokens(
        guards.estimate_tokens(message)
        + guards.estimate_history_tokens(history)
        + guards.estimate_tokens(response_text)
    )


# `response: Response` is required by slowapi so it can attach X-RateLimit-*
# headers to endpoints that return a plain dict / model rather than a Response.

@app.get("/health")
@limiter.limit(guards.RATE_LIMIT_ADMIN)
def health(request: Request, response: Response):
    return {"status": "ok", "sessions": len(SESSIONS)}


@app.get("/usage")
@limiter.limit(guards.RATE_LIMIT_ADMIN)
def usage(request: Request, response: Response):
    """Current spend-guard counters — no secrets, just budget headroom."""
    return guards.budget.snapshot()


@app.post("/chat", response_model=ChatResponse)
@limiter.limit(guards.RATE_LIMIT_CHAT)
def chat(request: Request, response: Response, req: ChatRequest):
    session_id = _validate_and_admit(req)
    history = SESSIONS.get(session_id, [])

    try:
        text, updated_history, tool_calls = run_agent(
            client, req.message, history, verbose=False
        )
    except Exception as e:
        log.error("agent error: %s", guards.redact_secrets(str(e)))
        raise HTTPException(status_code=500, detail="agent error")

    _store_session(session_id, updated_history)
    _record_tokens(req.message, history, text)

    return ChatResponse(
        response=text,
        session_id=session_id,
        tool_calls=[ToolCall(**tc) for tc in tool_calls],
    )


@app.post("/chat/stream")
@limiter.limit(guards.RATE_LIMIT_CHAT)
def chat_stream(request: Request, req: ChatRequest):
    session_id = _validate_and_admit(req)
    history = SESSIONS.get(session_id, [])
    message = req.message

    def event_stream():
        captured_history = history  # default: keep prior history if stream errors
        streamed_text = ""
        try:
            for event in run_agent_stream(client, message, history):
                if event.get("type") == "text":
                    streamed_text += event.get("chunk", "")
                if event.get("type") == "done":
                    captured_history = event.pop("history", history)  # not JSON-serializable
                    event["session_id"] = session_id
                yield json.dumps(event) + "\n"
            _store_session(session_id, captured_history)
        except Exception as e:
            log.error("stream error: %s", guards.redact_secrets(str(e)))
            yield json.dumps({"type": "error", "message": "agent error"}) + "\n"
        finally:
            _record_tokens(message, history, streamed_text)

    return StreamingResponse(
        event_stream(),
        media_type="application/x-ndjson",
        headers={"X-Accel-Buffering": "no"},  # disable proxy buffering if any
    )


@app.delete("/chat/{session_id}")
@limiter.limit(guards.RATE_LIMIT_ADMIN)
def reset(request: Request, response: Response, session_id: str):
    SESSIONS.pop(session_id, None)
    return {"status": "ok"}


# ── Serve the built frontend (single-service deploy) ──────────────────────────
# In dev, Vite serves the frontend on :5173 and this directory won't exist —
# the block is a no-op. In production (Render), the build step creates dist/
# and this mounts it alongside the API.
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "real-estate-agent" / "dist"
if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        # Top-level files (favicon, vite.svg, etc.) served directly; otherwise the SPA index.
        # Resolve and confine to dist/ so a traversal path can't read the filesystem.
        index = FRONTEND_DIST / "index.html"
        if not full_path:
            return FileResponse(index)
        try:
            candidate = (FRONTEND_DIST / full_path).resolve()
            if candidate.is_file() and candidate.is_relative_to(FRONTEND_DIST.resolve()):
                return FileResponse(candidate)
        except (OSError, ValueError):
            pass
        return FileResponse(index)
