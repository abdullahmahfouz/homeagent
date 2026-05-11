const API_URL = "http://localhost:8000";

// Non-streaming — kept for parity / debugging.
export async function sendMessage(message, sessionId = null) {
  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId }),
  });
  return res.json();
}

// Streaming. Caller passes the per-chat sessionId (null on first turn) and an
// event handler. The `done` event carries the session_id the backend assigned.
export async function streamMessage(message, onEvent, { sessionId = null } = {}) {
  const res = await fetch(`${API_URL}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId }),
  });
  if (!res.ok || !res.body) throw new Error(`stream failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  const dispatch = (line) => {
    if (!line.trim()) return;
    let event;
    try { event = JSON.parse(line); } catch { return; }
    onEvent(event);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) !== -1) {
      dispatch(buf.slice(0, nl));
      buf = buf.slice(nl + 1);
    }
  }
  if (buf.trim()) dispatch(buf);
}

export async function resetSession(sessionId) {
  if (!sessionId) return;
  try {
    await fetch(`${API_URL}/chat/${sessionId}`, { method: "DELETE" });
  } catch {}
}
