"""
PiiTrade – News router
Fetches and caches live forex news from multiple RSS feeds.
"""

import re as _re
import time
import logging
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from html import unescape
from typing import Any

import requests as _requests
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()
logger = logging.getLogger("news")

# ─── News feed ─────────────────────────────────────────────────────────────────
_NEWS_FEEDS: dict[str, list[str]] = {
    "ForexLive": [
        "https://www.forexlive.com/feed/",
    ],
    "FXStreet": [
        "https://www.fxstreet.com/rss/news",
    ],
    "Investing": [
        "https://www.investing.com/rss/news_25.rss",
    ],
    # DailyFX occasionally blocks certain user-agents on /feeds/all.
    "DailyFX": [
        "https://www.dailyfx.com/feeds/market-news",
        "https://www.dailyfx.com/feeds/all",
    ],
    # Legacy Reuters RSS host often fails DNS in some environments.
    "Reuters": [
        "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best",
        "https://feeds.reuters.com/reuters/businessNews",
    ],
    # Old MarketWatch forex endpoint was removed (404); use active RSS feeds.
    "MarketWatch": [
        "https://feeds.content.dowjones.io/public/rss/mw_topstories",
        "https://feeds.content.dowjones.io/public/rss/mw_marketpulse",
    ],
    "Yahoo Finance": [
        "https://finance.yahoo.com/rss/topfinstories",
    ],
}

_news_cache: dict[str, Any] = {"items": [], "ts": 0.0}
_NEWS_CACHE_TTL = 300  # 5 minutes
_NEWS_DEDUP_PREFIX_LEN = 60
_SOURCE_FAILURE_LOG_TS: dict[str, float] = {}
_SOURCE_FAILURE_LOG_COOLDOWN = 900  # 15 minutes


def _infer_sentiment(text: str) -> str:
    """Very light heuristic sentiment for UI chips."""
    t = text.lower()
    positive_tokens = (
        "rally", "gains", "up", "bull", "surge", "beats", "optimism", "strong", "rise",
    )
    negative_tokens = (
        "falls", "down", "bear", "drop", "slump", "misses", "weak", "risk-off", "selloff",
    )
    if any(tok in t for tok in positive_tokens):
        return "positive"
    if any(tok in t for tok in negative_tokens):
        return "negative"
    return "neutral"


def _infer_category(source: str, title: str) -> str:
    """Map article to frontend categories: forex, stocks, commodities, crypto."""
    src = (source or "").lower()
    txt = f"{source} {title}".lower()
    if any(k in txt for k in ("bitcoin", "ethereum", "crypto", "btc", "eth", "xrp", "solana")):
        return "crypto"
    if any(k in txt for k in ("gold", "silver", "oil", "brent", "wti", "commodity")):
        return "commodities"
    if any(k in txt for k in ("stock", "equity", "nasdaq", "s&p", "dow", "share")):
        return "stocks"
    if any(k in src for k in ("forex", "fxstreet", "dailyfx", "forexlive")):
        return "forex"
    return "forex"

# Reusable session (faster + more reliable)
_session = _requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/rss+xml, application/xml;q=0.9,*/*;q=0.8",
})


def _safe_text(elem, tag: str) -> str:
    """Safely extract text from XML with namespace support."""
    val = elem.findtext(tag)
    if val:
        return val
    # Try namespaced fallback
    for child in elem:
        if tag in child.tag:
            return child.text or ""
    return ""


def _clean_html(text: str) -> str:
    return _re.sub(r"<[^>]+>", "", unescape(text)).strip()


def _parse_feed(name: str, xml_bytes: bytes) -> list[dict[str, Any]]:
    root = ET.fromstring(xml_bytes)
    items: list[dict[str, Any]] = []

    for item in root.findall(".//item")[:10]:
        title = (_safe_text(item, "title") or "").strip()
        if not title:
            continue

        link = (_safe_text(item, "link") or "").strip()
        pub = (_safe_text(item, "pubDate") or "").strip()
        desc_raw = (
            _safe_text(item, "description")
            or _safe_text(item, "content")
            or ""
        )

        items.append({
            "title": _clean_html(title),
            "url": link,
            "source": name,
            "published_at": pub,
            "summary": _clean_html(desc_raw)[:240],
        })

    return items


def _fetch_rss_feed(name: str, urls: list[str]) -> list[dict[str, Any]]:
    """Fetch one source, trying fallback URLs before logging a failure."""
    last_error: Exception | None = None
    for url in urls:
        try:
            resp = _session.get(url, timeout=6)
            resp.raise_for_status()
            items = _parse_feed(name, resp.content)
            if items:
                return items
        except Exception as exc:
            last_error = exc
            continue

    now = time.time()
    last_log = _SOURCE_FAILURE_LOG_TS.get(name, 0.0)
    if now - last_log >= _SOURCE_FAILURE_LOG_COOLDOWN:
        logger.warning("[NEWS] Failed %s after trying %d feed URL(s): %s", name, len(urls), last_error)
        _SOURCE_FAILURE_LOG_TS[name] = now
    return []


def _make_news_items() -> list[dict[str, Any]]:
    """Fetch all feeds with caching + fallback."""
    now = time.time()

    # Return cached if fresh
    if _news_cache["items"] and now - _news_cache["ts"] < _NEWS_CACHE_TTL:
        return _news_cache["items"]

    results: list[dict[str, Any]] = []

    try:
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [
                executor.submit(_fetch_rss_feed, name, urls)
                for name, urls in _NEWS_FEEDS.items()
            ]

            for fut in as_completed(futures):
                try:
                    results.extend(fut.result())
                except Exception:
                    pass

    except Exception as e:
        logger.error(f"[NEWS] Thread error: {e}")

    # Deduplicate
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []

    for item in results:
        key = item.get("title", "")[:_NEWS_DEDUP_PREFIX_LEN].lower()
        if key and key not in seen:
            seen.add(key)
            unique.append(item)

    # Fallback to old cache if everything failed
    if not unique and _news_cache["items"]:
        logger.warning("[NEWS] Using stale cache")
        return _news_cache["items"]

    _news_cache["items"] = unique[:25]
    _news_cache["ts"] = now

    return _news_cache["items"]


@router.get("/api/forex/news")
async def forex_news():
    items = _make_news_items()
    normalized = [
        {
            "headline": item.get("title", ""),
            "url": item.get("url", ""),
            "source": item.get("source", ""),
            "published_at": item.get("published_at", ""),
            "summary": item.get("summary", ""),
            "sentiment": _infer_sentiment(f"{item.get('title', '')} {item.get('summary', '')}"),
            "category": _infer_category(item.get("source", ""), item.get("title", "")),
        }
        for item in items
    ]
    return JSONResponse({
        "status": "ok",
        "count": len(normalized),
        "news": normalized,
    })