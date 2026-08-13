"""
Abuse / cost guards for the HomeAgent API.

Everything here is configured by environment variable so the deployed instance
can be tightened without a code change. Defaults are sized for a small
portfolio demo, not for production traffic.

Nothing in this module reads or echoes an API key except `redact_secrets`,
which exists purely to strip secret values out of error text before it leaves
the process.
"""

from __future__ import annotations

import json
import os
import threading
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

# ─── env helpers ──────────────────────────────────────────────────────────────

def env_str(name: str, default: str = "") -> str:
    value = os.getenv(name)
    return default if value is None or not value.strip() else value.strip()


def env_int(name: str, default: int) -> int:
    try:
        return int(env_str(name, str(default)))
    except ValueError:
        return default


def env_bool(name: str, default: bool = False) -> bool:
    return env_str(name, "1" if default else "0").lower() in ("1", "true", "yes", "on")


def env_list(name: str) -> list[str]:
    return [item.strip() for item in env_str(name).split(",") if item.strip()]


# ─── CORS ─────────────────────────────────────────────────────────────────────

# Origins allowed in dev when ALLOW_LOCAL_ORIGINS / DEBUG is on.
LOCAL_ORIGINS = [
    "http://localhost:5173",   # vite dev
    "http://127.0.0.1:5173",
    "http://localhost:4173",   # vite preview
    "http://127.0.0.1:4173",
    "http://localhost:8000",   # backend serving the built SPA
    "http://127.0.0.1:8000",
]


def allowed_origins() -> list[str]:
    """Explicit allow-list — never "*".

    Production (single-service deploy) is same-origin, so the list can legally
    be empty: the browser doesn't do a CORS check when the page and the API
    share an origin. Set ALLOWED_ORIGINS only when the frontend is hosted
    somewhere else.
    """
    origins = [o.rstrip("/") for o in env_list("ALLOWED_ORIGINS")]
    if env_bool("ALLOW_LOCAL_ORIGINS") or env_bool("DEBUG"):
        origins += [o for o in LOCAL_ORIGINS if o not in origins]
    return origins


# ─── client identity ──────────────────────────────────────────────────────────

# Render (and most PaaS) terminate TLS at a proxy, so request.client.host is the
# proxy and every visitor shares one rate-limit bucket unless we read
# X-Forwarded-For. That header is trivially spoofable when the app is exposed
# directly, so set TRUST_PROXY_HEADERS=0 in that case; the budget ceiling below
# is the backstop either way.
TRUST_PROXY_HEADERS = env_bool("TRUST_PROXY_HEADERS", True)


def client_ip(request) -> str:
    if TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()
    client = getattr(request, "client", None)
    return getattr(client, "host", None) or "unknown"


# ─── request size limits ──────────────────────────────────────────────────────

# A real-estate query is a sentence or two; 2000 chars is generous and keeps a
# pasted wall of text from burning tokens (and free-tier quota) in one shot.
MAX_MESSAGE_CHARS = env_int("MAX_MESSAGE_CHARS", 2000)
MAX_BODY_BYTES = env_int("MAX_BODY_BYTES", 32 * 1024)
MAX_SESSION_ID_CHARS = 128


# ─── rate limits ──────────────────────────────────────────────────────────────

# Per-IP limits for Gemini-backed endpoints. Multiple windows are separated by
# ";" (slowapi/limits syntax). Sized for the Gemini free tier (5 RPM,
# 20 requests/day account-wide): 2/min keeps one visitor under the RPM ceiling,
# 4/day leaves headroom for other visitors.
RATE_LIMIT_CHAT = env_str("RATE_LIMIT_CHAT", "2/minute;4/day")
RATE_LIMIT_ADMIN = env_str("RATE_LIMIT_ADMIN", "60/minute")  # /health, /usage, session reset
SESSION_LIMIT_PER_MINUTE = env_int("SESSION_LIMIT_PER_MINUTE", 2)


class SlidingWindowCounter:
    """Per-key sliding window, used for the per-session limit.

    slowapi covers per-IP; it can't key on a field inside the JSON body, which
    is where session_id lives, so that half is done here.
    """

    def __init__(self, limit: int, window_seconds: int = 60, max_keys: int = 10_000):
        self.limit = limit
        self.window = window_seconds
        self.max_keys = max_keys
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def check(self, key: str) -> tuple[bool, int]:
        """Record a hit. Returns (allowed, retry_after_seconds)."""
        if self.limit <= 0:
            return True, 0
        now = time.monotonic()
        with self._lock:
            hits = self._hits.get(key)
            if hits is None:
                if len(self._hits) >= self.max_keys:
                    self._evict_stale(now)
                hits = self._hits.setdefault(key, deque())
            while hits and now - hits[0] > self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                return False, max(1, int(self.window - (now - hits[0])) + 1)
            hits.append(now)
            return True, 0

    def _evict_stale(self, now: float) -> None:
        for key in [k for k, v in self._hits.items() if not v or now - v[-1] > self.window]:
            self._hits.pop(key, None)
        if len(self._hits) >= self.max_keys:  # still full: drop the oldest half
            oldest = sorted(self._hits.items(), key=lambda kv: kv[1][-1] if kv[1] else 0)
            for key, _ in oldest[: len(oldest) // 2]:
                self._hits.pop(key, None)


session_limiter = SlidingWindowCounter(SESSION_LIMIT_PER_MINUTE)


# ─── spend guard ──────────────────────────────────────────────────────────────
#
# IMPORTANT: one chat turn is NOT one Gemini call. The agent loop calls the
# model once, runs the tools it asked for, then calls it again with the tool
# results — so a typical turn costs 2–3 calls against the account-wide quota
# (free tier: 5 RPM / 20 requests per day). These ceilings therefore count
# actual Gemini API calls, not HTTP requests, and the counting happens in the
# client wrapper in server.py so nothing can slip past.

# Account-wide ceilings. Defaults sit just under the free-tier quota so the
# demo degrades with a friendly message instead of an upstream 429.
MAX_GEMINI_CALLS_PER_DAY = env_int("MAX_GEMINI_CALLS_PER_DAY", 18)      # free tier: 20
MAX_GEMINI_CALLS_PER_MINUTE = env_int("MAX_GEMINI_CALLS_PER_MINUTE", 4)  # free tier: 5 RPM
MAX_GEMINI_CALLS_PER_MONTH = env_int("MAX_GEMINI_CALLS_PER_MONTH", 400)
MAX_TOKENS_PER_DAY = env_int("MAX_TOKENS_PER_DAY", 1_000_000)
MAX_TOKENS_PER_MONTH = env_int("MAX_TOKENS_PER_MONTH", 10_000_000)

# A turn needs room for more than one call; require this much headroom before
# admitting a request, so we don't start a turn we can't finish.
CALLS_RESERVED_PER_TURN = env_int("CALLS_RESERVED_PER_TURN", 2)

BUDGET_STATE_FILE = env_str("BUDGET_STATE_FILE")  # optional persistence across restarts

# Reasons returned by BudgetGuard.check(), mapped to user-facing copy in server.py.
BUDGET_DAILY = "daily"
BUDGET_MONTHLY = "monthly"
BUDGET_MINUTE = "minute"

CHARS_PER_TOKEN = 4


def estimate_tokens(text: str) -> int:
    """Rough char/4 heuristic — good enough for a budget ceiling, and it never
    costs an extra API call the way a real count_tokens() would."""
    if not text:
        return 0
    return max(1, len(text) // CHARS_PER_TOKEN)


def estimate_history_tokens(history) -> int:
    """Conversation history is resent on every turn, so it is the part of the
    bill that grows silently. Walk it defensively — it holds SDK objects."""
    total = 0
    try:
        for content in history or []:
            for part in getattr(content, "parts", None) or []:
                text = getattr(part, "text", None)
                if text:
                    total += estimate_tokens(text)
                fn_response = getattr(part, "response", None) or getattr(part, "function_response", None)
                if fn_response is not None:
                    total += estimate_tokens(str(fn_response))
    except Exception:
        return total
    return total


class BudgetGuard:
    """In-memory Gemini-call and estimated-token counters.

    Daily/monthly counters roll over on the UTC boundary; the per-minute
    counter is a sliding window matching the free tier's RPM quota. State is
    optionally mirrored to a JSON file so a restart doesn't hand an abuser a
    fresh budget.
    """

    def __init__(self, state_file: str = ""):
        self._lock = threading.Lock()
        self._state_file = Path(state_file) if state_file else None
        self._day = ""
        self._month = ""
        self.day_calls = 0
        self.day_tokens = 0
        self.month_calls = 0
        self.month_tokens = 0
        self._minute_calls: deque[float] = deque()
        self._load()
        self._roll(self._now())

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    def _roll(self, now: datetime) -> None:
        day, month = now.strftime("%Y-%m-%d"), now.strftime("%Y-%m")
        if day != self._day:
            self._day, self.day_calls, self.day_tokens = day, 0, 0
        if month != self._month:
            self._month, self.month_calls, self.month_tokens = month, 0, 0

    def _calls_this_minute(self) -> int:
        cutoff = time.monotonic() - 60
        while self._minute_calls and self._minute_calls[0] < cutoff:
            self._minute_calls.popleft()
        return len(self._minute_calls)

    def check(self, reserve: int = CALLS_RESERVED_PER_TURN) -> tuple[bool, str]:
        """Called before a turn starts. `reserve` is how many Gemini calls the
        turn is expected to need. Returns (allowed, reason) where reason is one
        of the BUDGET_* constants."""
        with self._lock:
            self._roll(self._now())
            reserve = max(1, reserve)
            if 0 < MAX_GEMINI_CALLS_PER_DAY < self.day_calls + reserve:
                return False, BUDGET_DAILY
            if 0 < MAX_GEMINI_CALLS_PER_MONTH < self.month_calls + reserve:
                return False, BUDGET_MONTHLY
            if 0 < MAX_TOKENS_PER_DAY <= self.day_tokens:
                return False, BUDGET_DAILY
            if 0 < MAX_TOKENS_PER_MONTH <= self.month_tokens:
                return False, BUDGET_MONTHLY
            if 0 < MAX_GEMINI_CALLS_PER_MINUTE <= self._calls_this_minute():
                return False, BUDGET_MINUTE
            return True, ""

    def record_call(self) -> None:
        """One actual Gemini API call. Called from the counting client wrapper."""
        with self._lock:
            self._roll(self._now())
            self.day_calls += 1
            self.month_calls += 1
            self._minute_calls.append(time.monotonic())
            self._save()

    def record_tokens(self, tokens: int) -> None:
        if tokens <= 0:
            return
        with self._lock:
            self._roll(self._now())
            self.day_tokens += tokens
            self.month_tokens += tokens
            self._save()

    def snapshot(self) -> dict:
        with self._lock:
            self._roll(self._now())
            return {
                "day": self._day,
                "month": self._month,
                "gemini_calls_today": self.day_calls,
                "gemini_calls_day_limit": MAX_GEMINI_CALLS_PER_DAY,
                "gemini_calls_this_minute": self._calls_this_minute(),
                "gemini_calls_minute_limit": MAX_GEMINI_CALLS_PER_MINUTE,
                "gemini_calls_this_month": self.month_calls,
                "gemini_calls_month_limit": MAX_GEMINI_CALLS_PER_MONTH,
                "tokens_today_estimated": self.day_tokens,
                "tokens_day_limit": MAX_TOKENS_PER_DAY,
                "tokens_this_month_estimated": self.month_tokens,
                "tokens_month_limit": MAX_TOKENS_PER_MONTH,
            }

    # persistence is best-effort: a broken state file must never take the API down
    def _load(self) -> None:
        if not self._state_file or not self._state_file.is_file():
            return
        try:
            data = json.loads(self._state_file.read_text())
            self._day = str(data.get("day", ""))
            self._month = str(data.get("month", ""))
            self.day_calls = int(data.get("day_calls", 0))
            self.day_tokens = int(data.get("day_tokens", 0))
            self.month_calls = int(data.get("month_calls", 0))
            self.month_tokens = int(data.get("month_tokens", 0))
        except Exception:
            pass

    def _save(self) -> None:
        if not self._state_file:
            return
        try:
            self._state_file.parent.mkdir(parents=True, exist_ok=True)
            tmp = self._state_file.with_suffix(self._state_file.suffix + ".tmp")
            tmp.write_text(json.dumps({
                "day": self._day,
                "month": self._month,
                "day_calls": self.day_calls,
                "day_tokens": self.day_tokens,
                "month_calls": self.month_calls,
                "month_tokens": self.month_tokens,
            }))
            tmp.replace(self._state_file)
        except Exception:
            pass


budget = BudgetGuard(BUDGET_STATE_FILE)


# ─── session store bound ──────────────────────────────────────────────────────

MAX_SESSIONS = env_int("MAX_SESSIONS", 1000)


# ─── secret redaction ─────────────────────────────────────────────────────────

_SECRET_ENV_VARS = ("GEMINI_API_KEY", "REPLIERS_API_KEY", "GOOGLE_API_KEY")


def redact_secrets(text: str) -> str:
    """Strip any configured secret out of text before it is returned or logged.

    Upstream SDK/HTTP errors occasionally quote the request they made; this
    makes it structurally impossible for a key to ride along in a response
    body or a log line.
    """
    if not text:
        return text
    for name in _SECRET_ENV_VARS:
        value = os.getenv(name)
        if value and len(value) >= 8 and value in text:
            text = text.replace(value, "***redacted***")
    return text
