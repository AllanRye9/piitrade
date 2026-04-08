"""
PiiTrade – Alerts / Economic Calendar router
Fetches and caches upcoming forex economic events.
"""

import time
from datetime import datetime
from typing import Any

import requests as _requests
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()

# ─── Economic Calendar ─────────────────────────────────────────────────────────

_ECO_CALENDAR_CACHE: dict[str, Any] = {"items": [], "ts": 0.0}
_ECO_CALENDAR_TTL = 3600  # refresh at most once per hour

_FALLBACK_EVENTS: list[dict[str, Any]] = [
    {"time": "Mon 12:30", "event": "US CPI y/y", "currency": "USD", "impact": "High"},
    {"time": "Tue 12:45", "event": "ECB Rate Decision", "currency": "EUR", "impact": "High"},
    {"time": "Wed 09:00", "event": "UK Unemployment Rate", "currency": "GBP", "impact": "Medium"},
    {"time": "Thu 00:00", "event": "Japan Tankan Index", "currency": "JPY", "impact": "Medium"},
    {"time": "Fri 12:30", "event": "US Non-Farm Payrolls", "currency": "USD", "impact": "High"},
    {"time": "Mon 14:00", "event": "ISM Manufacturing PMI", "currency": "USD", "impact": "Medium"},
    {"time": "Tue 09:30", "event": "UK GDP m/m", "currency": "GBP", "impact": "High"},
    {"time": "Wed 12:30", "event": "Canadian CPI", "currency": "CAD", "impact": "High"},
    {"time": "Thu 12:30", "event": "US Retail Sales m/m", "currency": "USD", "impact": "Medium"},
    {"time": "Fri 01:30", "event": "Australian Employment Change", "currency": "AUD", "impact": "High"},
]

_ECO_CURRENCY_MAP = {
    "usd": "USD", "eur": "EUR", "gbp": "GBP", "jpy": "JPY",
    "aud": "AUD", "cad": "CAD", "chf": "CHF", "nzd": "NZD",
    "cny": "CNY", "mxn": "MXN", "sek": "SEK", "nok": "NOK",
}


def _fetch_economic_calendar() -> list[dict[str, Any]]:
    """Fetch current-week economic events from ForexFactory public JSON feed.

    Falls back to curated static events when the feed is unreachable.
    """
    now = time.time()
    if _ECO_CALENDAR_CACHE["items"] and now - _ECO_CALENDAR_CACHE["ts"] < _ECO_CALENDAR_TTL:
        return _ECO_CALENDAR_CACHE["items"]

    events: list[dict[str, Any]] = []
    try:
        resp = _requests.get(
            "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
            timeout=6,
            headers={"User-Agent": "PiiTrade/1.0 (+https://piitrade.com)"},
        )
        resp.raise_for_status()
        raw: list[dict[str, Any]] = resp.json()
        for item in raw:
            impact_raw = (item.get("impact") or "").strip().lower()
            if impact_raw == "holiday":
                continue
            # Map impact level
            if "high" in impact_raw:
                impact = "High"
            elif "medium" in impact_raw or "moderate" in impact_raw:
                impact = "Medium"
            else:
                impact = "Low"
            # Parse ISO-8601 date/time to a readable label
            date_str = item.get("date") or ""
            try:
                dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                day_abbr = dt.strftime("%a")
                time_label = dt.strftime("%H:%M")
                display_time = f"{day_abbr} {time_label}"
            except Exception:
                display_time = date_str[:16] if date_str else "—"

            currency_raw = (item.get("country") or "").strip().lower()
            currency = _ECO_CURRENCY_MAP.get(currency_raw, currency_raw.upper() or "—")

            events.append({
                "time": display_time,
                "event": item.get("title") or item.get("name") or "Economic Event",
                "currency": currency,
                "impact": impact,
                "actual": item.get("actual"),
                "forecast": item.get("forecast"),
                "previous": item.get("previous"),
            })
    except Exception:
        pass

    if not events:
        events = list(_FALLBACK_EVENTS)

    _ECO_CALENDAR_CACHE["items"] = events[:30]
    _ECO_CALENDAR_CACHE["ts"] = now
    return _ECO_CALENDAR_CACHE["items"]


@router.get("/api/forex/economic-calendar")
async def forex_economic_calendar():
    """Return upcoming economic events for the current week."""
    return JSONResponse({"events": _fetch_economic_calendar()})
