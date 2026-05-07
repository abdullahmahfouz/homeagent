#!/usr/bin/env python3
"""
HomeAgent CLI — Agentic real estate assistant for GTA
Usage: python agent.py
"""

import anthropic
import json
import math
import os
import sys
from typing import Any

from dotenv import load_dotenv

load_dotenv()

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

# ─── Tool functions ────────────────────────────────────────────────────────────

def search_listings(
    max_price: int = 1000000,
    min_beds: int = 1,
    neighborhoods: list[str] = None,
    property_type: str = None,
    min_sqft: int = 0
) -> dict:
    """
    TODO: Replace with Repliers.io API call:
        GET https://api.repliers.io/listings
            ?maxPrice={max_price}
            &minBeds={min_beds}
            &city=Toronto
        headers: {"repliers-api-key": os.getenv("REPLIERS_API_KEY")}
    """
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
    """
    TODO: Replace with Walk Score API call:
        GET https://api.walkscore.com/score?
            wsapikey={key}&address={address}&city=Toronto
    """
    key = neighborhood.lower().strip()
    data = NEIGHBORHOOD_DATA.get(key)

    if not data:
        # Fuzzy match
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
        "avg_price_per_sqft": data["avg_price_sqft"]
    }


def calculate_mortgage(
    price: int,
    down_payment_pct: float = 20.0,
    amortization_years: int = 25,
    annual_rate_pct: float = 5.49
) -> dict:
    """Canadian mortgage with CMHC insurance rules."""
    down = price * (down_payment_pct / 100)
    principal = price - down

    # CMHC premium (required if down < 20%)
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
    monthly = total_principal * (monthly_rate * (1 + monthly_rate)**n) / ((1 + monthly_rate)**n - 1)

    # Stress test (qualifying rate = contract + 2%)
    stress_rate = (annual_rate_pct + 2.0) / 100 / 12
    stress_monthly = total_principal * (stress_rate * (1 + stress_rate)**n) / ((1 + stress_rate)**n - 1)
    min_income = stress_monthly * 12 / 0.32  # GDS ratio 32%

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
        "min_annual_income_needed": round(min_income)
    }


def get_market_trends(neighborhood: str) -> dict:
    """
    TODO: Replace with Repliers.io market stats endpoint.
    """
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


# ─── Tool dispatcher ───────────────────────────────────────────────────────────

TOOLS = [
    {
        "name": "search_listings",
        "description": "Search Toronto MLS listings by budget, bedrooms, neighborhood, and property type",
        "input_schema": {
            "type": "object",
            "properties": {
                "max_price":      {"type": "integer", "description": "Maximum price in CAD"},
                "min_beds":       {"type": "integer", "description": "Minimum bedrooms"},
                "neighborhoods":  {"type": "array", "items": {"type": "string"}, "description": "List of Toronto neighborhoods"},
                "property_type":  {"type": "string", "description": "condo, semi-detached, detached, townhouse"},
                "min_sqft":       {"type": "integer", "description": "Minimum square footage"}
            }
        }
    },
    {
        "name": "get_neighborhood_scores",
        "description": "Get walk score, transit score, school ratings, and commute time for a Toronto neighborhood",
        "input_schema": {
            "type": "object",
            "required": ["neighborhood"],
            "properties": {
                "neighborhood": {"type": "string", "description": "Toronto neighborhood name"}
            }
        }
    },
    {
        "name": "calculate_mortgage",
        "description": "Calculate Canadian mortgage with CMHC insurance, stress test, and minimum income required",
        "input_schema": {
            "type": "object",
            "required": ["price"],
            "properties": {
                "price":               {"type": "integer",  "description": "Property price in CAD"},
                "down_payment_pct":    {"type": "number",   "description": "Down payment percentage (5–50)"},
                "amortization_years":  {"type": "integer",  "description": "Amortization period (15, 20, 25, 30)"},
                "annual_rate_pct":     {"type": "number",   "description": "Annual interest rate percentage"}
            }
        }
    },
    {
        "name": "get_market_trends",
        "description": "Get average prices, year-over-year change, and days on market for a Toronto neighborhood",
        "input_schema": {
            "type": "object",
            "required": ["neighborhood"],
            "properties": {
                "neighborhood": {"type": "string"}
            }
        }
    }
]


def dispatch_tool(name: str, inputs: dict) -> Any:
    if name == "search_listings":
        return search_listings(**inputs)
    elif name == "get_neighborhood_scores":
        return get_neighborhood_scores(**inputs)
    elif name == "calculate_mortgage":
        return calculate_mortgage(**inputs)
    elif name == "get_market_trends":
        return get_market_trends(**inputs)
    else:
        return {"error": f"Unknown tool: {name}"}


# ─── Agent loop ────────────────────────────────────────────────────────────────

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


def run_agent(user_message: str, history: list) -> tuple[str, list]:
    """Run one turn of the agent loop. Returns (response_text, updated_history)."""
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    messages = history + [{"role": "user", "content": user_message}]

    print("\n  🤔 Thinking...", flush=True)

    while True:
        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=2048,
            system=SYSTEM,
            tools=TOOLS,
            messages=messages
        )

        # Append assistant turn to messages
        messages.append({"role": "assistant", "content": response.content})

        # If no tool calls — we're done
        if response.stop_reason == "end_turn":
            text = next((b.text for b in response.content if hasattr(b, "text")), "")
            return text, messages

        # Execute tool calls
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                print(f"  ⚡ {block.name}({json.dumps(block.input, separators=(',',':'))})", flush=True)
                result = dispatch_tool(block.name, block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(result)
                })

        messages.append({"role": "user", "content": tool_results})


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main():
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("❌  Set ANTHROPIC_API_KEY environment variable first")
        print("    export ANTHROPIC_API_KEY=sk-ant-...")
        sys.exit(1)

    print("\n╔═══════════════════════════════════════╗")
    print("║       HomeAgent — GTA Real Estate     ║")
    print("║  Type your search. 'quit' to exit.    ║")
    print("╚═══════════════════════════════════════╝\n")

    history = []

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

        response, history = run_agent(user_input, history)
        print(f"\nHomeAgent:\n{response}\n")
        print("─" * 60)


if __name__ == "__main__":
    main()
