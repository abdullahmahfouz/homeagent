"""
HomeAgent FastAPI server.

Run:
    uvicorn server:app --reload --port 8000
"""

import os
import sys
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from pydantic import BaseModel

from agent import run_agent

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


@app.delete("/chat/{session_id}")
def reset(session_id: str):
    SESSIONS.pop(session_id, None)
    return {"status": "ok"}
