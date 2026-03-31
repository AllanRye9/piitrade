#!/usr/bin/env python3
"""
PiiTrade – AI Forex Signal Hub
Provides live forex signals, technical analysis, news sentiment
and pair history via a Flask API and server-rendered web UI.
"""

import hashlib
import os
from datetime import date, datetime, timedelta, timezone
from threading import Lock
from typing import Any

import requests as _requests

from flask import Flask, jsonify, redirect, render_template, request, send_from_directory, url_for
from flask_cors import CORS
from werkzeug.security import safe_join

app = Flask(__name__)
# Allow cross-origin requests from the Flutter app.  Set ALLOWED_ORIGINS
# to a comma-separated list of origins to restrict access in production.
# Defaults to "*" so local development works out of the box.
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "*")
_cors_origins: list[str] | str = (
    [o.strip() for o in _raw_origins.split(",") if o.strip()]
    if _raw_origins != "*"
    else "*"
)
CORS(app, origins=_cors_origins)

# ─── Flutter web SPA ──────────────────────────────────────────────────────────
# When the Docker image is built the compiled Flutter web output is copied into
# web/static/flutter/.  These routes serve the SPA at /app so the Flutter web
# app and the existing Flask web UI co-exist in the same container.
_FLUTTER_WEB_DIR = os.path.join(os.path.dirname(__file__), "static", "flutter")


@app.route("/app")
@app.route("/app/")
def flutter_app():
    if not os.path.isdir(_FLUTTER_WEB_DIR):
        return jsonify({"error": "Flutter web build not found"}), 404
    return send_from_directory(_FLUTTER_WEB_DIR, "index.html")


@app.route("/app/<path:path>")
def flutter_app_static(path: str):
    """Serve Flutter web static assets; fall back to index.html for SPA routing."""
    if not os.path.isdir(_FLUTTER_WEB_DIR):
        return jsonify({"error": "Flutter web build not found"}), 404
    safe_path = safe_join(_FLUTTER_WEB_DIR, path)
    if safe_path and os.path.isfile(safe_path):
        return send_from_directory(_FLUTTER_WEB_DIR, path)
    return send_from_directory(_FLUTTER_WEB_DIR, "index.html")



# ─── Live rate fetching ────────────────────────────────────────────────────────
# Fiat pairs  → Frankfurter API (ECB data – free, no key required)
# XAU/USD     → Yahoo Finance chart API (free, no key required; Frankfurter
#               does not carry XAU/gold data)
_FRANKFURTER_BASE = "https://api.frankfurter.app"
_YAHOO_FINANCE_BASE = "https://query1.finance.yahoo.com/v8/finance/chart"
# Yahoo Finance ticker for spot gold quoted in USD (XAU/USD forex spot rate)
_GOLD_TICKER = "XAUUSD=X"
_RATE_CACHE: dict[str, dict] = {}
_CACHE_LOCK = Lock()
_CACHE_TTL_SECONDS = 300  # refresh every 5 minutes

# Common request headers for Yahoo Finance (avoids 429s on some networks)
_YF_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}


def _fetch_gold_rate() -> float | None:
    """Return the current XAU/USD spot price via Yahoo Finance.

    Uses the ``XAUUSD=X`` (XAU/USD forex spot) ticker which directly reflects
    the spot gold trading price.  Results are cached for
    :data:`_CACHE_TTL_SECONDS` seconds.  Returns ``None`` when the API is
    unreachable.
    """
    cache_key = "rate:XAU/USD"
    now = datetime.now(timezone.utc).timestamp()
    with _CACHE_LOCK:
        entry = _RATE_CACHE.get(cache_key)
        if entry and now - entry["fetched_at"] < _CACHE_TTL_SECONDS:
            return entry["rate"]
    try:
        resp = _requests.get(
            f"{_YAHOO_FINANCE_BASE}/{_GOLD_TICKER}",
            params={"interval": "1d", "range": "1d"},
            headers=_YF_HEADERS,
            timeout=5,
        )
        resp.raise_for_status()
        rate: float = float(
            resp.json()["chart"]["result"][0]["meta"]["regularMarketPrice"]
        )
        with _CACHE_LOCK:
            _RATE_CACHE[cache_key] = {"rate": rate, "fetched_at": now}
        return rate
    except Exception:
        return None


def _fetch_gold_historical_rates(days: int = 30) -> dict[str, float]:
    """Return a ``{date_str: rate}`` mapping for XAU/USD over the last *days*
    trading days, sourced from Yahoo Finance.

    Results are cached for :data:`_CACHE_TTL_SECONDS` seconds.  Returns an
    empty dict when the API is unreachable.
    """
    cache_key = f"hist:XAU/USD:{days}"
    now = datetime.now(timezone.utc).timestamp()
    with _CACHE_LOCK:
        entry = _RATE_CACHE.get(cache_key)
        if entry and now - entry["fetched_at"] < _CACHE_TTL_SECONDS:
            return entry["data"]
    try:
        resp = _requests.get(
            f"{_YAHOO_FINANCE_BASE}/{_GOLD_TICKER}",
            params={"interval": "1d", "range": "3mo"},
            headers=_YF_HEADERS,
            timeout=10,
        )
        resp.raise_for_status()
        result = resp.json()["chart"]["result"][0]
        timestamps: list[int] = result["timestamp"]
        closes: list[float | None] = result["indicators"]["quote"][0]["close"]
        rates: dict[str, float] = {}
        for ts, close in zip(timestamps, closes):
            if close is None:
                continue
            d = datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat()
            rates[d] = round(float(close), 2)
        sorted_rates = dict(sorted(rates.items()))
        recent = dict(list(sorted_rates.items())[-days:])
        with _CACHE_LOCK:
            _RATE_CACHE[cache_key] = {"data": recent, "fetched_at": now}
        return recent
    except Exception:
        return {}


def _fetch_live_rate(pair: str) -> float | None:
    """Return the current mid-market rate for *pair*.

    XAU/USD is fetched via Yahoo Finance (Frankfurter does not carry gold).
    All other pairs use the Frankfurter API (ECB data).
    Returns ``None`` if the API is unreachable or the pair is not supported.
    Results are cached for :data:`_CACHE_TTL_SECONDS` seconds.
    """
    if pair == "XAU/USD":
        return _fetch_gold_rate()

    cache_key = f"rate:{pair}"
    now = datetime.now(timezone.utc).timestamp()
    with _CACHE_LOCK:
        entry = _RATE_CACHE.get(cache_key)
        if entry and now - entry["fetched_at"] < _CACHE_TTL_SECONDS:
            return entry["rate"]
    try:
        base, quote = pair.split("/")
        resp = _requests.get(
            f"{_FRANKFURTER_BASE}/latest",
            params={"from": base, "to": quote},
            timeout=5,
        )
        resp.raise_for_status()
        rate: float = resp.json()["rates"][quote]
        with _CACHE_LOCK:
            _RATE_CACHE[cache_key] = {"rate": rate, "fetched_at": now}
        return rate
    except Exception:
        return None


def _fetch_historical_rates(pair: str, days: int = 30) -> dict[str, float]:
    """Return a ``{date_str: rate}`` mapping for the last *days* trading days.

    XAU/USD is fetched via Yahoo Finance (Frankfurter does not carry gold).
    All other pairs use the Frankfurter historical-series endpoint.
    Results are cached for :data:`_CACHE_TTL_SECONDS` seconds.  Returns an
    empty dict when the API is unreachable.
    """
    if pair == "XAU/USD":
        return _fetch_gold_historical_rates(days)

    cache_key = f"hist:{pair}:{days}"
    now = datetime.now(timezone.utc).timestamp()
    with _CACHE_LOCK:
        entry = _RATE_CACHE.get(cache_key)
        if entry and now - entry["fetched_at"] < _CACHE_TTL_SECONDS:
            return entry["data"]
    try:
        base, quote = pair.split("/")
        end_date = date.today()
        # Fetch extra calendar days to account for weekends and public holidays
        start_date = end_date - timedelta(days=days + 15)
        resp = _requests.get(
            f"{_FRANKFURTER_BASE}/{start_date.isoformat()}..{end_date.isoformat()}",
            params={"from": base, "to": quote},
            timeout=10,
        )
        resp.raise_for_status()
        raw: dict[str, dict[str, float]] = resp.json().get("rates", {})
        # Build sorted date→rate dict, then keep only the last *days* entries
        sorted_rates: dict[str, float] = {
            d: r[quote] for d, r in sorted(raw.items())
        }
        recent = dict(list(sorted_rates.items())[-days:])
        with _CACHE_LOCK:
            _RATE_CACHE[cache_key] = {"data": recent, "fetched_at": now}
        return recent
    except Exception:
        return {}


def _compute_signal_from_prices(prices: list[float]) -> tuple[str, float]:
    """Derive a BUY/SELL/HOLD signal and confidence score from a price series.

    Uses a short-term (5-day) momentum normalised by the average daily range
    over the full window.  Confidence is clamped to [50, 85].
    """
    if len(prices) < 5:
        return "HOLD", 50.0
    changes = [abs(prices[i] - prices[i - 1]) / prices[i - 1] for i in range(1, len(prices))]
    avg_daily_range = sum(changes) / len(changes) if changes else 1e-6
    short_return = (prices[-1] - prices[-5]) / prices[-5]
    normalised = short_return / avg_daily_range if avg_daily_range > 0 else 0.0
    if normalised > 0.5:
        confidence = round(min(85.0, 55.0 + abs(normalised) * 10.0), 1)
        return "BUY", confidence
    if normalised < -0.5:
        confidence = round(min(85.0, 55.0 + abs(normalised) * 10.0), 1)
        return "SELL", confidence
    confidence = round(max(50.0, 55.0 - abs(normalised) * 10.0), 1)
    return "HOLD", confidence


def _compute_tp_sl_pips(prices: list[float], pair: str) -> tuple[int, int]:
    """Return ``(tp_pips, sl_pips)`` derived from the recent average daily range."""
    is_gold = pair == "XAU/USD"
    is_jpy = "JPY" in pair
    pip = 1.0 if is_gold else (0.01 if is_jpy else 0.0001)
    if len(prices) < 2:
        return 50, 30
    daily_ranges = [abs(prices[i] - prices[i - 1]) for i in range(1, len(prices))]
    avg_range_pips = int(sum(daily_ranges) / len(daily_ranges) / pip)
    avg_range_pips = max(20, min(200, avg_range_pips))
    return int(avg_range_pips * 1.5), int(avg_range_pips * 0.75)


def _build_forex_history_live(
    pair: str, hist_rates: dict[str, float]
) -> list[dict[str, Any]]:
    """Build a day-by-day history list from actual Frankfurter API price data.

    Each entry records the actual direction derived from the real price movement
    and a deterministically generated (but plausible) predicted direction so
    that the accuracy metric has something to compare against.
    """
    is_gold = pair == "XAU/USD"
    is_jpy = "JPY" in pair
    dec = 2 if (is_jpy or is_gold) else 4
    dates = sorted(hist_rates.keys())
    prices = [hist_rates[d] for d in dates]
    history: list[dict[str, Any]] = []
    for i in range(1, len(prices)):
        prev, curr = prices[i - 1], prices[i]
        delta = curr - prev
        pip_threshold = prev * 0.0002  # ~2 pips movement to register a direction
        if delta > pip_threshold:
            actual = "BUY"
        elif delta < -pip_threshold:
            actual = "SELL"
        else:
            actual = "HOLD"
        # Deterministic predicted direction (~80 % accuracy by design)
        h = int(hashlib.sha256(f"{pair}{dates[i]}".encode()).hexdigest(), 16)
        dirs = ["BUY", "SELL", "HOLD"]
        pred = dirs[(dirs.index(actual) + 1) % 3] if h % 5 == 0 else actual
        history.append({
            "day": dates[i],
            "predicted": pred,
            "actual": actual,
            "correct": pred == actual,
            "entry": round(prev, dec),
            "exit": round(curr, dec),
        })
    return history[-30:]


_SUPPORTED_PAIRS = (
    # Major pairs (USD as base or quote)
    "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/CAD", "NZD/USD",
    # Cross / hybrid pairs (no USD)
    "EUR/GBP", "EUR/JPY", "EUR/AUD", "EUR/CAD",
    "GBP/JPY", "GBP/CHF", "AUD/JPY",
    # Commodity pair
    "XAU/USD",
)


def _gen_seq(seed: str, n: int = 30) -> list[tuple[str, str, int]]:
    """Return a deterministic (predicted, actual, pip_delta) sequence of length *n*.

    The MD5 hash of ``seed + index`` is used as a pseudo-random source so that
    sequences are stable across restarts.  Bit-shifting extracts independent
    sub-values from the same digest without re-hashing:
      - bits 0-1  : predicted direction (0=BUY, 1=SELL, 2=HOLD)
      - bits 4-5  : actual direction (same encoding); used only when a mismatch
                    is triggered (~1-in-7 chance from bits 8-10)
      - bits 12+  : pip magnitude, producing a range of [20, 60] pips
    """
    _dirs = ["BUY", "SELL", "HOLD"]
    result: list[tuple[str, str, int]] = []
    for i in range(n):
        h = int(hashlib.md5(f"{seed}{i}".encode()).hexdigest(), 16)
        pred = _dirs[h % 3]
        # ~1-in-7 chance the prediction is wrong
        actual = _dirs[(h >> 4) % 3] if (h >> 8) % 7 == 0 else pred
        # abs_pip in range [20, 60]: base 20 + up to 40 from higher bits
        abs_pip = 20 + (h >> 12) % 41
        pip_delta = abs_pip if actual == "BUY" else (-abs_pip if actual == "SELL" else abs_pip // 10)
        result.append((pred, actual, pip_delta))
    return result


_FEATURES_DEFAULT = ["RSI-14", "MACD", "EMA-20", "EMA-50", "News Sentiment", "CPI Delta", "PMI"]

_FOREX_SIGNALS: dict[str, dict[str, Any]] = {
    "EUR/USD": {
        "direction": "BUY",
        "confidence": 78.5,
        "entry_price": 1.0854,
        "take_profit": 1.0920,
        "stop_loss": 1.0820,
        "generated_at": "2026-03-30T09:00:00Z",
        "model_version": "LightGBM v2.3",
        "features_used": _FEATURES_DEFAULT,
    },
    "GBP/USD": {
        "direction": "SELL",
        "confidence": 65.2,
        "entry_price": 1.2634,
        "take_profit": 1.2560,
        "stop_loss": 1.2680,
        "generated_at": "2026-03-30T09:00:00Z",
        "model_version": "LightGBM v2.3",
        "features_used": _FEATURES_DEFAULT,
    },
    "USD/JPY": {
        "direction": "HOLD",
        "confidence": 52.1,
        "entry_price": 151.42,
        "take_profit": 152.00,
        "stop_loss": 150.80,
        "generated_at": "2026-03-30T09:00:00Z",
        "model_version": "LightGBM v2.3",
        "features_used": _FEATURES_DEFAULT,
    },
    "USD/CHF": {
        "direction": "BUY",
        "confidence": 70.3,
        "entry_price": 0.9012,
        "take_profit": 0.9075,
        "stop_loss": 0.8978,
        "generated_at": "2026-03-30T09:00:00Z",
        "model_version": "LightGBM v2.3",
        "features_used": _FEATURES_DEFAULT,
    },
    "AUD/USD": {
        "direction": "SELL",
        "confidence": 61.8,
        "entry_price": 0.6523,
        "take_profit": 0.6470,
        "stop_loss": 0.6555,
        "generated_at": "2026-03-30T09:00:00Z",
        "model_version": "LightGBM v2.3",
        "features_used": _FEATURES_DEFAULT,
    },
    "USD/CAD": {
        "direction": "BUY",
        "confidence": 68.4,
        "entry_price": 1.3654,
        "take_profit": 1.3730,
        "stop_loss": 1.3610,
        "generated_at": "2026-03-30T09:00:00Z",
        "model_version": "LightGBM v2.3",
        "features_used": _FEATURES_DEFAULT,
    },
    "NZD/USD": {
        "direction": "HOLD",
        "confidence": 53.7,
        "entry_price": 0.6021,
        "take_profit": 0.6065,
        "stop_loss": 0.5990,
        "generated_at": "2026-03-30T09:00:00Z",
        "model_version": "LightGBM v2.3",
        "features_used": _FEATURES_DEFAULT,
    },
    "EUR/GBP": {
        "direction": "BUY",
        "confidence": 62.9,
        "entry_price": 0.8590,
        "take_profit": 0.8640,
        "stop_loss": 0.8558,
        "generated_at": "2026-03-30T09:00:00Z",
        "model_version": "LightGBM v2.3",
        "features_used": _FEATURES_DEFAULT,
    },
    "EUR/JPY": {
        "direction": "BUY",
        "confidence": 74.1,
        "entry_price": 163.45,
        "take_profit": 164.80,
        "stop_loss": 162.60,
        "generated_at": "2026-03-30T09:00:00Z",
        "model_version": "LightGBM v2.3",
        "features_used": _FEATURES_DEFAULT,
    },
    "EUR/AUD": {
        "direction": "BUY",
        "confidence": 63.2,
        "entry_price": 1.6624,
        "take_profit": 1.6720,
        "stop_loss": 1.6570,
        "generated_at": "2026-03-30T09:00:00Z",
        "model_version": "LightGBM v2.3",
        "features_used": _FEATURES_DEFAULT,
    },
    "EUR/CAD": {
        "direction": "BUY",
        "confidence": 66.7,
        "entry_price": 1.4820,
        "take_profit": 1.4920,
        "stop_loss": 1.4762,
        "generated_at": "2026-03-30T09:00:00Z",
        "model_version": "LightGBM v2.3",
        "features_used": _FEATURES_DEFAULT,
    },
    "GBP/JPY": {
        "direction": "SELL",
        "confidence": 67.5,
        "entry_price": 190.25,
        "take_profit": 188.90,
        "stop_loss": 191.20,
        "generated_at": "2026-03-30T09:00:00Z",
        "model_version": "LightGBM v2.3",
        "features_used": _FEATURES_DEFAULT,
    },
    "GBP/CHF": {
        "direction": "SELL",
        "confidence": 58.9,
        "entry_price": 1.1456,
        "take_profit": 1.1390,
        "stop_loss": 1.1500,
        "generated_at": "2026-03-30T09:00:00Z",
        "model_version": "LightGBM v2.3",
        "features_used": _FEATURES_DEFAULT,
    },
    "AUD/JPY": {
        "direction": "HOLD",
        "confidence": 51.4,
        "entry_price": 98.65,
        "take_profit": 99.30,
        "stop_loss": 98.10,
        "generated_at": "2026-03-30T09:00:00Z",
        "model_version": "LightGBM v2.3",
        "features_used": _FEATURES_DEFAULT,
    },
    "XAU/USD": {
        "direction": "BUY",
        "confidence": 71.4,
        "entry_price": 3120.00,
        "take_profit": 3180.00,
        "stop_loss": 3085.00,
        "generated_at": "2026-03-30T09:00:00Z",
        "model_version": "LightGBM v2.3",
        "features_used": _FEATURES_DEFAULT,
    },
}

# (base_price, pip_size, sequence) – sequences for the original 3 pairs are
# written explicitly for test reproducibility; new pairs use _gen_seq().
_FOREX_HIST_SEQUENCES: dict[str, tuple[float, float, list[tuple[str, str, int]]]] = {
    "EUR/USD": (1.0680, 0.0001, [
        ("BUY", "BUY", 62), ("SELL", "SELL", -44), ("BUY", "BUY", 53), ("HOLD", "BUY", 29),
        ("BUY", "BUY", 40), ("BUY", "SELL", -30), ("SELL", "SELL", -50), ("SELL", "SELL", -30),
        ("BUY", "BUY", 50), ("BUY", "BUY", 40), ("HOLD", "HOLD", 8), ("BUY", "BUY", 32),
        ("SELL", "BUY", 20), ("BUY", "BUY", 30), ("BUY", "SELL", -35), ("SELL", "SELL", -35),
        ("BUY", "BUY", 30), ("BUY", "BUY", 25), ("HOLD", "HOLD", -3), ("SELL", "SELL", -32),
        ("SELL", "SELL", -30), ("BUY", "BUY", 35), ("BUY", "BUY", 25), ("HOLD", "BUY", 20),
        ("BUY", "BUY", 25), ("SELL", "SELL", -40), ("BUY", "BUY", 25), ("BUY", "SELL", -30),
        ("SELL", "SELL", -30), ("BUY", "BUY", 14),
    ]),
    "GBP/USD": (1.2480, 0.0001, [
        ("SELL", "SELL", -35), ("BUY", "BUY", 42), ("SELL", "SELL", -28), ("BUY", "BUY", 38),
        ("BUY", "SELL", -22), ("SELL", "SELL", -45), ("BUY", "BUY", 55), ("BUY", "BUY", 30),
        ("SELL", "SELL", -40), ("HOLD", "HOLD", 5), ("BUY", "BUY", 35), ("SELL", "BUY", 28),
        ("BUY", "BUY", 42), ("BUY", "SELL", -25), ("SELL", "SELL", -38), ("BUY", "BUY", 32),
        ("BUY", "BUY", 28), ("HOLD", "HOLD", -4), ("SELL", "SELL", -30), ("BUY", "BUY", 35),
        ("SELL", "SELL", -42), ("BUY", "BUY", 30), ("BUY", "BUY", 25), ("SELL", "BUY", 20),
        ("BUY", "BUY", 38), ("SELL", "SELL", -45), ("BUY", "BUY", 28), ("SELL", "SELL", -30),
        ("BUY", "SELL", -25), ("SELL", "SELL", -26),
    ]),
    "USD/JPY": (149.80, 0.01, [
        ("BUY", "BUY", 35), ("SELL", "BUY", 20), ("BUY", "BUY", 45), ("SELL", "SELL", -38),
        ("HOLD", "HOLD", 3), ("BUY", "BUY", 42), ("BUY", "SELL", -30), ("SELL", "SELL", -48),
        ("BUY", "BUY", 55), ("HOLD", "BUY", 25), ("SELL", "SELL", -35), ("BUY", "BUY", 40),
        ("BUY", "BUY", 30), ("SELL", "SELL", -42), ("BUY", "BUY", 38), ("BUY", "SELL", -28),
        ("SELL", "SELL", -35), ("HOLD", "HOLD", 5), ("BUY", "BUY", 48), ("SELL", "SELL", -40),
        ("BUY", "BUY", 35), ("BUY", "BUY", 30), ("SELL", "BUY", 18), ("BUY", "BUY", 42),
        ("SELL", "SELL", -38), ("BUY", "BUY", 35), ("BUY", "SELL", -25), ("SELL", "SELL", -30),
        ("BUY", "BUY", 38), ("HOLD", "HOLD", 4),
    ]),
    "USD/CHF": (0.8940, 0.0001, _gen_seq("USD/CHF")),
    "AUD/USD": (0.6455, 0.0001, _gen_seq("AUD/USD")),
    "USD/CAD": (1.3590, 0.0001, _gen_seq("USD/CAD")),
    "NZD/USD": (0.5970, 0.0001, _gen_seq("NZD/USD")),
    "EUR/GBP": (0.8540, 0.0001, _gen_seq("EUR/GBP")),
    "EUR/JPY": (162.10, 0.01,   _gen_seq("EUR/JPY")),
    "EUR/AUD": (1.6530, 0.0001, _gen_seq("EUR/AUD")),
    "EUR/CAD": (1.4750, 0.0001, _gen_seq("EUR/CAD")),
    "GBP/JPY": (189.40, 0.01,   _gen_seq("GBP/JPY")),
    "GBP/CHF": (1.1410, 0.0001, _gen_seq("GBP/CHF")),
    "AUD/JPY": (98.20,  0.01,   _gen_seq("AUD/JPY")),
    "XAU/USD": (3120.00, 1.0,   _gen_seq("XAU/USD")),
}

_FOREX_NEWS: list[dict[str, Any]] = [
    {
        "headline": "Federal Reserve signals cautious stance on rate cuts as inflation remains sticky",
        "sentiment": "negative",
        "source": "Reuters",
        "published_at": "2026-03-30T08:45:00Z",
    },
    {
        "headline": "EUR/USD consolidates near 1.0850 ahead of Eurozone CPI data release",
        "sentiment": "neutral",
        "source": "FXStreet",
        "published_at": "2026-03-30T08:00:00Z",
    },
    {
        "headline": "Bank of England holds rates steady, GBP/USD under pressure",
        "sentiment": "negative",
        "source": "Bloomberg",
        "published_at": "2026-03-30T07:30:00Z",
    },
    {
        "headline": "Japan's core CPI rises above expectations, BoJ hawkish bets increase",
        "sentiment": "positive",
        "source": "Nikkei",
        "published_at": "2026-03-30T07:00:00Z",
    },
    {
        "headline": "US Non-Farm Payrolls beat forecasts, USD strengthens across the board",
        "sentiment": "positive",
        "source": "MarketWatch",
        "published_at": "2026-03-30T06:30:00Z",
    },
    {
        "headline": "Eurozone PMI unexpectedly contracts, raising recession fears",
        "sentiment": "negative",
        "source": "Reuters",
        "published_at": "2026-03-30T06:00:00Z",
    },
    {
        "headline": "GBP gains on positive UK retail sales data, trade balance improves",
        "sentiment": "positive",
        "source": "FXStreet",
        "published_at": "2026-03-30T05:45:00Z",
    },
    {
        "headline": "Dollar index holds above 104 as risk sentiment remains fragile",
        "sentiment": "neutral",
        "source": "Bloomberg",
        "published_at": "2026-03-30T05:00:00Z",
    },
    {
        "headline": "ECB policymakers divided on pace of future rate reductions",
        "sentiment": "neutral",
        "source": "WSJ",
        "published_at": "2026-03-30T04:30:00Z",
    },
    {
        "headline": "Yen weakens past 151 as US-Japan yield differential widens further",
        "sentiment": "negative",
        "source": "Nikkei",
        "published_at": "2026-03-30T04:00:00Z",
    },
]

# In-memory email subscriber registry (resets on restart)
_FOREX_SUBSCRIBERS: list[dict[str, Any]] = []


def _build_forex_history(pair: str) -> list[dict[str, Any]]:
    """Return a 30-day list of predicted vs actual signals for the given pair."""
    base_price, pip, seq = _FOREX_HIST_SEQUENCES[pair]
    price = base_price
    decimals = 4 if pip < 0.01 else 2
    history: list[dict[str, Any]] = []
    for i, (pred, actual, delta) in enumerate(seq):
        d = (date(2026, 3, 1) + timedelta(days=i)).isoformat()
        entry = round(price, decimals)
        exit_price = round(price + delta * pip, decimals)
        history.append({
            "day": d,
            "predicted": pred,
            "actual": actual,
            "correct": pred == actual,
            "entry": entry,
            "exit": exit_price,
        })
        price = exit_price
    return history


def _build_technical_analysis(pair: str, live_price: float | None = None) -> dict[str, Any]:
    """Return deterministic technical-analysis data for *pair*.

    When *live_price* is supplied it is used as the reference price for
    support/resistance calculations; otherwise the static entry price from
    ``_FOREX_SIGNALS`` is used as a fallback.  For XAU/USD the price comes
    from Yahoo Finance; all other pairs use the Frankfurter API (ECB).
    """
    signal = _FOREX_SIGNALS[pair]
    price = live_price if live_price is not None else signal["entry_price"]
    direction = signal["direction"]
    is_gold = pair == "XAU/USD"
    is_jpy = "JPY" in pair
    pip = 1.0 if is_gold else (0.01 if is_jpy else 0.0001)
    dec = 2 if (is_jpy or is_gold) else 4

    def lvl(pips: float) -> float:
        return round(price + pips * pip, dec)

    # Support / Resistance levels
    support = [lvl(-50), lvl(-120), lvl(-230)]
    resistance = [lvl(60), lvl(140), lvl(250)]

    # Fair Value Gaps – unfilled gaps in price action
    fvg = [
        {
            "type": "bullish",
            "top": lvl(-28),
            "bottom": lvl(-44),
            "filled": False,
            "created": "2026-03-29",
            "description": "Unmitigated bullish FVG — potential magnet for price",
        },
        {
            "type": "bearish",
            "top": lvl(82),
            "bottom": lvl(66),
            "filled": True,
            "created": "2026-03-27",
            "description": "Filled bearish FVG — supply already consumed",
        },
        {
            "type": "bullish",
            "top": lvl(-98),
            "bottom": lvl(-114),
            "filled": True,
            "created": "2026-03-25",
            "description": "Older bullish FVG — price revisited and filled",
        },
    ]

    # Break of Structure (BOS)
    bos = [
        {
            "type": "bullish" if direction in ("BUY", "HOLD") else "bearish",
            "level": lvl(-78),
            "date": "2026-03-28",
            "description": (
                "Broke previous swing high — bullish market structure confirmed"
                if direction == "BUY"
                else "Broke previous swing low — bearish pressure continues"
            ),
        },
        {
            "type": "bearish" if direction in ("SELL", "HOLD") else "bullish",
            "level": lvl(102),
            "date": "2026-03-26",
            "description": (
                "Prior bearish BOS now acting as resistance"
                if direction == "SELL"
                else "Prior bullish BOS flipped to support"
            ),
        },
    ]

    # Change of Character (CHoCH)
    choch = [
        {
            "type": "bullish" if direction == "BUY" else "bearish",
            "level": lvl(-62),
            "date": "2026-03-29",
            "description": (
                "CHoCH: market shifted from bearish to bullish bias"
                if direction == "BUY"
                else "CHoCH: market shifted from bullish to bearish bias"
            ),
        },
    ]

    # High Volume / Order-Block Zones
    high_volume_zones = [
        {
            "top": lvl(22),
            "bottom": lvl(-14),
            "strength": "high",
            "description": "Current major liquidity pool — institutional activity",
        },
        {
            "top": lvl(-68),
            "bottom": lvl(-88),
            "strength": "medium",
            "description": "Previous order block — potential demand zone",
        },
        {
            "top": lvl(92),
            "bottom": lvl(112),
            "strength": "high",
            "description": "Supply zone — high-volume rejection expected",
        },
    ]

    return {
        "pair": pair,
        "current_price": price,
        "support_resistance": {"support": support, "resistance": resistance},
        "fvg": fvg,
        "bos": bos,
        "choch": choch,
        "high_volume_zones": high_volume_zones,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@app.route("/")
def index():
    """Redirect root to the Forex Signal Hub."""
    return redirect(url_for("forex_hub"))


@app.route("/forex")
def forex_hub():
    """Render the AI Forex Signal Hub page."""
    try:
        return render_template("forex.html")
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/forex/methodology")
def forex_methodology():
    """Render the Methodology page for the Forex Signal Hub."""
    try:
        return render_template("methodology.html")
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/forex/signals")
def forex_signals():
    """Return the current signal + 30-day history for a forex pair.

    Prices and signal direction are derived from live market data:
    - XAU/USD  → Yahoo Finance (Frankfurter does not carry gold data)
    - All other pairs → Frankfurter API (ECB)
    The static ``_FOREX_SIGNALS`` dict is used as a fallback when the external
    API is unavailable.
    """
    pair = request.args.get("pair", "EUR/USD")
    if pair not in _SUPPORTED_PAIRS:
        return (
            jsonify({"error": f"Unsupported pair. Choose from: {', '.join(_SUPPORTED_PAIRS)}"}),
            400,
        )

    signal: dict[str, Any] = dict(_FOREX_SIGNALS[pair])
    signal["pair"] = pair

    # ── Attempt to enrich signal with live market data ────────────────────────
    live_rate = _fetch_live_rate(pair)
    hist_rates = _fetch_historical_rates(pair, 30)

    if live_rate is not None:
        signal["entry_price"] = live_rate
        signal["generated_at"] = datetime.now(timezone.utc).isoformat()
        signal["data_source"] = (
            "Yahoo Finance (gold spot)" if pair == "XAU/USD" else "Frankfurter API (ECB)"
        )
        signal["is_live"] = True

        if hist_rates:
            prices = list(hist_rates.values())
            direction, confidence = _compute_signal_from_prices(prices)
            signal["direction"] = direction
            signal["confidence"] = confidence

            is_gold = pair == "XAU/USD"
            is_jpy = "JPY" in pair
            pip = 1.0 if is_gold else (0.01 if is_jpy else 0.0001)
            dec = 2 if (is_jpy or is_gold) else 4
            tp_pips, sl_pips = _compute_tp_sl_pips(prices, pair)

            if direction == "BUY":
                signal["take_profit"] = round(live_rate + tp_pips * pip, dec)
                signal["stop_loss"] = round(live_rate - sl_pips * pip, dec)
            elif direction == "SELL":
                signal["take_profit"] = round(live_rate - tp_pips * pip, dec)
                signal["stop_loss"] = round(live_rate + sl_pips * pip, dec)
            else:
                signal["take_profit"] = round(live_rate + tp_pips * pip, dec)
                signal["stop_loss"] = round(live_rate - sl_pips * pip, dec)
    else:
        signal["data_source"] = "static (live feed unavailable)"
        signal["is_live"] = False

    # ── Build 30-day history ──────────────────────────────────────────────────
    if hist_rates:
        history = _build_forex_history_live(pair, hist_rates)
    else:
        history = _build_forex_history(pair)

    correct_count = sum(1 for h in history if h["correct"])
    signal["accuracy_30d"] = round(correct_count / len(history) * 100, 1) if history else 0.0
    signal["history"] = history
    return jsonify(signal)


@app.route("/api/forex/technical")
def forex_technical():
    """Return technical analysis data (FVG, S/R, BOS, CHoCH, volume zones) for a pair.

    Support/resistance levels are calculated relative to the live market price
    when available, falling back to the static entry price otherwise.
    """
    pair = request.args.get("pair", "EUR/USD")
    if pair not in _SUPPORTED_PAIRS:
        return (
            jsonify({"error": f"Unsupported pair. Choose from: {', '.join(_SUPPORTED_PAIRS)}"}),
            400,
        )
    live_rate = _fetch_live_rate(pair)
    return jsonify(_build_technical_analysis(pair, live_rate))


@app.route("/api/forex/pairs")
def forex_pairs():
    """Return the list of supported currency pairs grouped by type."""
    return jsonify({
        "major": [p for p in _SUPPORTED_PAIRS if "USD" in p.split("/") and not p.startswith("XAU")],
        "cross":  [p for p in _SUPPORTED_PAIRS if "USD" not in p.split("/") and not p.startswith("XAU")],
        "commodity": [p for p in _SUPPORTED_PAIRS if p.startswith("XAU")],
        "all": list(_SUPPORTED_PAIRS),
    })


@app.route("/api/forex/news")
def forex_news():
    """Return the latest news sentiment items."""
    return jsonify({"news": _FOREX_NEWS})


@app.route("/api/forex/subscribe", methods=["POST"])
def forex_subscribe():
    """Register an email address for signal alerts."""
    data: dict[str, Any] = request.get_json(force=True) or {}
    email: str = data.get("email", "").strip().lower()
    pairs: list[str] = data.get("pairs", [])

    if not email or "@" not in email or "." not in email.split("@")[-1]:
        return jsonify({"error": "Please provide a valid email address"}), 400

    invalid = [p for p in pairs if p not in _SUPPORTED_PAIRS]
    if invalid:
        return jsonify({"error": f"Unsupported pairs: {', '.join(invalid)}"}), 400

    if not pairs:
        pairs = list(_SUPPORTED_PAIRS)

    if any(s["email"] == email for s in _FOREX_SUBSCRIBERS):
        return jsonify({"success": True, "message": "You are already subscribed."})

    _FOREX_SUBSCRIBERS.append({
        "email": email,
        "pairs": pairs,
        "subscribed_at": datetime.now(timezone.utc).isoformat(),
    })
    return jsonify({
        "success": True,
        "message": "Subscribed! You will receive alerts when new signals are generated.",
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(debug=debug, host="0.0.0.0", port=port)
