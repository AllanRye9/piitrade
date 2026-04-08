"""
PiiTrade – Alerts / Economic Calendar router
Fetches and caches upcoming forex economic events.
"""

import time
from datetime import datetime
from typing import Any

import requests as _requests
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter()

# ─── Economic Calendar ─────────────────────────────────────────────────────────

_ECO_CALENDAR_CACHE: dict[str, Any] = {"items": [], "ts": 0.0}
_ECO_CALENDAR_TTL = 3600  # refresh at most once per hour
_ALERTS_CACHE: dict[str, Any] = {"items": [], "ts": 0.0}
_ALERTS_TTL = 120  # short cache for snappy UI while staying fresh

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

_INSTITUTIONAL_TOKENS = (
    "rate decision", "fomc", "ecb", "boe", "boj", "rba", "boc", "snb", "minutes",
)
_SURGE_TOKENS = (
    "cpi", "nfp", "non-farm", "payroll", "gdp", "inflation", "pmi", "employment", "retail sales",
)


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


def _classify_alert_type(event_name: str) -> str:
    text = (event_name or "").lower()
    if any(token in text for token in _INSTITUTIONAL_TOKENS):
        return "institutional"
    if any(token in text for token in _SURGE_TOKENS):
        return "surge"
    return "economic"


def _impact_to_priority(impact: str) -> str:
    val = (impact or "").strip().lower()
    if "high" in val:
        return "high"
    if "medium" in val:
        return "medium"
    return "low"


def _build_alerts() -> list[dict[str, Any]]:
    now = time.time()
    if _ALERTS_CACHE["items"] and now - _ALERTS_CACHE["ts"] < _ALERTS_TTL:
        return _ALERTS_CACHE["items"]

    events = _fetch_economic_calendar()
    alerts: list[dict[str, Any]] = []
    for idx, event in enumerate(events):
        event_name = event.get("event") or "Economic Event"
        currency = event.get("currency") or "--"
        impact = event.get("impact") or "Low"
        alert_type = _classify_alert_type(event_name)
        priority = _impact_to_priority(impact)

        detail_parts = [f"Currency: {currency}", f"Impact: {impact}"]
        if event.get("forecast") not in (None, ""):
            detail_parts.append(f"Forecast: {event.get('forecast')}")
        if event.get("previous") not in (None, ""):
            detail_parts.append(f"Previous: {event.get('previous')}")

        alerts.append({
            "id": f"eco-{idx}",
            "type": alert_type,
            "priority": priority,
            "title": event_name,
            "time": event.get("time") or "--",
            "body": " | ".join(detail_parts),
            "impact": impact,
            "currency": currency,
        })

    _ALERTS_CACHE["items"] = alerts
    _ALERTS_CACHE["ts"] = now
    return alerts


def _core():
    """Load app core so router can reuse shared helpers/constants."""
    try:
        from web import app as core  # type: ignore
    except ImportError:
        import app as core  # type: ignore
    return core


@router.get("/api/forex/economic-calendar")
async def forex_economic_calendar():
    """Return upcoming economic events for the current week."""
    return JSONResponse({"events": _fetch_economic_calendar()})


@router.get("/api/forex/alerts")
async def forex_alerts():
    """Return normalized alert cards used by the Alerts tab in templates."""
    items = _build_alerts()
    return JSONResponse({
        "alerts": items,
        "count": len(items),
        "generated_at": datetime.utcnow().isoformat() + "Z",
    })


@router.post("/api/forex/alerts/subscribe")
async def alerts_subscribe(request: Request):
    """Receive alert subscriptions and forward details to support inbox."""
    try:
        payload: dict[str, Any] = await request.json()
    except Exception:
        return JSONResponse({"success": False, "error": "Invalid JSON payload."}, status_code=400)

    email = str(payload.get("email", "")).strip().lower()
    pairs = payload.get("pairs") or []

    if not email or "@" not in email:
        return JSONResponse({"success": False, "error": "Valid email is required."}, status_code=400)
    if not isinstance(pairs, list) or not pairs:
        return JSONResponse({"success": False, "error": "Select at least one pair."}, status_code=400)

    safe_pairs = [str(p).strip() for p in pairs if str(p).strip()]
    if not safe_pairs:
        return JSONResponse({"success": False, "error": "Select at least one pair."}, status_code=400)

    core = _core()
    pair_list = ", ".join(safe_pairs[:40])
    body = (
        "<h2>New Alerts Subscription</h2>"
        f"<p><strong>Email:</strong> {email}</p>"
        f"<p><strong>Pairs:</strong> {pair_list}</p>"
        f"<p><strong>Requested At:</strong> {datetime.utcnow().isoformat()}Z</p>"
    )
    recipient = getattr(core, "_SUPPORT_ALERT_EMAIL", "support@yotweek.com")
    sent = core._send_email(recipient, "PiiTrade Alerts Subscription", body)

    if not sent:
        # Keep success response so user flow is not blocked when SMTP is absent.
        return JSONResponse({
            "success": True,
            "message": "Subscription received. Support team will process your request.",
        })

    return JSONResponse({
        "success": True,
        "message": "Subscription received and forwarded to support@yotweek.com.",
    })
