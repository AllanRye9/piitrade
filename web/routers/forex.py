"""
PiiTrade – Forex resources router
Hosts API endpoints used by the dashboard tabs and clients.
"""

from datetime import datetime, timezone
import logging
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter()
logger = logging.getLogger("forex")

# Keep this in sync with frontend ticker usage.
_TICKER_PAIRS = [
    "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD",
    "USD/CHF", "NZD/USD", "EUR/GBP", "GBP/JPY", "EUR/JPY",
]

_EPSILON = 1e-12  # small value to prevent division by zero


def _core():
    """Load the main app module regardless of working directory."""
    try:
        from web import app as core  # type: ignore
    except ImportError:
        import app as core  # type: ignore
    return core


def _get_prices_for_pair(pair: str, days: int = 30) -> list[float]:
    """Return price list for pair, falling back to static sequences when live API unavailable."""
    core = _core()
    hist = core._fetch_historical_rates(pair, days)
    if hist:
        return list(hist.values())

    base_price, pip, seq = core._FOREX_HIST_SEQUENCES[pair]
    price = base_price
    prices: list[float] = [price]
    for _pred, _actual, delta in seq:
        price = round(price + delta * pip, 6)
        prices.append(price)
    return prices


def _compute_volatility(prices: list[float], window: int) -> float:
    """Return percentage range (high-low / midpoint) for the last window prices."""
    if len(prices) < 2:
        return 0.0
    subset = prices[-min(window, len(prices)):]
    high = max(subset)
    low = min(subset)
    mid = (high + low) / 2.0 if (high + low) > 0 else 1.0
    return round((high - low) / mid * 100, 4)


def _detect_reversal(prices: list[float]) -> dict[str, Any]:
    """Simple reversal detection: look for recent direction change in momentum."""
    if len(prices) < 10:
        return {"reversal": "none", "strength": 0.0}
    recent = prices[-5:]
    prior = prices[-10:-5]
    recent_trend = recent[-1] - recent[0]
    prior_trend = prior[-1] - prior[0]

    if prior_trend > 0 and recent_trend < 0:
        strength = round(abs(recent_trend) / (abs(prior_trend) + _EPSILON) * 100, 1)
        return {"reversal": "bearish", "strength": min(strength, 100.0)}
    if prior_trend < 0 and recent_trend > 0:
        strength = round(abs(recent_trend) / (abs(prior_trend) + _EPSILON) * 100, 1)
        return {"reversal": "bullish", "strength": min(strength, 100.0)}
    return {"reversal": "none", "strength": 0.0}


@router.get("/api/forex/signals")
async def forex_signals(pair: str = "EUR/USD"):
    try:
        core = _core()
        if pair not in core._SUPPORTED_PAIRS:
            return JSONResponse(
                {"error": f"Unsupported pair. Choose from: {', '.join(core._SUPPORTED_PAIRS)}"},
                status_code=400,
            )

        signal: dict[str, Any] = dict(core._FOREX_SIGNALS[pair])
        signal["pair"] = pair

        live_rate = core._fetch_live_rate(pair)
        hist_rates = core._fetch_historical_rates(pair, 30)

        if live_rate is not None:
            signal["entry_price"] = live_rate
            signal["generated_at"] = datetime.now(timezone.utc).isoformat()
            if pair in core._STOCK_TICKERS:
                signal["data_source"] = "Yahoo Finance"
            elif pair in core._COMMODITY_PAIRS:
                signal["data_source"] = "Yahoo Finance (Futures)"
            elif pair in core._CRYPTO_PAIRS:
                signal["data_source"] = "CoinGecko (Live)"
            else:
                signal["data_source"] = "Frankfurter API (ECB)"
            signal["is_live"] = True

            if hist_rates:
                prices = list(hist_rates.values())
                direction, confidence = core._compute_signal_from_prices(prices)
                signal["direction"] = direction
                signal["confidence"] = confidence
                pip, dec = core._pair_pip_dec(pair)
                tp_pips, sl_pips = core._compute_tp_sl_pips(prices, pair)
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
            history = core._build_forex_history_live(pair, hist_rates)
        else:
            history = core._build_forex_history(pair)

        correct_count = sum(1 for h in history if h["correct"])
        signal["accuracy_30d"] = round(correct_count / len(history) * 100, 1) if history else 0.0
        signal["history"] = history

        label_prices = list(hist_rates.values()) if hist_rates else []
        is_live = signal.get("is_live", False)
        signal["ai_label"] = core._generate_ai_label(
            signal.get("direction", "HOLD"),
            float(signal.get("confidence", 50)),
            label_prices,
            is_live,
        )
        signal["opportunity"] = signal["ai_label"]

        return JSONResponse(signal)
    except Exception as exc:
        logger.error("forex_signals error: %s", exc)
        return JSONResponse({"error": "Internal server error."}, status_code=500)


@router.get("/api/forex/technical")
async def forex_technical(pair: str = "EUR/USD"):
    try:
        core = _core()
        if pair not in core._SUPPORTED_PAIRS:
            return JSONResponse(
                {"error": f"Unsupported pair. Choose from: {', '.join(core._SUPPORTED_PAIRS)}"},
                status_code=400,
            )
        live_rate = core._fetch_live_rate(pair)
        return JSONResponse(core._build_technical_analysis(pair, live_rate))
    except Exception as exc:
        logger.error("forex_technical error: %s", exc)
        return JSONResponse({"error": "Internal server error."}, status_code=500)


@router.get("/api/forex/pairs")
async def forex_pairs():
    try:
        core = _core()
        major_ccys = {"EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD", "USD"}
        major: list[str] = []
        minor: list[str] = []
        exotic: list[str] = []

        for p in core._SUPPORTED_PAIRS:
            base, quote = p.split("/")
            if "USD" in (base, quote):
                other = base if quote == "USD" else quote
                if other in major_ccys - {"USD"}:
                    major.append(p)
                else:
                    exotic.append(p)
            else:
                minor.append(p)

        ecb_live = core._fetch_live_rate("EUR/USD") is not None
        return JSONResponse({
            "major": major,
            "minor": minor,
            "exotic": exotic,
            "all": list(core._SUPPORTED_PAIRS),
            "ecb_live": ecb_live,
        })
    except Exception as exc:
        logger.error("forex_pairs error: %s", exc)
        return JSONResponse({"error": "Internal server error."}, status_code=500)


@router.get("/api/forex/live-prices")
async def forex_live_prices():
    """Return live prices and 24h change for the main ticker pairs."""
    try:
        core = _core()
        result = []
        for pair in _TICKER_PAIRS:
            current = core._fetch_live_rate(pair)
            if current is None:
                entry = core._FOREX_SIGNALS.get(pair, {}).get("entry_price")
                result.append({
                    "pair": pair,
                    "price": str(entry) if entry is not None else "-",
                    "change": "0.00%",
                    "up": True,
                })
                continue

            hist = core._fetch_historical_rates(pair, 2)
            prev_values = list(hist.values())
            if len(prev_values) >= 2:
                prev = prev_values[-2]
            elif len(prev_values) == 1:
                prev = prev_values[0]
            else:
                prev = current
            change_pct = ((current - prev) / prev * 100) if prev != 0 else 0.0
            _pip, dec = core._pair_pip_dec(pair)
            result.append({
                "pair": pair,
                "price": f"{current:.{dec}f}",
                "change": f"{change_pct:+.2f}%",
                "up": change_pct >= 0,
            })
        return JSONResponse({"prices": result})
    except Exception as exc:
        logger.error("forex_live_prices error: %s", exc)
        return JSONResponse({"error": "Internal server error."}, status_code=500)


@router.get("/api/forex/volatile")
async def forex_volatile(timeframe: str = "24h"):
    """Return pairs ranked by volatility for timeframe (1h, 4h, 24h)."""
    try:
        core = _core()
        valid = {"1h", "4h", "24h"}
        if timeframe not in valid:
            return JSONResponse({"error": f"Invalid timeframe. Choose from: {', '.join(sorted(valid))}"}, status_code=400)

        window_map = {"1h": 2, "4h": 5, "24h": 10}
        window = window_map[timeframe]

        results: list[dict[str, Any]] = []
        for pair in core._SUPPORTED_PAIRS:
            prices = _get_prices_for_pair(pair, 30)
            vol = _compute_volatility(prices, window)
            signal_info = core._FOREX_SIGNALS[pair]
            live_rate = core._fetch_live_rate(pair)
            results.append({
                "pair": pair,
                "volatility_pct": vol,
                "direction": signal_info["direction"],
                "confidence": signal_info["confidence"],
                "entry_price": live_rate if live_rate is not None else signal_info["entry_price"],
            })

        results.sort(key=lambda x: x["volatility_pct"], reverse=True)
        return JSONResponse({"timeframe": timeframe, "pairs": results})
    except Exception as exc:
        logger.error("forex_volatile error: %s", exc)
        return JSONResponse({"error": "Internal server error."}, status_code=500)


@router.get("/api/forex/reversals")
async def forex_reversals():
    """Return pairs with detected potential trend reversals."""
    try:
        core = _core()
        results: list[dict[str, Any]] = []
        for pair in core._SUPPORTED_PAIRS:
            prices = _get_prices_for_pair(pair, 30)
            rev = _detect_reversal(prices)
            if rev["reversal"] == "none":
                continue
            signal_info = core._FOREX_SIGNALS[pair]
            live_rate = core._fetch_live_rate(pair)
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
    except Exception as exc:
        logger.error("forex_reversals error: %s", exc)
        return JSONResponse({"error": "Internal server error."}, status_code=500)


@router.get("/api/forex/fvg-scanner")
async def forex_fvg_scanner():
    """Return FVG status for all supported pairs grouped by status."""
    try:
        core = _core()
        grouped: dict[str, list[dict[str, Any]]] = {
            "approaching": [],
            "reached": [],
            "passed": [],
            "rejected": [],
        }
        pair_fvgs: dict[str, list[dict[str, Any]]] = {}
        seen_in_bucket: dict[str, set[str]] = {k: set() for k in grouped}

        for pair in core._SUPPORTED_PAIRS:
            live_rate = core._fetch_live_rate(pair)
            if pair in core._YF_PAIRS and live_rate is None:
                continue
            prices = _get_prices_for_pair(pair, 30)
            current_price = live_rate if live_rate is not None else (prices[-1] if prices else 0.0)
            ta = core._build_technical_analysis(pair, current_price)
            entries = core._classify_fvg_status(pair, current_price, ta["fvg"], prices)
            for entry in entries:
                bucket = entry.get("status", "")
                if bucket in grouped and pair not in seen_in_bucket[bucket]:
                    entry["direction"] = core._FOREX_SIGNALS[pair]["direction"]
                    grouped[bucket].append(entry)
                    seen_in_bucket[bucket].add(pair)

            _pip, dec = core._pair_pip_dec(pair)
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

        grouped["approaching"].sort(key=lambda x: x.get("dist", 1.0))
        return JSONResponse({
            "grouped": grouped,
            "pair_fvgs": pair_fvgs,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:
        logger.error("forex_fvg_scanner error: %s", exc)
        return JSONResponse({"error": "Internal server error."}, status_code=500)


@router.get("/api/forex/sr-breakouts")
async def forex_sr_breakouts():
    """Return all pairs classified by their relationship to major S/R levels."""
    try:
        core = _core()
        sr_groups: dict[str, list[dict[str, Any]]] = {
            "soon_touching": [],
            "touched": [],
            "broke": [],
        }
        seen_in_sr: dict[str, set[str]] = {k: set() for k in sr_groups}

        for pair in core._SUPPORTED_PAIRS:
            live_rate = core._fetch_live_rate(pair)
            if pair in core._YF_PAIRS and live_rate is None:
                continue
            prices = _get_prices_for_pair(pair, 30)
            current_price = live_rate if live_rate is not None else (prices[-1] if prices else 0.0)
            ta = core._build_technical_analysis(pair, current_price)
            sr = ta["support_resistance"]
            items = core._classify_sr_levels(pair, current_price, prices, sr["support"], sr["resistance"])
            items.sort(key=lambda x: x.get("dist", 1.0))
            for item in items:
                item["direction"] = core._FOREX_SIGNALS[pair]["direction"]
                item["confidence"] = core._FOREX_SIGNALS[pair]["confidence"]
                status = item.get("status", "")
                if status in sr_groups and pair not in seen_in_sr[status]:
                    sr_groups[status].append(item)
                    seen_in_sr[status].add(pair)

        for group_items in sr_groups.values():
            group_items.sort(key=lambda x: x.get("dist", 1.0))

        return JSONResponse({
            "sr_groups": sr_groups,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:
        logger.error("forex_sr_breakouts error: %s", exc)
        return JSONResponse({"error": "Internal server error."}, status_code=500)


@router.get("/api/forex/pattern-scanner")
async def forex_pattern_scanner(timeframe: str = "1h"):
    """Detect market structure formations across all supported pairs."""
    try:
        core = _core()
        valid_timeframes = {"30m", "1h", "4h", "1day"}
        if timeframe not in valid_timeframes:
            timeframe = "1h"

        tf_window: dict[str, int] = {"30m": 5, "1h": 10, "4h": 20, "1day": 30}
        analysis_window = tf_window[timeframe]
        all_candidates: list[dict[str, Any]] = []

        for pair in core._SUPPORTED_PAIRS:
            live_rate = core._fetch_live_rate(pair)
            if pair in core._YF_PAIRS and live_rate is None:
                continue
            prices_full = _get_prices_for_pair(pair, 30)
            prices = prices_full[-analysis_window:] if len(prices_full) >= analysis_window else prices_full
            current_price = live_rate if live_rate is not None else (prices[-1] if prices else 0.0)
            signal = core._FOREX_SIGNALS[pair]
            direction = signal["direction"]
            confidence = signal.get("confidence", 0.5)
            ta = core._build_technical_analysis(pair, current_price)

            for choch in ta.get("choch", []):
                choch_dir = "BUY" if choch["type"] == "bullish" else "SELL"
                all_candidates.append({
                    "pair": pair,
                    "type": "choch",
                    "label": "Change of Character (CHoCH)",
                    "impact": "high",
                    "direction": choch_dir,
                    "description": (
                        f"{pair}: {choch['description']} at level {choch['level']:.5g}. "
                        "CHoCH signals a potential trend reversal - one of the strongest "
                        "market structure formations."
                    ),
                })

            for bos in ta.get("bos", []):
                bos_dir = "BUY" if bos["type"] == "bullish" else "SELL"
                all_candidates.append({
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

            fvg_entries = core._classify_fvg_status(pair, current_price, ta["fvg"], prices)
            for fvg in fvg_entries:
                status = fvg.get("status", "")
                fvg_dir = direction

                if status == "rejected":
                    all_candidates.append({
                        "pair": pair,
                        "type": "fvg_rejection",
                        "label": "FVG Order Block Rejection",
                        "impact": "high",
                        "direction": fvg_dir,
                        "description": (
                            f"{pair}: Price was rejected at the "
                            f"{'bullish' if fvg['fvg_type'] == 'bullish' else 'bearish'} FVG zone "
                            f"({fvg['bottom']:.5g} - {fvg['top']:.5g}). "
                            "Order block rejections often signal strong reversals and high-probability "
                            "entry points."
                        ),
                    })
                elif status == "reached":
                    all_candidates.append({
                        "pair": pair,
                        "type": "fvg_inside",
                        "label": "Price Inside FVG Zone",
                        "impact": "medium",
                        "direction": fvg_dir,
                        "description": (
                            f"{pair}: Price is trading inside the "
                            f"{'bullish' if fvg['fvg_type'] == 'bullish' else 'bearish'} FVG zone "
                            f"({fvg['bottom']:.5g} - {fvg['top']:.5g}). "
                            "Price often fills the gap before continuing in the dominant direction."
                        ),
                    })
                elif status == "approaching":
                    all_candidates.append({
                        "pair": pair,
                        "type": "fvg_approach",
                        "label": "Approaching FVG Zone",
                        "impact": "low",
                        "direction": fvg_dir,
                        "description": (
                            f"{pair}: Price is approaching the "
                            f"{'bullish' if fvg['fvg_type'] == 'bullish' else 'bearish'} FVG zone "
                            f"({fvg['bottom']:.5g} - {fvg['top']:.5g}). "
                            "Watch for a reaction as price enters the imbalance area."
                        ),
                    })

            sr = ta["support_resistance"]
            sr_items = core._classify_sr_levels(pair, current_price, prices, sr["support"], sr["resistance"])
            for item in sr_items:
                sr_status = item.get("status", "")
                is_res = item["type"].startswith("resistance")
                sr_dir = "BUY" if is_res else "SELL"

                if sr_status == "broke":
                    all_candidates.append({
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
                    all_candidates.append({
                        "pair": pair,
                        "type": "sr_touched",
                        "label": "Key Level Touch",
                        "impact": "medium",
                        "direction": direction,
                        "description": (
                            f"{pair}: {item['description']} "
                            "Price testing a key level can produce a bounce or breakout - "
                            "watch for volume and momentum confirmation."
                        ),
                    })
                elif sr_status == "soon_touching":
                    all_candidates.append({
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

            if confidence >= 0.80 and direction in ("BUY", "SELL"):
                all_candidates.append({
                    "pair": pair,
                    "type": "strong_signal",
                    "label": "Strong Directional Signal",
                    "impact": "high",
                    "direction": direction,
                    "description": (
                        f"{pair}: AI model returned a {direction} signal with "
                        f"{confidence * 100:.1f}% confidence - above the high-conviction "
                        "threshold. Multiple indicators aligned in the same direction."
                    ),
                })

        impact_order = {"high": 0, "medium": 1, "low": 2}
        all_candidates.sort(key=lambda p: (impact_order.get(p["impact"], 3), p["pair"]))
        seen_pairs: set[str] = set()
        patterns: list[dict[str, Any]] = []
        for candidate in all_candidates:
            if candidate["pair"] not in seen_pairs:
                patterns.append(candidate)
                seen_pairs.add(candidate["pair"])

        return JSONResponse({
            "patterns": patterns,
            "timeframe": timeframe,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:
        logger.error("forex_pattern_scanner error: %s", exc)
        return JSONResponse({"error": "Internal server error."}, status_code=500)


@router.post("/api/forex/subscribe")
async def forex_subscribe(request: Request):
    """Handle alert subscription requests from dashboard and mobile clients."""
    core = _core()
    try:
        payload: dict[str, Any] = await request.json()
    except Exception:
        return JSONResponse({"success": False, "error": "Invalid JSON payload."}, status_code=400)

    try:
        email = str(payload.get("email", "")).strip().lower()
        pairs = payload.get("pairs") or []

        if not email or "@" not in email:
            return JSONResponse({"success": False, "error": "Valid email is required."}, status_code=400)
        if not isinstance(pairs, list) or not pairs:
            return JSONResponse({"success": False, "error": "Select at least one pair."}, status_code=400)

        safe_pairs = [str(p).strip() for p in pairs if str(p).strip()]
        if not safe_pairs:
            return JSONResponse({"success": False, "error": "Select at least one pair."}, status_code=400)

        # Send a support notification email when SMTP is configured.
        pair_list = ", ".join(safe_pairs[:30])
        body = (
            "<h2>New Forex Alert Subscription</h2>"
            f"<p><strong>Email:</strong> {email}</p>"
            f"<p><strong>Pairs:</strong> {pair_list}</p>"
            f"<p><strong>Requested At:</strong> {datetime.now(timezone.utc).isoformat()}</p>"
        )
        core._send_email(core._SUPPORT_ALERT_EMAIL, "PiiTrade Alert Subscription", body)

        return JSONResponse({
            "success": True,
            "message": "Subscription received. You will get alerts for selected pairs.",
        })
    except Exception as exc:
        logger.error("forex_subscribe error: %s", exc)
        return JSONResponse({"success": False, "error": "Internal server error."}, status_code=500)


# ── OHLC helpers ────────────────────────────────────────────────────────────


def _seeded_rand(seed_val: float):
    """Simple LCG pseudo-random generator for deterministic OHLC noise.

    Uses the classic Park-Miller LCG:
      s_next = s * 16807 mod (2^31 - 1)
    where 16807 is the multiplier, 2147483647 = 2^31 - 1 is a Mersenne prime
    commonly chosen as the modulus for full-period LCGs.
    """
    s = [max(1, abs(int(seed_val * 999997)) % 2147483647)]  # seed must be in [1, m-1]

    def _next() -> float:
        s[0] = s[0] * 16807 % 2147483647
        return (s[0] - 1) / 2147483646.0

    return _next


def _build_ohlc(
    daily_closes: list[tuple[str, float]],
    tf: str,
    dec: int,
    max_bars: int,
) -> list[dict[str, Any]]:
    """Convert a list of (date_str, close) into OHLC bars for the given timeframe."""
    if not daily_closes:
        return []

    seed_val = sum(v for _, v in daily_closes[:5]) if daily_closes else 1.0
    rand = _seeded_rand(seed_val)

    closes = [c for _, c in daily_closes]
    dates = [d for d, _ in daily_closes]

    if tf == "1W":
        bars: list[dict[str, Any]] = []
        i = 0
        while i < len(closes) - 4:
            wk = closes[i : i + 5]
            # ATR: average of |close[j] - close[j-1]| over the 4 day-to-day differences
            atr = sum(abs(wk[j] - wk[j - 1]) for j in range(1, len(wk))) / max(1, len(wk) - 1)
            o = round(wk[0], dec)
            c = round(wk[-1], dec)
            h = round(max(wk) + atr * (0.3 + rand() * 0.4), dec)
            l = round(min(wk) - atr * (0.3 + rand() * 0.4), dec)
            bars.append({"time": dates[i], "open": o, "high": h, "low": l, "close": c})
            i += 5
        return bars[-max_bars:]

    elif tf in ("1H", "4H"):
        sub_per_day = 24 if tf == "1H" else 6
        hours_per_bar = 24 // sub_per_day
        bars = []
        for i in range(1, len(closes)):
            prev = closes[i - 1]
            curr = closes[i]
            date_str = dates[i]
            for j in range(sub_per_day):
                frac = (j + 1) / sub_per_day
                noise_scale = abs(curr - prev) * 0.1 + curr * 0.00005
                sub_close = round(
                    prev + (curr - prev) * frac + (rand() - 0.5) * noise_scale, dec
                )
                sub_open = (
                    prev
                    if j == 0
                    else (bars[-1]["close"] if bars else sub_close)
                )
                noise = abs(sub_close - sub_open) * 0.4 + curr * 0.00008
                sub_high = round(max(sub_open, sub_close) + noise * rand(), dec)
                sub_low = round(min(sub_open, sub_close) - noise * rand(), dec)
                hour = j * hours_per_bar
                time_str = f"{date_str}T{hour:02d}:00:00"
                bars.append(
                    {
                        "time": time_str,
                        "open": sub_open,
                        "high": sub_high,
                        "low": sub_low,
                        "close": sub_close,
                    }
                )
        return bars[-max_bars:]

    else:  # 1D
        bars = []
        for i in range(len(closes)):
            o = round(closes[i - 1] if i > 0 else closes[i], dec)
            c = round(closes[i], dec)
            spread = abs(c - o)
            noise = spread * 0.5 + c * 0.0002
            h = round(max(o, c) + noise * rand(), dec)
            l = round(min(o, c) - noise * rand(), dec)
            bars.append({"time": dates[i], "open": o, "high": h, "low": l, "close": c})
        return bars[-max_bars:]


@router.get("/api/forex/candles")
async def forex_candles(pair: str = "EUR/USD", tf: str = "1D", bars: int = 365):
    """Return OHLC candle data for the advanced chart.

    tf values: 1H | 4H | 1D | 1W
    bars: number of bars to return (max 1825 for 1D/1W; 720 for 1H/4H)
    """
    try:
        core = _core()
        if pair not in core._SUPPORTED_PAIRS:
            return JSONResponse(
                {"error": f"Unsupported pair. Choose from: {', '.join(core._SUPPORTED_PAIRS)}"},
                status_code=400,
            )

        _pip, dec = core._pair_pip_dec(pair)
        tf_upper = tf.upper()

        # Determine how many daily bars to fetch.
        # 1H: need bars/24 days worth of data; min 14 days for decent history, max 30 days
        # 4H: need bars/6 days; min 14, max 90
        # 1W: need bars * 7 calendar days + buffer for aggregation
        # 1D: direct mapping with a small look-back buffer
        if tf_upper == "1H":
            fetch_days = min(max(bars // 24 + 3, 14), 30)
            bars = min(bars, 720)
        elif tf_upper == "4H":
            fetch_days = min(max(bars // 6 + 5, 14), 90)
            bars = min(bars, 1080)
        elif tf_upper == "1W":
            fetch_days = min(bars * 7 + 30, 1825)
            bars = min(bars, 260)
        else:  # 1D
            fetch_days = min(bars + 15, 1825)
            bars = min(bars, 1825)

        hist_rates = core._fetch_historical_rates(pair, fetch_days)

        if hist_rates:
            daily_closes = sorted(hist_rates.items())
        else:
            # Fallback to static sequences
            base_price, pip, seq = core._FOREX_HIST_SEQUENCES[pair]
            price = base_price
            from datetime import date as _date, timedelta as _td

            start = _date.today() - _td(days=len(seq))
            daily_closes = []
            for idx, (_, _, delta) in enumerate(seq):
                price = round(price + delta * pip, dec)
                daily_closes.append(
                    ((start + _td(days=idx)).isoformat(), price)
                )

        candles = _build_ohlc(daily_closes, tf_upper, dec, bars)

        live_rate = core._fetch_live_rate(pair)
        # Update the last candle's close with the live rate if available
        if live_rate is not None and candles:
            last = candles[-1]
            candles[-1] = {
                "time": last["time"],
                "open": last["open"],
                "high": max(last["high"], round(live_rate, dec)),
                "low": min(last["low"], round(live_rate, dec)),
                "close": round(live_rate, dec),
            }

        return JSONResponse(
            {
                "pair": pair,
                "tf": tf_upper,
                "bars": len(candles),
                "candles": candles,
                "live": live_rate,
            }
        )
    except Exception as exc:
        logger.error("forex_candles error: %s", exc)
        return JSONResponse({"error": "Internal server error."}, status_code=500)
