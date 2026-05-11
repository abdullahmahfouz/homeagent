# HomeAgent

A conversational real-estate research assistant. Type a search in plain English,
watch the agent call MLS and mortgage tools live, and explore ranked listings on
an interactive map.

```
┌─ HomeAgent ─────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌────────────────┐ ┌───────────────────────────────────────────┐   │
│  │                │ │                                           │   │
│  │  Chat          │ │              Map                          │   │
│  │  • streaming   │ │      ●$635K   ●$595K                      │   │
│  │  • live tools  │ │              ●$719K                       │   │
│  │  • markdown    │ │                                           │   │
│  │                │ │                                           │   │
│  │  [ask…]    [→] │ │                                           │   │
│  │                │ ├───────────────────────────────────────────┤   │
│  │                │ │ [card] [card] [card] [card] →             │   │
│  └────────────────┘ └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## What it does

- **Conversational search** — describe a home in natural language (budget,
  location, beds, schools, commute, lifestyle) and the agent searches live MLS
  listings.
- **Streaming responses** — tokens stream from Gemini as they're generated.
- **Live tool-call visualization** — every `search_listings` or `calculate_mortgage`
  call renders as a spinner that flips to a checkmark + result chip when done.
- **Interactive map** — Mapbox dark map with price-pill pins. Click a pin to
  focus a listing; click a listing card to fly the map to it.
- **Horizontal listing strip** — scroll through the active result set under the
  map. Active card auto-scrolls into view.
- **Mortgage calculator** — US conventional mortgage with PMI when LTV > 80%,
  matching the backend's `calculate_mortgage` tool.

## Tech stack

| Layer    | Stack                                            |
|----------|--------------------------------------------------|
| Frontend | React 19 + Vite 8, Mapbox GL JS, plain CSS       |
| Backend  | FastAPI, Uvicorn, `google-genai` SDK             |
| Model    | Gemini 2.5 Flash with function calling           |
| Data     | Repliers MLS API (live US listings)              |
| Streaming| Server: `StreamingResponse` NDJSON • Client: `fetch` + `ReadableStream` |

No framework lock-in beyond React; no state-management library, no UI kit.
The agent loop is ~80 lines.

## Architecture

```
┌─ Frontend (Vite/React) ──────────────┐    ┌─ Backend (FastAPI) ─────────────┐
│                                      │    │                                 │
│   App.jsx                            │    │   server.py                     │
│   ├── streamMessage()  ─── POST ─────┼───►│   /chat/stream                  │
│   │                                  │    │      │                          │
│   │   NDJSON stream:                 │    │      ▼                          │
│   │   { type: "tool_start", … }   ◄──┼────┤   agent.run_agent_stream()      │
│   │   { type: "tool_end",   … }      │    │      │                          │
│   │   { type: "text",       … }      │    │      ├─ Gemini stream          │
│   │   { type: "done",       … }      │    │      │  (function calling)     │
│   │                                  │    │      │                          │
│   ├── AssistantTurn  ── renders ─────┤    │      ├─ search_listings()      │
│   ├── ListingMap     ── Mapbox pins  │    │      │     └─ Repliers API     │
│   └── MortgageModal  ── calc          │    │      │                          │
│                                      │    │      └─ calculate_mortgage()    │
└──────────────────────────────────────┘    └─────────────────────────────────┘
```

## Project layout

```
homeagent/
├── backend/
│   ├── agent.py          # Tool definitions + agent loop (sync + streaming)
│   ├── server.py         # FastAPI app: /chat, /chat/stream, /health
│   ├── requirements.txt
│   └── .env              # GEMINI_API_KEY, REPLIERS_API_KEY
└── frontend/real-estate-agent/
    └── src/
        ├── App.jsx                       # Top-level layout + state
        ├── api.js                        # streamMessage(), sendMessage()
        ├── styles.css                    # All styling (dark theme)
        ├── lib/
        │   ├── parse.js                  # parseAgentResponse, mergeListingData
        │   └── mortgage.js               # calcMortgage
        └── components/
            ├── Icons.jsx
            ├── ListingMap.jsx            # Mapbox map + price-pill pins
            ├── ListingCards.jsx          # ListingCard, SideCard
            ├── StripCard.jsx             # Compact card for the bottom strip
            ├── AssistantTurn.jsx
            ├── MarkdownProse.jsx         # Inline markdown renderer
            ├── ToolLine.jsx              # Live tool-call row
            └── MortgageModal.jsx
```

## Setup

### Prerequisites

- Python 3.11+
- Node 20+
- A free [Gemini API key](https://aistudio.google.com/app/apikey)
- A free [Repliers API key](https://repliers.com) (sample tier is fine)
- A free [Mapbox public token](https://account.mapbox.com/access-tokens/)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # then fill in the keys
./.venv/bin/uvicorn server:app --reload --port 8000
```

`.env`:
```
GEMINI_API_KEY=...
REPLIERS_API_KEY=...
```

### Frontend

```bash
cd frontend/real-estate-agent
npm install
cp .env.example .env.local # then add VITE_MAPBOX_TOKEN
npm run dev                # http://localhost:5173
```

`.env.local`:
```
VITE_MAPBOX_TOKEN=pk.eyJ1...
```

## How the streaming protocol works

The frontend opens a `POST` to `/chat/stream` and reads NDJSON. The backend
yields four event types as the agent loop runs:

```json
{"type": "tool_start", "name": "search_listings", "args": {"city": "Austin", "state": "TX", "max_price": 800000}}
{"type": "tool_end",   "name": "search_listings", "result": {"count": 5, "listings": [...]}}
{"type": "text",       "chunk": "I found 5 listings in Austin..."}
{"type": "text",       "chunk": " under $800,000."}
{"type": "done",       "session_id": "abc-123", "tool_calls": [...]}
```

The frontend dispatches each event:

- `tool_start` → push a "running" entry into the assistant message's `toolEvents`.
- `tool_end` → flip the matching entry to `done` with the result.
- `text` → append to the streaming message body.
- `done` → finalize. Listings parsed from the model's `<<<LISTINGS:…>>>` block
  are merged with the raw tool results (the model sometimes drops fields like
  `lat`/`lng`/`image`, so we backfill them from the tool's payload).

## Data sources

- **Live data**: Repliers MLS API for the US South + Mountain West (NC, TN, TX,
  CO, FL, MO, SC, KS). Cities with strong coverage include Austin, Charlotte,
  Nashville, Tampa, Denver, Kansas City. Sampling the API at the sample tier
  returned ~29k active US listings.
- **Not available**: NYC, California, Chicago, Boston, DC, the Pacific
  Northwest, and all of Canada. CREA-controlled markets (Canada) require
  REALTOR® affiliation; the agent declines and redirects to a covered city.

The `search_listings` tool accepts a `property_type` argument but applies it as
a post-filter on the `class` field (Repliers' `type` URL param expects
`sale`/`lease`, not property class).

## Known limitations / next steps

- Listing pagination — only top 5 results are returned per query today; the API
  supports more but the agent's prompt caps it for UX.
- No persistence — sessions live in an in-memory `dict` on the backend; restart
  drops history. Easy swap to Redis or SQLite.
- Mapbox bundle is heavy (~700KB minified). Code-splitting the map would shave
  noticeable bytes from the initial JS payload but adds complexity.
- Some Repliers listing fields (walk score, transit score, school ratings,
  commute times) are estimated by the model from neighborhood knowledge —
  consistent across requests because the agent runs at low temperature, but
  not authoritative. Production would call a real walk-score / GreatSchools API.

## License

MIT.
