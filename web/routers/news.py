"""
PiiTrade – News router
Fetches and caches live forex news from multiple RSS feeds.
"""

import re as _re
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from html import unescape
from typing import Any

import requests as _requests
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()

# ─── News feed ─────────────────────────────────────────────────────────────────
_NEWS_FEEDS: list[tuple[str, str]] = [
    ("ForexLive", "https://www.forexlive.com/feed/"),
    ("FXStreet", "https://www.fxstreet.com/rss/news"),
    ("Investing.com", "https://www.investing.com/rss/news_25.rss"),
    ("DailyFX", "https://www.dailyfx.com/feeds/all"),
    ("Reuters", "https://feeds.reuters.com/reuters/businessNews"),
    ("MarketWatch", "https://feeds.content.dowjones.io/public/rss/mw_forex"),
    ("Yahoo Finance", "https://finance.yahoo.com/rss/topfinstories"),
]

_news_cache: dict[str, Any] = {"items": [], "ts": 0.0}
_NEWS_CACHE_TTL = 300  # 5 minutes
_NEWS_DEDUP_PREFIX_LEN = 60  # characters of title used to detect duplicate articles


def _fetch_rss_feed(name: str, url: str) -> list[dict[str, Any]]:
    """Fetch and parse a single RSS feed. Returns [] on any error."""
    try:
        resp = _requests.get(
            url,
            timeout=4,
            headers={"User-Agent": "PiiTrade/1.0 (+https://piitrade.com)"},
        )
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
        items: list[dict[str, Any]] = []
        for item in root.findall(".//item")[:8]:
            title = (item.findtext("title") or "").strip()
            if not title:
                continue
            link = (item.findtext("link") or "").strip()
            pub = (item.findtext("pubDate") or "").strip()
            desc_raw = item.findtext("description") or ""
            # Strip HTML tags from description
            desc = _re.sub(r"<[^>]+>", "", unescape(desc_raw)).strip()[:240]
            items.append({
                "title": unescape(title),
                "url": link,
                "source": name,
                "published_at": pub,
                "summary": desc,
            })
        return items
    except Exception:
        return []


def _make_news_items() -> list[dict[str, Any]]:
    """Return live news from multiple RSS feeds with 5-minute caching.
    Returns an empty list if all feeds are unreachable."""
    now = time.time()
    if _news_cache["items"] and now - _news_cache["ts"] < _NEWS_CACHE_TTL:
        return _news_cache["items"]

    results: list[dict[str, Any]] = []
    try:
        with ThreadPoolExecutor(max_workers=len(_NEWS_FEEDS)) as executor:
            futures = {executor.submit(_fetch_rss_feed, name, url): name for name, url in _NEWS_FEEDS}
            for fut in as_completed(futures, timeout=6):
                try:
                    results.extend(fut.result())
                except Exception:
                    pass
    except Exception:
        pass

    # Deduplicate by title
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for item in results:
        key = item.get("title", "")[:_NEWS_DEDUP_PREFIX_LEN].lower()
        if key not in seen:
            seen.add(key)
            unique.append(item)

    _news_cache["items"] = unique[:25]
    _news_cache["ts"] = now
    return _news_cache["items"]


@router.get("/api/forex/news")
async def forex_news():
    return JSONResponse({"news": _make_news_items()})
