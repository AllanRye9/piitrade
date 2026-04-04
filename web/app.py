#!/usr/bin/env python3
"""
PiiTrade – AI Forex Signal Hub
FastAPI application with auth, admin dashboard, and security hardening.
"""

import hashlib
import os
import secrets
import smtplib
from datetime import date, datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from threading import Lock
from typing import Any, Optional

import shutil
import uuid

import requests as _requests
from fastapi import FastAPI, File, Form, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware



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
    # Check candidate locations: app directory first, then /tmp for read-only filesystems
    # (e.g. Vercel serverless, AWS Lambda) where the app directory is not writable.
    _candidates = [_DIR / ".secret_key", Path("/tmp/.piitrade_secret_key")]
    for _key_file in _candidates:
        if _key_file.exists():
            stored = _key_file.read_text().strip()
            if stored:
                return stored
    new_key = secrets.token_hex(32)
    for _key_file in _candidates:
        try:
            _key_file.write_text(new_key)
            return new_key
        except OSError:
            pass
    import warnings
    warnings.warn(
        f"PiiTrade: could not persist secret key to {_candidates[0]} "
        "(read-only filesystem). Sessions will be invalidated on every server restart. "
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
# Enable secure (HTTPS-only) session cookies when running behind TLS (default on Render).
_SESSION_HTTPS_ONLY = os.environ.get("SESSION_HTTPS_ONLY", "1") != "0"

# Database connection URL (e.g. postgresql://user:pass@host/dbname).
# Set the PIIDATA environment variable to enable persistent database storage.
_PIIDATA = os.environ.get("PIIDATA", "")

# Stripe payments have been removed – service is free
_STRIPE_AVAILABLE = False

# ─── SMTP / email configuration ───────────────────────────────────────────────
_SMTP_HOST = os.environ.get("SMTP_HOST", "")
_SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
_SMTP_USER = os.environ.get("SMTP_USER", "")
_SMTP_PASS = os.environ.get("SMTP_PASS", "")
_SMTP_FROM = os.environ.get("SMTP_FROM", "") or _SMTP_USER
_APP_BASE_URL = os.environ.get("APP_BASE_URL", "https://piitrade.onrender.com")

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


# ─── Email helper ─────────────────────────────────────────────────────────────

def _send_email(to: str, subject: str, html_body: str) -> bool:
    """Send an HTML email via SMTP. Returns True on success.

    Requires SMTP_HOST and SMTP_USER environment variables.  When not
    configured the function is a silent no-op (returns False).
    """
    if not _SMTP_HOST or not _SMTP_USER:
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = _SMTP_FROM
        msg["To"] = to
        msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT, timeout=10) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(_SMTP_USER, _SMTP_PASS)
            smtp.sendmail(_SMTP_FROM, [to], msg.as_string())
        return True
    except Exception:
        return False


# ─── In-memory user store ──────────────────────────────────────────────────────
# username -> {email, password_hash, salt, role, recovery_token, created_at}
_USERS: dict[str, dict[str, Any]] = {}
_USERS_LOCK = Lock()

_RATE_LIMIT: dict[str, list[float]] = {}
_RATE_LIMIT_LOCK = Lock()

# ─── Support / forwarding email ───────────────────────────────────────────────
_SUPPORT_ALERT_EMAIL = os.environ.get("SUPPORT_ALERT_EMAIL", "support@yotweek.com")

# ─── Visitor tracking ─────────────────────────────────────────────────────────
# ip -> {first_seen, last_seen, country, page_views, first_date}
_VISITOR_LOG: dict[str, dict[str, Any]] = {}
_VISITOR_LOG_LOCK = Lock()
_TOTAL_PAGE_VIEWS = 0
_TOTAL_PAGE_VIEWS_LOCK = Lock()


def _get_client_ip(request: Request) -> str:
    """Return real client IP, honouring X-Forwarded-For from Render's proxy."""
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _lookup_country_bg(ip: str) -> None:
    """Background thread: look up the country for *ip* and cache it."""
    import threading as _threading
    if ip in ("127.0.0.1", "::1", "unknown"):
        country = "Local"
    elif ip.startswith(("10.", "172.16.", "172.17.", "172.18.", "172.19.",
                         "172.20.", "172.21.", "172.22.", "172.23.", "172.24.",
                         "172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
                         "172.30.", "172.31.", "192.168.")):
        country = "Local"
    else:
        try:
            resp = _requests.get(
                f"https://ip-api.com/json/{ip}?fields=country,countryCode",
                timeout=4,
            )
            if resp.status_code == 200:
                data = resp.json()
                country = data.get("country", "") if data.get("status") == "success" else ""
            else:
                country = ""
        except Exception:
            country = ""
    with _VISITOR_LOG_LOCK:
        if ip in _VISITOR_LOG and not _VISITOR_LOG[ip].get("country"):
            _VISITOR_LOG[ip]["country"] = country


def _mask_ip(ip: str) -> str:
    """Return a privacy-safe display version of an IP address.

    IPv4: mask the last octet (e.g. '203.0.113.1' → '203.0.113.***')
    IPv6: keep only the first two groups (e.g. '2001:db8::1' → '2001:db8:***')
    Other: show first 8 chars followed by ***
    """
    if "." in ip and ":" not in ip:
        # IPv4
        parts = ip.split(".")
        if len(parts) == 4:
            return f"{parts[0]}.{parts[1]}.{parts[2]}.*"
    elif ":" in ip:
        # IPv6
        groups = ip.split(":")
        if len(groups) >= 2:
            return f"{groups[0]}:{groups[1]}:***"
    return ip[:8] + "***"


def _record_visit(ip: str) -> None:
    """Record a page-view hit; spawns a background country-lookup for new IPs."""
    import threading as _threading
    global _TOTAL_PAGE_VIEWS
    now = datetime.now(timezone.utc).isoformat()
    today = now[:10]
    is_new = False
    with _VISITOR_LOG_LOCK:
        if ip not in _VISITOR_LOG:
            _VISITOR_LOG[ip] = {
                "first_seen": now,
                "last_seen": now,
                "country": "",
                "page_views": 1,
                "first_date": today,
            }
            is_new = True
        else:
            _VISITOR_LOG[ip]["last_seen"] = now
            _VISITOR_LOG[ip]["page_views"] += 1
    with _TOTAL_PAGE_VIEWS_LOCK:
        _TOTAL_PAGE_VIEWS += 1
    if is_new:
        _threading.Thread(target=_lookup_country_bg, args=(ip,), daemon=True).start()


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


def _find_user_by_identifier(identifier: str) -> Optional[tuple[str, dict]]:
    """Look up a user by username or email address.

    The *identifier* is compared case-sensitively for usernames and
    case-insensitively for email addresses.  Returns ``(username, user_dict)``
    on success, or ``None`` when no match is found.
    """
    with _USERS_LOCK:
        # 1. Exact username match
        user = _USERS.get(identifier)
        if user:
            return identifier, dict(user)
        # 2. Case-insensitive email match
        identifier_lower = identifier.lower()
        for uname, udata in _USERS.items():
            if udata.get("email", "").lower() == identifier_lower:
                return uname, dict(udata)
    return None


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


# ─── Email templates ─────────────────────────────────────────────────────────

def _email_purchase_html(plan_label: str, start_date: str, end_date: str) -> str:
    """Return HTML body for a new purchase confirmation email."""
    return f"""
<html><body style="font-family:sans-serif;background:#0d1117;color:#c9d1d9;padding:32px">
<div style="max-width:560px;margin:0 auto;background:#161b22;border-radius:12px;padding:32px;border:1px solid #30363d">
  <h1 style="color:#58a6ff;margin-top:0">🎉 Welcome to PiiTrade!</h1>
  <p>Your <strong>{plan_label}</strong> subscription is now active.</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0">
    <tr><td style="padding:8px 0;color:#8b949e">Plan</td>
        <td style="padding:8px 0;font-weight:600">{plan_label}</td></tr>
    <tr><td style="padding:8px 0;color:#8b949e">Start date</td>
        <td style="padding:8px 0">{start_date}</td></tr>
    <tr><td style="padding:8px 0;color:#8b949e">Renews / expires</td>
        <td style="padding:8px 0">{end_date}</td></tr>
  </table>
  <p>You can view your subscription details and payment history on your
     <a href="{_APP_BASE_URL}/profile" style="color:#58a6ff">profile page</a>.</p>
  <hr style="border:none;border-top:1px solid #30363d;margin:24px 0"/>
  <p style="font-size:.85rem;color:#8b949e">PiiTrade – AI Forex Signal Hub</p>
</div>
</body></html>"""


def _email_renewal_html(plan_label: str, new_end_date: str) -> str:
    """Return HTML body for a subscription renewal confirmation email."""
    return f"""
<html><body style="font-family:sans-serif;background:#0d1117;color:#c9d1d9;padding:32px">
<div style="max-width:560px;margin:0 auto;background:#161b22;border-radius:12px;padding:32px;border:1px solid #30363d">
  <h1 style="color:#3fb950;margin-top:0">🔄 Subscription Renewed</h1>
  <p>Your <strong>{plan_label}</strong> subscription has been automatically renewed.</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0">
    <tr><td style="padding:8px 0;color:#8b949e">Plan</td>
        <td style="padding:8px 0;font-weight:600">{plan_label}</td></tr>
    <tr><td style="padding:8px 0;color:#8b949e">New expiry date</td>
        <td style="padding:8px 0">{new_end_date}</td></tr>
  </table>
  <p>View your updated subscription on your
     <a href="{_APP_BASE_URL}/profile" style="color:#58a6ff">profile page</a>.</p>
  <hr style="border:none;border-top:1px solid #30363d;margin:24px 0"/>
  <p style="font-size:.85rem;color:#8b949e">PiiTrade – AI Forex Signal Hub</p>
</div>
</body></html>"""


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
    user_email: str = ""
    plan_label: str = ""
    new_end_str: str = ""
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
                user_email = user.get("email", "")
                plan_label = plan["label"]
                new_end_str = new_end.isoformat()
                break
    # Send renewal confirmation email outside the lock
    if user_email:
        _send_email(
            user_email,
            "PiiTrade – Subscription Renewed",
            _email_renewal_html(plan_label, new_end_str),
        )


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


# ─── Ads store ────────────────────────────────────────────────────────────────
# id -> {id, title, image_url, link_url, placement, active, created_at}
_ADS: dict[str, dict[str, Any]] = {}
_ADS_LOCK = Lock()
_ADS_UPLOADS_DIR = _STATIC_DIR / "uploads" / "ads"


def _ensure_ads_dir() -> None:
    """Create the uploads/ads directory if it doesn't exist.

    Silently ignores errors on read-only filesystems (e.g. Vercel).
    """
    try:
        _ADS_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    except OSError:
        pass


_ensure_ads_dir()

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
_COINGECKO_BASE = "https://api.coingecko.com/api/v3"
_RATE_CACHE: dict[str, dict] = {}
_CACHE_LOCK = Lock()
_CACHE_TTL_SECONDS = 300

_YF_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}

# Stock tickers served via Yahoo Finance (real-time prices, no cache warm-up needed)
_STOCK_TICKERS: frozenset[str] = frozenset({"AAPL", "TSLA", "NVDA", "AMZN", "MSFT", "GOOGL", "META"})

# Commodity pairs served via Yahoo Finance futures tickers
_COMMODITY_PAIRS: frozenset[str] = frozenset({"XAU/USD", "XAG/USD", "WTI/USD", "BRENT/USD"})

# Crypto pairs served via CoinGecko (with YF as fallback)
_CRYPTO_PAIRS: frozenset[str] = frozenset({"BTC/USD", "ETH/USD", "BNB/USD", "XRP/USD", "SOL/USD"})

# All pairs requiring Yahoo Finance (stocks + commodities + crypto)
_YF_PAIRS: frozenset[str] = _STOCK_TICKERS | _COMMODITY_PAIRS | _CRYPTO_PAIRS

# Mapping from pair name to Yahoo Finance ticker symbol
_YF_TICKER_MAP: dict[str, str] = {
    # Stocks
    "AAPL": "AAPL",
    "TSLA": "TSLA",
    "NVDA": "NVDA",
    "AMZN": "AMZN",
    "MSFT": "MSFT",
    "GOOGL": "GOOGL",
    "META": "META",
    # Commodities (futures)
    "XAU/USD": "GC=F",    # Gold futures
    "XAG/USD": "SI=F",    # Silver futures
    "WTI/USD": "CL=F",    # WTI Crude Oil futures
    "BRENT/USD": "BZ=F",  # Brent Crude Oil futures
    # Crypto (fallback only – CoinGecko tried first)
    "BTC/USD": "BTC-USD",
    "ETH/USD": "ETH-USD",
    "BNB/USD": "BNB-USD",
    "XRP/USD": "XRP-USD",
    "SOL/USD": "SOL-USD",
}

# CoinGecko coin IDs for crypto pairs
_COINGECKO_ID_MAP: dict[str, str] = {
    "BTC/USD": "bitcoin",
    "ETH/USD": "ethereum",
    "BNB/USD": "binancecoin",
    "XRP/USD": "ripple",
    "SOL/USD": "solana",
}

# Shared CoinGecko batch cache: id → price, refreshed together
_COINGECKO_CACHE: dict[str, float] = {}
_COINGECKO_CACHE_TIME: float = 0.0
_COINGECKO_CACHE_LOCK = Lock()
_COINGECKO_CACHE_TTL = 60  # refresh at most once per minute


def _fetch_coingecko_batch() -> dict[str, float]:
    """Fetch current USD prices for all tracked crypto coins via CoinGecko.

    Returns a mapping of CoinGecko coin ID → USD price.
    Results are cached for ``_COINGECKO_CACHE_TTL`` seconds.
    """
    import time as _time

    now = _time.time()
    with _COINGECKO_CACHE_LOCK:
        if now - _COINGECKO_CACHE_TIME < _COINGECKO_CACHE_TTL and _COINGECKO_CACHE:
            return dict(_COINGECKO_CACHE)

    ids = ",".join(_COINGECKO_ID_MAP.values())
    try:
        resp = _requests.get(
            f"{_COINGECKO_BASE}/simple/price",
            params={"ids": ids, "vs_currencies": "usd"},
            timeout=6,
        )
        resp.raise_for_status()
        data = resp.json()
        prices: dict[str, float] = {
            coin_id: float(v["usd"])
            for coin_id, v in data.items()
            if "usd" in v
        }
        with _COINGECKO_CACHE_LOCK:
            _COINGECKO_CACHE.clear()
            _COINGECKO_CACHE.update(prices)
            import time as _t
            _COINGECKO_CACHE_TIME = _t.time()
        return prices
    except Exception:
        with _COINGECKO_CACHE_LOCK:
            return dict(_COINGECKO_CACHE)  # return stale cache on error


def _fetch_coingecko_rate(pair: str) -> float | None:
    """Return current USD price for a crypto pair via CoinGecko."""
    coin_id = _COINGECKO_ID_MAP.get(pair)
    if not coin_id:
        return None
    prices = _fetch_coingecko_batch()
    return prices.get(coin_id)


def _fetch_yf_rate(ticker: str) -> float | None:
    """Fetch the current price for a Yahoo Finance ticker (stock or index)."""
    for base_url in (_YAHOO_FINANCE_BASE, _YAHOO_FINANCE_BASE_ALT):
        try:
            resp = _requests.get(
                f"{base_url}/{ticker}",
                params={"interval": "1d", "range": "1d"},
                headers=_YF_HEADERS,
                timeout=6,
            )
            resp.raise_for_status()
            return float(resp.json()["chart"]["result"][0]["meta"]["regularMarketPrice"])
        except Exception:
            continue
    return None


def _fetch_yf_historical(ticker: str, days: int = 30) -> dict[str, float]:
    """Fetch daily historical closing prices for a Yahoo Finance ticker."""
    for base_url in (_YAHOO_FINANCE_BASE, _YAHOO_FINANCE_BASE_ALT):
        try:
            resp = _requests.get(
                f"{base_url}/{ticker}",
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
            return dict(list(sorted_rates.items())[-days:])
        except Exception:
            continue
    return {}


def _fetch_live_rate(pair: str) -> float | None:
    cache_key = f"rate:{pair}"
    now = datetime.now(timezone.utc).timestamp()
    with _CACHE_LOCK:
        entry = _RATE_CACHE.get(cache_key)
        if entry and now - entry["fetched_at"] < _CACHE_TTL_SECONDS:
            return entry["rate"]
    rate: float | None = None
    if pair in _CRYPTO_PAIRS:
        # Try CoinGecko first (free, no auth, reliable) then fall back to Yahoo Finance
        rate = _fetch_coingecko_rate(pair)
        if rate is None:
            yf_ticker = _YF_TICKER_MAP.get(pair, pair)
            rate = _fetch_yf_rate(yf_ticker)
    elif pair in _YF_PAIRS:
        yf_ticker = _YF_TICKER_MAP.get(pair, pair)
        rate = _fetch_yf_rate(yf_ticker)
    else:
        try:
            base, quote = pair.split("/")
            resp = _requests.get(
                f"{_FRANKFURTER_BASE}/latest",
                params={"from": base, "to": quote},
                timeout=5,
            )
            resp.raise_for_status()
            rate = resp.json()["rates"][quote]
        except Exception:
            rate = None
    if rate:
        with _CACHE_LOCK:
            _RATE_CACHE[cache_key] = {"rate": rate, "fetched_at": now}
    return rate


def _fetch_historical_rates(pair: str, days: int = 30) -> dict[str, float]:
    cache_key = f"hist:{pair}:{days}"
    now = datetime.now(timezone.utc).timestamp()
    with _CACHE_LOCK:
        entry = _RATE_CACHE.get(cache_key)
        if entry and now - entry["fetched_at"] < _CACHE_TTL_SECONDS:
            return entry["data"]
    if pair in _YF_PAIRS:
        yf_ticker = _YF_TICKER_MAP.get(pair, pair)
        data = _fetch_yf_historical(yf_ticker, days)
    else:
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
            data = dict(list(sorted_rates.items())[-days:])
        except Exception:
            data = {}
    if data:
        with _CACHE_LOCK:
            _RATE_CACHE[cache_key] = {"data": data, "fetched_at": now}
    return data


def _pair_pip_dec(pair: str) -> tuple[float, int]:
    """Return (pip_size, decimal_places) for the given trading pair."""
    if pair in _STOCK_TICKERS:
        return 0.01, 2
    if pair in _COMMODITY_PAIRS:
        # Gold/Silver/Oil use 2 decimal places; silver uses 3 but we round to 2
        if pair == "XAG/USD":
            return 0.001, 3
        return 0.01, 2
    if pair in _CRYPTO_PAIRS:
        # BTC uses whole-dollar pips; ETH/BNB/SOL use $0.01; XRP uses $0.0001
        if pair == "BTC/USD":
            return 1.0, 2
        if pair == "XRP/USD":
            return 0.0001, 4
        return 0.01, 2
    if "JPY" in pair:
        return 0.01, 2
    return 0.0001, 4


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
    pip, _dec = _pair_pip_dec(pair)
    if len(prices) < 2:
        return 50, 30
    daily_ranges = [abs(prices[i] - prices[i - 1]) for i in range(1, len(prices))]
    avg_range_pips = int(sum(daily_ranges) / len(daily_ranges) / pip)
    avg_range_pips = max(20, min(200, avg_range_pips))
    return int(avg_range_pips * 1.5), int(avg_range_pips * 0.75)


def _build_forex_history_live(pair: str, hist_rates: dict[str, float]) -> list[dict[str, Any]]:
    _pip, dec = _pair_pip_dec(pair)
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
    # ── Major pairs (USD) ──────────────────────────────────────────────────────
    "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/CAD", "NZD/USD",
    # ── Minor / Cross pairs (no USD) ───────────────────────────────────────────
    "EUR/GBP", "EUR/JPY", "EUR/AUD", "EUR/CAD", "EUR/CHF", "EUR/NZD",
    "GBP/JPY", "GBP/CHF", "GBP/AUD", "GBP/CAD", "GBP/NZD",
    "AUD/JPY", "AUD/CAD", "AUD/CHF", "AUD/NZD",
    "NZD/JPY", "NZD/CAD", "NZD/CHF",
    "CAD/JPY", "CHF/JPY",
    # ── Exotic pairs ───────────────────────────────────────────────────────────
    "USD/MXN", "USD/NOK", "USD/SEK", "USD/SGD", "USD/HKD",
    "USD/TRY", "USD/ZAR", "USD/CNY",
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
    # ── Majors ─────────────────────────────────────────────────────────────────
    "EUR/USD": {"direction": "BUY",  "confidence": 78.5, "entry_price": 1.0854, "take_profit": 1.0920, "stop_loss": 1.0820, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "GBP/USD": {"direction": "SELL", "confidence": 65.2, "entry_price": 1.2634, "take_profit": 1.2560, "stop_loss": 1.2680, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "USD/JPY": {"direction": "HOLD", "confidence": 52.1, "entry_price": 149.82, "take_profit": 150.50, "stop_loss": 149.10, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "USD/CHF": {"direction": "BUY",  "confidence": 70.3, "entry_price": 0.9012, "take_profit": 0.9075, "stop_loss": 0.8978, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "AUD/USD": {"direction": "SELL", "confidence": 61.8, "entry_price": 0.6305, "take_profit": 0.6250, "stop_loss": 0.6340, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "USD/CAD": {"direction": "BUY",  "confidence": 68.4, "entry_price": 1.4380, "take_profit": 1.4460, "stop_loss": 1.4330, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "NZD/USD": {"direction": "HOLD", "confidence": 53.7, "entry_price": 0.5720, "take_profit": 0.5765, "stop_loss": 0.5690, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    # ── Minors / Crosses ───────────────────────────────────────────────────────
    "EUR/GBP": {"direction": "BUY",  "confidence": 62.9, "entry_price": 0.8590, "take_profit": 0.8640, "stop_loss": 0.8558, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "EUR/JPY": {"direction": "BUY",  "confidence": 74.1, "entry_price": 162.50, "take_profit": 163.80, "stop_loss": 161.60, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "EUR/AUD": {"direction": "BUY",  "confidence": 63.2, "entry_price": 1.7210, "take_profit": 1.7310, "stop_loss": 1.7155, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "EUR/CAD": {"direction": "BUY",  "confidence": 66.7, "entry_price": 1.5610, "take_profit": 1.5720, "stop_loss": 1.5548, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "EUR/CHF": {"direction": "HOLD", "confidence": 55.4, "entry_price": 0.9368, "take_profit": 0.9410, "stop_loss": 0.9340, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "EUR/NZD": {"direction": "BUY",  "confidence": 60.8, "entry_price": 1.8950, "take_profit": 1.9060, "stop_loss": 1.8890, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "GBP/JPY": {"direction": "SELL", "confidence": 67.5, "entry_price": 189.30, "take_profit": 187.90, "stop_loss": 190.20, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "GBP/CHF": {"direction": "SELL", "confidence": 58.9, "entry_price": 1.1384, "take_profit": 1.1316, "stop_loss": 1.1430, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "GBP/AUD": {"direction": "SELL", "confidence": 60.5, "entry_price": 2.0040, "take_profit": 1.9930, "stop_loss": 2.0100, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "GBP/CAD": {"direction": "BUY",  "confidence": 64.8, "entry_price": 1.8190, "take_profit": 1.8300, "stop_loss": 1.8125, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "GBP/NZD": {"direction": "BUY",  "confidence": 59.3, "entry_price": 2.2110, "take_profit": 2.2230, "stop_loss": 2.2045, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "AUD/JPY": {"direction": "HOLD", "confidence": 51.4, "entry_price": 94.52,  "take_profit": 95.20,  "stop_loss": 93.90,  "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "AUD/CAD": {"direction": "SELL", "confidence": 57.6, "entry_price": 0.9063, "take_profit": 0.9005, "stop_loss": 0.9095, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "AUD/CHF": {"direction": "SELL", "confidence": 56.2, "entry_price": 0.5684, "take_profit": 0.5640, "stop_loss": 0.5712, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "AUD/NZD": {"direction": "HOLD", "confidence": 52.8, "entry_price": 1.1022, "take_profit": 1.1070, "stop_loss": 1.0990, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "NZD/JPY": {"direction": "SELL", "confidence": 63.1, "entry_price": 85.75,  "take_profit": 84.80,  "stop_loss": 86.35,  "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "NZD/CAD": {"direction": "HOLD", "confidence": 54.2, "entry_price": 0.8228, "take_profit": 0.8275, "stop_loss": 0.8198, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "NZD/CHF": {"direction": "SELL", "confidence": 55.9, "entry_price": 0.5153, "take_profit": 0.5115, "stop_loss": 0.5178, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "CAD/JPY": {"direction": "BUY",  "confidence": 58.3, "entry_price": 104.18, "take_profit": 105.40, "stop_loss": 103.45, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "CHF/JPY": {"direction": "HOLD", "confidence": 54.6, "entry_price": 166.42, "take_profit": 167.80, "stop_loss": 165.50, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    # ── Exotics ────────────────────────────────────────────────────────────────
    "USD/MXN": {"direction": "BUY",  "confidence": 63.5, "entry_price": 20.3500,"take_profit": 20.5800,"stop_loss": 20.2200, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "USD/NOK": {"direction": "BUY",  "confidence": 60.1, "entry_price": 10.6250,"take_profit": 10.7800,"stop_loss": 10.5400, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "USD/SEK": {"direction": "BUY",  "confidence": 61.4, "entry_price": 10.3880,"take_profit": 10.5420,"stop_loss": 10.3000, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "USD/SGD": {"direction": "HOLD", "confidence": 53.8, "entry_price": 1.3418, "take_profit": 1.3470, "stop_loss": 1.3388, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "USD/HKD": {"direction": "HOLD", "confidence": 52.3, "entry_price": 7.7826, "take_profit": 7.7870, "stop_loss": 7.7790, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "USD/TRY": {"direction": "BUY",  "confidence": 72.6, "entry_price": 38.4500,"take_profit": 39.2000,"stop_loss": 38.0500, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "USD/ZAR": {"direction": "BUY",  "confidence": 65.9, "entry_price": 18.7200,"take_profit": 19.1000,"stop_loss": 18.5000, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
    "USD/CNY": {"direction": "BUY",  "confidence": 58.7, "entry_price": 7.2368, "take_profit": 7.2800, "stop_loss": 7.2100, "generated_at": "2026-04-03T09:00:00Z", "model_version": "LightGBM v2.3", "features_used": _FEATURES_DEFAULT},
}

_FOREX_HIST_SEQUENCES: dict[str, tuple[float, float, list[tuple[str, str, int]]]] = {
    # ── Majors ─────────────────────────────────────────────────────────────────
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
    "AUD/USD": (0.6250, 0.0001, _gen_seq("AUD/USD")),
    "USD/CAD": (1.4350, 0.0001, _gen_seq("USD/CAD")),
    "NZD/USD": (0.5690, 0.0001, _gen_seq("NZD/USD")),
    # ── Minors / Crosses ───────────────────────────────────────────────────────
    "EUR/GBP": (0.8540, 0.0001, _gen_seq("EUR/GBP")),
    "EUR/JPY": (161.10, 0.01,   _gen_seq("EUR/JPY")),
    "EUR/AUD": (1.7100, 0.0001, _gen_seq("EUR/AUD")),
    "EUR/CAD": (1.5520, 0.0001, _gen_seq("EUR/CAD")),
    "EUR/CHF": (0.9340, 0.0001, _gen_seq("EUR/CHF")),
    "EUR/NZD": (1.8820, 0.0001, _gen_seq("EUR/NZD")),
    "GBP/JPY": (188.40, 0.01,   _gen_seq("GBP/JPY")),
    "GBP/CHF": (1.1340, 0.0001, _gen_seq("GBP/CHF")),
    "GBP/AUD": (1.9920, 0.0001, _gen_seq("GBP/AUD")),
    "GBP/CAD": (1.8120, 0.0001, _gen_seq("GBP/CAD")),
    "GBP/NZD": (2.2040, 0.0001, _gen_seq("GBP/NZD")),
    "AUD/JPY": (93.80,  0.01,   _gen_seq("AUD/JPY")),
    "AUD/CAD": (0.9020, 0.0001, _gen_seq("AUD/CAD")),
    "AUD/CHF": (0.5660, 0.0001, _gen_seq("AUD/CHF")),
    "AUD/NZD": (1.0980, 0.0001, _gen_seq("AUD/NZD")),
    "NZD/JPY": (85.20,  0.01,   _gen_seq("NZD/JPY")),
    "NZD/CAD": (0.8190, 0.0001, _gen_seq("NZD/CAD")),
    "NZD/CHF": (0.5130, 0.0001, _gen_seq("NZD/CHF")),
    "CAD/JPY": (104.00, 0.01,   _gen_seq("CAD/JPY")),
    "CHF/JPY": (165.80, 0.01,   _gen_seq("CHF/JPY")),
    # ── Exotics ────────────────────────────────────────────────────────────────
    "USD/MXN": (20.200, 0.0001, _gen_seq("USD/MXN")),
    "USD/NOK": (10.580, 0.0001, _gen_seq("USD/NOK")),
    "USD/SEK": (10.360, 0.0001, _gen_seq("USD/SEK")),
    "USD/SGD": (1.3390, 0.0001, _gen_seq("USD/SGD")),
    "USD/HKD": (7.7800, 0.0001, _gen_seq("USD/HKD")),
    "USD/TRY": (38.200, 0.0001, _gen_seq("USD/TRY")),
    "USD/ZAR": (18.500, 0.0001, _gen_seq("USD/ZAR")),
    "USD/CNY": (7.2200, 0.0001, _gen_seq("USD/CNY")),
}

def _make_news_items() -> list[dict[str, Any]]:
    """Return live news items. Empty until a real news feed is integrated."""
    return []

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
    pip, dec = _pair_pip_dec(pair)

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


def _classify_fvg_status(
    pair: str,
    current_price: float,
    fvg_list: list[dict[str, Any]],
    prices: list[float],
) -> list[dict[str, Any]]:
    """Classify each FVG entry as approaching / reached / passed / rejected.

    Rules
    -----
    - **passed**    : FVG is already marked *filled* (price went through it).
    - **reached**   : current price is *inside* the FVG zone (bottom ≤ price ≤ top).
    - **rejected**  : price is outside the zone but was recently inside *and* reversed;
                      detected by checking whether the last 5-bar delta moves away from
                      the zone while the zone still lies close to the current price.
    - **approaching**: price is outside the zone but within a 1 % proximity threshold.
    - All other FVGs (too far away) are excluded from the result.
    """
    PROXIMITY_PCT = 0.005  # 0.5 % of current price – only very close zones shown
    results: list[dict[str, Any]] = []
    recent_trend = (prices[-1] - prices[-5]) if len(prices) >= 5 else 0.0

    for fvg in fvg_list:
        top = fvg["top"]
        bottom = fvg["bottom"]
        filled = fvg.get("filled", False)
        fvg_type = fvg["type"]
        # dist = 0.0 means price is at/inside the zone (reached) or zone was already
        # consumed (passed).  For approaching/rejected items the value is computed
        # in the else-branch below.
        dist = 0.0

        if filled:
            status = "passed"
        elif bottom <= current_price <= top:
            status = "reached"
        else:
            if current_price < bottom:
                dist = (bottom - current_price) / (current_price or 1)
                direction_away = recent_trend < 0  # price moving down away from zone above
            else:  # current_price > top
                dist = (current_price - top) / (current_price or 1)
                direction_away = recent_trend > 0  # price moving up away from zone below

            if dist < PROXIMITY_PCT:
                # Was price recently inside the zone?  Approximate: if distance is tiny
                # and the recent move reverses away, treat it as rejected.
                if direction_away and dist < PROXIMITY_PCT * 0.4:
                    status = "rejected"
                else:
                    status = "approaching"
            else:
                continue  # too far away – skip

        results.append({
            "pair": pair,
            "fvg_type": fvg_type,
            "top": top,
            "bottom": bottom,
            "filled": filled,
            "status": status,
            "current_price": current_price,
            "dist": round(dist, 6),
            "created": fvg.get("created", ""),
            "description": fvg.get("description", ""),
        })

    return results


def _detect_sr_breakout(
    pair: str,
    current_price: float,
    prices: list[float],
    support_levels: list[float],
    resistance_levels: list[float],
) -> list[dict[str, Any]]:
    """Detect whether price has broken through a major support or resistance level.

    A breakout is confirmed when the current price is beyond the level by at
    least a small buffer (0.05 % of the level price) and the recent 5-bar
    momentum confirms the move direction.
    """
    BUFFER_PCT = 0.0005  # 0.05 %
    results: list[dict[str, Any]] = []
    recent_trend = (prices[-1] - prices[-5]) if len(prices) >= 5 else 0.0

    for level in resistance_levels:
        buffer = level * BUFFER_PCT
        if current_price > level + buffer and recent_trend > 0:
            results.append({
                "pair": pair,
                "type": "resistance_break",
                "level": level,
                "current_price": current_price,
                "description": f"Price broke above resistance {level} — bullish breakout confirmed",
            })

    for level in support_levels:
        buffer = level * BUFFER_PCT
        if current_price < level - buffer and recent_trend < 0:
            results.append({
                "pair": pair,
                "type": "support_break",
                "level": level,
                "current_price": current_price,
                "description": f"Price broke below support {level} — bearish breakdown confirmed",
            })

    return results


def _classify_sr_levels(
    pair: str,
    current_price: float,
    prices: list[float],
    support_levels: list[float],
    resistance_levels: list[float],
) -> list[dict[str, Any]]:
    """Classify each S/R level into one of three states.

    States
    ------
    - **soon_touching**: Price is approaching the level (within 0.3 % proximity)
      but has not yet reached it.
    - **touched**: Price is right at the level (within 0.05 % of it) without a
      confirmed break — potential reversal or breakout forming.
    - **broke**: Price has moved beyond the level with confirming 5-bar momentum
      — breakout confirmed.
    """
    SOON_PCT    = 0.003   # 0.3 % – approaching range
    TOUCHED_PCT = 0.0005  # 0.05 % – at-level range
    BROKE_PCT   = 0.0005  # 0.05 % – minimum buffer past level to call a break
    results: list[dict[str, Any]] = []
    recent_trend = (prices[-1] - prices[-5]) if len(prices) >= 5 else 0.0

    for level in resistance_levels:
        soon_margin    = level * SOON_PCT
        touched_margin = level * TOUCHED_PCT
        broke_buffer   = level * BROKE_PCT
        dist = abs(current_price - level) / (current_price or 1)

        if current_price > level + broke_buffer and recent_trend > 0:
            status = "broke"
            sr_type = "resistance_break"
            desc = f"Price broke above resistance {level:.5g} — bullish breakout confirmed"
        elif abs(current_price - level) <= touched_margin:
            status = "touched"
            sr_type = "resistance_touch"
            desc = f"Price is right at resistance {level:.5g} — watching for breakout or rejection"
        elif level - soon_margin < current_price < level:
            status = "soon_touching"
            sr_type = "resistance_approach"
            desc = f"Price approaching resistance {level:.5g} — potential breakout zone ahead"
        else:
            continue

        results.append({
            "pair": pair,
            "type": sr_type,
            "status": status,
            "level": level,
            "current_price": current_price,
            "description": desc,
            "dist": round(dist, 6),
        })

    for level in support_levels:
        soon_margin    = level * SOON_PCT
        touched_margin = level * TOUCHED_PCT
        broke_buffer   = level * BROKE_PCT
        dist = abs(current_price - level) / (current_price or 1)

        if current_price < level - broke_buffer and recent_trend < 0:
            status = "broke"
            sr_type = "support_break"
            desc = f"Price broke below support {level:.5g} — bearish breakdown confirmed"
        elif abs(current_price - level) <= touched_margin:
            status = "touched"
            sr_type = "support_touch"
            desc = f"Price is right at support {level:.5g} — watching for bounce or breakdown"
        elif level < current_price < level + soon_margin:
            status = "soon_touching"
            sr_type = "support_approach"
            desc = f"Price approaching support {level:.5g} — potential bounce zone ahead"
        else:
            continue

        results.append({
            "pair": pair,
            "type": sr_type,
            "status": status,
            "level": level,
            "current_price": current_price,
            "description": desc,
            "dist": round(dist, 6),
        })

    return results


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
    https_only=_SESSION_HTTPS_ONLY,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins if isinstance(_cors_origins, list) else ["*"],
    allow_credentials=_cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(_SecurityHeadersMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)

class _CachedStaticFiles(StaticFiles):
    """StaticFiles subclass that adds long-lived cache headers to all static files."""
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response

app.mount("/static", _CachedStaticFiles(directory=_STATIC_DIR), name="static")

# Mount the React build output (Vite builds to static/dist)
_REACT_DIST_DIR = _STATIC_DIR / "dist"
_REACT_INDEX = _REACT_DIST_DIR / "index.html"

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


# ─── Page routes – React SPA ──────────────────────────────────────────────────
# The React SPA (built to static/dist/) handles all client-side routing.
# Track visits for analytics and fall back to the legacy Jinja2 templates when
# the React build is not present (e.g. development without a prior build step).

def _serve_react_or_template(request: Request, template: str, **kwargs):
    """Serve the React SPA index.html if the build exists, else a legacy template."""
    _record_visit(_get_client_ip(request))
    if _REACT_INDEX.exists():
        return FileResponse(str(_REACT_INDEX), media_type="text/html")
    return templates.TemplateResponse(request, template, _ctx(request, **kwargs))


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Landing page."""
    if _REACT_INDEX.exists():
        _record_visit(_get_client_ip(request))
        return FileResponse(str(_REACT_INDEX), media_type="text/html")
    # Legacy fallback
    _record_visit(_get_client_ip(request))
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
    _record_visit(_get_client_ip(request))
    if _REACT_INDEX.exists():
        return FileResponse(str(_REACT_INDEX), media_type="text/html")
    try:
        return templates.TemplateResponse(request, "forex.html", _ctx(request))
    except Exception:
        return JSONResponse({"error": "An internal error occurred."}, status_code=500)


@app.get("/methodology", response_class=HTMLResponse)
async def methodology_page(request: Request):
    _record_visit(_get_client_ip(request))
    if _REACT_INDEX.exists():
        return FileResponse(str(_REACT_INDEX), media_type="text/html")
    return RedirectResponse(url="/", status_code=status.HTTP_301_MOVED_PERMANENTLY)


@app.get("/disclaimer", response_class=HTMLResponse)
async def disclaimer_page(request: Request):
    _record_visit(_get_client_ip(request))
    if _REACT_INDEX.exists():
        return FileResponse(str(_REACT_INDEX), media_type="text/html")
    return templates.TemplateResponse(request, "disclaimer.html", _ctx(request))


# ─── Auth routes ──────────────────────────────────────────────────────────────

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    if _REACT_INDEX.exists():
        return FileResponse(str(_REACT_INDEX), media_type="text/html")
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
    result = _find_user_by_identifier(username)
    if result:
        matched_username, user = result
        if _hash_password(password, user["salt"]) == user["password_hash"]:
            if user.get("role") != "admin":
                return templates.TemplateResponse(
                    request, "login.html",
                    _ctx(request, error="Login is restricted to administrators only."),
                    status_code=status.HTTP_401_UNAUTHORIZED,
                )
            request.session["username"] = matched_username
            return RedirectResponse(url="/const", status_code=status.HTTP_302_FOUND)
    return templates.TemplateResponse(
        request, "login.html",
        _ctx(request, error="Invalid username or password."),
        status_code=status.HTTP_401_UNAUTHORIZED,
    )


@app.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)


@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    return RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)


@app.post("/register", response_class=HTMLResponse)
async def register_submit(request: Request):
    return RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)


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


# ─── Mobile / Flutter JSON auth API ──────────────────────────────────────────
# These endpoints accept and return JSON so the Flutter mobile app can
# authenticate against the same backend user store without CSRF tokens or
# session cookies.  Rate-limiting is applied the same way as the HTML routes.

@app.post("/api/auth/login")
async def api_auth_login(request: Request):
    """Authenticate a user and return their profile on success.

    Body: ``{"username": "...", "password": "..."}``
    """
    try:
        data: dict[str, Any] = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body."}, status_code=400)

    ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(ip, max_requests=10, window=60):
        return JSONResponse(
            {"error": "Too many login attempts. Please wait a minute."},
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))

    if not username or not password:
        return JSONResponse(
            {"error": "Username and password are required."},
            status_code=400,
        )

    result = _find_user_by_identifier(username)
    if result:
        matched_username, user = result
        if _hash_password(password, user["salt"]) == user["password_hash"]:
            # Set session cookie so the React SPA stays authenticated
            request.session["username"] = matched_username
            return JSONResponse({
                "success": True,
                "username": matched_username,
                "role": user.get("role", "user"),
                "subscription_status": user.get("subscription_status", "inactive"),
            })

    return JSONResponse(
        {"error": "Invalid username or password."},
        status_code=status.HTTP_401_UNAUTHORIZED,
    )


@app.post("/api/auth/register")
async def api_auth_register(request: Request):
    """Register a new user account.

    Body: ``{"username": "...", "email": "...", "password": "...", "confirm_password": "..."}``
    """
    try:
        data: dict[str, Any] = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body."}, status_code=400)

    ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(ip, max_requests=5, window=60):
        return JSONResponse(
            {"error": "Too many registration attempts. Please wait."},
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    username = str(data.get("username", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    confirm_password = str(data.get("confirm_password", ""))

    if len(username) < 3 or len(username) > 32:
        return JSONResponse(
            {"error": "Username must be between 3 and 32 characters."},
            status_code=400,
        )
    if not all(c.isalnum() or c in "_-" for c in username):
        return JSONResponse(
            {"error": "Username may only contain letters, numbers, hyphens and underscores."},
            status_code=400,
        )
    if "@" not in email or "." not in email.split("@")[-1]:
        return JSONResponse(
            {"error": "Please provide a valid email address."},
            status_code=400,
        )
    if len(password) < 8:
        return JSONResponse(
            {"error": "Password must be at least 8 characters."},
            status_code=400,
        )
    if password != confirm_password:
        return JSONResponse({"error": "Passwords do not match."}, status_code=400)

    with _USERS_LOCK:
        if username in _USERS:
            return JSONResponse(
                {"error": "Username is already taken."},
                status_code=409,
            )
        if any(u["email"] == email for u in _USERS.values()):
            return JSONResponse(
                {"error": "An account with this email already exists."},
                status_code=409,
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

    return JSONResponse({"success": True, "message": "Account created! You can now log in."})


@app.post("/api/auth/recovery/request")
async def api_auth_recovery_request(request: Request):
    """Generate a recovery token for the given username.

    Body: ``{"username": "..."}``

    A token is always returned (even for non-existent users) to prevent
    user enumeration.
    """
    try:
        data: dict[str, Any] = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body."}, status_code=400)

    ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(ip, max_requests=5, window=300):
        return JSONResponse(
            {"error": "Too many recovery attempts. Please wait 5 minutes."},
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    username = str(data.get("username", "")).strip()
    if not username:
        return JSONResponse({"error": "Username is required."}, status_code=400)

    with _USERS_LOCK:
        user = _USERS.get(username)

    # Always generate a token to prevent user enumeration.
    # For non-existent users, use a random nonce so the token cannot be
    # replayed (a known username like "__nonexistent__" would be predictable).
    token = _generate_recovery_token(username if user else secrets.token_hex(16))
    if user:
        with _USERS_LOCK:
            _USERS[username]["recovery_token"] = token

    return JSONResponse({
        "success": True,
        "token": token,
        "message": "Recovery code generated. Use it within 30 minutes to reset your password.",
    })


@app.post("/api/auth/recovery/reset")
async def api_auth_recovery_reset(request: Request):
    """Reset password using a previously generated recovery token.

    Body: ``{"token": "...", "new_password": "...", "confirm_password": "..."}``
    """
    try:
        data: dict[str, Any] = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body."}, status_code=400)

    token = str(data.get("token", "")).strip()
    new_password = str(data.get("new_password", ""))
    confirm_password = str(data.get("confirm_password", ""))

    if not token:
        return JSONResponse({"error": "Recovery token is required."}, status_code=400)
    if len(new_password) < 8:
        return JSONResponse(
            {"error": "Password must be at least 8 characters."},
            status_code=400,
        )
    if new_password != confirm_password:
        return JSONResponse({"error": "Passwords do not match."}, status_code=400)

    username = _verify_recovery_token(token)
    if not username:
        return JSONResponse(
            {"error": "Invalid or expired recovery code."},
            status_code=400,
        )

    with _USERS_LOCK:
        user = _USERS.get(username)
        if not user:
            return JSONResponse({"error": "Account not found."}, status_code=404)
        if user.get("recovery_token") != token:
            return JSONResponse(
                {"error": "Recovery code already used or invalid."},
                status_code=400,
            )
        new_salt = _make_salt()
        _USERS[username]["password_hash"] = _hash_password(new_password, new_salt)
        _USERS[username]["salt"] = new_salt
        _USERS[username]["recovery_token"] = None

    return JSONResponse({"success": True, "message": "Password reset successfully! You can now log in."})


# ─── Auth: session status & logout (React SPA) ────────────────────────────────

@app.get("/api/auth/me")
async def api_auth_me(request: Request):
    """Return the current authenticated user, or 401 if not logged in."""
    username = _get_current_user(request)
    if not username:
        return JSONResponse({"error": "Not authenticated."}, status_code=401)
    with _USERS_LOCK:
        user = dict(_USERS.get(username, {}))
    return JSONResponse({
        "username": username,
        "email": user.get("email", ""),
        "role": user.get("role", "user"),
        "subscription_status": user.get("subscription_status", "inactive"),
        "plan": user.get("plan"),
        "subscription_end": user.get("subscription_end"),
    })


@app.post("/api/auth/logout")
async def api_auth_logout(request: Request):
    """Clear the session (React SPA logout)."""
    request.session.clear()
    return JSONResponse({"success": True})


# ─── Ads API (public: list active; admin: full CRUD) ──────────────────────────

ALLOWED_AD_PLACEMENTS = {"banner-top", "banner-bottom", "sidebar", "inline"}
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"}
MAX_AD_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB


@app.get("/api/ads/active")
async def ads_active():
    """Return all active ads (public endpoint for the frontend)."""
    with _ADS_LOCK:
        active = [dict(ad) for ad in _ADS.values() if ad.get("active")]
    return JSONResponse(active)


@app.get("/api/admin/ads")
async def admin_list_ads(request: Request):
    """Admin: list all ads."""
    if not _is_admin(request):
        return JSONResponse({"error": "Forbidden."}, status_code=403)
    with _ADS_LOCK:
        ads = [dict(ad) for ad in _ADS.values()]
    return JSONResponse(ads)


@app.post("/api/admin/ads")
async def admin_create_ad(
    request: Request,
    image: UploadFile = File(...),
    link_url: str = Form(...),
    title: str = Form(""),
    placement: str = Form("inline"),
    active: str = Form("true"),
):
    """Admin: upload a new ad (image + metadata)."""
    if not _is_admin(request):
        return JSONResponse({"error": "Forbidden."}, status_code=403)

    # Validate placement
    placement = placement.strip().lower()
    if placement not in ALLOWED_AD_PLACEMENTS:
        return JSONResponse({"error": f"Invalid placement. Allowed: {', '.join(ALLOWED_AD_PLACEMENTS)}"}, status_code=400)

    # Validate link URL
    link_url = link_url.strip()
    if not link_url.startswith(("http://", "https://")):
        return JSONResponse({"error": "link_url must start with http:// or https://"}, status_code=400)

    # Validate image type
    content_type = image.content_type or ""
    if content_type not in ALLOWED_IMAGE_TYPES:
        return JSONResponse({"error": "Only JPEG, PNG, GIF, WebP, or SVG images are allowed."}, status_code=400)

    # Read and size-check image
    image_data = await image.read()
    if len(image_data) > MAX_AD_IMAGE_SIZE:
        return JSONResponse({"error": "Image must be smaller than 5 MB."}, status_code=400)

    # Determine file extension from validated content_type (never trust client filename)
    _CONTENT_TYPE_TO_EXT: dict[str, str] = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/svg+xml": ".svg",
    }
    ext = _CONTENT_TYPE_TO_EXT.get(content_type, ".jpg")

    # Save image
    _ensure_ads_dir()
    ad_id = str(uuid.uuid4())
    filename = f"{ad_id}{ext}"
    dest = _ADS_UPLOADS_DIR / filename
    dest.write_bytes(image_data)

    ad: dict[str, Any] = {
        "id": ad_id,
        "title": title.strip()[:200],
        "image_url": f"/static/uploads/ads/{filename}",
        "link_url": link_url,
        "placement": placement,
        "active": active.lower() not in ("false", "0", "no"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    with _ADS_LOCK:
        _ADS[ad_id] = ad

    return JSONResponse(dict(ad), status_code=201)


@app.patch("/api/admin/ads/{ad_id}")
async def admin_toggle_ad(request: Request, ad_id: str):
    """Admin: toggle an ad's active status."""
    if not _is_admin(request):
        return JSONResponse({"error": "Forbidden."}, status_code=403)
    with _ADS_LOCK:
        if ad_id not in _ADS:
            return JSONResponse({"error": "Ad not found."}, status_code=404)
        _ADS[ad_id]["active"] = not _ADS[ad_id]["active"]
        updated = dict(_ADS[ad_id])
    return JSONResponse(updated)


@app.delete("/api/admin/ads/{ad_id}")
async def admin_delete_ad(request: Request, ad_id: str):
    """Admin: permanently delete an ad and its uploaded image."""
    if not _is_admin(request):
        return JSONResponse({"error": "Forbidden."}, status_code=403)
    with _ADS_LOCK:
        ad = _ADS.pop(ad_id, None)
    if not ad:
        return JSONResponse({"error": "Ad not found."}, status_code=404)
    # Delete the image file (safe: only filenames stored under uploads/ads/)
    image_url: str = ad.get("image_url", "")
    if image_url.startswith("/static/uploads/ads/"):
        filename = Path(image_url).name
        # Prevent path traversal: only allow simple filenames
        if filename and "/" not in filename and "\\" not in filename:
            img_path = _ADS_UPLOADS_DIR / filename
            try:
                img_path.unlink(missing_ok=True)
            except OSError:
                pass
    return JSONResponse({"success": True})


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

    # Visitor tracking stats
    today_str = date.today().isoformat()
    with _VISITOR_LOG_LOCK:
        total_visitors = len(_VISITOR_LOG)
        unique_countries_set = {v["country"] for v in _VISITOR_LOG.values() if v.get("country") and v["country"] != "Local"}
        unique_countries = len(unique_countries_set)
        visitors_today = sum(
            1 for v in _VISITOR_LOG.values()
            if v.get("last_seen", "")[:10] == today_str or v.get("first_date", "") == today_str
        )
        # Top 10 countries by visitor count
        country_counts: dict[str, int] = {}
        for v in _VISITOR_LOG.values():
            c = v.get("country", "")
            if c and c != "Local":
                country_counts[c] = country_counts.get(c, 0) + 1
        top_countries = sorted(country_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        # Recent visitors (last 20 unique IPs by last_seen)
        recent_visitors = sorted(
            _VISITOR_LOG.items(),
            key=lambda x: x[1].get("last_seen", ""),
            reverse=True,
        )[:20]
    with _TOTAL_PAGE_VIEWS_LOCK:
        total_page_views = _TOTAL_PAGE_VIEWS

    visitor_stats = {
        "total_visitors": total_visitors,
        "unique_countries": unique_countries,
        "visitors_today": visitors_today,
        "total_page_views": total_page_views,
        "top_countries": [{"country": c, "count": n} for c, n in top_countries],
        "recent_visitors": [
            {
                "ip": _mask_ip(ip),
                "country": data.get("country", "Unknown"),
                "first_seen": data.get("first_seen", "")[:10],
                "last_seen": data.get("last_seen", "")[:10],
                "page_views": data.get("page_views", 0),
            }
            for ip, data in recent_visitors
        ],
    }

    return templates.TemplateResponse(
        request, "admin.html",
        _ctx(
            request,
            users=users_list,
            subscribers=list(_FOREX_SUBSCRIBERS),
            plans=_PLANS,
            cache_info=sorted(cache_info, key=lambda x: x["key"]),
            total_pairs=len(_SUPPORTED_PAIRS),
            visitor_stats=visitor_stats,
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
    if confirmation.get("status") == "approved":
        return JSONResponse({"error": "Payment already approved"}, status_code=400)
    email = confirmation.get("email", "")
    plan_id = confirmation.get("plan", "").lower()
    # Map legacy plan names to new ids (quarterly/annual → yearly)
    _plan_alias = {"quarterly": "yearly", "annual": "yearly"}
    plan_id = _plan_alias.get(plan_id, plan_id) if plan_id in _plan_alias else plan_id
    # Validate plan_id; fall back to monthly for unknown values
    if not any(p["id"] == plan_id for p in _PLANS):
        plan_id = "monthly"
    plan = next(p for p in _PLANS if p["id"] == plan_id)
    # Find the user by email
    with _USERS_LOCK:
        username = next((k for k, v in _USERS.items() if v.get("email") == email), None)
    if username:
        _activate_subscription(username, plan_id)
    # Record approval timestamp
    _PAYMENT_CONFIRMATIONS[idx]["status"] = "approved"
    _PAYMENT_CONFIRMATIONS[idx]["approved_at"] = datetime.now(timezone.utc).isoformat()
    # Send purchase confirmation email
    today_str = date.today().isoformat()
    end_str = (date.today() + timedelta(days=plan["duration_days"])).isoformat()
    _send_email(
        email,
        "PiiTrade – Subscription Activated",
        _email_purchase_html(plan["label"], today_str, end_str),
    )
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
        if pair in _STOCK_TICKERS:
            signal["data_source"] = "Yahoo Finance"
        elif pair in _COMMODITY_PAIRS:
            signal["data_source"] = "Yahoo Finance (Futures)"
        elif pair in _CRYPTO_PAIRS:
            signal["data_source"] = "CoinGecko (Live)"
        else:
            signal["data_source"] = "Frankfurter API (ECB)"
        signal["is_live"] = True
        if hist_rates:
            prices = list(hist_rates.values())
            direction, confidence = _compute_signal_from_prices(prices)
            signal["direction"] = direction
            signal["confidence"] = confidence
            pip, dec = _pair_pip_dec(pair)
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
    _MAJOR_CCYS = {"EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD", "USD"}
    major: list[str] = []
    minor: list[str] = []
    exotic: list[str] = []
    for p in _SUPPORTED_PAIRS:
        parts = p.split("/")
        base, quote = parts[0], parts[1]
        if "USD" in (base, quote):
            other = base if quote == "USD" else quote
            if other in _MAJOR_CCYS - {"USD"}:
                major.append(p)
            else:
                exotic.append(p)
        else:
            minor.append(p)
    # Check if Frankfurter/ECB API is available
    ecb_live = _fetch_live_rate("EUR/USD") is not None
    return JSONResponse({
        "major": major,
        "minor": minor,
        "exotic": exotic,
        "all": list(_SUPPORTED_PAIRS),
        "ecb_live": ecb_live,
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
    # Subscriber is stored before attempting the notification email so that
    # a transient SMTP failure never prevents the subscription from being recorded.
    # Forward new subscriber info to support (backend only – address not exposed to frontend).
    # _send_email() silently swallows exceptions and returns False on failure.
    _send_email(
        _SUPPORT_ALERT_EMAIL,
        "PiiTrade – New Signal Alert Subscriber",
        f"<html><body style='font-family:sans-serif'>"
        f"<p><strong>New subscriber:</strong> {email}</p>"
        f"<p><strong>Pairs:</strong> {', '.join(pairs)}</p>"
        f"</body></html>",
    )
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


# ─── FVG Scanner API ──────────────────────────────────────────────────────────

@app.get("/api/forex/fvg-scanner")
async def forex_fvg_scanner():
    """Return FVG status for all supported pairs, grouped by status category.

    Also returns ``pair_fvgs`` – a mapping of pair → all FVGs (both filled and
    unfilled) so the frontend can display a full per-pair FVG dropdown.
    """
    grouped: dict[str, list[dict[str, Any]]] = {
        "approaching": [],
        "reached": [],
        "passed": [],
        "rejected": [],
    }
    pair_fvgs: dict[str, list[dict[str, Any]]] = {}
    # Track which pairs already have an entry in each bucket so only one entry
    # per pair per status category is shown (the closest / most relevant one).
    seen_in_bucket: dict[str, set[str]] = {k: set() for k in grouped}
    for pair in _SUPPORTED_PAIRS:
        live_rate = _fetch_live_rate(pair)
        # Skip YF-sourced pairs (stocks, commodities, crypto) when live data is
        # unavailable — static fallback prices would not match market conditions.
        if pair in _YF_PAIRS and live_rate is None:
            continue
        prices = _get_prices_for_pair(pair, 30)
        current_price = live_rate if live_rate is not None else (prices[-1] if prices else 0.0)
        ta = _build_technical_analysis(pair, current_price)
        entries = _classify_fvg_status(pair, current_price, ta["fvg"], prices)
        for entry in entries:
            bucket = entry.get("status", "")
            if bucket in grouped and pair not in seen_in_bucket[bucket]:
                entry["direction"] = _FOREX_SIGNALS[pair]["direction"]
                grouped[bucket].append(entry)
                seen_in_bucket[bucket].add(pair)
        # Annotate each raw FVG with live current_price and zone midpoint so
        # the frontend can show distinct prices per FVG in the dropdown.
        _pip, dec = _pair_pip_dec(pair)
        pair_fvgs[pair] = [
            {
                "type": fvg["type"],
                "top": round(fvg["top"], dec),
                "bottom": round(fvg["bottom"], dec),
                "mid": round((fvg["top"] + fvg["bottom"]) / 2, dec),
                "filled": fvg.get("filled", False),
                "created": fvg.get("created", ""),
                "description": fvg.get("description", ""),
                "current_price": round(current_price, dec),
            }
            for fvg in ta["fvg"]
        ]
    # Sort approaching list so the closest zone (smallest dist) appears first
    grouped["approaching"].sort(key=lambda x: x.get("dist", 1.0))
    return JSONResponse({
        "grouped": grouped,
        "pair_fvgs": pair_fvgs,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    })


# ─── S/R Breakout Scanner API ─────────────────────────────────────────────────

@app.get("/api/forex/sr-breakouts")
async def forex_sr_breakouts():
    """Return all pairs classified by their relationship to major S/R levels.

    Returns three groups:
    - **soon_touching**: price is approaching a level (within 0.3 %).
    - **touched**: price is right at the level (within 0.05 %).
    - **broke**: price has broken through with momentum confirmation.
    """
    sr_groups: dict[str, list[dict[str, Any]]] = {
        "soon_touching": [],
        "touched": [],
        "broke": [],
    }
    # Track which pairs already have an entry in each status group so only the
    # closest level per pair per group is displayed (avoids duplicate pair rows).
    seen_in_sr: dict[str, set[str]] = {k: set() for k in sr_groups}
    for pair in _SUPPORTED_PAIRS:
        live_rate = _fetch_live_rate(pair)
        # Skip YF-sourced pairs (stocks, commodities, crypto) when live data is
        # unavailable — static fallback prices would not match market conditions.
        if pair in _YF_PAIRS and live_rate is None:
            continue
        prices = _get_prices_for_pair(pair, 30)
        current_price = live_rate if live_rate is not None else (prices[-1] if prices else 0.0)
        ta = _build_technical_analysis(pair, current_price)
        sr = ta["support_resistance"]
        items = _classify_sr_levels(
            pair, current_price, prices,
            sr["support"], sr["resistance"],
        )
        # Sort by proximity so the closest level is considered first for each pair
        items.sort(key=lambda x: x.get("dist", 1.0))
        for item in items:
            item["direction"] = _FOREX_SIGNALS[pair]["direction"]
            item["confidence"] = _FOREX_SIGNALS[pair]["confidence"]
            status = item.get("status", "")
            if status in sr_groups and pair not in seen_in_sr[status]:
                sr_groups[status].append(item)
                seen_in_sr[status].add(pair)
    # Sort each group by proximity – closest to level first
    for group_items in sr_groups.values():
        group_items.sort(key=lambda x: x.get("dist", 1.0))
    return JSONResponse({
        "sr_groups": sr_groups,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    })


# ─── Price Action Pattern Scanner API ────────────────────────────────────────

@app.get("/api/forex/pattern-scanner")
async def forex_pattern_scanner():
    """Detect market structure formations across all supported pairs.

    Analyses each pair's technical data (BOS, CHoCH, FVG status, S/R proximity,
    and signal strength) and maps them to named market structure formations.

    Each pattern entry includes:
    - ``pair``        : trading pair symbol
    - ``type``        : machine-readable formation type
    - ``label``       : human-readable formation name
    - ``impact``      : ``'high'`` | ``'medium'`` | ``'low'``
    - ``direction``   : ``'BUY'`` | ``'SELL'`` | ``'HOLD'``
    - ``description`` : detailed explanation
    """
    # Collect all raw pattern candidates then deduplicate to one per pair.
    _all_candidates: list[dict[str, Any]] = []

    for pair in _SUPPORTED_PAIRS:
        live_rate = _fetch_live_rate(pair)
        # Skip YF-sourced pairs (stocks, commodities, crypto) when live data is
        # unavailable — static fallback prices would not match market conditions.
        if pair in _YF_PAIRS and live_rate is None:
            continue
        prices = _get_prices_for_pair(pair, 30)
        current_price = live_rate if live_rate is not None else (prices[-1] if prices else 0.0)
        signal = _FOREX_SIGNALS[pair]
        direction = signal["direction"]
        confidence = signal.get("confidence", 0.5)
        ta = _build_technical_analysis(pair, current_price)

        # ── Change of Character (CHoCH) — trend reversal formation ────────────
        for choch in ta.get("choch", []):
            choch_dir = "BUY" if choch["type"] == "bullish" else "SELL"
            _all_candidates.append({
                "pair": pair,
                "type": "choch",
                "label": "Change of Character (CHoCH)",
                "impact": "high",
                "direction": choch_dir,
                "description": (
                    f"{pair}: {choch['description']} at level {choch['level']:.5g}. "
                    "CHoCH signals a potential trend reversal — one of the strongest "
                    "market structure formations."
                ),
            })

        # ── Break of Structure (BOS) — momentum continuation ──────────────────
        for bos in ta.get("bos", []):
            bos_dir = "BUY" if bos["type"] == "bullish" else "SELL"
            _all_candidates.append({
                "pair": pair,
                "type": "bos",
                "label": "Break of Structure (BOS)",
                "impact": "high",
                "direction": bos_dir,
                "description": (
                    f"{pair}: {bos['description']} at level {bos['level']:.5g}. "
                    "A BOS confirms market structure continuation and is used to "
                    "identify the dominant trend direction."
                ),
            })

        # ── FVG-based formations ───────────────────────────────────────────────
        fvg_entries = _classify_fvg_status(pair, current_price, ta["fvg"], prices)
        for fvg in fvg_entries:
            status = fvg.get("status", "")
            fvg_dir = direction  # inherit pair signal direction

            if status == "rejected":
                _all_candidates.append({
                    "pair": pair,
                    "type": "fvg_rejection",
                    "label": "FVG Order Block Rejection",
                    "impact": "high",
                    "direction": fvg_dir,
                    "description": (
                        f"{pair}: Price was rejected at the "
                        f"{'bullish' if fvg['fvg_type'] == 'bullish' else 'bearish'} FVG zone "
                        f"({fvg['bottom']:.5g} – {fvg['top']:.5g}). "
                        "Order block rejections often signal strong reversals and high-probability "
                        "entry points."
                    ),
                })
            elif status == "reached":
                _all_candidates.append({
                    "pair": pair,
                    "type": "fvg_inside",
                    "label": "Price Inside FVG Zone",
                    "impact": "medium",
                    "direction": fvg_dir,
                    "description": (
                        f"{pair}: Price is trading inside the "
                        f"{'bullish' if fvg['fvg_type'] == 'bullish' else 'bearish'} FVG zone "
                        f"({fvg['bottom']:.5g} – {fvg['top']:.5g}). "
                        "Price often fills the gap before continuing in the dominant direction."
                    ),
                })
            elif status == "approaching":
                _all_candidates.append({
                    "pair": pair,
                    "type": "fvg_approach",
                    "label": "Approaching FVG Zone",
                    "impact": "low",
                    "direction": fvg_dir,
                    "description": (
                        f"{pair}: Price is approaching the "
                        f"{'bullish' if fvg['fvg_type'] == 'bullish' else 'bearish'} FVG zone "
                        f"({fvg['bottom']:.5g} – {fvg['top']:.5g}). "
                        "Watch for a reaction as price enters the imbalance area."
                    ),
                })

        # ── S/R-based formations ───────────────────────────────────────────────
        sr = ta["support_resistance"]
        sr_items = _classify_sr_levels(
            pair, current_price, prices,
            sr["support"], sr["resistance"],
        )
        for item in sr_items:
            sr_status = item.get("status", "")
            is_res = item["type"].startswith("resistance")
            sr_dir = "BUY" if is_res else "SELL"

            if sr_status == "broke":
                _all_candidates.append({
                    "pair": pair,
                    "type": "sr_broke",
                    "label": "S/R Breakout Formation",
                    "impact": "high",
                    "direction": sr_dir,
                    "description": (
                        f"{pair}: {item['description']} "
                        "Confirmed breakouts beyond key levels often precede "
                        "significant directional moves."
                    ),
                })
            elif sr_status == "touched":
                _all_candidates.append({
                    "pair": pair,
                    "type": "sr_touched",
                    "label": "Key Level Touch",
                    "impact": "medium",
                    "direction": direction,
                    "description": (
                        f"{pair}: {item['description']} "
                        "Price testing a key level can produce a bounce or breakout — "
                        "watch for volume and momentum confirmation."
                    ),
                })
            elif sr_status == "soon_touching":
                _all_candidates.append({
                    "pair": pair,
                    "type": "sr_approaching",
                    "label": "Approaching Key Level",
                    "impact": "low",
                    "direction": direction,
                    "description": (
                        f"{pair}: {item['description']} "
                        "Prepare for a potential reaction as price nears the level."
                    ),
                })

        # ── Strong directional signal (high-confidence) ────────────────────────
        if confidence >= 0.80 and direction in ("BUY", "SELL"):
            _all_candidates.append({
                "pair": pair,
                "type": "strong_signal",
                "label": "Strong Directional Signal",
                "impact": "high",
                "direction": direction,
                "description": (
                    f"{pair}: AI model returned a {direction} signal with "
                    f"{confidence * 100:.1f}% confidence — above the high-conviction "
                    "threshold. Multiple indicators aligned in the same direction."
                ),
            })

    # Deduplicate: keep only the highest-impact pattern per pair.  Sort candidates
    # so the highest-impact entry per pair is always encountered first, then iterate
    # and keep only the first occurrence of each pair.
    IMPACT_ORDER = {"high": 0, "medium": 1, "low": 2}
    _all_candidates.sort(key=lambda p: (IMPACT_ORDER.get(p["impact"], 3), p["pair"]))
    seen_pairs: set[str] = set()
    patterns: list[dict[str, Any]] = []
    for candidate in _all_candidates:
        if candidate["pair"] not in seen_pairs:
            patterns.append(candidate)
            seen_pairs.add(candidate["pair"])

    return JSONResponse({
        "patterns": patterns,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    })


# ─── Subscription / payment page ─────────────────────────────────────────────

# Subscription plans (kept for admin manual management)
_PLANS = [
    {"id": "weekly",  "label": "Weekly",  "price_usd": 3,  "duration_days": 7},
    {"id": "monthly", "label": "Monthly", "price_usd": 14, "duration_days": 30},
    {"id": "yearly",  "label": "Yearly",  "price_usd": 99, "duration_days": 365},
]


@app.get("/subscribe", response_class=HTMLResponse)
async def subscribe_page(request: Request):
    """Redirect legacy subscribe URL to the forex dashboard (service is now free)."""
    return RedirectResponse(url="/forex", status_code=status.HTTP_302_FOUND)


@app.get("/subscribe/success", response_class=HTMLResponse)
async def subscribe_success(request: Request, session_id: str = ""):
    return RedirectResponse(url="/forex", status_code=status.HTTP_302_FOUND)


# ─── Profile page ─────────────────────────────────────────────────────────────

@app.get("/profile", response_class=HTMLResponse)
async def profile_page(request: Request):
    username = _get_current_user(request)
    if not username:
        return RedirectResponse(url="/login?next=/profile", status_code=status.HTTP_302_FOUND)
    with _USERS_LOCK:
        user = dict(_USERS.get(username, {}))

    plan_label = next((p["label"] for p in _PLANS if p["id"] == user.get("plan")), None)
    sub_active = _is_subscription_active(username)

@app.get("/profile", response_class=HTMLResponse)
async def profile_page(request: Request):
    if _REACT_INDEX.exists():
        _record_visit(_get_client_ip(request))
        return FileResponse(str(_REACT_INDEX), media_type="text/html")
    username = _get_current_user(request)
    if not username:
        return RedirectResponse(url="/login?next=/profile", status_code=status.HTTP_302_FOUND)
    with _USERS_LOCK:
        user = dict(_USERS.get(username, {}))

    plan_label = next((p["label"] for p in _PLANS if p["id"] == user.get("plan")), None)
    sub_active = _is_subscription_active(username)

    return templates.TemplateResponse(
        request, "profile.html",
        _ctx(
            request,
            profile_user=user,
            profile_username=username,
            invoices=[],
            local_payments=[],
            portal_url=None,
            plan_label=plan_label,
            sub_active=sub_active,
            stripe_available=False,
        ),
    )


@app.get("/admin", response_class=HTMLResponse)
async def admin_react_page(request: Request):
    """React admin dashboard route."""
    if _REACT_INDEX.exists():
        return FileResponse(str(_REACT_INDEX), media_type="text/html")
    return RedirectResponse(url="/const", status_code=status.HTTP_302_FOUND)


# ─── React SPA catch-all ─────────────────────────────────────────────────────
# Must be the LAST route. Any path not matched by an API endpoint above
# is handled by the React SPA (client-side routing).

@app.get("/{full_path:path}", response_class=HTMLResponse)
async def spa_catch_all(request: Request, full_path: str):
    """Serve the React SPA index.html for all unmatched GET routes.

    Falls back gracefully when the React build is not present.
    """
    # Skip paths that look like static asset requests to avoid hiding 404s
    if full_path.startswith(("static/", "api/", "_next/")):
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
    if _REACT_INDEX.exists():
        return FileResponse(str(_REACT_INDEX), media_type="text/html")
    return RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    debug = os.environ.get("DEBUG", "0") == "1"
    uvicorn.run("web.app:app", host="0.0.0.0", port=port, reload=debug)
