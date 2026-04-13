# PiiTrade – Free AI Forex Signal Hub

AI and machine-learning backed **Forex-only** trading signal platform delivering real-time buy/sell/hold signals for 35 currency pairs.

## Features

- **35 Forex Currency Pairs** across 3 categories:
  - **Major Pairs (USD)**: EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, NZD/USD
  - **Minor / Cross Pairs**: 20 non-USD crosses (EUR/GBP, GBP/JPY, AUD/JPY, etc.)
  - **Exotic Pairs**: USD/MXN, USD/NOK, USD/SEK, USD/SGD, USD/HKD, USD/TRY, USD/ZAR, USD/CNY
- Real-time price data via Frankfurter API (ECB) for all forex pairs
- Technical analysis: FVG, Support/Resistance, BOS, CHoCH, volume zones
- **Market News** with forex category tab
- **Market Alerts & Events**: institutional activity, price surges, economic events
- **Structure & Pattern Scanner**: BOS, CHoCH, FVG reactions, S/R interactions
- Email subscription for signal alerts
- Risk calculator: position size, pip value, risk/reward (including 1:3.00 ratio), required margin
- Success rate tracking with animated Load All Pairs view
- **Development Roadmap**: upcoming features publicly displayed on landing page
- **Whitepaper**: AI pipeline documentation linked from landing page
- **Compact Header**: sticky, animated, minimal vertical space
- **Margin Ads**: 2.25% left (Taptap) and 2.25% right (Exness) animated ad columns
- img/trader.png used as site favicon and branding icon
- Flutter mobile app (Android & iOS)

## Advanced Market Analysis Page (`/advance`)

The `/advance` page is a comprehensive SMC (Smart Money Concepts) charting and analysis dashboard designed to be accessible for beginners while offering professional-grade insights.

### Chart Features

- **Interactive Canvas Chart** with four timeframes in ascending order: **1H → 4H → 1D → 30D**
- **Real-time current price** displayed as a glowing blinking line — updated every 20 seconds via live-price API polling
- **ENTRY, TAKE PROFIT (TP), STOP LOSS (SL)** are clearly marked on the chart with bold pill labels and distinct colours:
  - ⚡ **ENTRY** — direction-coloured dashed line + pill badge
  - ✅ **TAKE PROFIT** — green dashed line + pill badge
  - 🛑 **STOP LOSS** — red dashed line + pill badge
- **Order Blocks (OB)**: Green (bullish) and red (bearish) shaded zones; the nearest block to current price is fully highlighted
- **Fair Value Gaps (FVG)**: Blue (bullish) and orange (bearish) shaded zones with "FVG" label
- **CHoCH levels**: Dashed lines with direction arrows marking Change of Character
- **Liquidity Zones**: Dotted support (💧S) and resistance (💧R) lines drawn from the S/R data
- **Current Price pill**: Animated glowing horizontal line with price badge on Y-axis
- **Live price overlay badge**: Top-right corner of chart shows the real-time price with a pulsing green dot
- **Chart legend**: All visual elements labelled with emoji for quick identification
- **Hover tooltip**: Shows price, date, signal correctness, and AI signal on mouseover

### Signal Card

- Prominently displays **ENTRY**, **TAKE PROFIT**, and **STOP LOSS** in a 3-column grid with colour-coded borders and large bold values
- AI direction badge (BUY / SELL / HOLD) with confidence bar
- Data source masking for user-friendly display

### Navigation & UX

- **Theme dropdown**: Select Dark 🌑, Ocean 🌊, or Light ☀️ theme from a compact dropdown in the nav bar (persisted in localStorage)
- **8.5% side margins** for comfortable reading on all screen sizes
- **Beginner Guide** (collapsible `<details>` panel): Explains ENTRY, TP, SL, Order Blocks, FVG, Liquidity Zones, BOS/CHoCH in plain language
- **Section descriptions**: Each analysis section has a one-line plain-English summary
- **Trading Sessions**: Live/closed status for Sydney, Tokyo, London, New York sessions with killzone tips
- **Auto-refresh**: Data reloads every 90 seconds automatically

## What Was Removed

- ❌ Cryptocurrencies (BTC, ETH, BNB, XRP, SOL)
- ❌ Stocks (AAPL, TSLA, NVDA, AMZN, MSFT, GOOGL, META)
- ❌ Commodities (XAU/USD Gold, XAG/USD Silver, WTI Oil, Brent Oil)
- ❌ Methodology page/section
- ❌ Multi-asset news tabs (stocks, crypto, commodities)

## Deployment

### Render (recommended)

The project is deployed at `https://piitrade.onrender.com`.

### Vercel

Zero-config Vercel deployment:

```
vercel deploy
```

All requests are routed to `api/index.py` → `web/app.py`.

### Local development

```bash
pip install -r web/requirements.txt
python -m flask --app web/app run --debug
```

Or with uvicorn (for FastAPI):

```bash
uvicorn web.app:app --reload
```

## Project Structure

```
piitrade/
├── api/              # Vercel serverless entrypoint
│   ├── index.py
│   └── requirements.txt
├── web/              # FastAPI application
│   ├── app.py        # Forex-only API + web UI
│   ├── requirements.txt
│   ├── templates/
│   │   ├── landing.html   # Landing page with Roadmap & Whitepaper cards
│   │   ├── forex.html     # Forex-only signal dashboard
│   │   └── disclaimer.html
│   └── static/
│       ├── img/trader.png     # Site favicon/logo
│       ├── css/forex.css
│       └── js/forex.js
├── flutter/          # Mobile app (Android & iOS)
│   └── lib/
│       ├── main.dart
│       ├── screens/forex_screen.dart
│       ├── screens/settings_screen.dart
│       ├── models/
│       └── services/api_service.dart
└── vercel.json
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/forex/signals?pair=EUR/USD` | Signal for a specific forex pair |
| `GET /api/forex/pairs` | All forex pairs by category with `ecb_live` status |
| `GET /api/forex/news` | Forex news feed |
| `GET /api/forex/technical?pair=EUR/USD` | Technical analysis (FVG, S/R, BOS, CHoCH) |
| `GET /api/forex/volatile?timeframe=24h` | Highest-momentum forex pairs |
| `GET /api/forex/reversals` | Potential trend reversal pairs |
| `GET /api/forex/fvg-scanner` | FVG status for all pairs |
| `GET /api/forex/sr-breakouts` | Support & Resistance breakout levels |
| `GET /api/forex/pattern-scanner` | Market structure pattern scanner |
| `POST /api/forex/subscribe` | Email alert subscription |

## Development Roadmap

Planned upcoming features:
- Multi-timeframe confluence scoring
- Advanced AI retraining pipeline with live data
- Mobile push alerts
- TradingView chart integration
- Premium tier with email signal delivery
- Public API access for developers
