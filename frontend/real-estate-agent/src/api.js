const API_URL = "http://localhost:8000";

let sessionId = null;

export async function sendMessage(message) {
  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId })
  });

  const data = await res.json();
  sessionId = data.session_id;
  return data;
}

export async function streamMessage(message, onEvent) {
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
    if (event.type === "done" && event.session_id) sessionId = event.session_id;
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

export async function resetSession() {
  if (sessionId) {
    await fetch(`${API_URL}/chat/${sessionId}`, { method: "DELETE" });
    sessionId = null;
  }
}
