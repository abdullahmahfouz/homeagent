#!/usr/bin/env python3
"""
HomeAgent CLI — Agentic real estate assistant for GTA (Gemini)
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

# ─── Mock data (swap for Repliers.io later) ───────────────────────────────────
MOCK_LISTINGS = [
    {
        "id": 1,
        "address": "47 Rosedale Valley Rd",
        "neighborhood": "Rosedale",
        "price": 789000,
        "beds": 3, "baths": 2, "sqft": 1340,
        "property_type": "semi-detached",
        "listing_url": "https://repliers.io/listing/1"
    },
    {
        "id": 2,
        "address": "1205 Bathurst St #412",
        "neighborhood": "Annex",
        "price": 729000,
        "beds": 3, "baths": 2, "sqft": 1180,
        "property_type": "condo",
        "listing_url": "https://repliers.io/listing/2"
    },
    {
        "id": 3,
        "address": "312 Broadview Ave",
        "neighborhood": "Riverdale",
        "price": 845000,
        "beds": 3, "baths": 2, "sqft": 1520,
        "property_type": "semi-detached",
        "listing_url": "https://repliers.io/listing/3"
    },
    {
        "id": 4,
        "address": "88 Ossington Ave #201",
        "neighborhood": "Trinity Bellwoods",
        "price": 668000,
        "beds": 2, "baths": 2, "sqft": 1050,
        "property_type": "condo",
        "listing_url": "https://repliers.io/listing/4"
    },
    {
        "id": 5,
        "address": "221 Danforth Ave",
        "neighborhood": "Greektown",
        "price": 799000,
        "beds": 3, "baths": 2, "sqft": 1400,
        "property_type": "townhouse",
        "listing_url": "https://repliers.io/listing/5"
    },
]

NEIGHBORHOOD_DATA = {
    "rosedale":         {"walk": 82, "transit": 78, "school": "Rosedale Jr PS (9.1/10)", "commute_min": 28, "avg_price_sqft": 720},
    "annex":            {"walk": 91, "transit": 92, "school": "Huron St PS (8.6/10)",    "commute_min": 22, "avg_price_sqft": 780},
    "riverdale":        {"walk": 76, "transit": 71, "school": "Riverdale CI (8.2/10)",   "commute_min": 31, "avg_price_sqft": 650},
    "trinity bellwoods":{"walk": 94, "transit": 88, "school": "Ossington PS (7.9/10)",   "commute_min": 19, "avg_price_sqft": 810},
    "greektown":        {"walk": 84, "transit": 86, "school": "Earl Haig PS (8.4/10)",   "commute_min": 26, "avg_price_sqft": 620},
    "leslieville":      {"walk": 85, "transit": 79, "school": "Leslieville PS (8.1/10)", "commute_min": 29, "avg_price_sqft": 640},
    "north york":       {"walk": 72, "transit": 81, "school": "Various (7.5–8.5/10)",    "commute_min": 38, "avg_price_sqft": 550},
    "scarborough":      {"walk": 62, "transit": 69, "school": "Various (7.0–8.0/10)",    "commute_min": 44, "avg_price_sqft": 480},
    "etobicoke":        {"walk": 65, "transit": 70, "school": "Various (7.5–8.3/10)",    "commute_min": 40, "avg_price_sqft": 520},
}

# ─── Tool functions ───────────────────────────────────────────────────────────

def search_listings(
    max_price: int = 1000000,
    min_beds: int = 1,
    neighborhoods: list[str] | None = None,
    property_type: str | None = None,
    min_sqft: int = 0,
) -> dict:
    results = [l for l in MOCK_LISTINGS if l["price"] <= max_price and l["beds"] >= min_beds]

    if neighborhoods:
        normalized = [n.lower() for n in neighborhoods]
        results = [l for l in results if any(n in l["neighborhood"].lower() for n in normalized)]

    if property_type:
        results = [l for l in results if property_type.lower() in l["property_type"].lower()]

    if min_sqft:
        results = [l for l in results if l["sqft"] >= min_sqft]

    return {"count": len(results), "listings": results}


def get_neighborhood_scores(neighborhood: str) -> dict:
    key = neighborhood.lower().strip()
    data = NEIGHBORHOOD_DATA.get(key)

    if not data:
        for k, v in NEIGHBORHOOD_DATA.items():
            if k in key or key in k:
                data = v
                break

    if not data:
        data = {"walk": 70, "transit": 72, "school": "Data unavailable", "commute_min": 35, "avg_price_sqft": 600}

    return {
        "neighborhood": neighborhood,
        "walk_score": data["walk"],
        "transit_score": data["transit"],
        "top_school": data["school"],
        "commute_to_downtown_min": data["commute_min"],
        "avg_price_per_sqft": data["avg_price_sqft"],
    }


def calculate_mortgage(
    price: int,
    down_payment_pct: float = 20.0,
    amortization_years: int = 25,
    annual_rate_pct: float = 5.49,
) -> dict:
    """Canadian mortgage with CMHC insurance rules."""
    down = price * (down_payment_pct / 100)
    principal = price - down

    cmhc = 0
    if down_payment_pct < 20:
        ltv = principal / price
        if ltv > 0.90:
            cmhc_rate = 0.040
        elif ltv > 0.85:
            cmhc_rate = 0.031
        else:
            cmhc_rate = 0.028
        cmhc = principal * cmhc_rate

    total_principal = principal + cmhc
    monthly_rate = (annual_rate_pct / 100) / 12
    n = amortization_years * 12
    monthly = total_principal * (monthly_rate * (1 + monthly_rate) ** n) / ((1 + monthly_rate) ** n - 1)

    stress_rate = (annual_rate_pct + 2.0) / 100 / 12
    stress_monthly = total_principal * (stress_rate * (1 + stress_rate) ** n) / ((1 + stress_rate) ** n - 1)
    min_income = stress_monthly * 12 / 0.32  # GDS 32%

    return {
        "price": price,
        "down_payment": round(down),
        "down_pct": down_payment_pct,
        "cmhc_premium": round(cmhc),
        "total_mortgage": round(total_principal),
        "monthly_payment": round(monthly),
        "amortization_years": amortization_years,
        "rate_pct": annual_rate_pct,
        "stress_test_monthly": round(stress_monthly),
        "min_annual_income_needed": round(min_income),
    }


def get_market_trends(neighborhood: str) -> dict:
    trends = {
        "rosedale":          {"avg_price": 1100000, "yoy_change_pct": 3.2,  "avg_days_on_market": 18, "price_sqft": 720},
        "annex":             {"avg_price": 950000,  "yoy_change_pct": 4.1,  "avg_days_on_market": 14, "price_sqft": 780},
        "riverdale":         {"avg_price": 860000,  "yoy_change_pct": 2.8,  "avg_days_on_market": 21, "price_sqft": 650},
        "trinity bellwoods": {"avg_price": 1050000, "yoy_change_pct": 5.0,  "avg_days_on_market": 12, "price_sqft": 810},
        "greektown":         {"avg_price": 780000,  "yoy_change_pct": 2.1,  "avg_days_on_market": 24, "price_sqft": 620},
        "leslieville":       {"avg_price": 820000,  "yoy_change_pct": 3.5,  "avg_days_on_market": 19, "price_sqft": 640},
        "north york":        {"avg_price": 720000,  "yoy_change_pct": 1.8,  "avg_days_on_market": 28, "price_sqft": 550},
    }
    key = neighborhood.lower().strip()
    data = trends.get(key, {"avg_price": 800000, "yoy_change_pct": 2.5, "avg_days_on_market": 22, "price_sqft": 600})
    return {"neighborhood": neighborhood, **data}


# ─── Tool declarations (Gemini schema) ────────────────────────────────────────

FUNCTION_DECLARATIONS = [
    {
        "name": "search_listings",
        "description": "Search Toronto MLS listings by budget, bedrooms, neighborhood, and property type.",
        "parameters": {
            "type": "object",
            "properties": {
                "max_price":     {"type": "integer", "description": "Maximum price in CAD"},
                "min_beds":      {"type": "integer", "description": "Minimum bedrooms"},
                "neighborhoods": {"type": "array",  "items": {"type": "string"}, "description": "List of Toronto neighborhoods"},
                "property_type": {"type": "string", "description": "condo, semi-detached, detached, townhouse"},
                "min_sqft":      {"type": "integer", "description": "Minimum square footage"},
            },
        },
    },
    {
        "name": "get_neighborhood_scores",
        "description": "Get walk score, transit score, school ratings, and commute time for a Toronto neighborhood.",
        "parameters": {
            "type": "object",
            "required": ["neighborhood"],
            "properties": {
                "neighborhood": {"type": "string", "description": "Toronto neighborhood name"},
            },
        },
    },
    {
        "name": "calculate_mortgage",
        "description": "Calculate Canadian mortgage with CMHC insurance, stress test, and minimum income required.",
        "parameters": {
            "type": "object",
            "required": ["price"],
            "properties": {
                "price":              {"type": "integer", "description": "Property price in CAD"},
                "down_payment_pct":   {"type": "number",  "description": "Down payment percentage (5-50)"},
                "amortization_years": {"type": "integer", "description": "Amortization period (15, 20, 25, 30)"},
                "annual_rate_pct":    {"type": "number",  "description": "Annual interest rate percentage"},
            },
        },
    },
    {
        "name": "get_market_trends",
        "description": "Get average prices, year-over-year change, and days on market for a Toronto neighborhood.",
        "parameters": {
            "type": "object",
            "required": ["neighborhood"],
            "properties": {
                "neighborhood": {"type": "string"},
            },
        },
    },
]

TOOL_FUNCTIONS = {
    "search_listings": search_listings,
    "get_neighborhood_scores": get_neighborhood_scores,
    "calculate_mortgage": calculate_mortgage,
    "get_market_trends": get_market_trends,
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

SYSTEM = """You are HomeAgent, an expert real estate assistant specializing in the Greater Toronto Area.

You have access to real tools: search_listings, get_neighborhood_scores, calculate_mortgage, get_market_trends.

ALWAYS call the relevant tools before responding — never answer from memory alone.
For any property search: call search_listings first, then get_neighborhood_scores for the top results.
For any budget question: call calculate_mortgage.

Format your final response clearly:
- Lead with a 1-sentence summary
- List properties with address, price, key stats, and why it's recommended
- End with 2-3 follow-up suggestions the user might want

Be specific, confident, and concise. Use real Toronto context."""


def run_agent(client: genai.Client, user_message: str, history: list) -> tuple[str, list]:
    """Run one turn of the agent loop. Returns (response_text, updated_history)."""

    contents = list(history) + [
        types.Content(role="user", parts=[types.Part(text=user_message)])
    ]

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM,
        tools=[types.Tool(function_declarations=FUNCTION_DECLARATIONS)],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        temperature=0.3,
    )

    print("\n  🤔 Thinking...", flush=True)

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
            return text, contents

        function_response_parts = []
        for fc in function_calls:
            args = dict(fc.args or {})
            print(f"  ⚡ {fc.name}({json.dumps(args, separators=(',', ':'))})", flush=True)
            result = dispatch_tool(fc.name, args)
            function_response_parts.append(
                types.Part.from_function_response(name=fc.name, response={"result": result})
            )

        contents.append(types.Content(role="user", parts=function_response_parts))


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("❌  Set GEMINI_API_KEY in backend/.env")
        print("    GEMINI_API_KEY=AIza...")
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    print("\n╔═══════════════════════════════════════╗")
    print("║       HomeAgent — GTA Real Estate     ║")
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
            response, history = run_agent(client, user_input, history)
        except Exception as e:
            print(f"\n❌  Error: {e}\n")
            continue

        print(f"\nHomeAgent:\n{response}\n")
        print("─" * 60)


if __name__ == "__main__":
    main()
