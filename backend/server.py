"""
HomeAgent FastAPI server.

Run:
    uvicorn server:app --reload --port 8000
"""

import json
import os
import sys
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from google import genai
from pydantic import BaseModel

from agent import run_agent, run_agent_stream

app = FastAPI(title="HomeAgent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("ERROR: GEMINI_API_KEY not set in backend/.env", file=sys.stderr)
    sys.exit(1)

client = genai.Client(api_key=api_key)

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


@app.get("/health")
def health():
    return {"status": "ok", "sessions": len(SESSIONS)}


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="message is required")

    session_id = req.session_id or str(uuid.uuid4())
    history = SESSIONS.get(session_id, [])

    try:
        text, updated_history, tool_calls = run_agent(
            client, req.message, history, verbose=False
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"agent error: {e}")

    SESSIONS[session_id] = updated_history

    return ChatResponse(
        response=text,
        session_id=session_id,
        tool_calls=[ToolCall(**tc) for tc in tool_calls],
    )


@app.post("/chat/stream")
def chat_stream(req: ChatRequest):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="message is required")

    session_id = req.session_id or str(uuid.uuid4())
    history = SESSIONS.get(session_id, [])

    def event_stream():
        captured_history = history  # default: keep prior history if stream errors
        try:
            for event in run_agent_stream(client, req.message, history):
                if event.get("type") == "done":
                    captured_history = event.pop("history", history)  # not JSON-serializable
                    event["session_id"] = session_id
                yield json.dumps(event) + "\n"
            SESSIONS[session_id] = captured_history
        except Exception as e:
            yield json.dumps({"type": "error", "message": str(e)}) + "\n"

    return StreamingResponse(
        event_stream(),
        media_type="application/x-ndjson",
        headers={"X-Accel-Buffering": "no"},  # disable proxy buffering if any
    )


@app.delete("/chat/{session_id}")
def reset(session_id: str):
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
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
