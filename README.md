# PiiTrade – Free AI Forex Signal Hub

AI and machine-learning backed **Forex-only** trading signal platform delivering real-time buy/sell/hold signals for 35 currency pairs. Built with React 19 + Vite (SPA), FastAPI, and a Flutter mobile app.

## Features

- **35 Forex Currency Pairs** across 3 categories:
  - **Major Pairs (USD)**: EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, NZD/USD
  - **Minor / Cross Pairs**: 20 non-USD crosses (EUR/GBP, GBP/JPY, AUD/JPY, etc.)
  - **Exotic Pairs**: USD/MXN, USD/NOK, USD/SEK, USD/SGD, USD/HKD, USD/TRY, USD/ZAR, USD/CNY
- Real-time price data via Frankfurter API (ECB) for all forex pairs
- Technical analysis: FVG, Support/Resistance, BOS, CHoCH, volume zones
- **Market News** with live headlines from multiple forex news sources
- **Economic Calendar & Alerts**: institutional activity, price surges, economic events
- **Structure & Pattern Scanner**: BOS, CHoCH, FVG reactions, S/R interactions
- Email subscription for signal alerts
- Risk calculator: position size, pip value, risk/reward ratio, required margin
- Success rate tracking with animated chart
- **Development Roadmap**: upcoming features publicly displayed on landing page
- **Our Partners**: TapTap Send (money transfer platform) and Exness (forex broker)
- Flutter mobile app (Android & iOS)

## Tech Stack

- **Frontend**: React 19 + Vite + Tailwind CSS + Framer Motion (SPA at `web/static/dist/`)
- **Backend**: FastAPI (`web/app.py`) with routers for forex, news, and alerts
- **Mobile**: Flutter (Dart) with HTTP + SharedPreferences

## Deployment

### Render (recommended)

The project is deployed at `https://piitrade.com`.

```bash
uvicorn web.app:app --host 0.0.0.0 --port 10000
```

### Vercel

Zero-config Vercel deployment:

```
vercel deploy
```

All requests are routed to `api/index.py` → `web/app.py`.

### Local development

```bash
pip install -r web/requirements.txt
uvicorn web.app:app --reload
```

To rebuild the React SPA:

```bash
cd web/frontend
npm install
npx vite build
```

## Project Structure

```
piitrade/
├── api/                  # Vercel serverless entrypoint
│   ├── index.py
│   └── requirements.txt
├── web/                  # FastAPI application
│   ├── app.py            # Main API + auth + admin routes
│   ├── requirements.txt
│   ├── routers/
│   │   ├── forex.py      # Forex signal & analysis endpoints
│   │   ├── news.py       # News feed router
│   │   └── alerts.py     # Alerts & economic calendar router
│   └── static/
│       ├── dist/         # Compiled React SPA (served as the main UI)
│       │   ├── index.html
│       │   └── assets/
│       ├── img/          # Images and branding
│       └── js/forex.js   # Legacy JS (used by non-SPA views)
├── flutter/              # Mobile app (Android & iOS)
│   ├── pubspec.yaml
│   └── lib/
│       ├── main.dart
│       ├── screens/
│       │   ├── forex_screen.dart
│       │   ├── login_screen.dart
│       │   └── settings_screen.dart
│       ├── models/
│       └── services/api_service.dart
└── vercel.json
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/forex/signals?pair=EUR/USD` | Signal for a specific forex pair |
| `GET /api/forex/pairs` | All forex pairs by category with `ecb_live` status |
| `GET /api/forex/news` | Forex news feed (returns `headline`, `source`, `summary`, etc.) |
| `GET /api/forex/technical?pair=EUR/USD` | Technical analysis (FVG, S/R, BOS, CHoCH) |
| `GET /api/forex/volatile?timeframe=24h` | Highest-momentum forex pairs |
| `GET /api/forex/reversals` | Potential trend reversal pairs |
| `GET /api/forex/fvg-scanner` | FVG status for all pairs |
| `GET /api/forex/sr-breakouts` | Support & Resistance breakout levels |
| `GET /api/forex/pattern-scanner` | Market structure pattern scanner |
| `GET /api/forex/economic-calendar` | Upcoming economic events |
| `GET /api/forex/alerts` | Economic alert cards |
| `POST /api/forex/alerts/subscribe` | Subscribe email to signal alerts |

## Development Roadmap

Planned upcoming features:
- Multi-timeframe confluence scoring

- Advanced AI retraining pipeline with live data
- Mobile push alerts
- TradingView chart integration
- Premium tier with email signal delivery
- Public API access for developers
