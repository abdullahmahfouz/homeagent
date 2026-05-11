#!/usr/bin/env python3
"""
HomeAgent CLI — Agentic US real estate assistant (Gemini)
Usage: python agent.py
"""

import json
import os
import sys
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

MODEL = "gemini-2.5-flash"

# ─── Tool functions ───────────────────────────────────────────────────────────

def search_listings(
    max_price: int = 1000000,
    min_beds: int = 1,
    city: str = None,
    state: str = None,
    property_type: str = None,
    min_sqft: int = 0,
) -> dict:
    api_key = os.getenv("REPLIERS_API_KEY")

    if not api_key:
        return {
            "error": "REPLIERS_API_KEY not set in backend/.env",
            "count": 0,
            "listings": [],
        }

    import requests
    # Repliers `type` field is the transaction type (sale/lease), NOT property class.
    # We always want for-sale listings; property class filtering is done post-hoc.
    params = {
        "type": "sale",
        "maxPrice": max_price,
        "minBeds": min_beds,
        "pageSize": 20,
    }
    if city:
        params["city"] = city
    if state:
        params["state"] = state

    response = requests.get(
        "https://api.repliers.io/listings",
        params=params,
        headers={"repliers-api-key": api_key},
    )
    if response.status_code != 200:
        return {
            "error": f"Repliers API returned {response.status_code}: {response.text[:200]}",
            "count": 0,
            "listings": [],
        }
    data = response.json()
    listings = data.get("listings", []) if isinstance(data, dict) else data

    # Optional post-filter on property class
    if property_type:
        pt = property_type.lower().replace("-", "").replace(" ", "")
        class_match = {
            "condo":        ("condo",),
            "singlefamily": ("residential", "freehold"),
            "townhouse":    ("residential", "freehold"),
            "multifamily":  ("multifamily", "multi"),
        }.get(pt, (pt,))
        listings = [
            l for l in listings
            if any(m in (l.get("class", "") or "").lower() for m in class_match)
        ]
    listings = listings[:5]

    results = []
    for l in listings:
        addr = l.get("address", {}) or {}
        details = l.get("details", {}) or {}
        mp = l.get("map", {}) or {}
        street = f"{addr.get('streetNumber','')} {addr.get('streetName','')} {addr.get('streetSuffix','')}".strip()
        # Repliers returns lat/lng as strings sometimes; coerce to float
        def _f(v):
            try: return float(v) if v is not None else None
            except (TypeError, ValueError): return None
        results.append({
            "id": l.get("mlsNumber"),
            "address": street,
            "city": addr.get("city", ""),
            "state": addr.get("state", ""),
            "zip": addr.get("zip", ""),
            "neighborhood": addr.get("neighborhood", ""),
            "price": l.get("listPrice", 0),
            "beds": details.get("numBedrooms", 0),
            "baths": details.get("numBathrooms", 0),
            "sqft": details.get("sqft", 0),
            "property_type": details.get("propertyType", "") or l.get("class", ""),
            "days_on_market": l.get("daysOnMarket"),
            "image": (lambda imgs: f"https://cdn.repliers.io/{imgs[0]}?class=medium" if imgs else None)(l.get("images") or []),
            "lat": _f(mp.get("latitude")),
            "lng": _f(mp.get("longitude")),
        })

    return {"count": len(results), "listings": results}


def calculate_mortgage(
    price: int,
    down_payment_pct: float = 20.0,
    loan_term_years: int = 30,
    annual_rate_pct: float = 7.0,
) -> dict:
    """US conventional mortgage with PMI when LTV > 80%."""
    down = price * (down_payment_pct / 100)
    principal = price - down

    monthly_rate = (annual_rate_pct / 100) / 12
    n = loan_term_years * 12
    monthly_pi = principal * (monthly_rate * (1 + monthly_rate) ** n) / ((1 + monthly_rate) ** n - 1)

    pmi_monthly = 0
    if down_payment_pct < 20:
        # Typical US PMI: ~0.5%–1.5% annual of loan balance. Use 0.8% midpoint.
        pmi_monthly = (principal * 0.008) / 12

    monthly_total = monthly_pi + pmi_monthly
    # Lenders typically want housing cost ≤ 28% of gross income (front-end DTI)
    min_income = monthly_total * 12 / 0.28

    return {
        "price": price,
        "down_payment": round(down),
        "down_pct": down_payment_pct,
        "loan_amount": round(principal),
        "monthly_principal_interest": round(monthly_pi),
        "monthly_pmi": round(pmi_monthly),
        "monthly_payment": round(monthly_total),
        "loan_term_years": loan_term_years,
        "rate_pct": annual_rate_pct,
        "min_annual_income_needed": round(min_income),
    }


# ─── Tool declarations (Gemini schema) ────────────────────────────────────────

FUNCTION_DECLARATIONS = [
    {
        "name": "search_listings",
        "description": "Search US MLS listings by city, state, budget, bedrooms, and property type.",
        "parameters": {
            "type": "object",
            "properties": {
                "max_price":     {"type": "integer", "description": "Maximum price in USD"},
                "min_beds":      {"type": "integer", "description": "Minimum bedrooms"},
                "city":          {"type": "string",  "description": "US city name (e.g. 'Tampa', 'Austin')"},
                "state":         {"type": "string",  "description": "US state code (e.g. 'FL', 'TX', 'CA')"},
                "property_type": {"type": "string",  "description": "condo, single-family, townhouse, multi-family"},
                "min_sqft":      {"type": "integer", "description": "Minimum square footage"},
            },
        },
    },
    {
        "name": "calculate_mortgage",
        "description": "Calculate US conventional mortgage payment with PMI when down payment < 20%.",
        "parameters": {
            "type": "object",
            "required": ["price"],
            "properties": {
                "price":            {"type": "integer", "description": "Property price in USD"},
                "down_payment_pct": {"type": "number",  "description": "Down payment percentage (3-50)"},
                "loan_term_years":  {"type": "integer", "description": "Loan term (15 or 30 typical)"},
                "annual_rate_pct":  {"type": "number",  "description": "Annual interest rate percentage"},
            },
        },
    },
]

TOOL_FUNCTIONS = {
    "search_listings": search_listings,
    "calculate_mortgage": calculate_mortgage,
}


def dispatch_tool(name: str, args: dict) -> Any:
    fn = TOOL_FUNCTIONS.get(name)
    if not fn:
        return {"error": f"Unknown tool: {name}"}
    try:
        return fn(**args)
    except TypeError as e:
        return {"error": f"Bad args for {name}: {e}"}


# ─── Agent loop ───────────────────────────────────────────────────────────────

SYSTEM = """You are HomeAgent, a US real estate research assistant. You feed a
structured frontend, so EVERY response MUST follow the output contract below.

# Tools
- search_listings(city, state, max_price, min_beds, property_type, min_sqft)
- calculate_mortgage(price, down_payment_pct, loan_term_years, annual_rate_pct)

# Search behavior
- ALWAYS call search_listings before answering any property search — never invent
  listings or answer from memory.
- DEFAULT LOCATION: Austin, TX. If the user does NOT specify a city, search
  Austin (city="Austin", state="TX"). Do NOT ask "what city?" — just run the
  search and proceed. The user can redirect afterwards.
- COVERAGE: live US MLS via Repliers. Strong markets: Austin TX, Charlotte NC,
  Nashville TN, Tampa FL, Denver CO, Kansas City MO, Round Rock TX,
  Murfreesboro TN. States: TX, NC, TN, FL, CO, MO, SC, KS. Prices in USD.
- Markets NOT covered: NYC, California (SF/LA), Chicago, Boston, DC, Seattle,
  Pacific Northwest, US Northeast, all of Canada. When the user names an
  uncovered market, acknowledge it isn't covered and suggest 2 covered
  cities that fit their vibe (e.g. NYC walker → Austin or Denver;
  SF tech → Austin; Chicago → Kansas City; Toronto → Austin).
- Run search_listings without property_type unless the user was explicit.
  If results are zero in a covered market, retry once with broader criteria
  (drop property_type, +30% price, -1 bed) and narrate what you broadened.
- For mortgage / affordability questions, always call calculate_mortgage.

# Output contract (structured blocks the UI parses)
You MUST emit these tagged blocks at the end of every response. Use literal
characters `<<<` and `>>>`. JSON inside the blocks must be valid (double quotes,
no trailing commas).

1. WHENEVER search_listings returned ANY listings (count >= 1), you MUST emit a
   <<<LISTINGS:...>>> block containing EVERY listing the tool returned (do not
   drop any). Never describe properties in prose without also emitting the
   block. The UI hides them otherwise.
<<<LISTINGS:[{"id":"<mls>","address":"<street>, <city>, <state>","neighborhood":"<neighborhood or city>","price":<int USD>,"beds":<int>,"baths":<int>,"sqft":<int>,"walkScore":<0-100>,"transitScore":<0-100>,"commute":"<e.g. 25 min to downtown>","schools":"<named school + rating>","image":"<the exact image URL returned by search_listings, or null>","why":"<one short sentence on why this is a strong pick>","score":<0-100>}]>>>

2. ALWAYS emit (even when no listings):
<<<FOLLOWUPS:["short user-voice question 1","question 2","question 3"]>>>

3. For mortgage answers, ALSO emit:
<<<MORTGAGE:{"price":<int>,"down":<int>,"monthly":<int>,"pmi":<int>,"total":<int>}>>>

# Enriching fields the API does NOT return
search_listings returns: id, address, city, state, zip, neighborhood, price,
beds, baths, sqft, property_type. It does NOT return walkScore, transitScore,
commute, schools — estimate these from your knowledge of the neighborhood:
- walkScore: 90+ for Manhattan / SF Mission / Chicago Loop, 70–90 dense urban,
  40–70 inner suburbs, <40 car-dependent.
- transitScore: similar scale, much lower outside major-transit metros.
- commute: realistic "X min to <downtown / nearest major hub>".
- schools: a real, well-known school in that catchment with a plausible rating
  (e.g. "PS 199 Jessie Isidor Straus (8.7/10)"). Never write "good schools nearby".
- score: your overall relevance score for this user's query (60–98 typical).
- why: one specific sentence — what makes this listing a contender for THIS user.

# Prose style — IMPORTANT
- Plain conversational English, no markdown formatting at all.
- DO NOT use `**bold**`, `*italics*`, `#` headings, or bullet lists in your prose.
  Asterisks render as raw characters in the UI.
- DO NOT write inline lists of suggestions like "* Adjust your budget" — put
  those in the FOLLOWUPS block instead.
- DO NOT narrate tool actions in prose ("Searching MLS...", "Pulling scores...").
  The UI shows tool calls live as they fire — narrating them is redundant.
- Lead with one specific sentence summarizing what you found.
- Keep total prose to 1–3 sentences.

Be specific, confident, concise. Prices in USD."""


def run_agent(
    client: genai.Client,
    user_message: str,
    history: list,
    verbose: bool = True,
) -> tuple[str, list, list]:
    """Run one turn of the agent loop. Returns (response_text, updated_history, tool_calls)."""

    contents = list(history) + [
        types.Content(role="user", parts=[types.Part(text=user_message)])
    ]

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM,
        tools=[types.Tool(function_declarations=FUNCTION_DECLARATIONS)],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        temperature=0.3,
    )

    if verbose:
        print("\n   Thinking...", flush=True)

    tool_calls: list = []

    while True:
        response = client.models.generate_content(
            model=MODEL,
            contents=contents,
            config=config,
        )

        candidate = response.candidates[0]
        contents.append(candidate.content)

        function_calls = response.function_calls or []

        if not function_calls:
            text = response.text or ""
            return text, contents, tool_calls

        function_response_parts = []
        for fc in function_calls:
            args = dict(fc.args or {})
            if verbose:
                print(f"  ⚡ {fc.name}({json.dumps(args, separators=(',', ':'))})", flush=True)
            result = dispatch_tool(fc.name, args)
            tool_calls.append({"name": fc.name, "args": args, "result": result})
            function_response_parts.append(
                types.Part.from_function_response(name=fc.name, response={"result": result})
            )

        contents.append(types.Content(role="user", parts=function_response_parts))


def run_agent_stream(client: genai.Client, user_message: str, history: list):
    """Streaming agent loop. Yields dict events:
        {"type":"text",       "chunk": "..."}
        {"type":"tool_start", "name": "...", "args": {...}}
        {"type":"tool_end",   "name": "...", "result": {...}}
        {"type":"done",       "tool_calls": [...], "history": [...]}   # history is non-JSON; server pops it.
    """
    contents = list(history) + [
        types.Content(role="user", parts=[types.Part(text=user_message)])
    ]
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM,
        tools=[types.Tool(function_declarations=FUNCTION_DECLARATIONS)],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        temperature=0.3,
    )

    tool_calls_log: list = []

    while True:
        full_text = ""
        pending_calls: list = []

        for chunk in client.models.generate_content_stream(
            model=MODEL, contents=contents, config=config
        ):
            if not chunk.candidates:
                continue
            for part in (chunk.candidates[0].content.parts or []):
                if getattr(part, "text", None):
                    full_text += part.text
                    yield {"type": "text", "chunk": part.text}
                if getattr(part, "function_call", None):
                    pending_calls.append(part.function_call)

        # Reconstruct the model's turn for history continuity
        model_parts: list = []
        if full_text:
            model_parts.append(types.Part(text=full_text))
        for fc in pending_calls:
            model_parts.append(types.Part(function_call=fc))
        contents.append(types.Content(role="model", parts=model_parts))

        if not pending_calls:
            yield {"type": "done", "tool_calls": tool_calls_log, "history": contents}
            return

        function_response_parts = []
        for fc in pending_calls:
            args = dict(fc.args or {})
            yield {"type": "tool_start", "name": fc.name, "args": args}
            result = dispatch_tool(fc.name, args)
            tool_calls_log.append({"name": fc.name, "args": args, "result": result})
            yield {"type": "tool_end", "name": fc.name, "result": result}
            function_response_parts.append(
                types.Part.from_function_response(name=fc.name, response={"result": result})
            )
        contents.append(types.Content(role="user", parts=function_response_parts))


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print(" Set GEMINI_API_KEY in backend/.env")
        print("    GEMINI_API_KEY=AIza...")
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    print("\n╔═══════════════════════════════════════╗")
    print("║       HomeAgent — US Real Estate      ║")
    print("║  Type your search. 'quit' to exit.    ║")
    print("╚═══════════════════════════════════════╝\n")

    history: list = []

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n\nGoodbye!")
            break

        if not user_input:
            continue
        if user_input.lower() in ("quit", "exit", "q"):
            print("Goodbye!")
            break

        try:
            response, history, _ = run_agent(client, user_input, history)
        except Exception as e:
            print(f"\n❌  Error: {e}\n")
            continue

        print(f"\nHomeAgent:\n{response}\n")
        print("─" * 60)


if __name__ == "__main__":
    main()
