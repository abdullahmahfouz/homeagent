// Dev: defaults to the local backend on :8000.
// Prod (single-service deploy): empty string → fetch hits the same origin that served the page.
// Override with VITE_API_URL if you ever split the services again.
const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:8000" : "");

// The backend answers 429 (rate limited) / 503 (daily budget) / 413 (message too
// long) with a friendly `detail` string. Surface it verbatim instead of the
// generic "can't reach the agent" fallback.
async function limitError(res) {
  let detail = "";
  try {
    const body = await res.json();
    detail = body?.detail || body?.error || "";
  } catch {}
  if (!detail) return null;
  const err = new Error(detail);
  err.status = res.status;
  err.userFacing = true;
  return err;
}

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
  if (!res.ok) throw (await limitError(res)) || new Error(`stream failed: ${res.status}`);
  if (!res.body) throw new Error(`stream failed: ${res.status}`);

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
