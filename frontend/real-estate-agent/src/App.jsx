import { useState, useRef, useEffect } from "react";
import { sendMessage as apiSend, resetSession } from "./api.js";

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..600;1,9..40,300..600&family=Source+Serif+4:opsz,wght@8..60,400..600&display=swap');

  :root {
    --bg:            #F4F1E8;
    --bg-2:          #EFEBDE;
    --surface:       #FCFAF3;
    --surface-2:     #F8F5EB;
    --surface-3:     #EAE4D2;
    --border:        #E0DACA;
    --border-strong: #CFC8B5;
    --ink:           #1F1B14;
    --ink-2:         #3A352A;
    --ink-dim:       #6B6457;
    --ink-faint:     #9A9384;
    --ink-ghost:     #C5BFB1;

    --accent:        #C4633C;
    --accent-bright: #D97757;
    --accent-deep:   #A04E2C;
    --accent-soft:   rgba(196,99,60,0.08);
    --accent-mid:    rgba(196,99,60,0.16);

    --pos:           #5C8C6A;
    --pos-soft:      rgba(92,140,106,0.14);

    --shadow-sm: 0 1px 2px rgba(31,27,20,0.04);
    --shadow:    0 4px 16px -6px rgba(31,27,20,0.10), 0 1px 2px rgba(31,27,20,0.04);
    --shadow-lg: 0 18px 40px -16px rgba(31,27,20,0.18), 0 2px 6px rgba(31,27,20,0.06);

    --r-sm: 6px;
    --r:    10px;
    --r-md: 14px;
    --r-lg: 20px;
    --r-xl: 28px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }

  body {
    background: var(--bg);
    color: var(--ink);
    font-family: 'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 15px;
    line-height: 1.55;
    font-weight: 400;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    font-feature-settings: 'ss01', 'cv11';
    overflow: hidden;
  }

  ::selection { background: var(--accent-mid); color: var(--ink); }

  button { font: inherit; color: inherit; }

  .app {
    display: grid;
    grid-template-columns: 280px 1fr;
    height: 100vh;
    overflow: hidden;
    background: var(--bg);
  }

  /* ── Sidebar ── */
  .sidebar {
    border-right: 1px solid var(--border);
    background: var(--bg-2);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .side-head {
    padding: 18px 18px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .brand-mark {
    width: 26px; height: 26px;
    border-radius: 7px;
    background: var(--ink);
    color: var(--bg);
    display: flex; align-items: center; justify-content: center;
    box-shadow: var(--shadow-sm);
  }
  .brand-mark svg { width: 16px; height: 16px; }
  .brand-name {
    font-weight: 500;
    font-size: 15px;
    letter-spacing: -0.01em;
    color: var(--ink);
  }
  .new-chat {
    width: 28px; height: 28px;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--ink-dim);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.18s;
  }
  .new-chat:hover { background: var(--surface-2); color: var(--ink); border-color: var(--border-strong); }
  .new-chat svg { width: 14px; height: 14px; }

  .side-section {
    padding: 6px 12px 0;
    display: flex; flex-direction: column; gap: 2px;
  }
  .side-label {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.05em;
    color: var(--ink-faint);
    padding: 8px 8px 6px;
    text-transform: uppercase;
  }

  .side-list {
    flex: 1;
    overflow-y: auto;
    padding: 0 12px 16px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .side-list::-webkit-scrollbar { width: 6px; }
  .side-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  .side-list::-webkit-scrollbar-thumb:hover { background: var(--border-strong); }

  .side-card {
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--r);
    padding: 8px;
    cursor: pointer;
    display: grid;
    grid-template-columns: 56px 1fr;
    gap: 10px;
    align-items: center;
    transition: background 0.15s, border-color 0.15s;
    text-align: left;
    width: 100%;
  }
  .side-card:hover { background: var(--surface-2); }
  .side-card.active { background: var(--surface); border-color: var(--border); box-shadow: var(--shadow-sm); }

  .side-card-img {
    width: 56px; height: 56px;
    border-radius: 8px;
    object-fit: cover;
    background: var(--surface-3);
    flex-shrink: 0;
  }
  .side-card-img.placeholder {
    display: flex; align-items: center; justify-content: center;
    color: var(--ink-faint);
    font-size: 18px;
  }
  .side-card-info { min-width: 0; }
  .side-card-price {
    font-weight: 600;
    font-size: 14px;
    color: var(--ink);
    letter-spacing: -0.01em;
    font-feature-settings: 'tnum';
    margin-bottom: 1px;
  }
  .side-card-addr {
    font-size: 12.5px;
    color: var(--ink-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .side-card-meta {
    font-size: 11.5px;
    color: var(--ink-faint);
    margin-top: 1px;
  }

  .side-empty {
    margin-top: 4px;
    padding: 16px 12px;
    background: var(--surface-2);
    border: 1px dashed var(--border);
    border-radius: var(--r);
    color: var(--ink-faint);
    font-size: 13px;
    line-height: 1.55;
  }

  .side-foot {
    border-top: 1px solid var(--border);
    padding: 12px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11.5px;
    color: var(--ink-faint);
  }
  .live-pill {
    display: inline-flex; align-items: center; gap: 6px;
    color: var(--ink-dim);
  }
  .live-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--pos);
    box-shadow: 0 0 0 0 rgba(92,140,106,0.4);
    animation: pulse 2.4s ease-out infinite;
  }
  @keyframes pulse {
    0%   { box-shadow: 0 0 0 0 rgba(92,140,106,0.5); }
    70%  { box-shadow: 0 0 0 6px rgba(92,140,106,0); }
    100% { box-shadow: 0 0 0 0 rgba(92,140,106,0); }
  }

  /* ── Chat area ── */
  .chat {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
    position: relative;
  }

  .chat-head {
    height: 52px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 22px;
    gap: 12px;
    background: rgba(244,241,232,0.7);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    flex-shrink: 0;
  }
  .chat-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--ink);
    letter-spacing: -0.005em;
  }
  .chat-sub {
    font-size: 12.5px;
    color: var(--ink-faint);
    margin-left: 8px;
  }
  .chat-head .ghost {
    margin-left: auto;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 12.5px;
    color: var(--ink-dim);
    cursor: pointer;
    transition: all 0.18s;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .chat-head .ghost:hover { background: var(--surface); border-color: var(--border-strong); color: var(--ink); }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 36px 24px 24px;
    display: flex;
    flex-direction: column;
    gap: 28px;
    scroll-behavior: smooth;
  }
  .messages::-webkit-scrollbar { width: 8px; }
  .messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
  .messages::-webkit-scrollbar-thumb:hover { background: var(--border-strong); }

  .turn {
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    animation: fadeUp 0.4s cubic-bezier(0.2,0.8,0.2,1) both;
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* User message */
  .user-row { display: flex; justify-content: flex-end; }
  .user-msg {
    max-width: 80%;
    background: var(--surface-3);
    color: var(--ink);
    padding: 11px 16px;
    border-radius: 18px 18px 4px 18px;
    font-size: 14.5px;
    line-height: 1.5;
    letter-spacing: -0.003em;
    word-wrap: break-word;
  }

  /* Assistant message */
  .assistant-row {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }
  .avatar {
    width: 30px; height: 30px;
    border-radius: 8px;
    background: linear-gradient(135deg, var(--accent-bright), var(--accent-deep));
    color: var(--bg);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 2px 6px -2px rgba(196,99,60,0.4);
    margin-top: 2px;
  }
  .avatar svg { width: 16px; height: 16px; }
  .assistant-body { flex: 1; min-width: 0; }
  .assistant-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--ink);
    margin-bottom: 8px;
    letter-spacing: -0.005em;
  }
  .assistant-name .stamp {
    font-size: 11.5px;
    font-weight: 400;
    color: var(--ink-faint);
    margin-left: 6px;
  }

  /* Tool narration */
  .tool-stack {
    margin: 4px 0 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .tool-line {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 12.5px;
    color: var(--ink-faint);
  }
  .tool-line .check {
    width: 14px; height: 14px;
    border-radius: 50%;
    background: var(--pos-soft);
    color: var(--pos);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    font-size: 9px;
  }
  .tool-line .check svg { width: 8px; height: 8px; }

  /* Prose */
  .prose {
    font-family: 'Source Serif 4', 'DM Sans', serif;
    font-size: 16px;
    line-height: 1.62;
    color: var(--ink);
    letter-spacing: -0.003em;
    font-variation-settings: "opsz" 16, "wght" 420;
  }
  .prose p { margin-bottom: 0.75em; }
  .prose p:last-child { margin-bottom: 0; }
  .prose strong { font-weight: 600; color: var(--ink); }
  .prose em { font-style: italic; }
  .prose ul {
    list-style: none;
    padding: 0;
    margin: 0.5em 0 0.75em;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .prose li {
    position: relative;
    padding-left: 18px;
  }
  .prose li::before {
    content: '';
    position: absolute;
    left: 4px;
    top: 0.65em;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--accent);
  }
  .prose code {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.9em;
    background: var(--surface-3);
    color: var(--ink);
    padding: 1px 5px;
    border-radius: 4px;
  }

  /* Inline property cards */
  .listing-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    margin: 16px 0 8px;
  }
  @media (min-width: 720px) {
    .listing-grid.dense { grid-template-columns: 1fr 1fr; }
  }
  .listing-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
    display: flex;
    flex-direction: column;
    text-align: left;
    width: 100%;
    padding: 0;
  }
  .listing-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow);
    border-color: var(--border-strong);
  }
  .listing-card.active {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent-mid), var(--shadow);
  }
  .listing-img-wrap {
    position: relative;
    aspect-ratio: 4 / 3;
    background: var(--surface-3);
    overflow: hidden;
  }
  .listing-img {
    width: 100%; height: 100%;
    object-fit: cover;
    transition: transform 0.5s cubic-bezier(0.2,0.8,0.2,1);
    display: block;
  }
  .listing-card:hover .listing-img { transform: scale(1.04); }
  .listing-img-fallback {
    width: 100%; height: 100%;
    background: linear-gradient(135deg, var(--surface-3), var(--bg-2));
    display: flex; align-items: center; justify-content: center;
    color: var(--ink-faint);
    font-size: 32px;
  }
  .listing-score {
    position: absolute;
    top: 10px; right: 10px;
    background: rgba(252,250,243,0.94);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    border: 1px solid rgba(31,27,20,0.06);
    color: var(--ink);
    padding: 4px 9px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: -0.005em;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    box-shadow: 0 2px 6px rgba(31,27,20,0.10);
  }
  .listing-score .star {
    color: var(--accent);
    font-size: 12px;
    line-height: 1;
  }
  .listing-rank {
    position: absolute;
    top: 10px; left: 10px;
    background: rgba(31,27,20,0.86);
    backdrop-filter: blur(6px);
    color: var(--bg);
    padding: 3px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
  }
  .listing-body {
    padding: 14px 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .listing-price-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
  }
  .listing-price {
    font-size: 19px;
    font-weight: 600;
    color: var(--ink);
    letter-spacing: -0.02em;
    font-feature-settings: 'tnum';
  }
  .listing-walk {
    font-size: 12px;
    color: var(--ink-faint);
    white-space: nowrap;
  }
  .listing-walk b {
    font-weight: 500;
    color: var(--ink-dim);
  }
  .listing-addr {
    font-size: 14px;
    color: var(--ink);
    font-weight: 500;
    line-height: 1.35;
    letter-spacing: -0.005em;
  }
  .listing-neigh {
    font-size: 12.5px;
    color: var(--ink-faint);
  }
  .listing-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }
  .meta-chip {
    font-size: 11.5px;
    color: var(--ink-dim);
    background: var(--surface-2);
    border: 1px solid var(--border);
    padding: 3px 9px;
    border-radius: 999px;
    font-weight: 500;
    letter-spacing: -0.003em;
    font-feature-settings: 'tnum';
  }
  .listing-why {
    font-family: 'Source Serif 4', serif;
    font-variation-settings: "opsz" 14, "wght" 420;
    font-size: 13.5px;
    line-height: 1.5;
    color: var(--ink-2);
    margin-top: 8px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
  }

  /* Followups */
  .followups {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
  }
  .followup {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 7px 13px;
    font-size: 13px;
    color: var(--ink-dim);
    cursor: pointer;
    transition: all 0.18s;
    line-height: 1.3;
  }
  .followup:hover {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--accent-deep);
  }

  /* Thinking */
  .thinking {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--ink-faint);
    font-size: 13.5px;
  }
  .think-dots {
    display: flex; gap: 4px;
  }
  .think-dots span {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.5;
    animation: dotBounce 1.2s ease-in-out infinite;
  }
  .think-dots span:nth-child(2) { animation-delay: 0.15s; }
  .think-dots span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes dotBounce {
    0%, 100% { opacity: 0.3; transform: translateY(0); }
    40%      { opacity: 1; transform: translateY(-3px); }
  }

  /* Welcome */
  .welcome {
    flex: 1;
    overflow-y: auto;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .welcome-inner {
    max-width: 760px;
    width: 100%;
    margin: 0 auto;
    padding: 80px 24px 40px;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .greeting {
    font-family: 'Source Serif 4', serif;
    font-variation-settings: "opsz" 60, "wght" 440;
    font-size: clamp(34px, 5vw, 44px);
    line-height: 1.12;
    letter-spacing: -0.025em;
    color: var(--ink);
    margin-bottom: 8px;
  }
  .greeting .accent {
    color: var(--accent);
    font-style: italic;
    font-variation-settings: "opsz" 60, "wght" 440;
  }
  .greeting-sub {
    font-size: 16px;
    color: var(--ink-dim);
    line-height: 1.5;
    max-width: 52ch;
    margin-bottom: 36px;
  }
  .quick-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  @media (max-width: 620px) {
    .quick-grid { grid-template-columns: 1fr; }
  }
  .quick {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    padding: 14px 16px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .quick:hover {
    border-color: var(--border-strong);
    background: var(--surface-2);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }
  .quick-title {
    font-weight: 500;
    font-size: 14px;
    color: var(--ink);
    letter-spacing: -0.005em;
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .quick-icon {
    width: 22px; height: 22px;
    border-radius: 6px;
    background: var(--accent-soft);
    color: var(--accent);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .quick-icon svg { width: 12px; height: 12px; }
  .quick-text {
    font-size: 13px;
    color: var(--ink-dim);
    line-height: 1.45;
  }

  /* Input */
  .input-region {
    border-top: 1px solid var(--border);
    padding: 14px 24px 18px;
    background: linear-gradient(180deg, transparent, var(--bg) 50%);
    flex-shrink: 0;
  }
  .input-wrap {
    max-width: 760px;
    margin: 0 auto;
  }
  .input-shell {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
    padding: 4px 4px 4px 18px;
    display: flex;
    align-items: flex-end;
    gap: 8px;
    transition: border-color 0.2s, box-shadow 0.2s;
    box-shadow: var(--shadow-sm);
  }
  .input-shell:focus-within {
    border-color: var(--ink-faint);
    box-shadow: 0 0 0 3px rgba(31,27,20,0.04), var(--shadow);
  }
  .chat-input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: var(--ink);
    font-family: inherit;
    font-size: 15px;
    line-height: 1.5;
    resize: none;
    min-height: 24px;
    max-height: 200px;
    padding: 10px 0;
    letter-spacing: -0.003em;
  }
  .chat-input::placeholder { color: var(--ink-faint); }
  .send-btn {
    width: 34px; height: 34px;
    border-radius: 50%;
    background: var(--ink);
    color: var(--bg);
    border: none;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    align-self: flex-end;
    margin-bottom: 4px;
    transition: all 0.15s;
  }
  .send-btn:hover { background: var(--accent); transform: scale(1.04); }
  .send-btn:active { transform: scale(0.94); }
  .send-btn:disabled {
    background: var(--ink-ghost);
    cursor: not-allowed;
    transform: none;
  }
  .send-btn svg { width: 14px; height: 14px; }
  .input-foot {
    text-align: center;
    margin-top: 8px;
    font-size: 11.5px;
    color: var(--ink-faint);
  }

  /* Mortgage modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(31,27,20,0.32);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    animation: fadeIn 0.2s ease both;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
    padding: 28px;
    width: 100%;
    max-width: 460px;
    box-shadow: var(--shadow-lg);
    animation: modalIn 0.32s cubic-bezier(0.2,0.8,0.2,1) both;
  }
  @keyframes modalIn {
    from { opacity: 0; transform: translateY(12px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .modal-eyebrow {
    font-size: 11.5px;
    font-weight: 500;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 6px;
  }
  .modal-title {
    font-family: 'Source Serif 4', serif;
    font-variation-settings: "opsz" 40, "wght" 500;
    font-size: 24px;
    color: var(--ink);
    letter-spacing: -0.022em;
    margin-bottom: 4px;
  }
  .modal-sub {
    font-size: 13px;
    color: var(--ink-dim);
    margin-bottom: 22px;
    padding-bottom: 18px;
    border-bottom: 1px solid var(--border);
  }
  .modal-sub b { color: var(--ink); font-weight: 500; }

  .field { margin-bottom: 16px; }
  .field-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 7px;
  }
  .field-label {
    font-size: 12.5px;
    color: var(--ink-dim);
    font-weight: 500;
  }
  .field-value {
    font-size: 13.5px;
    color: var(--ink);
    font-weight: 600;
    letter-spacing: -0.005em;
    font-feature-settings: 'tnum';
  }
  .field-value em {
    color: var(--ink-faint);
    font-weight: 400;
    font-style: normal;
    margin-left: 4px;
  }
  .field input[type="range"] {
    width: 100%;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
  }
  .field input[type="range"]::-webkit-slider-runnable-track {
    height: 3px; background: var(--border-strong); border-radius: 2px;
  }
  .field input[type="range"]::-moz-range-track {
    height: 3px; background: var(--border-strong); border-radius: 2px;
  }
  .field input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px; height: 16px;
    margin-top: -7px;
    background: var(--accent);
    border-radius: 50%;
    border: 2px solid var(--surface);
    box-shadow: 0 0 0 1px var(--accent), 0 2px 4px rgba(196,99,60,0.3);
    cursor: grab;
    transition: transform 0.15s;
  }
  .field input[type="range"]::-webkit-slider-thumb:active { transform: scale(1.18); cursor: grabbing; }
  .field input[type="range"]::-moz-range-thumb {
    width: 16px; height: 16px;
    background: var(--accent);
    border-radius: 50%;
    border: 2px solid var(--surface);
  }

  .modal-result {
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r);
    padding: 16px 18px;
    margin-top: 18px;
  }
  .result-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 6px 0;
    font-size: 13px;
  }
  .result-row .rk { color: var(--ink-dim); }
  .result-row .rv { color: var(--ink); font-weight: 500; font-feature-settings: 'tnum'; }
  .result-row.total {
    border-top: 1px solid var(--border);
    margin-top: 8px;
    padding-top: 12px;
  }
  .result-row.total .rk { font-size: 13px; }
  .result-row.total .rv {
    font-family: 'Source Serif 4', serif;
    font-variation-settings: "opsz" 30, "wght" 600;
    font-size: 22px;
    color: var(--accent);
    letter-spacing: -0.02em;
  }
  .result-row.total .rv .per {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: var(--ink-faint);
    font-weight: 400;
    margin-left: 2px;
  }
  .modal-close {
    width: 100%;
    margin-top: 18px;
    background: var(--ink);
    color: var(--bg);
    border: none;
    padding: 11px;
    border-radius: var(--r);
    cursor: pointer;
    font-size: 13.5px;
    font-weight: 500;
    transition: all 0.18s;
  }
  .modal-close:hover { background: var(--accent); }

  /* Responsive */
  @media (max-width: 820px) {
    .app { grid-template-columns: 1fr; }
    .sidebar { display: none; }
    .messages { padding: 24px 18px 18px; }
    .input-region { padding: 12px 18px 14px; }
    .welcome-inner { padding: 48px 20px 24px; }
  }
`;

// ─── SVG icons ───────────────────────────────────────────────────────────────
const Icons = {
  Logo: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 11 L12 4 L21 11 V20 H15 V14 H9 V20 H3 Z"
        stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  ),
  Spark: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3 L13.5 9 L20 10.5 L13.5 12 L12 18 L10.5 12 L4 10.5 L10.5 9 Z"
        fill="currentColor"/>
    </svg>
  ),
  Plus: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 5 V19 M5 12 H19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  ArrowUp: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 5 V19 M6 11 L12 5 L18 11"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 12 L10 17 L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Home: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 11 L12 5 L20 11 V19 H14 V14 H10 V19 H4 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  ),
  Building: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="4" width="14" height="16" rx="1" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M9 9 H10 M14 9 H15 M9 13 H10 M14 13 H15 M9 17 H10 M14 17 H15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  Trend: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 17 L9 12 L13 15 L20 7 M14 7 H20 V13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Map: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 5 L3 7 V20 L9 18 L15 20 L21 18 V5 L15 7 Z M9 5 V18 M15 7 V20" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  ),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatPrice = (n) => {
  if (!n) return "—";
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `$${(v >= 10 ? v.toFixed(1) : v.toFixed(2)).replace(/\.?0+$/, '')}M`;
  }
  if (n >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${n.toLocaleString()}`;
};

function parseAgentResponse(text) {
  let listings = null;
  let followups = [];
  let mortgage = null;

  const listingsMatch = text.match(/<<<LISTINGS:(\[[\s\S]*?\])>>>/);
  if (listingsMatch) {
    try { listings = JSON.parse(listingsMatch[1]); } catch (e) {}
  }
  const followupsMatch = text.match(/<<<FOLLOWUPS:(\[[\s\S]*?\])>>>/);
  if (followupsMatch) {
    try { followups = JSON.parse(followupsMatch[1]); } catch (e) {}
  }
  const mortgageMatch = text.match(/<<<MORTGAGE:(\{[\s\S]*?\})>>>/);
  if (mortgageMatch) {
    try { mortgage = JSON.parse(mortgageMatch[1]); } catch (e) {}
  }

  let clean = text
    .replace(/<<<LISTINGS:[\s\S]*?>>>/g, '')
    .replace(/<<<FOLLOWUPS:[\s\S]*?>>>/g, '')
    .replace(/<<<MORTGAGE:[\s\S]*?>>>/g, '')
    .trim();

  return { clean, listings, followups, mortgage };
}

function calcMortgage(price, downPct, years, rate) {
  const down = price * (downPct / 100);
  const principal = price - down;
  let pmiMonthly = 0;
  if (downPct < 20) pmiMonthly = (principal * 0.008) / 12;
  const monthlyRate = (rate / 100) / 12;
  const n = years * 12;
  const pi = principal * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
  return {
    down: Math.round(down),
    principal: Math.round(principal),
    monthlyPI: Math.round(pi),
    pmi: Math.round(pmiMonthly),
    monthly: Math.round(pi + pmiMonthly),
  };
}

// ─── Inline markdown renderer (handles **bold**, *italic*, `code`, lists) ────
function renderInline(text) {
  const out = [];
  const re = /\*\*(.+?)\*\*|\*([^*\n]+?)\*|`([^`\n]+?)`/g;
  let last = 0;
  let m;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={`s${key++}`}>{m[1]}</strong>);
    else if (m[2] !== undefined) out.push(<em key={`e${key++}`}>{m[2]}</em>);
    else if (m[3] !== undefined) out.push(<code key={`c${key++}`}>{m[3]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function MarkdownProse({ text }) {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const blocks = [];
  let listBuf = [];
  for (const line of lines) {
    const trim = line.trim();
    const lm = trim.match(/^[*\-•]\s+(.+)/);
    if (lm) {
      listBuf.push(lm[1]);
    } else {
      if (listBuf.length) {
        blocks.push({ type: 'ul', items: listBuf });
        listBuf = [];
      }
      blocks.push({ type: 'p', text: trim });
    }
  }
  if (listBuf.length) blocks.push({ type: 'ul', items: listBuf });

  return (
    <div className="prose">
      {blocks.map((b, i) =>
        b.type === 'ul'
          ? <ul key={i}>{b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ul>
          : <p key={i}>{renderInline(b.text)}</p>
      )}
    </div>
  );
}

// ─── Components ──────────────────────────────────────────────────────────────

function ListingCard({ prop, index, active, onClick }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <button className={`listing-card ${active ? 'active' : ''}`} onClick={() => onClick(prop)}>
      <div className="listing-img-wrap">
        {prop.image && !imgFailed ? (
          <img
            src={prop.image}
            alt={prop.address}
            className="listing-img"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="listing-img-fallback"><Icons.Home/></div>
        )}
        {typeof index === 'number' && <div className="listing-rank">{String(index + 1).padStart(2, '0')}</div>}
        {prop.score != null && (
          <div className="listing-score">
            <span className="star">★</span>{prop.score}
          </div>
        )}
      </div>
      <div className="listing-body">
        <div className="listing-price-row">
          <span className="listing-price">{formatPrice(prop.price)}</span>
          {prop.walkScore != null && (
            <span className="listing-walk">walk <b>{prop.walkScore}</b></span>
          )}
        </div>
        <div className="listing-addr">{prop.address}</div>
        {prop.neighborhood && <div className="listing-neigh">{prop.neighborhood}</div>}
        <div className="listing-meta">
          <span className="meta-chip">{prop.beds} bd</span>
          <span className="meta-chip">{prop.baths} ba</span>
          {prop.sqft ? <span className="meta-chip">{prop.sqft.toLocaleString()} sqft</span> : null}
          {prop.commute && <span className="meta-chip">{prop.commute}</span>}
        </div>
        {prop.why && <div className="listing-why">{prop.why}</div>}
      </div>
    </button>
  );
}

function SideCard({ prop, active, onClick }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <button className={`side-card ${active ? 'active' : ''}`} onClick={() => onClick(prop)}>
      {prop.image && !imgFailed ? (
        <img
          src={prop.image}
          alt=""
          className="side-card-img"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="side-card-img placeholder"><Icons.Home/></div>
      )}
      <div className="side-card-info">
        <div className="side-card-price">{formatPrice(prop.price)}</div>
        <div className="side-card-addr">{prop.address}</div>
        <div className="side-card-meta">{prop.beds}bd · {prop.baths}ba{prop.sqft ? ` · ${prop.sqft.toLocaleString()}sf` : ''}</div>
      </div>
    </button>
  );
}

function ThinkingBubble({ step }) {
  return (
    <div className="thinking">
      <div className="think-dots"><span/><span/><span/></div>
      <span>{step || "Thinking"}</span>
    </div>
  );
}

function MortgageModal({ property, onClose }) {
  const [downPct, setDownPct] = useState(20);
  const [years, setYears] = useState(30);
  const [rate, setRate] = useState(7.0);
  const price = property?.price || 750000;
  const r = calcMortgage(price, downPct, years, rate);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-eyebrow">Affordability</div>
        <div className="modal-title">Mortgage estimate</div>
        <div className="modal-sub">
          <b>{property?.address}</b> · {formatPrice(price)}
        </div>

        <div className="field">
          <div className="field-head">
            <span className="field-label">Down payment</span>
            <span className="field-value">{downPct}%<em>${(price * downPct / 100 / 1000).toFixed(0)}k</em></span>
          </div>
          <input type="range" min="3" max="50" value={downPct} step="1" onChange={e => setDownPct(+e.target.value)}/>
        </div>
        <div className="field">
          <div className="field-head">
            <span className="field-label">Loan term</span>
            <span className="field-value">{years}<em>years</em></span>
          </div>
          <input type="range" min="10" max="30" value={years} step="5" onChange={e => setYears(+e.target.value)}/>
        </div>
        <div className="field">
          <div className="field-head">
            <span className="field-label">Interest rate</span>
            <span className="field-value">{rate.toFixed(2)}<em>%</em></span>
          </div>
          <input type="range" min="3" max="9" value={rate} step="0.25" onChange={e => setRate(+e.target.value)}/>
        </div>

        <div className="modal-result">
          <div className="result-row"><span className="rk">Down payment</span><span className="rv">${r.down.toLocaleString()}</span></div>
          <div className="result-row"><span className="rk">Loan amount</span><span className="rv">${r.principal.toLocaleString()}</span></div>
          <div className="result-row"><span className="rk">Principal & interest</span><span className="rv">${r.monthlyPI.toLocaleString()}/mo</span></div>
          {r.pmi > 0 && <div className="result-row"><span className="rk">PMI</span><span className="rv">${r.pmi.toLocaleString()}/mo</span></div>}
          <div className="result-row total">
            <span className="rk">Monthly payment</span>
            <span className="rv">${r.monthly.toLocaleString()}<span className="per"> /mo</span></span>
          </div>
        </div>

        <button className="modal-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function AssistantTurn({ msg, activeId, onPropertyClick, onFollowup }) {
  const { clean, listings: parsedListings, followups } = parseAgentResponse(msg.content);
  const lines = clean.split('\n');

  // Merge agent-enriched listings with raw tool listings.
  // Prefer parsed (has walkScore/why/score), fall back to tool data, then merge image from tool when missing.
  let listings = parsedListings;
  const toolListings = msg.toolListings || [];
  if (!listings || !listings.length) {
    listings = toolListings;
  } else if (toolListings.length) {
    const toolById = Object.fromEntries(toolListings.map(t => [String(t.id), t]));
    listings = listings.map(l => {
      const t = toolById[String(l.id)];
      return t ? { ...l, image: l.image || t.image, sqft: l.sqft || t.sqft } : l;
    });
  }

  const isToolLine = (l) => {
    const lower = l.trim().toLowerCase();
    if (!lower.endsWith('...') && !lower.endsWith('…')) return false;
    return lower.includes('search') || lower.includes('pull') || lower.includes('check') ||
           lower.includes('fetch') || lower.includes('running') || lower.includes('querying') ||
           lower.includes('calculating') || lower.includes('ranking') || lower.includes('broaden');
  };

  const toolLines = lines.filter(l => l.trim() && isToolLine(l));
  const proseText = lines.filter(l => !isToolLine(l)).join('\n').trim();

  return (
    <div className="turn">
      <div className="assistant-row">
        <div className="avatar"><Icons.Spark/></div>
        <div className="assistant-body">
          <div className="assistant-name">HomeAgent</div>

          {toolLines.length > 0 && (
            <div className="tool-stack">
              {toolLines.map((l, i) => (
                <div key={i} className="tool-line">
                  <span className="check"><Icons.Check/></span>
                  <span>{l.trim().replace(/[.…]+$/, '')}</span>
                </div>
              ))}
            </div>
          )}

          {proseText && <MarkdownProse text={proseText}/>}

          {listings && listings.length > 0 && (
            <div className={`listing-grid ${listings.length >= 2 ? 'dense' : ''}`}>
              {listings.map((p, i) => (
                <ListingCard
                  key={p.id || i}
                  prop={p}
                  index={i}
                  active={activeId === p.id}
                  onClick={onPropertyClick}
                />
              ))}
            </div>
          )}

          {followups.length > 0 && (
            <div className="followups">
              {followups.map((f, i) => (
                <button key={i} className="followup" onClick={() => onFollowup(f)}>{f}</button>
              ))}
            </div>
          )}
        </div>
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
    setMortgageModal(prop);
  };

  const handleSidebarClick = (prop) => {
    setActiveProperty(prop);
  };

  const SUGGESTIONS = [
    { icon: <Icons.Home/>, title: "Family home in Austin", text: "3-bed house under $900k with good schools" },
    { icon: <Icons.Building/>, title: "Condo in Tampa", text: "2-bed condo near downtown, walkable, under $500k" },
    { icon: <Icons.Trend/>, title: "Investment in Charlotte", text: "Townhouses under $400k with strong rental yield" },
    { icon: <Icons.Map/>, title: "Explore Nashville", text: "Show me 3-bed homes in East Nashville under $700k" },
  ];

  const THINK_STEPS = [
    "Querying MLS",
    "Pulling listings",
    "Calculating scores",
    "Ranking results",
  ];

  const sendMessage = async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const userMsg = { role: 'user', content };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    let stepIdx = 0;
    setThinkStep(THINK_STEPS[0]);
    const stepInterval = setInterval(() => {
      stepIdx = (stepIdx + 1) % THINK_STEPS.length;
      setThinkStep(THINK_STEPS[stepIdx]);
    }, 1100);

    try {
      const data = await apiSend(content);
      clearInterval(stepInterval);
      setLoading(false);

      // Fallback: derive listings from raw tool_calls if the model forgot the LISTINGS block.
      const toolListings = (data.tool_calls || [])
        .filter(tc => tc.name === 'search_listings' && tc.result && Array.isArray(tc.result.listings))
        .flatMap(tc => tc.result.listings)
        .filter(l => l && l.price);

      const assistantMsg = {
        role: 'assistant',
        content: data.response,
        toolListings,
      };
      setMessages(prev => [...prev, assistantMsg]);

      const { listings } = parseAgentResponse(data.response);
      const finalListings = (listings && listings.length) ? listings : toolListings;
      if (finalListings && finalListings.length > 0) {
        setProperties(finalListings);
        setActiveProperty(finalListings[0]);
      }
    } catch (err) {
      clearInterval(stepInterval);
      setLoading(false);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I couldn't reach the local agent. Make sure the API is running on port 8000.\n<<<FOLLOWUPS:[\"Try again\",\"Check connection\"]>>>"
      }]);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleNewChat = async () => {
    try { await resetSession(); } catch (e) {}
    setMessages([]);
    setProperties([]);
    setActiveProperty(null);
    setInput('');
  };

  const hasMessages = messages.length > 0;

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">

        {/* Sidebar */}
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
                  onClick={handleSidebarClick}
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

        {/* Chat */}
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
                  Good {(() => { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'; })()}.<br/>
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
                    onPropertyClick={handlePropertyClick}
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
                        HomeAgent
                        <span className="stamp">working…</span>
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
    </>
  );
}
