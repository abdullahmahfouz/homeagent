import { useState, useRef, useEffect } from "react";
import { sendMessage as apiSend } from "./api.js";

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');

  :root {
    --bg: #0f0e0c;
    --surface: #1a1916;
    --surface2: #232220;
    --border: rgba(255,255,255,0.08);
    --border2: rgba(255,255,255,0.14);
    --cream: #f0ead8;
    --cream-dim: rgba(240,234,216,0.55);
    --cream-faint: rgba(240,234,216,0.12);
    --accent: #c8a96e;
    --accent-dim: rgba(200,169,110,0.2);
    --green: #5a9e78;
    --green-dim: rgba(90,158,120,0.18);
    --red: #c06060;
    --text: #e8e2d4;
    --text-dim: rgba(232,226,212,0.5);
    --text-faint: rgba(232,226,212,0.28);
    --radius: 12px;
    --radius-sm: 8px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    line-height: 1.6;
    min-height: 100vh;
  }

  .app {
    display: grid;
    grid-template-columns: 340px 1fr;
    grid-template-rows: 56px 1fr;
    height: 100vh;
    overflow: hidden;
  }

  /* ── Header ── */
  .header {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    padding: 0 24px;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
    gap: 12px;
    z-index: 10;
  }
  .header-logo {
    font-family: 'Playfair Display', serif;
    font-size: 20px;
    font-weight: 600;
    color: var(--cream);
    letter-spacing: -0.3px;
  }
  .header-logo span { color: var(--accent); font-style: italic; }
  .header-badge {
    font-size: 11px;
    font-weight: 500;
    padding: 3px 8px;
    border-radius: 20px;
    background: var(--accent-dim);
    color: var(--accent);
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .header-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .status-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--green);
    box-shadow: 0 0 6px var(--green);
  }
  .status-label { font-size: 12px; color: var(--text-dim); }

  /* ── Sidebar ── */
  .sidebar {
    border-right: 1px solid var(--border);
    overflow-y: auto;
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: var(--surface);
  }
  .sidebar::-webkit-scrollbar { width: 4px; }
  .sidebar::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }

  .sidebar-section { display: flex; flex-direction: column; gap: 8px; }
  .sidebar-label {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--text-faint);
    padding: 0 4px;
  }

  /* Property card */
  .property-card {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    position: relative;
    overflow: hidden;
  }
  .property-card:hover { border-color: var(--border2); background: #2a2825; }
  .property-card.active { border-color: var(--accent); }
  .property-card.active::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--accent);
    border-radius: 3px 0 0 3px;
  }

  .prop-img {
    width: 100%; height: 120px;
    border-radius: var(--radius-sm);
    object-fit: cover;
    margin-bottom: 10px;
    background: var(--surface);
    display: flex; align-items: center; justify-content: center;
    font-size: 32px;
  }
  .prop-address {
    font-size: 13px;
    font-weight: 500;
    color: var(--cream);
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .prop-neighborhood {
    font-size: 12px;
    color: var(--text-dim);
    margin-bottom: 8px;
  }
  .prop-meta {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .prop-chip {
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 20px;
    background: var(--cream-faint);
    color: var(--cream-dim);
  }
  .prop-price {
    font-family: 'Playfair Display', serif;
    font-size: 16px;
    color: var(--accent);
    font-weight: 600;
    margin-bottom: 6px;
  }
  .prop-score {
    position: absolute;
    top: 10px; right: 10px;
    font-size: 11px;
    font-weight: 500;
    padding: 3px 8px;
    border-radius: 20px;
  }
  .prop-score.high { background: var(--green-dim); color: var(--green); }
  .prop-score.mid { background: var(--accent-dim); color: var(--accent); }

  .empty-sidebar {
    text-align: center;
    padding: 40px 16px;
    color: var(--text-faint);
    font-size: 13px;
    line-height: 1.8;
  }
  .empty-sidebar .icon { font-size: 28px; margin-bottom: 10px; opacity: 0.4; }

  /* ── Chat area ── */
  .chat-area {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 28px 32px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .messages::-webkit-scrollbar { width: 4px; }
  .messages::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }

  /* Welcome screen */
  .welcome {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    text-align: center;
    gap: 16px;
  }
  .welcome-title {
    font-family: 'Playfair Display', serif;
    font-size: 36px;
    font-weight: 400;
    color: var(--cream);
    line-height: 1.2;
    max-width: 480px;
  }
  .welcome-title em { font-style: italic; color: var(--accent); }
  .welcome-sub {
    font-size: 15px;
    color: var(--text-dim);
    max-width: 400px;
  }
  .suggestion-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 12px;
    max-width: 560px;
    width: 100%;
  }
  .suggestion {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px 16px;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    font-size: 13px;
    color: var(--text-dim);
    font-family: 'DM Sans', sans-serif;
  }
  .suggestion:hover { border-color: var(--accent); color: var(--text); background: var(--surface2); }
  .suggestion strong { display: block; font-size: 13px; color: var(--cream); font-weight: 500; margin-bottom: 4px; }

  /* Messages */
  .message { display: flex; flex-direction: column; gap: 4px; max-width: 760px; width: 100%; margin: 0 auto; }
  .message.user { align-items: flex-end; }
  .message.assistant { align-items: flex-start; }

  .msg-bubble {
    padding: 12px 16px;
    border-radius: var(--radius);
    font-size: 14px;
    line-height: 1.7;
    max-width: 85%;
  }
  .message.user .msg-bubble {
    background: var(--accent);
    color: #1a1408;
    font-weight: 400;
    border-radius: var(--radius) var(--radius) 4px var(--radius);
  }
  .message.assistant .msg-bubble {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius) var(--radius) var(--radius) 4px;
    width: 100%;
    max-width: 100%;
  }

  .msg-label { font-size: 11px; color: var(--text-faint); padding: 0 4px; }

  /* Thinking indicator */
  .thinking {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius) var(--radius) var(--radius) 4px;
    font-size: 13px;
    color: var(--text-dim);
    width: fit-content;
  }
  .think-dots { display: flex; gap: 4px; }
  .think-dots span {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--accent);
    animation: bounce 1.2s infinite;
  }
  .think-dots span:nth-child(2) { animation-delay: 0.2s; }
  .think-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes bounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
    40% { transform: translateY(-5px); opacity: 1; }
  }

  /* Tool call badge */
  .tool-call {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    padding: 4px 10px;
    background: var(--cream-faint);
    border: 1px solid var(--border);
    border-radius: 20px;
    color: var(--cream-dim);
    margin-bottom: 8px;
    font-weight: 500;
  }
  .tool-call .tool-icon { opacity: 0.7; }

  /* Agent response formatting */
  .agent-section { margin-bottom: 14px; }
  .agent-section:last-child { margin-bottom: 0; }
  .agent-section h3 {
    font-family: 'Playfair Display', serif;
    font-size: 16px;
    font-weight: 600;
    color: var(--cream);
    margin-bottom: 8px;
  }
  .agent-section p { font-size: 14px; line-height: 1.7; color: var(--text); }

  /* Inline property result */
  .inline-property {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    margin: 6px 0;
    display: flex;
    gap: 12px;
    align-items: flex-start;
    cursor: pointer;
    transition: border-color 0.2s;
  }
  .inline-property:hover { border-color: var(--accent); }
  .inline-prop-rank {
    font-family: 'Playfair Display', serif;
    font-size: 20px;
    color: var(--accent);
    opacity: 0.7;
    min-width: 24px;
    line-height: 1;
  }
  .inline-prop-info { flex: 1; }
  .inline-prop-addr { font-size: 13px; font-weight: 500; color: var(--cream); margin-bottom: 2px; }
  .inline-prop-detail { font-size: 12px; color: var(--text-dim); line-height: 1.5; }
  .inline-prop-price { font-family: 'Playfair Display', serif; font-size: 15px; color: var(--accent); white-space: nowrap; }

  /* Follow-up chips */
  .followup-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .followup-chip {
    font-size: 12px;
    padding: 5px 12px;
    border: 1px solid var(--border2);
    border-radius: 20px;
    color: var(--text-dim);
    cursor: pointer;
    transition: all 0.15s;
    background: transparent;
    font-family: 'DM Sans', sans-serif;
  }
  .followup-chip:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }

  /* ── Input bar ── */
  .input-bar {
    padding: 16px 24px 20px;
    border-top: 1px solid var(--border);
    background: var(--bg);
  }
  .input-row {
    display: flex;
    gap: 10px;
    align-items: flex-end;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 10px 12px 10px 16px;
    transition: border-color 0.2s;
    max-width: 760px;
    margin: 0 auto;
  }
  .input-row:focus-within { border-color: var(--border2); }
  .chat-input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: var(--text);
    font-size: 14px;
    font-family: 'DM Sans', sans-serif;
    resize: none;
    min-height: 24px;
    max-height: 120px;
    line-height: 1.6;
  }
  .chat-input::placeholder { color: var(--text-faint); }
  .send-btn {
    width: 36px; height: 36px;
    border-radius: 8px;
    background: var(--accent);
    border: none;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    transition: opacity 0.2s, transform 0.1s;
    color: #1a1408;
    font-size: 16px;
  }
  .send-btn:hover { opacity: 0.9; }
  .send-btn:active { transform: scale(0.95); }
  .send-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  /* Mortgage modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(10,9,8,0.8);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    backdrop-filter: blur(4px);
  }
  .modal {
    background: var(--surface);
    border: 1px solid var(--border2);
    border-radius: 16px;
    padding: 28px;
    width: 100%;
    max-width: 440px;
  }
  .modal-title {
    font-family: 'Playfair Display', serif;
    font-size: 22px;
    color: var(--cream);
    margin-bottom: 20px;
  }
  .modal-field { margin-bottom: 16px; }
  .modal-field label { display: block; font-size: 12px; color: var(--text-dim); margin-bottom: 6px; letter-spacing: 0.3px; }
  .modal-field input {
    width: 100%;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    color: var(--text);
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }
  .modal-field input:focus { border-color: var(--accent); }
  .modal-result {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 16px;
    margin-top: 16px;
  }
  .modal-result-row {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    padding: 4px 0;
    color: var(--text-dim);
  }
  .modal-result-row span:last-child { color: var(--cream); font-weight: 500; }
  .modal-result-row.total { border-top: 1px solid var(--border); margin-top: 8px; padding-top: 12px; }
  .modal-result-row.total span:last-child { color: var(--accent); font-family: 'Playfair Display', serif; font-size: 18px; }
  .modal-close {
    width: 100%; margin-top: 20px;
    background: var(--accent-dim);
    border: 1px solid var(--accent);
    color: var(--accent);
    padding: 10px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    transition: background 0.2s;
  }
  .modal-close:hover { background: var(--accent); color: #1a1408; }
`;

// ─── Mock property data (in real app: from Repliers.io) ───────────────────────
const MOCK_LISTINGS = [
  {
    id: 1, rank: 1,
    address: "47 Rosedale Valley Rd", neighborhood: "Rosedale",
    price: 789000, beds: 3, baths: 2, sqft: 1340,
    walkScore: 82, transitScore: 78,
    commute: "28 min to downtown",
    schools: "Rosedale Jr PS (9.1/10)",
    emoji: "🏡",
    why: "Best value in the shortlist. Under budget with strong walk score and direct subway access.",
    score: 94
  },
  {
    id: 2, rank: 2,
    address: "1205 Bathurst St #412", neighborhood: "Annex",
    price: 729000, beds: 3, baths: 2, sqft: 1180,
    walkScore: 91, transitScore: 92,
    commute: "22 min to downtown",
    schools: "Huron St PS (8.6/10)",
    emoji: "🏢",
    why: "Highest transit score. Walkable to Bloor shops and cafes. Condo fees ~$480/mo.",
    score: 88
  },
  {
    id: 3, rank: 3,
    address: "312 Broadview Ave", neighborhood: "Riverdale",
    price: 845000, beds: 3, baths: 2, sqft: 1520,
    walkScore: 76, transitScore: 71,
    commute: "31 min to downtown",
    schools: "Riverdale Collegiate (8.2/10)",
    emoji: "🏠",
    why: "Most space per dollar. Slightly over budget but strong school catchment.",
    score: 81
  }
];

// ─── System prompt for the agent ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are HomeAgent, an elite real estate research assistant specializing in the Greater Toronto Area. You help buyers find properties through conversational search.

You have access to these capabilities (simulate them realistically when called):
- search_listings(query, maxPrice, beds, neighborhood) → returns ranked property results
- get_neighborhood_scores(address) → returns walkScore, transitScore, school ratings, avg commute
- calculate_mortgage(price, downPayment, amortization, rate) → returns monthly payment breakdown
- get_market_trends(neighborhood) → returns avg price, YoY change, days on market, price per sqft

CRITICAL BEHAVIOR:
1. When a user describes their home search, ALWAYS call the relevant tools and return STRUCTURED results
2. Format property results using this EXACT JSON block in your response (parseable):
   <<<LISTINGS:[{"id":1,"address":"...","neighborhood":"...","price":000000,"beds":0,"baths":0,"sqft":0,"walkScore":0,"transitScore":0,"commute":"...","schools":"...","emoji":"🏠","why":"...","score":0}]>>>
3. After the listings block, write a brief natural explanation (2-3 sentences)
4. End EVERY response with a <<<FOLLOWUPS:["question 1","question 2","question 3"]>>> block

For tool calls, narrate them naturally: "Searching MLS listings... pulling neighborhood scores... running affordability check..."

Be specific and confident. Use real Toronto neighborhood names, real TTC commute times, realistic 2024-2025 prices (condos $600-900k, semis $800k-1.2M, detached $1.1M+). 

If the user asks follow-up questions (show cheaper, different area, can I afford this), run new tool calls with updated params and return fresh listings.

For mortgage questions, return: <<<MORTGAGE:{"price":0,"down":0,"monthly":0,"cmhc":0,"total":0}>>>

Keep tone warm, expert, and concise. Never say you're an AI or that you can't access real data — simulate it confidently.`;

// ─── Parse agent response ─────────────────────────────────────────────────────
function parseAgentResponse(text) {
  let listings = null;
  let followups = [];
  let mortgage = null;

  const listingsMatch = text.match(/<<<LISTINGS:(\[[\s\S]*?\])>>>/);
  if (listingsMatch) {
    try { listings = JSON.parse(listingsMatch[1]); } catch(e) {}
  }

  const followupsMatch = text.match(/<<<FOLLOWUPS:(\[[\s\S]*?\])>>>/);
  if (followupsMatch) {
    try { followups = JSON.parse(followupsMatch[1]); } catch(e) {}
  }

  const mortgageMatch = text.match(/<<<MORTGAGE:(\{[\s\S]*?\})>>>/);
  if (mortgageMatch) {
    try { mortgage = JSON.parse(mortgageMatch[1]); } catch(e) {}
  }

  // Clean the display text
  let clean = text
    .replace(/<<<LISTINGS:[\s\S]*?>>>/g, '')
    .replace(/<<<FOLLOWUPS:[\s\S]*?>>>/g, '')
    .replace(/<<<MORTGAGE:[\s\S]*?>>>/g, '')
    .trim();

  return { clean, listings, followups, mortgage };
}

// ─── Mortgage calculator ──────────────────────────────────────────────────────
function calcMortgage(price, downPct, years, rate) {
  const down = price * (downPct / 100);
  const principal = price - down;
  let cmhc = 0;
  if (downPct < 20) {
    const ratio = principal / price;
    cmhc = ratio >= 0.9 ? principal * 0.04 : ratio >= 0.85 ? principal * 0.031 : principal * 0.028;
  }
  const totalPrincipal = principal + cmhc;
  const monthlyRate = (rate / 100) / 12;
  const n = years * 12;
  const monthly = totalPrincipal * (monthlyRate * Math.pow(1+monthlyRate, n)) / (Math.pow(1+monthlyRate, n) - 1);
  return { down: Math.round(down), monthly: Math.round(monthly), cmhc: Math.round(cmhc), principal: Math.round(totalPrincipal) };
}

// ─── Components ──────────────────────────────────────────────────────────────

function PropertyCard({ prop, active, onClick }) {
  const scoreClass = prop.score >= 90 ? 'high' : 'mid';
  return (
    <div className={`property-card ${active ? 'active' : ''}`} onClick={() => onClick(prop)}>
      <div className="prop-img">{prop.emoji}</div>
      <div className="prop-score" style={{background: scoreClass === 'high' ? 'var(--green-dim)' : 'var(--accent-dim)', color: scoreClass === 'high' ? 'var(--green)' : 'var(--accent)'}}>
        {prop.score}/100
      </div>
      <div className="prop-price">${(prop.price/1000).toFixed(0)}k</div>
      <div className="prop-address">{prop.address}</div>
      <div className="prop-neighborhood">{prop.neighborhood}</div>
      <div className="prop-meta">
        <span className="prop-chip">{prop.beds}bd</span>
        <span className="prop-chip">{prop.baths}ba</span>
        <span className="prop-chip">{prop.sqft?.toLocaleString()} sqft</span>
        <span className="prop-chip">Walk {prop.walkScore}</span>
      </div>
    </div>
  );
}

function ThinkingBubble({ step }) {
  return (
    <div className="thinking">
      <div className="think-dots">
        <span/><span/><span/>
      </div>
      <span style={{fontSize:13}}>{step || "Searching listings..."}</span>
    </div>
  );
}

function MortgageModal({ property, onClose }) {
  const [downPct, setDownPct] = useState(20);
  const [years, setYears] = useState(25);
  const [rate, setRate] = useState(5.49);
  const price = property?.price || 750000;
  const result = calcMortgage(price, downPct, years, rate);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Mortgage Estimate</div>
        <div style={{fontSize:13, color:'var(--text-dim)', marginBottom:20}}>
          {property?.address} · ${price.toLocaleString()}
        </div>

        <div className="modal-field">
          <label>Down payment ({downPct}% · ${(price*downPct/100/1000).toFixed(0)}k)</label>
          <input type="range" min="5" max="50" value={downPct} step="1"
            onChange={e => setDownPct(+e.target.value)}
            style={{width:'100%',accentColor:'var(--accent)'}} />
        </div>
        <div className="modal-field">
          <label>Amortization ({years} years)</label>
          <input type="range" min="10" max="30" value={years} step="5"
            onChange={e => setYears(+e.target.value)}
            style={{width:'100%',accentColor:'var(--accent)'}} />
        </div>
        <div className="modal-field">
          <label>Rate ({rate}%)</label>
          <input type="range" min="3" max="9" value={rate} step="0.25"
            onChange={e => setRate(+e.target.value)}
            style={{width:'100%',accentColor:'var(--accent)'}} />
        </div>

        <div className="modal-result">
          <div className="modal-result-row"><span>Down payment</span><span>${result.down.toLocaleString()}</span></div>
          <div className="modal-result-row"><span>Mortgage principal</span><span>${result.principal.toLocaleString()}</span></div>
          {result.cmhc > 0 && <div className="modal-result-row"><span>CMHC premium</span><span>${result.cmhc.toLocaleString()}</span></div>}
          <div className="modal-result-row total"><span>Monthly payment</span><span>${result.monthly.toLocaleString()}/mo</span></div>
        </div>

        <button className="modal-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function AssistantMessage({ msg, onPropertyClick, onFollowup }) {
  const { clean, listings, followups } = parseAgentResponse(msg.content);
  const lines = clean.split('\n').filter(l => l.trim());

  // detect tool call narration lines
  const toolLines = lines.filter(l => l.includes('...') && (l.toLowerCase().includes('search') || l.toLowerCase().includes('pull') || l.toLowerCase().includes('check') || l.toLowerCase().includes('fetch') || l.toLowerCase().includes('running')));
  const bodyLines = lines.filter(l => !toolLines.includes(l));

  return (
    <div className="message assistant">
      <div className="msg-label">HomeAgent</div>
      <div className="msg-bubble">
        {toolLines.map((l,i) => (
          <div key={i} className="tool-call">
            <span className="tool-icon">⚡</span> {l.replace(/^[•\-*]\s*/,'')}
          </div>
        ))}

        {listings && listings.map((prop, i) => (
          <div key={prop.id} className="inline-property" onClick={() => onPropertyClick(prop)}>
            <div className="inline-prop-rank">#{i+1}</div>
            <div className="inline-prop-info">
              <div className="inline-prop-addr">{prop.address} · {prop.neighborhood}</div>
              <div className="inline-prop-detail">
                {prop.beds}bd · {prop.baths}ba · {prop.sqft?.toLocaleString()} sqft · Walk {prop.walkScore} · {prop.commute}
              </div>
              {prop.why && <div style={{fontSize:12, color:'var(--text-faint)', marginTop:3}}>{prop.why}</div>}
            </div>
            <div className="inline-prop-price">${(prop.price/1000).toFixed(0)}k</div>
          </div>
        ))}

        {bodyLines.length > 0 && (
          <div style={{marginTop: listings ? 12 : 0, fontSize:14, lineHeight:1.7}}>
            {bodyLines.map((l,i) => <p key={i} style={{marginBottom: i < bodyLines.length-1 ? 8 : 0}}>{l}</p>)}
          </div>
        )}

        {followups.length > 0 && (
          <div className="followup-row">
            {followups.map((f,i) => (
              <button key={i} className="followup-chip" onClick={() => onFollowup(f)}>{f}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
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

  const handlePropertyClick = (prop) => {
    setActiveProperty(prop);
  };

  const SUGGESTIONS = [
    { title: "Family home search", text: "3-bed house under $900k in Toronto, good schools, max 30 min commute to downtown" },
    { title: "First-time buyer condo", text: "2-bed condo under $750k near subway, walkable neighborhood, under $700/mo condo fees" },
    { title: "Investment property", text: "What neighborhoods in Toronto have the best price appreciation and rental yield?" },
    { title: "Specific area deep dive", text: "Show me everything available in Leslieville under $850k — semis or townhouses only" }
  ];

  const THINK_STEPS = [
    "Querying MLS listings...",
    "Pulling neighborhood scores...",
    "Calculating commute times...",
    "Running affordability analysis...",
    "Ranking results..."
  ];

  const sendMessage = async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput('');

    const userMsg = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    // Cycle through think steps
    let stepIdx = 0;
    setThinkStep(THINK_STEPS[0]);
    const stepInterval = setInterval(() => {
      stepIdx = (stepIdx + 1) % THINK_STEPS.length;
      setThinkStep(THINK_STEPS[stepIdx]);
    }, 1200);

    try {
      const data = await apiSend(content);
      const assistantContent = data.response;

      clearInterval(stepInterval);
      setLoading(false);

      const assistantMsg = { role: 'assistant', content: assistantContent };
      setMessages(prev => [...prev, assistantMsg]);

      // Extract and update sidebar listings
      const { listings } = parseAgentResponse(assistantContent);
      if (listings && listings.length > 0) {
        setProperties(listings);
        setActiveProperty(listings[0]);
      }

    } catch(err) {
      clearInterval(stepInterval);
      setLoading(false);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "<<<FOLLOWUPS:[\"Try a different search\",\"Adjust your budget\"]>>>\nSomething went wrong connecting to the API. Make sure you're using this artifact through Claude.ai."
      }]);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">

        {/* Header */}
        <header className="header">
          <span className="header-logo">Home<span>Agent</span></span>
          <span className="header-badge">AI</span>
          <div className="header-right">
            <div className="status-dot"/>
            <span className="status-label">GTA · Live</span>
            {activeProperty && (
              <button
                onClick={() => setMortgageModal(activeProperty)}
                style={{marginLeft:12, fontSize:12, padding:'5px 12px', background:'var(--accent-dim)', border:'1px solid var(--accent)', borderRadius:20, color:'var(--accent)', cursor:'pointer', fontFamily:'DM Sans, sans-serif'}}
              >
                Mortgage calc
              </button>
            )}
          </div>
        </header>

        {/* Sidebar */}
        <aside className="sidebar">
          {properties.length > 0 ? (
            <>
              <div className="sidebar-section">
                <div className="sidebar-label">Shortlist · {properties.length} properties</div>
                {properties.map(p => (
                  <PropertyCard
                    key={p.id}
                    prop={p}
                    active={activeProperty?.id === p.id}
                    onClick={handlePropertyClick}
                  />
                ))}
              </div>
              {activeProperty && (
                <div className="sidebar-section">
                  <div className="sidebar-label">Details</div>
                  <div style={{background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:14}}>
                    <div style={{fontSize:15, fontWeight:500, color:'var(--cream)', marginBottom:4}}>{activeProperty.address}</div>
                    <div style={{fontSize:12, color:'var(--text-dim)', marginBottom:10}}>{activeProperty.neighborhood}</div>
                    {[
                      ['Commute', activeProperty.commute],
                      ['Schools', activeProperty.schools],
                      ['Walk score', activeProperty.walkScore + '/100'],
                      ['Transit', activeProperty.transitScore + '/100'],
                    ].map(([k,v]) => (
                      <div key={k} style={{display:'flex', justifyContent:'space-between', fontSize:12, padding:'4px 0', borderBottom:'1px solid var(--border)'}}>
                        <span style={{color:'var(--text-dim)'}}>{k}</span>
                        <span style={{color:'var(--text)'}}>{v}</span>
                      </div>
                    ))}
                    <button
                      onClick={() => setMortgageModal(activeProperty)}
                      style={{marginTop:12, width:'100%', padding:'8px', background:'var(--accent-dim)', border:'1px solid var(--accent)', borderRadius:8, color:'var(--accent)', cursor:'pointer', fontSize:13, fontFamily:'DM Sans, sans-serif'}}
                    >
                      Calculate mortgage →
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-sidebar">
              <div className="icon">🏙</div>
              <div style={{fontWeight:500, color:'var(--text-dim)', marginBottom:6}}>No listings yet</div>
              Describe what you're looking for and HomeAgent will build your shortlist here.
            </div>
          )}
        </aside>

        {/* Chat */}
        <div className="chat-area">
          {!hasMessages ? (
            <div className="welcome">
              <div className="welcome-title">Find your <em>perfect home</em> in Toronto</div>
              <div className="welcome-sub">Describe your search in plain English — budget, location, lifestyle. The agent handles the rest.</div>
              <div className="suggestion-grid">
                {SUGGESTIONS.map((s,i) => (
                  <button key={i} className="suggestion" onClick={() => sendMessage(s.text)}>
                    <strong>{s.title}</strong>
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((msg, i) => (
                msg.role === 'user' ? (
                  <div key={i} className="message user">
                    <div className="msg-label">You</div>
                    <div className="msg-bubble">{msg.content}</div>
                  </div>
                ) : (
                  <AssistantMessage
                    key={i}
                    msg={msg}
                    onPropertyClick={handlePropertyClick}
                    onFollowup={sendMessage}
                  />
                )
              ))}
              {loading && (
                <div className="message assistant">
                  <div className="msg-label">HomeAgent</div>
                  <ThinkingBubble step={thinkStep} />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          <div className="input-bar">
            <div className="input-row">
              <textarea
                ref={textareaRef}
                className="chat-input"
                placeholder="3-bed under $900k, good schools, near subway..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                rows={1}
                style={{
                  height: 'auto',
                  overflow: 'hidden',
                }}
                onInput={e => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
              />
              <button className="send-btn" onClick={() => sendMessage()} disabled={!input.trim() || loading}>
                ↑
              </button>
            </div>
          </div>
        </div>

        {/* Mortgage modal */}
        {mortgageModal && (
          <MortgageModal property={mortgageModal} onClose={() => setMortgageModal(null)} />
        )}
      </div>
    </>
  );
}