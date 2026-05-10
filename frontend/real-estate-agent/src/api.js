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

export async function resetSession() {
  if (sessionId) {
    await fetch(`${API_URL}/chat/${sessionId}`, { method: "DELETE" });
    sessionId = null;
  }
}
