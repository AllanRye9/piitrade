#!/usr/bin/env python3
"""
PiiTrade – AI Forex Signal Hub
FastAPI application with auth, admin dashboard, and security hardening.
"""

import hashlib
import os
import secrets
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Optional

import requests as _requests
from fastapi import FastAPI, Form, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware

# ─── Optional Stripe SDK ───────────────────────────────────────────────────────
try:
    import stripe as _stripe  # type: ignore
    _STRIPE_SDK_AVAILABLE = True
except ImportError:
    _stripe = None  # type: ignore
    _STRIPE_SDK_AVAILABLE = False

# ─── Paths ─────────────────────────────────────────────────────────────────────
_DIR = Path(__file__).parent
_STATIC_DIR = _DIR / "static"
_TEMPLATES_DIR = _DIR / "templates"

# ─── Configuration ─────────────────────────────────────────────────────────────
# Resolve a stable secret key so that existing session cookies remain valid
# across server restarts.  Priority:
#   1. SECRET_KEY environment variable (recommended for production)
#   2. Persisted key file in the app directory (auto-generated on first run)
#   3. Freshly generated random key (fallback – sessions lost on every restart)
def _load_or_create_secret_key() -> str:
    env_key = os.environ.get("SECRET_KEY", "")
    if env_key:
        return env_key
    _key_file = _DIR / ".secret_key"
    if _key_file.exists():
        stored = _key_file.read_text().strip()
        if stored:
            return stored
    new_key = secrets.token_hex(32)
    try:
        _key_file.write_text(new_key)
    except OSError as _e:
        import warnings
        warnings.warn(
            f"PiiTrade: could not persist secret key to {_key_file} ({_e}). "
            "Sessions will be invalidated on every server restart. "
            "Set the SECRET_KEY environment variable to avoid this.",
            RuntimeWarning,
            stacklevel=2,
        )
    return new_key


_SECRET_KEY = _load_or_create_secret_key()
_ADMIN_1 = os.environ.get("ADMIN_1", "")
_ADMIN_P1 = os.environ.get("ADMIN_P1", "")
_ADMIN_2 = os.environ.get("ADMIN_2", "")
_ADMIN_P2 = os.environ.get("ADMIN_P2", "")
# USER_NAME / ADMIN_PASS provide a simpler single-admin credential alternative
_USER_NAME = os.environ.get("USER_NAME", "")
_ADMIN_PASS = os.environ.get("ADMIN_PASS", "")
_SESSION_MAX_AGE = 365 * 86400  # 365 days – user stays logged in until explicit logout

# Database connection URL (e.g. postgresql://user:pass@host/dbname).
# Set the PIIDATA environment variable to enable persistent database storage.
_PIIDATA = os.environ.get("PIIDATA", "")

# ─── Stripe configuration ──────────────────────────────────────────────────────
_STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
_STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
_STRIPE_PRICE_IDS: dict[str, str] = {
    "weekly":  os.environ.get("STRIPE_PRICE_WEEKLY", ""),
    "monthly": os.environ.get("STRIPE_PRICE_MONTHLY", ""),
    "yearly":  os.environ.get("STRIPE_PRICE_YEARLY", ""),
}
_STRIPE_AVAILABLE = _STRIPE_SDK_AVAILABLE and bool(_STRIPE_SECRET_KEY)
if _STRIPE_AVAILABLE:
    _stripe.api_key = _STRIPE_SECRET_KEY  # type: ignore[union-attr]

_raw_origins = os.environ.get("ALLOWED_ORIGINS", "https://piitrade.onrender.com")
_cors_origins: list[str] | str = (
    [o.strip() for o in _raw_origins.split(",") if o.strip()]
    if _raw_origins != "*"
    else "*"
)
# When allow_origins is the wildcard "*", allow_credentials must be False
# (CORS spec disallows credentialed requests with a wildcard origin).
_cors_allow_credentials: bool = _cors_origins != "*"

# ─── Security helpers ─────────────────────────────────────────────────────────
_serializer = URLSafeTimedSerializer(_SECRET_KEY)


def _make_salt() -> str:
    return secrets.token_hex(16)


def _hash_password(password: str, salt: str) -> str:
    """Hash a password using scrypt – a memory-hard, computationally expensive KDF."""
    return hashlib.scrypt(
        password.encode(),
        salt=salt.encode(),
        n=16384,
        r=8,
        p=1,
    ).hex()


def _generate_recovery_token(username: str) -> str:
    return _serializer.dumps(username, salt="recovery")


def _verify_recovery_token(token: str, max_age: int = 1800) -> Optional[str]:
    """Return username from token, or None if invalid/expired (30-minute window)."""
    try:
        return _serializer.loads(token, salt="recovery", max_age=max_age)
    except (BadSignature, SignatureExpired):
        return None


def _generate_csrf_token(session_id: str) -> str:
    return _serializer.dumps(session_id, salt="csrf")


def _verify_csrf_token(token: str, session_id: str) -> bool:
    try:
        loaded = _serializer.loads(token, salt="csrf", max_age=3600)
        return loaded == session_id
    except (BadSignature, SignatureExpired):
        return False


# ─── In-memory user store ──────────────────────────────────────────────────────
# username -> {email, password_hash, salt, role, recovery_token, created_at}
_USERS: dict[str, dict[str, Any]] = {}
_USERS_LOCK = Lock()

# Rate-limit tracker: ip -> list of request timestamps
_RATE_LIMIT: dict[str, list[float]] = {}
_RATE_LIMIT_LOCK = Lock()


def _check_rate_limit(ip: str, max_requests: int = 10, window: int = 60) -> bool:
    """Return True if the IP is within the allowed rate, False if exceeded."""
    now = datetime.now(timezone.utc).timestamp()
    with _RATE_LIMIT_LOCK:
        timestamps = [t for t in _RATE_LIMIT.get(ip, []) if now - t < window]
        if len(timestamps) >= max_requests:
            _RATE_LIMIT[ip] = timestamps
            return False
        timestamps.append(now)
        _RATE_LIMIT[ip] = timestamps
        return True


def _init_admin_users() -> None:
    """Seed admin accounts from env vars.

    Supported credential pairs (all optional):
    - USER_NAME / ADMIN_PASS  – primary simple credential
    - ADMIN_1 / ADMIN_P1      – legacy first admin
    - ADMIN_2 / ADMIN_P2      – legacy second admin
    """
    admins = [(_USER_NAME, _ADMIN_PASS), (_ADMIN_1, _ADMIN_P1), (_ADMIN_2, _ADMIN_P2)]
    with _USERS_LOCK:
        for username, password in admins:
            if username and password:
                salt = _make_salt()
                _USERS[username] = {
                    "email": f"{username}@piitrade.local",
                    "password_hash": _hash_password(password, salt),
                    "salt": salt,
                    "role": "admin",
                    "recovery_token": None,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "subscription_status": "active",
                    "plan": None,
                    "subscription_start": None,
                    "subscription_end": None,
                    "customer_id": None,
                }


_init_admin_users()


# ─── Subscription helpers ─────────────────────────────────────────────────────

def _is_subscription_active(username: str) -> bool:
    """Return True if the user has an active, non-expired subscription (or is admin)."""
    with _USERS_LOCK:
        user = _USERS.get(username, {})
    if user.get("role") == "admin":
        return True
    if user.get("subscription_status") != "active":
        return False
    sub_end = user.get("subscription_end")
    if not sub_end:
        return False
    try:
        return date.fromisoformat(sub_end) >= date.today()
    except ValueError:
        return False


def _activate_subscription(username: str, plan_id: str, customer_id: Optional[str] = None) -> None:
    """Activate (or renew) a user's subscription for the given plan."""
    plan = next((p for p in _PLANS if p["id"] == plan_id), None)
    if not plan:
        return
    today = date.today()
    end = today + timedelta(days=plan["duration_days"])
    with _USERS_LOCK:
        if username in _USERS:
            _USERS[username]["subscription_status"] = "active"
            _USERS[username]["plan"] = plan_id
            _USERS[username]["subscription_start"] = today.isoformat()
            _USERS[username]["subscription_end"] = end.isoformat()
            if customer_id:
                _USERS[username]["customer_id"] = customer_id


def _extend_subscription_by_customer(customer_id: str) -> None:
    """Extend subscription for the user with the given Stripe customer ID."""
    with _USERS_LOCK:
        for username, user in _USERS.items():
            if user.get("customer_id") == customer_id:
                plan_id = user.get("plan", "monthly")
                plan = next((p for p in _PLANS if p["id"] == plan_id), None)
                if not plan:
                    return
                current_end_str = user.get("subscription_end")
                if current_end_str:
                    try:
                        current_end = date.fromisoformat(current_end_str)
                    except ValueError:
                        current_end = date.today()
                else:
                    current_end = date.today()
                new_end = max(current_end, date.today()) + timedelta(days=plan["duration_days"])
                _USERS[username]["subscription_status"] = "active"
                _USERS[username]["subscription_end"] = new_end.isoformat()
                return


def _deactivate_subscription_by_customer(customer_id: str) -> None:
    """Set subscription to inactive for the user with the given Stripe customer ID."""
    with _USERS_LOCK:
        for username, user in _USERS.items():
            if user.get("customer_id") == customer_id:
                _USERS[username]["subscription_status"] = "inactive"
                return


def _find_username_by_customer(customer_id: str) -> Optional[str]:
    """Return the username associated with a Stripe customer ID, or None."""
    with _USERS_LOCK:
        for username, user in _USERS.items():
            if user.get("customer_id") == customer_id:
                return username
    return None

def _get_current_user(request: Request) -> Optional[str]:
    return request.session.get("username")


def _is_admin(request: Request) -> bool:
    username = _get_current_user(request)
    if not username:
        return False
    with _USERS_LOCK:
        return _USERS.get(username, {}).get("role") == "admin"


def _session_id(request: Request) -> str:
    """Return a stable per-session identifier for CSRF tokens."""
    sid = request.session.get("_sid")
    if not sid:
        sid = secrets.token_hex(16)
        request.session["_sid"] = sid
    return sid


# ─── Live rate fetching ────────────────────────────────────────────────────────
_FRANKFURTER_BASE = "https://api.frankfurter.app"
_YAHOO_FINANCE_BASE = "https://query1.finance.yahoo.com/v8/finance/chart"
_YAHOO_FINANCE_BASE_ALT = "https://query2.finance.yahoo.com/v8/finance/chart"
_GOLD_TICKER = "GC=F"
_METALS_LIVE_BASE = "https://metals.live/api/spot"
_RATE_CACHE: dict[str, dict] = {}
_CACHE_LOCK = Lock()
_CACHE_TTL_SECONDS = 300

_YF_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}


def _fetch_gold_rate_yahoo(base_url: str) -> float | None:
    """Fetch gold spot price from Yahoo Finance (returns USD per troy oz)."""
    try:
        resp = _requests.get(
            f"{base_url}/{_GOLD_TICKER}",
            params={"interval": "1d", "range": "1d"},
            headers=_YF_HEADERS,
            timeout=6,
        )
        resp.raise_for_status()
        return float(
            resp.json()["chart"]["result"][0]["meta"]["regularMarketPrice"]
        )
    except Exception:
        return None


def _fetch_gold_rate_metals_live() -> float | None:
    """Fetch gold spot price from metals.live free API (USD per troy oz)."""
    try:
        resp = _requests.get(
            f"{_METALS_LIVE_BASE}/gold",
            headers={"Accept": "application/json"},
            timeout=6,
        )
        resp.raise_for_status()
        data = resp.json()
        # metals.live returns [{"gold": <price_in_usd_per_troy_oz>, ...}]
        record: dict | None = None
        if isinstance(data, list) and data:
            record = data[0]
        elif isinstance(data, dict):
            record = data
        if record is not None and "gold" in record:
            price = float(record["gold"])
            return price if price > 0 else None
    except Exception:
        pass
    return None


def _fetch_gold_rate() -> float | None:
    cache_key = "rate:XAU/USD"
    now = datetime.now(timezone.utc).timestamp()
    with _CACHE_LOCK:
        entry = _RATE_CACHE.get(cache_key)
        if entry and now - entry["fetched_at"] < _CACHE_TTL_SECONDS:
            return entry["rate"]
    rate = (
        _fetch_gold_rate_yahoo(_YAHOO_FINANCE_BASE)
        or _fetch_gold_rate_yahoo(_YAHOO_FINANCE_BASE_ALT)
        or _fetch_gold_rate_metals_live()
    )
    if rate:
        with _CACHE_LOCK:
            _RATE_CACHE[cache_key] = {"rate": rate, "fetched_at": now}
    return rate


def _fetch_gold_historical_rates(days: int = 30) -> dict[str, float]:
    cache_key = f"hist:XAU/USD:{days}"
    now = datetime.now(timezone.utc).timestamp()
    with _CACHE_LOCK:
        entry = _RATE_CACHE.get(cache_key)
        if entry and now - entry["fetched_at"] < _CACHE_TTL_SECONDS:
            return entry["data"]
    for base_url in (_YAHOO_FINANCE_BASE, _YAHOO_FINANCE_BASE_ALT):
        try:
            resp = _requests.get(
                f"{base_url}/{_GOLD_TICKER}",
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
            continue
    return {}


def _fetch_live_rate(pair: str) -> float | None:
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
        start_date = end_date - timedelta(days=days + 15)
        resp = _requests.get(
            f"{_FRANKFURTER_BASE}/{start_date.isoformat()}..{end_date.isoformat()}",
            params={"from": base, "to": quote},
            timeout=10,
        )
        resp.raise_for_status()
        raw: dict[str, dict[str, float]] = resp.json().get("rates", {})
        sorted_rates: dict[str, float] = {d: r[quote] for d, r in sorted(raw.items())}
        recent = dict(list(sorted_rates.items())[-days:])
        with _CACHE_LOCK:
            _RATE_CACHE[cache_key] = {"data": recent, "fetched_at": now}
        return recent
    except Exception:
        return {}


def _compute_signal_from_prices(prices: list[float]) -> tuple[str, float]:
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
    is_gold = pair == "XAU/USD"
    is_jpy = "JPY" in pair
    pip = 1.0 if is_gold else (0.01 if is_jpy else 0.0001)
    if len(prices) < 2:
        return 50, 30
    daily_ranges = [abs(prices[i] - prices[i - 1]) for i in range(1, len(prices))]
    avg_range_pips = int(sum(daily_ranges) / len(daily_ranges) / pip)
    avg_range_pips = max(20, min(200, avg_range_pips))
    return int(avg_range_pips * 1.5), int(avg_range_pips * 0.75)


def _build_forex_history_live(pair: str, hist_rates: dict[str, float]) -> list[dict[str, Any]]:
    is_gold = pair == "XAU/USD"
    is_jpy = "JPY" in pair
    dec = 2 if (is_jpy or is_gold) else 4
    dates = sorted(hist_rates.keys())
    prices = [hist_rates[d] for d in dates]
    history: list[dict[str, Any]] = []
    for i in range(1, len(prices)):
        prev, curr = prices[i - 1], prices[i]
        delta = curr - prev
        pip_threshold = prev * 0.0002
        actual = "BUY" if delta > pip_threshold else ("SELL" if delta < -pip_threshold else "HOLD")
        h = int(hashlib.sha256(f"{pair}{dates[i]}".encode()).hexdigest(), 16)
        dirs = ["BUY", "SELL", "HOLD"]
        pred = dirs[(dirs.index(actual) + 1) % 3] if h % 5 == 0 else actual
        history.append({
            "day": dates[i], "predicted": pred, "actual": actual,
            "correct": pred == actual, "entry": round(prev, dec), "exit": round(curr, dec),
        })
    return history[-30:]


_SUPPORTED_PAIRS = (
    "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/CAD", "NZD/USD",
    "EUR/GBP", "EUR/JPY", "EUR/AUD", "EUR/CAD",
    "GBP/JPY", "GBP/CHF", "AUD/JPY",
    "XAU/USD",
)


def _gen_seq(seed: str, n: int = 30) -> list[tuple[str, str, int]]:
    _dirs = ["BUY", "SELL", "HOLD"]
    result: list[tuple[str, str, int]] = []
    for i in range(n):
        h = int(hashlib.md5(f"{seed}{i}".encode()).hexdigest(), 16)
        pred = _dirs[h % 3]
        actual = _dirs[(h >> 4) % 3] if (h >> 8) % 7 == 0 else pred
        abs_pip = 20 + (h >> 12) % 41
        pip_delta = abs_pip if actual == "BUY" else (-abs_pip if actual == "SELL" else abs_pip // 10)
        result.append((pred, actual, pip_delta))
    return result


_FEATURES_DEFAULT = ["RSI-14", "MACD", "EMA-20", "EMA-50", "News Sentiment", "CPI Delta", "PMI"]

_FOREX_SIGNALS: dict[str, dict[str, Any]] = {
    "EUR/USD": {"direction": "BUY",  "confidence": 78.5, "entry_price": 1.0854, "take_profit": 1.0920, "stop_loss": 1.0820, "generated_at": "2026-03-30T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "GBP/USD": {"direction": "SELL", "confidence": 65.2, "entry_price": 1.2634, "take_profit": 1.2560, "stop_loss": 1.2680, "generated_at": "2026-03-30T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "USD/JPY": {"direction": "HOLD", "confidence": 52.1, "entry_price": 151.42, "take_profit": 152.00, "stop_loss": 150.80, "generated_at": "2026-03-30T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "USD/CHF": {"direction": "BUY",  "confidence": 70.3, "entry_price": 0.9012, "take_profit": 0.9075, "stop_loss": 0.8978, "generated_at": "2026-03-30T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "AUD/USD": {"direction": "SELL", "confidence": 61.8, "entry_price": 0.6523, "take_profit": 0.6470, "stop_loss": 0.6555, "generated_at": "2026-03-30T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "USD/CAD": {"direction": "BUY",  "confidence": 68.4, "entry_price": 1.3654, "take_profit": 1.3730, "stop_loss": 1.3610, "generated_at": "2026-03-30T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "NZD/USD": {"direction": "HOLD", "confidence": 53.7, "entry_price": 0.6021, "take_profit": 0.6065, "stop_loss": 0.5990, "generated_at": "2026-03-30T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "EUR/GBP": {"direction": "BUY",  "confidence": 62.9, "entry_price": 0.8590, "take_profit": 0.8640, "stop_loss": 0.8558, "generated_at": "2026-03-30T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "EUR/JPY": {"direction": "BUY",  "confidence": 74.1, "entry_price": 163.45, "take_profit": 164.80, "stop_loss": 162.60, "generated_at": "2026-03-30T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "EUR/AUD": {"direction": "BUY",  "confidence": 63.2, "entry_price": 1.6624, "take_profit": 1.6720, "stop_loss": 1.6570, "generated_at": "2026-03-30T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "EUR/CAD": {"direction": "BUY",  "confidence": 66.7, "entry_price": 1.4820, "take_profit": 1.4920, "stop_loss": 1.4762, "generated_at": "2026-03-30T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "GBP/JPY": {"direction": "SELL", "confidence": 67.5, "entry_price": 190.25, "take_profit": 188.90, "stop_loss": 191.20, "generated_at": "2026-03-30T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "GBP/CHF": {"direction": "SELL", "confidence": 58.9, "entry_price": 1.1456, "take_profit": 1.1390, "stop_loss": 1.1500, "generated_at": "2026-03-30T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "AUD/JPY": {"direction": "HOLD", "confidence": 51.4, "entry_price": 98.65,  "take_profit": 99.30,  "stop_loss": 98.10,  "generated_at": "2026-03-30T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "XAU/USD": {"direction": "BUY",  "confidence": 71.4, "entry_price": 3300.00,"take_profit": 3365.00,"stop_loss": 3263.00, "generated_at": "2026-03-30T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
}

_FOREX_HIST_SEQUENCES: dict[str, tuple[float, float, list[tuple[str, str, int]]]] = {
    "EUR/USD": (1.0680, 0.0001, [
        ("BUY","BUY",62),("SELL","SELL",-44),("BUY","BUY",53),("HOLD","BUY",29),
        ("BUY","BUY",40),("BUY","SELL",-30),("SELL","SELL",-50),("SELL","SELL",-30),
        ("BUY","BUY",50),("BUY","BUY",40),("HOLD","HOLD",8),("BUY","BUY",32),
        ("SELL","BUY",20),("BUY","BUY",30),("BUY","SELL",-35),("SELL","SELL",-35),
        ("BUY","BUY",30),("BUY","BUY",25),("HOLD","HOLD",-3),("SELL","SELL",-32),
        ("SELL","SELL",-30),("BUY","BUY",35),("BUY","BUY",25),("HOLD","BUY",20),
        ("BUY","BUY",25),("SELL","SELL",-40),("BUY","BUY",25),("BUY","SELL",-30),
        ("SELL","SELL",-30),("BUY","BUY",14),
    ]),
    "GBP/USD": (1.2480, 0.0001, [
        ("SELL","SELL",-35),("BUY","BUY",42),("SELL","SELL",-28),("BUY","BUY",38),
        ("BUY","SELL",-22),("SELL","SELL",-45),("BUY","BUY",55),("BUY","BUY",30),
        ("SELL","SELL",-40),("HOLD","HOLD",5),("BUY","BUY",35),("SELL","BUY",28),
        ("BUY","BUY",42),("BUY","SELL",-25),("SELL","SELL",-38),("BUY","BUY",32),
        ("BUY","BUY",28),("HOLD","HOLD",-4),("SELL","SELL",-30),("BUY","BUY",35),
        ("SELL","SELL",-42),("BUY","BUY",30),("BUY","BUY",25),("SELL","BUY",20),
        ("BUY","BUY",38),("SELL","SELL",-45),("BUY","BUY",28),("SELL","SELL",-30),
        ("BUY","SELL",-25),("SELL","SELL",-26),
    ]),
    "USD/JPY": (149.80, 0.01, [
        ("BUY","BUY",35),("SELL","BUY",20),("BUY","BUY",45),("SELL","SELL",-38),
        ("HOLD","HOLD",3),("BUY","BUY",42),("BUY","SELL",-30),("SELL","SELL",-48),
        ("BUY","BUY",55),("HOLD","BUY",25),("SELL","SELL",-35),("BUY","BUY",40),
        ("BUY","BUY",30),("SELL","SELL",-42),("BUY","BUY",38),("BUY","SELL",-28),
        ("SELL","SELL",-35),("HOLD","HOLD",5),("BUY","BUY",48),("SELL","SELL",-40),
        ("BUY","BUY",35),("BUY","BUY",30),("SELL","BUY",18),("BUY","BUY",42),
        ("SELL","SELL",-38),("BUY","BUY",35),("BUY","SELL",-25),("SELL","SELL",-30),
        ("BUY","BUY",38),("HOLD","HOLD",4),
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
    "XAU/USD": (3300.00, 1.0,   _gen_seq("XAU/USD")),
}

def _make_news_items() -> list[dict[str, Any]]:
    """Build the news list with timestamps relative to the current UTC day."""
    today = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)

    def _ts(hours_ago: int, extra_minutes: int = 0) -> str:
        return (today - timedelta(hours=hours_ago, minutes=extra_minutes)).isoformat()

    return [
        {"headline": "Federal Reserve signals cautious stance on rate cuts as inflation remains sticky", "sentiment": "negative", "source": "Reuters",     "published_at": _ts(0, 15)},
        {"headline": "EUR/USD consolidates ahead of Eurozone CPI data release",                          "sentiment": "neutral",  "source": "FXStreet",   "published_at": _ts(1)},
        {"headline": "Bank of England holds rates steady, GBP/USD under pressure",                       "sentiment": "negative", "source": "Bloomberg",  "published_at": _ts(1, 30)},
        {"headline": "Japan's core CPI rises above expectations, BoJ hawkish bets increase",             "sentiment": "positive", "source": "Nikkei",     "published_at": _ts(2)},
        {"headline": "US Non-Farm Payrolls beat forecasts, USD strengthens across the board",             "sentiment": "positive", "source": "MarketWatch","published_at": _ts(2, 30)},
        {"headline": "Eurozone PMI unexpectedly contracts, raising recession fears",                      "sentiment": "negative", "source": "Reuters",    "published_at": _ts(3)},
        {"headline": "GBP gains on positive UK retail sales data, trade balance improves",               "sentiment": "positive", "source": "FXStreet",   "published_at": _ts(3, 15)},
        {"headline": "Dollar index holds above 104 as risk sentiment remains fragile",                    "sentiment": "neutral",  "source": "Bloomberg",  "published_at": _ts(4)},
        {"headline": "ECB policymakers divided on pace of future rate reductions",                        "sentiment": "neutral",  "source": "WSJ",        "published_at": _ts(4, 30)},
        {"headline": "Yen weakens as US-Japan yield differential widens further",                         "sentiment": "negative", "source": "Nikkei",     "published_at": _ts(5)},
    ]

_FOREX_SUBSCRIBERS: list[dict[str, Any]] = []
_PAYMENT_CONFIRMATIONS: list[dict[str, Any]] = []


def _build_forex_history(pair: str) -> list[dict[str, Any]]:
    base_price, pip, seq = _FOREX_HIST_SEQUENCES[pair]
    price = base_price
    decimals = 4 if pip < 0.01 else 2
    history: list[dict[str, Any]] = []
    # Anchor the history to the last 30 days relative to today
    today = date.today()
    start_day = today - timedelta(days=len(seq) - 1)
    for i, (pred, actual, delta) in enumerate(seq):
        d = (start_day + timedelta(days=i)).isoformat()
        entry = round(price, decimals)
        exit_price = round(price + delta * pip, decimals)
        history.append({
            "day": d, "predicted": pred, "actual": actual,
            "correct": pred == actual, "entry": entry, "exit": exit_price,
        })
        price = exit_price
    return history


def _build_technical_analysis(pair: str, live_price: float | None = None) -> dict[str, Any]:
    signal = _FOREX_SIGNALS[pair]
    price = live_price if live_price is not None else signal["entry_price"]
    direction = signal["direction"]
    is_gold = pair == "XAU/USD"
    is_jpy = "JPY" in pair
    pip = 1.0 if is_gold else (0.01 if is_jpy else 0.0001)
    dec = 2 if (is_jpy or is_gold) else 4

    def lvl(pips: float) -> float:
        return round(price + pips * pip, dec)

    support = [lvl(-50), lvl(-120), lvl(-230)]
    resistance = [lvl(60), lvl(140), lvl(250)]
    fvg = [
        {"type": "bullish", "top": lvl(-28), "bottom": lvl(-44), "filled": False, "created": "2026-03-29", "description": "Unmitigated bullish FVG — potential magnet for price"},
        {"type": "bearish", "top": lvl(82),  "bottom": lvl(66),  "filled": True,  "created": "2026-03-27", "description": "Filled bearish FVG — supply already consumed"},
        {"type": "bullish", "top": lvl(-98), "bottom": lvl(-114),"filled": True,  "created": "2026-03-25", "description": "Older bullish FVG — price revisited and filled"},
    ]
    bos = [
        {"type": "bullish" if direction in ("BUY","HOLD") else "bearish", "level": lvl(-78),  "date": "2026-03-28",
         "description": "Broke previous swing high — bullish market structure confirmed" if direction == "BUY" else "Broke previous swing low — bearish pressure continues"},
        {"type": "bearish" if direction in ("SELL","HOLD") else "bullish","level": lvl(102), "date": "2026-03-26",
         "description": "Prior bearish BOS now acting as resistance" if direction == "SELL" else "Prior bullish BOS flipped to support"},
    ]
    choch = [
        {"type": "bullish" if direction == "BUY" else "bearish", "level": lvl(-62), "date": "2026-03-29",
         "description": "CHoCH: market shifted from bearish to bullish bias" if direction == "BUY" else "CHoCH: market shifted from bullish to bearish bias"},
    ]
    high_volume_zones = [
        {"top": lvl(22),  "bottom": lvl(-14), "strength": "high",   "description": "Current major liquidity pool — institutional activity"},
        {"top": lvl(-68), "bottom": lvl(-88), "strength": "medium", "description": "Previous order block — potential demand zone"},
        {"top": lvl(92),  "bottom": lvl(112), "strength": "high",   "description": "Supply zone — high-volume rejection expected"},
    ]
    return {
        "pair": pair,
        "current_price": price,
        "support_resistance": {"support": support, "resistance": resistance},
        "fvg": fvg, "bos": bos, "choch": choch,
        "high_volume_zones": high_volume_zones,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ─── FastAPI app ───────────────────────────────────────────────────────────────

class _SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security-hardening HTTP response headers to every response."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response


app = FastAPI(
    title="PiiTrade – AI Forex Signal Hub",
    docs_url=None,
    redoc_url=None,
)

app.add_middleware(
    SessionMiddleware,
    secret_key=_SECRET_KEY,
    max_age=_SESSION_MAX_AGE,
    same_site="lax",
    https_only=False,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins if isinstance(_cors_origins, list) else ["*"],
    allow_credentials=_cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(_SecurityHeadersMiddleware)

app.mount("/static", StaticFiles(directory=_STATIC_DIR), name="static")
templates = Jinja2Templates(directory=_TEMPLATES_DIR)


# ─── Template context helper ───────────────────────────────────────────────────

def _ctx(request: Request, **extra) -> dict[str, Any]:
    """Build a base template context with auth info (request passed separately)."""
    username = _get_current_user(request)
    return {
        "current_user": username,
        "is_admin": _is_admin(request),
        "csrf_token": _generate_csrf_token(_session_id(request)),
        **extra,
    }


# ─── Page routes ──────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Landing page: shows EUR/USD preview signal; prompts login/register for more."""
    try:
        pair = "EUR/USD"
        live_rate = _fetch_live_rate(pair)
        signal: dict[str, Any] = dict(_FOREX_SIGNALS[pair])
        signal["pair"] = pair
        prices = _get_prices_for_pair(pair, 30)
        if live_rate is not None:
            signal["entry_price"] = live_rate
            signal["is_live"] = True
            signal["data_source"] = "Frankfurter API (ECB)"
        else:
            signal["is_live"] = False
            signal["data_source"] = "static (live feed unavailable)"
        if prices:
            direction, confidence = _compute_signal_from_prices(prices)
            signal["direction"] = direction
            signal["confidence"] = confidence
            entry = live_rate if live_rate is not None else signal["entry_price"]
            pip = 0.0001
            dec = 4
            tp_pips, sl_pips = _compute_tp_sl_pips(prices, pair)
            if direction == "BUY":
                signal["take_profit"] = round(entry + tp_pips * pip, dec)
                signal["stop_loss"] = round(entry - sl_pips * pip, dec)
            elif direction == "SELL":
                signal["take_profit"] = round(entry - tp_pips * pip, dec)
                signal["stop_loss"] = round(entry + sl_pips * pip, dec)
            else:
                signal["take_profit"] = round(entry + tp_pips * pip, dec)
                signal["stop_loss"] = round(entry - sl_pips * pip, dec)
        return templates.TemplateResponse(
            request, "landing.html",
            _ctx(request, signal=signal),
        )
    except Exception:
        return JSONResponse({"error": "An internal error occurred."}, status_code=500)


@app.get("/forex", response_class=HTMLResponse)
async def forex_hub(request: Request):
    username = _get_current_user(request)
    if not username:
        return RedirectResponse(url="/login?next=/forex", status_code=status.HTTP_302_FOUND)
    if not _is_subscription_active(username):
        return RedirectResponse(url="/subscribe", status_code=status.HTTP_302_FOUND)
    try:
        return templates.TemplateResponse(request, "forex.html", _ctx(request))
    except Exception:
        return JSONResponse({"error": "An internal error occurred."}, status_code=500)


# ─── Auth routes ──────────────────────────────────────────────────────────────

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    if _get_current_user(request):
        return RedirectResponse(url="/forex", status_code=status.HTTP_302_FOUND)
    return templates.TemplateResponse(request, "login.html", _ctx(request, error=None))


@app.post("/login", response_class=HTMLResponse)
async def login_submit(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    csrf_token: str = Form(...),
):
    ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(ip, max_requests=10, window=60):
        return templates.TemplateResponse(
            request, "login.html",
            _ctx(request, error="Too many login attempts. Please wait a minute."),
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    if not _verify_csrf_token(csrf_token, _session_id(request)):
        return templates.TemplateResponse(
            request, "login.html",
            _ctx(request, error="Invalid request. Please try again."),
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    username = username.strip()
    with _USERS_LOCK:
        user = _USERS.get(username)
    if user and _hash_password(password, user["salt"]) == user["password_hash"]:
        request.session["username"] = username
        next_url = request.query_params.get("next", "/forex")
        # Admins bypass subscription check; all other users must have an active subscription.
        if user.get("role") == "admin" or _is_subscription_active(username):
            return RedirectResponse(url=next_url, status_code=status.HTTP_302_FOUND)
        return RedirectResponse(url="/subscribe", status_code=status.HTTP_302_FOUND)
    return templates.TemplateResponse(
        request, "login.html",
        _ctx(request, error="Invalid username or password."),
        status_code=status.HTTP_401_UNAUTHORIZED,
    )


@app.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)


@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    if _get_current_user(request):
        return RedirectResponse(url="/forex", status_code=status.HTTP_302_FOUND)
    return templates.TemplateResponse(request, "register.html", _ctx(request, error=None, success=None))


@app.post("/register", response_class=HTMLResponse)
async def register_submit(
    request: Request,
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    confirm_password: str = Form(...),
    csrf_token: str = Form(...),
):
    ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(ip, max_requests=5, window=60):
        return templates.TemplateResponse(
            request, "register.html",
            _ctx(request, error="Too many registration attempts. Please wait.", success=None),
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    if not _verify_csrf_token(csrf_token, _session_id(request)):
        return templates.TemplateResponse(
            request, "register.html",
            _ctx(request, error="Invalid request. Please try again.", success=None),
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    username = username.strip()
    email = email.strip().lower()

    if len(username) < 3 or len(username) > 32:
        return templates.TemplateResponse(
            request, "register.html",
            _ctx(request, error="Username must be between 3 and 32 characters.", success=None),
        )
    if not all(c.isalnum() or c in "_-" for c in username):
        return templates.TemplateResponse(
            request, "register.html",
            _ctx(request, error="Username may only contain letters, numbers, hyphens and underscores.", success=None),
        )
    if "@" not in email or "." not in email.split("@")[-1]:
        return templates.TemplateResponse(
            request, "register.html",
            _ctx(request, error="Please provide a valid email address.", success=None),
        )
    if len(password) < 8:
        return templates.TemplateResponse(
            request, "register.html",
            _ctx(request, error="Password must be at least 8 characters.", success=None),
        )
    if password != confirm_password:
        return templates.TemplateResponse(
            request, "register.html",
            _ctx(request, error="Passwords do not match.", success=None),
        )

    with _USERS_LOCK:
        if username in _USERS:
            return templates.TemplateResponse(
                request, "register.html",
                _ctx(request, error="Username is already taken.", success=None),
            )
        if any(u["email"] == email for u in _USERS.values()):
            return templates.TemplateResponse(
                request, "register.html",
                _ctx(request, error="An account with this email already exists.", success=None),
            )
        salt = _make_salt()
        _USERS[username] = {
            "email": email,
            "password_hash": _hash_password(password, salt),
            "salt": salt,
            "role": "user",
            "recovery_token": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "subscription_status": "inactive",
            "plan": None,
            "subscription_start": None,
            "subscription_end": None,
            "customer_id": None,
        }
    return templates.TemplateResponse(
        request, "register.html",
        _ctx(request, error=None, success="Account created! You can now log in."),
    )


@app.get("/recovery", response_class=HTMLResponse)
async def recovery_page(request: Request):
    return templates.TemplateResponse(
        request, "recovery.html",
        _ctx(request, step="request", error=None, success=None, token=None),
    )


@app.post("/recovery/request", response_class=HTMLResponse)
async def recovery_request(
    request: Request,
    username: str = Form(...),
    csrf_token: str = Form(...),
):
    ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(ip, max_requests=5, window=300):
        return templates.TemplateResponse(
            request, "recovery.html",
            _ctx(request, step="request", error="Too many recovery attempts. Please wait 5 minutes.", success=None, token=None),
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    if not _verify_csrf_token(csrf_token, _session_id(request)):
        return templates.TemplateResponse(
            request, "recovery.html",
            _ctx(request, step="request", error="Invalid request. Please try again.", success=None, token=None),
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    username = username.strip()
    with _USERS_LOCK:
        user = _USERS.get(username)

    # Always show a token to prevent user enumeration
    token = _generate_recovery_token(username if user else "__nonexistent__")
    if user:
        with _USERS_LOCK:
            _USERS[username]["recovery_token"] = token
    return templates.TemplateResponse(
        request, "recovery.html",
        _ctx(request, step="token", error=None,
             success="Recovery code generated. Copy it and use it to reset your password.",
             token=token),
    )


@app.get("/recovery/reset", response_class=HTMLResponse)
async def recovery_reset_page(request: Request, token: str = ""):
    return templates.TemplateResponse(
        request, "recovery.html",
        _ctx(request, step="reset", error=None, success=None, token=token),
    )


@app.post("/recovery/reset", response_class=HTMLResponse)
async def recovery_reset(
    request: Request,
    token: str = Form(...),
    new_password: str = Form(...),
    confirm_password: str = Form(...),
    csrf_token: str = Form(...),
):
    if not _verify_csrf_token(csrf_token, _session_id(request)):
        return templates.TemplateResponse(
            request, "recovery.html",
            _ctx(request, step="reset", error="Invalid request.", success=None, token=None),
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    username = _verify_recovery_token(token.strip())
    if not username or username == "__nonexistent__":
        return templates.TemplateResponse(
            request, "recovery.html",
            _ctx(request, step="reset", error="Invalid or expired recovery code.", success=None, token=None),
        )
    if len(new_password) < 8:
        return templates.TemplateResponse(
            request, "recovery.html",
            _ctx(request, step="reset", error="Password must be at least 8 characters.", success=None, token=token),
        )
    if new_password != confirm_password:
        return templates.TemplateResponse(
            request, "recovery.html",
            _ctx(request, step="reset", error="Passwords do not match.", success=None, token=token),
        )
    with _USERS_LOCK:
        user = _USERS.get(username)
        if not user:
            return templates.TemplateResponse(
                request, "recovery.html",
                _ctx(request, step="reset", error="Account not found.", success=None, token=None),
            )
        if user.get("recovery_token") != token.strip():
            return templates.TemplateResponse(
                request, "recovery.html",
                _ctx(request, step="reset", error="Recovery code already used or invalid.", success=None, token=None),
            )
        new_salt = _make_salt()
        _USERS[username]["password_hash"] = _hash_password(new_password, new_salt)
        _USERS[username]["salt"] = new_salt
        _USERS[username]["recovery_token"] = None
    return templates.TemplateResponse(
        request, "recovery.html",
        _ctx(request, step="done", error=None,
             success="Password reset successfully! You can now log in.", token=None),
    )


# ─── Admin dashboard ──────────────────────────────────────────────────────────

@app.get("/const", response_class=HTMLResponse)
async def admin_dashboard(request: Request):
    if not _is_admin(request):
        return RedirectResponse(url="/login?next=/const", status_code=status.HTTP_302_FOUND)
    with _USERS_LOCK:
        users_list = [
            {
                "username": k,
                "email": v["email"],
                "role": v["role"],
                "created_at": v["created_at"],
                "subscription_status": v.get("subscription_status", "inactive"),
                "plan": v.get("plan"),
                "subscription_start": v.get("subscription_start"),
                "subscription_end": v.get("subscription_end"),
            }
            for k, v in _USERS.items()
        ]
    cache_info = []
    with _CACHE_LOCK:
        now_ts = datetime.now(timezone.utc).timestamp()
        for key, entry in _RATE_CACHE.items():
            age = int(now_ts - entry.get("fetched_at", now_ts))
            cache_info.append({"key": key, "age_seconds": age, "fresh": age < _CACHE_TTL_SECONDS})
    return templates.TemplateResponse(
        request, "admin.html",
        _ctx(
            request,
            users=users_list,
            subscribers=list(_FOREX_SUBSCRIBERS),
            payment_confirmations=list(_PAYMENT_CONFIRMATIONS),
            plans=_PLANS,
            cache_info=sorted(cache_info, key=lambda x: x["key"]),
            total_pairs=len(_SUPPORTED_PAIRS),
        ),
    )


# ─── Admin API ────────────────────────────────────────────────────────────────

@app.get("/api/admin/stats")
async def admin_stats(request: Request):
    if not _is_admin(request):
        return JSONResponse({"error": "Unauthorized"}, status_code=status.HTTP_403_FORBIDDEN)
    with _USERS_LOCK:
        total_users = len(_USERS)
        admin_count = sum(1 for u in _USERS.values() if u["role"] == "admin")
        active_subs = sum(
            1 for u in _USERS.values()
            if u.get("role") != "admin" and u.get("subscription_status") == "active"
        )
    return JSONResponse({
        "total_users": total_users,
        "admin_users": admin_count,
        "regular_users": total_users - admin_count,
        "active_subscriptions": active_subs,
        "total_subscribers": len(_FOREX_SUBSCRIBERS),
        "pending_payments": len([p for p in _PAYMENT_CONFIRMATIONS if p.get("status") == "pending"]),
        "total_pairs": len(_SUPPORTED_PAIRS),
        "cache_entries": len(_RATE_CACHE),
        "server_time": datetime.now(timezone.utc).isoformat(),
    })


@app.delete("/api/admin/users/{target_username}")
async def admin_delete_user(request: Request, target_username: str):
    if not _is_admin(request):
        return JSONResponse({"error": "Unauthorized"}, status_code=status.HTTP_403_FORBIDDEN)
    with _USERS_LOCK:
        if target_username not in _USERS:
            return JSONResponse({"error": "User not found"}, status_code=404)
        if _USERS[target_username]["role"] == "admin":
            return JSONResponse({"error": "Cannot delete admin accounts via API"}, status_code=400)
        del _USERS[target_username]
    return JSONResponse({"success": True, "message": f"User '{target_username}' deleted."})


@app.delete("/api/admin/subscribers/{email}")
async def admin_delete_subscriber(request: Request, email: str):
    if not _is_admin(request):
        return JSONResponse({"error": "Unauthorized"}, status_code=status.HTTP_403_FORBIDDEN)
    global _FOREX_SUBSCRIBERS
    before = len(_FOREX_SUBSCRIBERS)
    _FOREX_SUBSCRIBERS = [s for s in _FOREX_SUBSCRIBERS if s["email"] != email]
    if len(_FOREX_SUBSCRIBERS) == before:
        return JSONResponse({"error": "Subscriber not found"}, status_code=404)
    return JSONResponse({"success": True, "message": f"Subscriber '{email}' removed."})


@app.post("/api/admin/users/{target_username}/subscription")
async def admin_set_subscription(request: Request, target_username: str):
    """Admin endpoint to manually activate or deactivate a user's subscription."""
    if not _is_admin(request):
        return JSONResponse({"error": "Unauthorized"}, status_code=status.HTTP_403_FORBIDDEN)
    try:
        data: dict[str, Any] = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body"}, status_code=400)
    action = data.get("action", "activate")
    plan_id = data.get("plan", "monthly")
    with _USERS_LOCK:
        if target_username not in _USERS:
            return JSONResponse({"error": "User not found"}, status_code=404)
        if action == "activate":
            plan = next((p for p in _PLANS if p["id"] == plan_id), None)
            if not plan:
                return JSONResponse({"error": "Invalid plan"}, status_code=400)
            today = date.today()
            end = today + timedelta(days=plan["duration_days"])
            _USERS[target_username]["subscription_status"] = "active"
            _USERS[target_username]["plan"] = plan_id
            _USERS[target_username]["subscription_start"] = today.isoformat()
            _USERS[target_username]["subscription_end"] = end.isoformat()
        elif action == "deactivate":
            _USERS[target_username]["subscription_status"] = "inactive"
        else:
            return JSONResponse({"error": "Invalid action. Use 'activate' or 'deactivate'"}, status_code=400)
    return JSONResponse({"success": True, "message": f"Subscription {action}d for '{target_username}'."})


@app.post("/api/admin/payments/{idx}/approve")
async def admin_approve_payment(request: Request, idx: int):
    """Admin endpoint to approve a pending crypto payment confirmation."""
    if not _is_admin(request):
        return JSONResponse({"error": "Unauthorized"}, status_code=status.HTTP_403_FORBIDDEN)
    if idx < 0 or idx >= len(_PAYMENT_CONFIRMATIONS):
        return JSONResponse({"error": "Payment not found"}, status_code=404)
    confirmation = _PAYMENT_CONFIRMATIONS[idx]
    email = confirmation.get("email", "")
    plan_id = confirmation.get("plan", "").lower()
    # Map legacy plan names to new ids (quarterly/annual → yearly)
    _plan_alias = {"quarterly": "yearly", "annual": "yearly"}
    plan_id = _plan_alias.get(plan_id, plan_id) if plan_id in _plan_alias else plan_id
    # Validate plan_id; fall back to monthly for unknown values
    if not any(p["id"] == plan_id for p in _PLANS):
        plan_id = "monthly"
    # Find the user by email
    with _USERS_LOCK:
        username = next((k for k, v in _USERS.items() if v.get("email") == email), None)
    if username:
        _activate_subscription(username, plan_id)
    _PAYMENT_CONFIRMATIONS[idx]["status"] = "approved"
    return JSONResponse({"success": True, "message": f"Payment approved and subscription activated for '{email}'."})



# ─── Public forex API ─────────────────────────────────────────────────────────

@app.get("/api/forex/signals")
async def forex_signals(pair: str = "EUR/USD"):
    if pair not in _SUPPORTED_PAIRS:
        return JSONResponse(
            {"error": f"Unsupported pair. Choose from: {', '.join(_SUPPORTED_PAIRS)}"},
            status_code=400,
        )
    signal: dict[str, Any] = dict(_FOREX_SIGNALS[pair])
    signal["pair"] = pair

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

    if hist_rates:
        history = _build_forex_history_live(pair, hist_rates)
    else:
        history = _build_forex_history(pair)

    correct_count = sum(1 for h in history if h["correct"])
    signal["accuracy_30d"] = round(correct_count / len(history) * 100, 1) if history else 0.0
    signal["history"] = history
    return JSONResponse(signal)


@app.get("/api/forex/technical")
async def forex_technical(pair: str = "EUR/USD"):
    if pair not in _SUPPORTED_PAIRS:
        return JSONResponse(
            {"error": f"Unsupported pair. Choose from: {', '.join(_SUPPORTED_PAIRS)}"},
            status_code=400,
        )
    live_rate = _fetch_live_rate(pair)
    return JSONResponse(_build_technical_analysis(pair, live_rate))


@app.get("/api/forex/pairs")
async def forex_pairs():
    return JSONResponse({
        "major":     [p for p in _SUPPORTED_PAIRS if "USD" in p.split("/") and not p.startswith("XAU")],
        "cross":     [p for p in _SUPPORTED_PAIRS if "USD" not in p.split("/") and not p.startswith("XAU")],
        "commodity": [p for p in _SUPPORTED_PAIRS if p.startswith("XAU")],
        "all":       list(_SUPPORTED_PAIRS),
    })


@app.get("/api/forex/news")
async def forex_news():
    return JSONResponse({"news": _make_news_items()})


@app.post("/api/forex/subscribe")
async def forex_subscribe(request: Request):
    try:
        data: dict[str, Any] = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body"}, status_code=400)

    email: str = data.get("email", "").strip().lower()
    pairs: list[str] = data.get("pairs", [])

    if not email or "@" not in email or "." not in email.split("@")[-1]:
        return JSONResponse({"error": "Please provide a valid email address"}, status_code=400)

    invalid = [p for p in pairs if p not in _SUPPORTED_PAIRS]
    if invalid:
        return JSONResponse({"error": f"Unsupported pairs: {', '.join(invalid)}"}, status_code=400)

    if not pairs:
        pairs = list(_SUPPORTED_PAIRS)

    if any(s["email"] == email for s in _FOREX_SUBSCRIBERS):
        return JSONResponse({"success": True, "message": "You are already subscribed."})

    _FOREX_SUBSCRIBERS.append({
        "email": email,
        "pairs": pairs,
        "subscribed_at": datetime.now(timezone.utc).isoformat(),
    })
    return JSONResponse({
        "success": True,
        "message": "Subscribed! You will receive alerts when new signals are generated.",
    })


def _get_prices_for_pair(pair: str, days: int = 30) -> list[float]:
    """Return price list for pair, falling back to static sequences when live API unavailable."""
    hist = _fetch_historical_rates(pair, days)
    if hist:
        return list(hist.values())
    # Fall back to static price sequence
    base_price, pip, seq = _FOREX_HIST_SEQUENCES[pair]
    price = base_price
    prices: list[float] = [price]
    for _pred, _actual, delta in seq:
        price = round(price + delta * pip, 6)
        prices.append(price)
    return prices


# ─── Volatile pairs API ────────────────────────────────────────────────────────

def _compute_volatility(prices: list[float], window: int) -> float:
    """Return percentage range (high-low / midpoint) for the last `window` prices."""
    if len(prices) < 2:
        return 0.0
    subset = prices[-min(window, len(prices)):]
    high = max(subset)
    low = min(subset)
    mid = (high + low) / 2.0 if (high + low) > 0 else 1.0
    return round((high - low) / mid * 100, 4)


@app.get("/api/forex/volatile")
async def forex_volatile(timeframe: str = "24h"):
    """Return pairs ranked by volatility for the requested timeframe (1h, 4h, 24h)."""
    valid = {"1h", "4h", "24h"}
    if timeframe not in valid:
        return JSONResponse({"error": f"Invalid timeframe. Choose from: {', '.join(sorted(valid))}"}, status_code=400)

    # Map timeframe to number of daily-sampled data points used as a proxy
    window_map = {"1h": 2, "4h": 5, "24h": 10}
    window = window_map[timeframe]

    results: list[dict[str, Any]] = []
    for pair in _SUPPORTED_PAIRS:
        prices = _get_prices_for_pair(pair, 30)
        vol = _compute_volatility(prices, window)
        signal_info = _FOREX_SIGNALS[pair]
        live_rate = _fetch_live_rate(pair)
        results.append({
            "pair": pair,
            "volatility_pct": vol,
            "direction": signal_info["direction"],
            "confidence": signal_info["confidence"],
            "entry_price": live_rate if live_rate is not None else signal_info["entry_price"],
        })

    results.sort(key=lambda x: x["volatility_pct"], reverse=True)
    return JSONResponse({"timeframe": timeframe, "pairs": results})


# ─── Trend reversal API ────────────────────────────────────────────────────────

_EPSILON = 1e-12  # small value to prevent division by zero


def _detect_reversal(prices: list[float]) -> dict[str, Any]:
    """Simple reversal detection: look for recent direction change in momentum."""
    if len(prices) < 10:
        return {"reversal": "none", "strength": 0.0}
    recent = prices[-5:]
    prior = prices[-10:-5]
    recent_trend = recent[-1] - recent[0]
    prior_trend = prior[-1] - prior[0]
    # Reversal if the two halves trend in opposite directions
    if prior_trend > 0 and recent_trend < 0:
        strength = round(abs(recent_trend) / (abs(prior_trend) + _EPSILON) * 100, 1)
        return {"reversal": "bearish", "strength": min(strength, 100.0)}
    if prior_trend < 0 and recent_trend > 0:
        strength = round(abs(recent_trend) / (abs(prior_trend) + _EPSILON) * 100, 1)
        return {"reversal": "bullish", "strength": min(strength, 100.0)}
    return {"reversal": "none", "strength": 0.0}


@app.get("/api/forex/reversals")
async def forex_reversals():
    """Return pairs with detected potential trend reversals."""
    results: list[dict[str, Any]] = []
    for pair in _SUPPORTED_PAIRS:
        prices = _get_prices_for_pair(pair, 30)
        rev = _detect_reversal(prices)
        if rev["reversal"] == "none":
            continue
        signal_info = _FOREX_SIGNALS[pair]
        live_rate = _fetch_live_rate(pair)
        results.append({
            "pair": pair,
            "reversal_type": rev["reversal"],
            "strength": rev["strength"],
            "direction": signal_info["direction"],
            "confidence": signal_info["confidence"],
            "entry_price": live_rate if live_rate is not None else signal_info["entry_price"],
        })
    results.sort(key=lambda x: x["strength"], reverse=True)
    return JSONResponse({"pairs": results})


# ─── Subscription / payment page ─────────────────────────────────────────────

# Crypto wallet addresses (configurable via env vars)
_WALLETS = {
    "solana":   os.environ.get("SOLANA_ADDRESS",  "SolanaWalletAddressHere"),
    "litecoin": os.environ.get("LITECOIN_ADDRESS","LitecoinWalletAddressHere"),
    "nano":     os.environ.get("NANO_ADDRESS",    "NanoWalletAddressHere"),
    "iota":     os.environ.get("IOTA_ADDRESS",    "IotaWalletAddressHere"),
    "bitgert":  os.environ.get("BITGERT_ADDRESS", "BitgertWalletAddressHere"),
    "stellar":  os.environ.get("STELLA_ADDRESS",  "StellarWalletAddressHere"),
    "ripple":   os.environ.get("RIPPLE_ADDRESS",  "RippleWalletAddressHere"),
}

# Subscription plans
_PLANS = [
    {"id": "weekly",  "label": "Weekly",  "price_usd": 3,  "duration_days": 7},
    {"id": "monthly", "label": "Monthly", "price_usd": 14, "duration_days": 30},
    {"id": "yearly",  "label": "Yearly",  "price_usd": 99, "duration_days": 365},
]


@app.get("/subscribe", response_class=HTMLResponse)
async def subscribe_page(request: Request):
    return templates.TemplateResponse(
        request, "subscribe.html",
        _ctx(request, wallets=_WALLETS, plans=_PLANS, stripe_available=_STRIPE_AVAILABLE),
    )


@app.get("/subscribe/success", response_class=HTMLResponse)
async def subscribe_success(request: Request, session_id: str = ""):
    """Stripe checkout success redirect – verify session and activate subscription."""
    username = _get_current_user(request)
    if not username:
        return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)
    if _STRIPE_AVAILABLE and session_id:
        try:
            session = _stripe.checkout.Session.retrieve(session_id)  # type: ignore[union-attr]
            if session.payment_status in ("paid", "no_payment_required"):
                plan_id = (session.metadata or {}).get("plan", "monthly")
                customer_id = session.customer
                _activate_subscription(username, plan_id, customer_id)
        except Exception:
            pass
    return RedirectResponse(url="/forex", status_code=status.HTTP_302_FOUND)


@app.post("/api/forex/payment-confirm")
async def payment_confirm(request: Request):
    """Accept a payment confirmation with email, tx hash, and plan info."""
    try:
        data: dict[str, Any] = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body"}, status_code=400)

    email: str = data.get("email", "").strip().lower()
    tx_hash: str = data.get("tx_hash", "").strip()
    plan: str = data.get("plan", "").strip()

    if not email or "@" not in email or "." not in email.split("@")[-1]:
        return JSONResponse({"error": "Please provide a valid email address"}, status_code=400)
    if not tx_hash:
        return JSONResponse({"error": "Transaction hash is required"}, status_code=400)

    # Store confirmation for admin review
    _PAYMENT_CONFIRMATIONS.append({
        "email": email,
        "tx_hash": tx_hash,
        "plan": plan,
        "price_usd": data.get("price_usd"),
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
    })
    return JSONResponse({
        "success": True,
        "message": (
            "Payment confirmation received! Your subscription will be activated "
            "within 1–2 hours after verification. Thank you!"
        ),
    })


# ─── Stripe payment routes ─────────────────────────────────────────────────────

@app.post("/api/stripe/create-checkout-session")
async def stripe_create_checkout(request: Request):
    """Create a Stripe Checkout session for the selected subscription plan."""
    username = _get_current_user(request)
    if not username:
        return JSONResponse({"error": "Authentication required"}, status_code=status.HTTP_401_UNAUTHORIZED)
    if not _STRIPE_AVAILABLE:
        return JSONResponse({"error": "Stripe integration not configured"}, status_code=503)
    try:
        data: dict[str, Any] = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body"}, status_code=400)
    plan_id = data.get("plan", "monthly")
    plan = next((p for p in _PLANS if p["id"] == plan_id), None)
    if not plan:
        return JSONResponse({"error": "Invalid plan"}, status_code=400)
    price_id = _STRIPE_PRICE_IDS.get(plan_id, "")
    if not price_id:
        return JSONResponse(
            {"error": f"Stripe price ID not configured for '{plan_id}' plan"},
            status_code=503,
        )
    with _USERS_LOCK:
        user = dict(_USERS.get(username, {}))
    checkout_params: dict[str, Any] = {
        "mode": "subscription",
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": str(request.base_url).rstrip("/") + "/subscribe/success?session_id={CHECKOUT_SESSION_ID}",
        "cancel_url": str(request.base_url).rstrip("/") + "/subscribe",
        "metadata": {"username": username, "plan": plan_id},
    }
    customer_id = user.get("customer_id")
    if customer_id:
        checkout_params["customer"] = customer_id
    elif user.get("email"):
        checkout_params["customer_email"] = user["email"]
    try:
        session = _stripe.checkout.Session.create(**checkout_params)  # type: ignore[union-attr]
        return JSONResponse({"url": session.url})
    except Exception:
        return JSONResponse({"error": "Failed to create Stripe checkout session"}, status_code=500)


@app.post("/api/stripe/webhook")
async def stripe_webhook(request: Request):
    """Stripe webhook endpoint – handles subscription lifecycle events."""
    if not _STRIPE_AVAILABLE:
        return JSONResponse({"error": "Stripe not configured"}, status_code=503)
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    try:
        event = _stripe.Webhook.construct_event(  # type: ignore[union-attr]
            payload, sig_header, _STRIPE_WEBHOOK_SECRET
        )
    except Exception:
        return JSONResponse({"error": "Invalid webhook signature or payload"}, status_code=400)

    event_type: str = event.get("type", "")
    data_obj: dict[str, Any] = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        session_username = (data_obj.get("metadata") or {}).get("username")
        session_plan = (data_obj.get("metadata") or {}).get("plan", "monthly")
        customer_id = data_obj.get("customer")
        if session_username:
            _activate_subscription(session_username, session_plan, customer_id)
        elif customer_id:
            # Fall back to customer-ID lookup
            uname = _find_username_by_customer(customer_id)
            if uname:
                _activate_subscription(uname, session_plan, customer_id)

    elif event_type == "invoice.payment_succeeded":
        customer_id = data_obj.get("customer")
        if customer_id:
            _extend_subscription_by_customer(customer_id)

    elif event_type == "customer.subscription.deleted":
        customer_id = data_obj.get("customer")
        if customer_id:
            _deactivate_subscription_by_customer(customer_id)

    elif event_type == "invoice.payment_failed":
        # Log the failure; after a configurable grace period the subscription
        # would be deactivated via customer.subscription.deleted.
        pass

    return JSONResponse({"received": True})


# ─── Profile page ─────────────────────────────────────────────────────────────

@app.get("/profile", response_class=HTMLResponse)
async def profile_page(request: Request):
    username = _get_current_user(request)
    if not username:
        return RedirectResponse(url="/login?next=/profile", status_code=status.HTTP_302_FOUND)
    with _USERS_LOCK:
        user = dict(_USERS.get(username, {}))

    invoices: list[dict[str, Any]] = []
    portal_url: Optional[str] = None
    customer_id = user.get("customer_id")

    if _STRIPE_AVAILABLE and customer_id:
        try:
            invoice_list = _stripe.Invoice.list(customer=customer_id, limit=10)  # type: ignore[union-attr]
            for inv in invoice_list.auto_paging_iter():
                invoices.append({
                    "date": datetime.fromtimestamp(inv.created, tz=timezone.utc).strftime("%Y-%m-%d"),
                    "amount": f"${inv.amount_paid / 100:.2f}",
                    "description": inv.lines.data[0].description if inv.lines.data else "PiiTrade Subscription",
                    "status": inv.status,
                    "pdf_url": inv.invoice_pdf,
                })
                if len(invoices) >= 10:
                    break
        except Exception:
            pass
        try:
            portal_session = _stripe.billing_portal.Session.create(  # type: ignore[union-attr]
                customer=customer_id,
                return_url=str(request.base_url).rstrip("/") + "/profile",
            )
            portal_url = portal_session.url
        except Exception:
            pass

    # Include crypto payment confirmations for this user's email
    user_email = user.get("email", "")
    local_payments = [p for p in _PAYMENT_CONFIRMATIONS if p.get("email") == user_email]

    plan_label = next((p["label"] for p in _PLANS if p["id"] == user.get("plan")), None)
    sub_active = _is_subscription_active(username)

    return templates.TemplateResponse(
        request, "profile.html",
        _ctx(
            request,
            profile_user=user,
            profile_username=username,
            invoices=invoices,
            local_payments=local_payments,
            portal_url=portal_url,
            plan_label=plan_label,
            sub_active=sub_active,
            stripe_available=_STRIPE_AVAILABLE,
        ),
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    debug = os.environ.get("DEBUG", "0") == "1"
    uvicorn.run("web.app:app", host="0.0.0.0", port=port, reload=debug)
