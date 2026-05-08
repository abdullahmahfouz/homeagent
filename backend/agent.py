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
    params = {
        "maxPrice": max_price,
        "minBeds": min_beds,
        "pageSize": 5,
    }
    if city:
        params["city"] = city
    if state:
        params["state"] = state
    if property_type:
        params["type"] = property_type

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
    listings = listings[:5]

    results = []
    for l in listings:
        addr = l.get("address", {}) or {}
        details = l.get("details", {}) or {}
        street = f"{addr.get('streetNumber','')} {addr.get('streetName','')} {addr.get('streetSuffix','')}".strip()
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

SYSTEM = """You are HomeAgent, a US real estate assistant.

You have two tools: search_listings, calculate_mortgage.

ALWAYS call search_listings before answering any property search — never answer from memory alone.
Pass city and state to search_listings whenever the user mentions a location. If the user does not specify a location, ask them for one before searching.
For any budget or affordability question, call calculate_mortgage.

Format your final response clearly:
- Lead with a 1-sentence summary
- List properties with full address (street, city, state), price, beds/baths, sqft, and property type
- End with 2-3 follow-up suggestions the user might want

Be specific, confident, and concise. Prices are in USD."""


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
        print("\n  🤔 Thinking...", flush=True)

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
