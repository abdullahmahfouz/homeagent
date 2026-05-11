import { useState, useRef, useEffect } from "react";
import { streamMessage, resetSession } from "./api.js";
import { parseAgentResponse, mergeListingData } from "./lib/parse.js";
import { Icons } from "./components/Icons.jsx";
import { SideCard } from "./components/ListingCards.jsx";
import { ListingMap } from "./components/ListingMap.jsx";
import { MortgageModal } from "./components/MortgageModal.jsx";
import { AssistantTurn } from "./components/AssistantTurn.jsx";
import "./styles.css";

const SUGGESTIONS = [
  { icon: <Icons.Home/>,     title: "Family home in Austin",   text: "3-bed house under $900k with good schools" },
  { icon: <Icons.Building/>, title: "Condo in Tampa",          text: "2-bed condo near downtown, walkable, under $500k" },
  { icon: <Icons.Trend/>,    title: "Investment in Charlotte", text: "Townhouses under $400k with strong rental yield" },
  { icon: <Icons.Map/>,      title: "Explore Nashville",       text: "Show me 3-bed homes in East Nashville under $700k" },
];

const THINK_STEPS = [
  "Querying MLS",
  "Pulling listings",
  "Calculating scores",
  "Ranking results",
];

function ThinkingBubble({ step }) {
  return (
    <div className="thinking">
      <div className="think-dots"><span/><span/><span/></div>
      <span>{step || "Thinking"}</span>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}

export default function HomeAgent() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [thinkStep, setThinkStep] = useState('');
  const [properties, setProperties] = useState([]);
  const [activeProperty, setActiveProperty] = useState(null);
  const [mortgageModal, setMortgageModal] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const openMortgage  = (prop) => { setActiveProperty(prop); setMortgageModal(prop); };
  const focusProperty = (prop) => setActiveProperty(prop);

  const sendMessage = async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

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

    const ensureMessage = () => {
      if (messageStarted) return;
      messageStarted = true;
      clearInterval(stepInterval);
      setLoading(false);
      setMessages(prev => [...prev, {
        role: 'assistant', content: "", streaming: true, toolListings: [], toolEvents: [...toolEvents],
      }]);
    };
    const patchLast = (patch) => {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== 'assistant') return prev;
        return [...prev.slice(0, -1), { ...last, ...patch }];
      });
    };

    try {
      await streamMessage(content, (event) => {
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

          const toolListings = toolEvents
            .filter(e => e.name === 'search_listings' && e.result && Array.isArray(e.result.listings))
            .flatMap(e => e.result.listings)
            .filter(l => l && l.price);

          if (!messageStarted) {
            setMessages(prev => [...prev, {
              role: 'assistant', content: "", streaming: false, toolListings, toolEvents: [...toolEvents],
            }]);
          } else {
            patchLast({ streaming: false, toolListings, toolEvents: [...toolEvents] });
          }

          const { listings: parsedListings } = parseAgentResponse(streamingText);
          const finalListings = mergeListingData(parsedListings, toolListings);
          if (finalListings.length > 0) {
            setProperties(finalListings);
            setActiveProperty(finalListings[0]);
          }
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      });
    } catch (err) {
      clearInterval(stepInterval);
      setLoading(false);
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleNewChat = async () => {
    try { await resetSession(); } catch {}
    setMessages([]);
    setProperties([]);
    setActiveProperty(null);
    setInput('');
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="app">

      <aside className="sidebar">
        <div className="side-head">
          <div className="brand">
            <span className="brand-mark"><Icons.Logo/></span>
            <span className="brand-name">HomeAgent</span>
          </div>
          <button className="new-chat" onClick={handleNewChat} title="New chat">
            <Icons.Plus/>
          </button>
        </div>

        {properties.length > 0 && (
          <ListingMap
            properties={properties}
            activeId={activeProperty?.id}
            onPinClick={focusProperty}
          />
        )}

        <div className="side-section">
          <div className="side-label">Shortlist</div>
        </div>

        <div className="side-list">
          {properties.length > 0 ? (
            properties.map((p, i) => (
              <SideCard
                key={p.id || i}
                prop={p}
                active={activeProperty?.id === p.id}
                onClick={focusProperty}
              />
            ))
          ) : (
            <div className="side-empty">
              Tell HomeAgent what you're looking for. Matching listings will collect here.
            </div>
          )}
        </div>

        <div className="side-foot">
          <span className="live-pill">
            <span className="live-dot"/>
            <span>Live MLS</span>
          </span>
          <span>v0.2</span>
        </div>
      </aside>

      <div className="chat">
        <div className="chat-head">
          <div className="chat-title">HomeAgent</div>
          <div className="chat-sub">conversational property research</div>
          {activeProperty && (
            <button className="ghost" onClick={() => setMortgageModal(activeProperty)}>
              Mortgage calc
            </button>
          )}
        </div>

        {!hasMessages ? (
          <div className="welcome">
            <div className="welcome-inner">
              <h1 className="greeting">
                Good {greeting()}.<br/>
                What are you looking for <span className="accent">today</span>?
              </h1>
              <p className="greeting-sub">
                Describe your search in plain English — budget, location, lifestyle. I'll pull live listings and rank them for you.
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
                  onPropertyClick={openMortgage}
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
                placeholder="Ask about Austin, Tampa, Charlotte, Nashville…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                rows={1}
                onInput={e => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                }}
              />
              <button className="send-btn" onClick={() => sendMessage()} disabled={!input.trim() || loading}>
                <Icons.ArrowUp/>
              </button>
            </div>
            <div className="input-foot">
              Live MLS data via Repliers · Press <kbd>Enter</kbd> to send
            </div>
          </div>
        </div>
      </div>

      {mortgageModal && (
        <MortgageModal property={mortgageModal} onClose={() => setMortgageModal(null)}/>
      )}
    </div>
  );
}
