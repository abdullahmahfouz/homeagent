import { useState, useRef, useEffect, useMemo } from "react";
import { streamMessage, resetSession } from "./api.js";
import { parseAgentResponse, mergeListingData } from "./lib/parse.js";
import {
  loadSessions, saveSessions, loadCurrentId, saveCurrentId,
  newSession, deriveTitle,
} from "./lib/storage.js";
import { Icons } from "./components/Icons.jsx";
import { ListingMap } from "./components/ListingMap.jsx";
import { MortgageModal } from "./components/MortgageModal.jsx";
import { AssistantTurn } from "./components/AssistantTurn.jsx";
import { StripCard } from "./components/StripCard.jsx";
import { ChatHistory } from "./components/ChatHistory.jsx";
import "./styles.css";

const SUGGESTIONS = [
  { icon: <Icons.Home/>,     title: "Family home in Austin",   text: "3-bed under $900k with good schools and a short downtown commute" },
  { icon: <Icons.Building/>, title: "Tampa waterfront condo",  text: "2-bed condo near downtown Tampa under $600k, walkable" },
  { icon: <Icons.Trend/>,    title: "Investment in Charlotte", text: "Townhouses under $400k with strong rental yield" },
  { icon: <Icons.Map/>,      title: "Nashville detached",      text: "3-bed detached in East Nashville under $700k" },
];

const THINK_STEPS = ["Querying MLS", "Pulling listings", "Calculating scores", "Ranking results"];

function ThinkingBubble({ step }) {
  return (
    <div className="thinking">
      <div className="think-dots"><span/><span/><span/></div>
      <span>{step || "Thinking"}</span>
    </div>
  );
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
};

// ─── Sessions bootstrap ──────────────────────────────────────────────────────
function bootstrapSessions() {
  const stored = loadSessions();
  if (stored.length > 0) return stored;
  return [newSession()];
}
function bootstrapCurrentId(sessions) {
  const stored = loadCurrentId();
  if (stored && sessions.some(s => s.id === stored)) return stored;
  return sessions[0]?.id ?? null;
}

export default function HomeAgent() {
  const [sessions, setSessions] = useState(bootstrapSessions);
  const [currentSessionId, setCurrentSessionId] = useState(() => bootstrapCurrentId(sessions));

  // Live state for the active chat (loaded from session, written back on change)
  const [messages, setMessages]                 = useState([]);
  const [properties, setProperties]             = useState([]);
  const [activeProperty, setActiveProperty]     = useState(null);
  const [serverSessionId, setServerSessionId]   = useState(null);

  const [input, setInput]                       = useState('');
  const [loading, setLoading]                   = useState(false);
  const [thinkStep, setThinkStep]               = useState('');
  const [mortgageModal, setMortgageModal]       = useState(null);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [mobileView, setMobileView]             = useState('chat'); // 'chat' | 'map'

  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);
  const genRef         = useRef(0);
  const lastLoadedRef  = useRef(null);

  // Load session into live state when the current id changes
  useEffect(() => {
    const s = sessions.find(s => s.id === currentSessionId);
    if (!s) return;
    setMessages(s.messages || []);
    setProperties(s.properties || []);
    setActiveProperty((s.properties || []).find(p => p.id === s.activePropertyId) || null);
    setServerSessionId(s.serverSessionId || null);
    lastLoadedRef.current = currentSessionId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionId]);

  // Persist live state back into the current session record
  useEffect(() => {
    if (!currentSessionId || lastLoadedRef.current !== currentSessionId) return;
    setSessions(prev => {
      if (!prev.find(s => s.id === currentSessionId)) return prev;
      return prev.map(s => s.id === currentSessionId
        ? {
            ...s,
            messages, properties,
            activePropertyId: activeProperty?.id ?? null,
            serverSessionId,
            title: s.title === "New chat" && messages.length > 0
              ? deriveTitle(messages)
              : s.title,
            updatedAt: messages.length > 0 ? Date.now() : s.updatedAt,
          }
        : s
      );
    });
  }, [messages, properties, activeProperty, serverSessionId, currentSessionId]);

  // Persist sessions + current id to localStorage whenever they change
  useEffect(() => { saveSessions(sessions); }, [sessions]);
  useEffect(() => { saveCurrentId(currentSessionId); }, [currentSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ─── Session ops ──────────────────────────────────────────────────────────
  const handleNewChat = () => {
    genRef.current += 1;
    setLoading(false);
    const s = newSession();
    setSessions(prev => [s, ...prev]);
    setCurrentSessionId(s.id);
    setInput('');
    setMortgageModal(null);
  };

  const handleSelectChat = (id) => {
    setHistoryDrawerOpen(false);
    if (id === currentSessionId) return;
    genRef.current += 1;
    setLoading(false);
    setCurrentSessionId(id);
    setMortgageModal(null);
  };

  const handleDeleteChat = async (id) => {
    const target = sessions.find(s => s.id === id);
    if (target?.serverSessionId) resetSession(target.serverSessionId);

    const remaining = sessions.filter(s => s.id !== id);
    if (id === currentSessionId) {
      if (remaining.length === 0) {
        const fresh = newSession();
        setSessions([fresh]);
        setCurrentSessionId(fresh.id);
      } else {
        setSessions(remaining);
        setCurrentSessionId(remaining[0].id);
      }
    } else {
      setSessions(remaining);
    }
  };

  const focusProperty = (prop) => setActiveProperty(prop);
  const openMortgage  = (prop) => { setActiveProperty(prop); setMortgageModal(prop); };

  // ─── Send ─────────────────────────────────────────────────────────────────
  const sendMessage = async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const myGen = ++genRef.current;
    setMessages(prev => [...prev, { role: 'user', content }]);
    setLoading(true);

    let stepIdx = 0;
    setThinkStep(THINK_STEPS[0]);
    const stepInterval = setInterval(() => {
      stepIdx = (stepIdx + 1) % THINK_STEPS.length;
      setThinkStep(THINK_STEPS[stepIdx]);
    }, 1100);

    let streamingText = "";
    let messageStarted = false;
    const toolEvents = [];

    const isAlive = () => myGen === genRef.current;
    const ensureMessage = () => {
      if (messageStarted || !isAlive()) return;
      messageStarted = true;
      clearInterval(stepInterval);
      setLoading(false);
      setMessages(prev => [...prev, {
        role: 'assistant', content: "", streaming: true, toolListings: [], toolEvents: [...toolEvents],
      }]);
    };
    const patchLast = (patch) => {
      if (!isAlive()) return;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== 'assistant') return prev;
        return [...prev.slice(0, -1), { ...last, ...patch }];
      });
    };

    try {
      await streamMessage(content, (event) => {
        if (!isAlive()) return;
        if (event.type === "tool_start") {
          toolEvents.push({ name: event.name, args: event.args, status: 'running', result: null });
          ensureMessage();
          patchLast({ toolEvents: [...toolEvents] });
        } else if (event.type === "tool_end") {
          for (let i = toolEvents.length - 1; i >= 0; i--) {
            if (toolEvents[i].name === event.name && toolEvents[i].status === 'running') {
              toolEvents[i] = { ...toolEvents[i], status: 'done', result: event.result };
              break;
            }
          }
          ensureMessage();
          patchLast({ toolEvents: [...toolEvents] });
        } else if (event.type === "text") {
          streamingText += event.chunk;
          ensureMessage();
          patchLast({ content: streamingText });
        } else if (event.type === "done") {
          clearInterval(stepInterval);
          setLoading(false);
          if (event.session_id && isAlive()) setServerSessionId(event.session_id);

          const toolListings = toolEvents
            .filter(e => e.name === 'search_listings' && e.result && Array.isArray(e.result.listings))
            .flatMap(e => e.result.listings)
            .filter(l => l && l.price);

          if (!messageStarted) {
            if (isAlive()) {
              setMessages(prev => [...prev, {
                role: 'assistant', content: "", streaming: false, toolListings, toolEvents: [...toolEvents],
              }]);
            }
          } else {
            patchLast({ streaming: false, toolListings, toolEvents: [...toolEvents] });
          }

          const { listings: parsedListings } = parseAgentResponse(streamingText);
          const finalListings = mergeListingData(parsedListings, toolListings);
          if (finalListings.length > 0 && isAlive()) {
            setProperties(finalListings);
            setActiveProperty(finalListings[0]);
          }
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      }, { sessionId: serverSessionId });
    } catch (err) {
      clearInterval(stepInterval);
      setLoading(false);
      if (!isAlive()) return;
      const fail = "I couldn't reach the local agent. Make sure the API is running on port 8000.\n<<<FOLLOWUPS:[\"Try again\",\"Check connection\"]>>>";
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && last.streaming) {
          return [...prev.slice(0, -1), { ...last, content: fail, streaming: false }];
        }
        return [...prev, { role: 'assistant', content: fail }];
      });
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    [sessions]
  );

  const hasMessages = messages.length > 0;

  return (
    <div className="app">

      <header className="top-bar">
        <button
          className="menu-btn"
          onClick={() => setHistoryDrawerOpen(true)}
          title="Show chats"
        >
          <Icons.Menu/>
        </button>

        <div className="brand">
          <span className="brand-mark"><Icons.Logo/></span>
          <span className="brand-name">HomeAgent</span>
          <span className="brand-tag">beta</span>
        </div>

        <div className="top-meta hide-mobile">
          <span className="dot"/> Live MLS · Repliers
        </div>
        {properties.length > 0 && (
          <div className="top-meta count-chip hide-mobile">
            {properties.length} listing{properties.length === 1 ? '' : 's'}
          </div>
        )}

        {/* Mobile-only view switcher */}
        <div className="view-tabs">
          <button
            className={`view-tab ${mobileView === 'chat' ? 'active' : ''}`}
            onClick={() => setMobileView('chat')}
          >Chat</button>
          <button
            className={`view-tab ${mobileView === 'map' ? 'active' : ''}`}
            onClick={() => setMobileView('map')}
          >
            Map{properties.length > 0 && <span className="view-tab-badge">{properties.length}</span>}
          </button>
        </div>

        <div className="top-actions">
          <button className="new-chat-btn" onClick={handleNewChat}>
            <Icons.Plus/><span className="hide-mobile">New chat</span>
          </button>
          {activeProperty && (
            <button className="ghost hide-mobile" onClick={() => setMortgageModal(activeProperty)}>
              Mortgage
            </button>
          )}
          <div className="avatar-chip hide-tight" title="Demo session">AM</div>
        </div>
      </header>

      <div className={`below view-${mobileView} ${historyDrawerOpen ? 'drawer-open' : ''}`}>

        {/* Backdrop for drawer (mobile/tablet only) */}
        {historyDrawerOpen && (
          <div className="drawer-backdrop" onClick={() => setHistoryDrawerOpen(false)}/>
        )}

        {/* Left: chat history (acts as a drawer on narrow screens) */}
        <ChatHistory
          sessions={sortedSessions}
          currentId={currentSessionId}
          onSelect={handleSelectChat}
          onNew={() => { handleNewChat(); setHistoryDrawerOpen(false); }}
          onDelete={handleDeleteChat}
        />

        {/* Middle: chat */}
        <aside className="chat-panel">
          {!hasMessages ? (
            <div className="welcome">
              <div className="welcome-inner">
                <h1 className="greeting">
                  Good {greeting()}.<br/>
                  Where are you looking <span className="accent">today</span>?
                </h1>
                <p className="greeting-sub">
                  Conversational property research powered by live US MLS data. Describe your search in plain English — budget, location, lifestyle — and I'll pull ranked listings, plot them on the map, and price out the mortgage.
                </p>
                <div className="quick-grid">
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} className="quick" onClick={() => sendMessage(s.text)}>
                      <span className="quick-title">
                        <span className="quick-icon">{s.icon}</span>
                        {s.title}
                      </span>
                      <span className="quick-text">{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((msg, i) => (
                msg.role === 'user' ? (
                  <div key={i} className="turn">
                    <div className="user-row">
                      <div className="user-msg">{msg.content}</div>
                    </div>
                  </div>
                ) : (
                  <AssistantTurn
                    key={i}
                    msg={msg}
                    activeId={activeProperty?.id}
                    onPropertyClick={focusProperty}
                    onFollowup={sendMessage}
                  />
                )
              ))}
              {loading && (
                <div className="turn">
                  <div className="assistant-row">
                    <div className="avatar"><Icons.Spark/></div>
                    <div className="assistant-body">
                      <div className="assistant-name">
                        HomeAgent <span className="stamp">working…</span>
                      </div>
                      <ThinkingBubble step={thinkStep}/>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef}/>
            </div>
          )}

          <div className="input-region">
            <div className="input-wrap">
              <div className="input-shell">
                <textarea
                  ref={textareaRef}
                  className="chat-input"
                  placeholder="Ask about Austin, Tampa, Charlotte, Nashville, Denver…"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  rows={1}
                  onInput={e => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
                  }}
                />
                <button className="send-btn" onClick={() => sendMessage()} disabled={!input.trim() || loading}>
                  <Icons.ArrowUp/>
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Right: map + strip */}
        <main className="map-region">
          <div className="map-main">
            <ListingMap
              properties={properties}
              activeId={activeProperty?.id}
              onPinClick={focusProperty}
            />
          </div>
          <div className={`strip ${properties.length === 0 ? 'empty' : ''}`}>
            {properties.length > 0 ? (
              properties.map((p, i) => (
                <StripCard
                  key={p.id || i}
                  prop={p}
                  active={activeProperty?.id === p.id}
                  onClick={focusProperty}
                />
              ))
            ) : (
              <div className="strip-empty">
                Listings will appear here. Click pins on the map or cards to focus a property.
              </div>
            )}
          </div>
        </main>
      </div>

      {mortgageModal && (
        <MortgageModal property={mortgageModal} onClose={() => setMortgageModal(null)}/>
      )}
    </div>
  );
}
