// Persistent chat sessions, kept in localStorage. Each session bundles its
// message history, active listings, and the backend's session_id (so we can
// resume the same Gemini context).

const SESSIONS_KEY = "homeagent.sessions.v1";
const CURRENT_KEY  = "homeagent.currentSessionId.v1";

const safeParse = (s, fallback) => {
  try { return JSON.parse(s); } catch { return fallback; }
};

export function loadSessions() {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(SESSIONS_KEY);
  const arr = safeParse(raw, []);
  return Array.isArray(arr) ? arr : [];
}

export function saveSessions(sessions) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (e) {
    // Quota or serialization error — silently drop. Demo shouldn't crash.
    console.warn("session save failed:", e);
  }
}

export function loadCurrentId() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(CURRENT_KEY);
}

export function saveCurrentId(id) {
  if (typeof localStorage === "undefined") return;
  if (id) localStorage.setItem(CURRENT_KEY, id);
  else    localStorage.removeItem(CURRENT_KEY);
}

const cryptoId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "s_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
};

export function newSession() {
  return {
    id: cryptoId(),
    serverSessionId: null,
    title: "New chat",
    messages: [],
    properties: [],
    activePropertyId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Format a session's first user message into a title (≤ 42 chars).
export function deriveTitle(messages) {
  const first = messages.find(m => m.role === "user");
  if (!first) return "New chat";
  const t = first.content.trim().replace(/\s+/g, " ");
  return t.length > 42 ? t.slice(0, 42) + "…" : t;
}

// Friendly relative time for the history sidebar.
export function relativeTime(ts) {
  const now = Date.now();
  const diff = Math.max(0, now - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
