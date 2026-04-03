# PiiTrade – AI Signal Hub

AI & machine learning backed multi-asset trading signal platform covering forex, commodities, crypto, and stocks.

## Features

- **51 Live Trading Pairs** across 6 categories:
  - **Forex**: 7 major USD pairs, 20 minor/cross pairs, 8 exotic pairs
  - **Commodities**: Gold (XAU/USD), Silver (XAG/USD), WTI Crude Oil, Brent Crude Oil
  - **Crypto**: Bitcoin (BTC/USD), Ethereum (ETH/USD), BNB, XRP, Solana (SOL/USD)
  - **Stocks**: AAPL, TSLA, NVDA, AMZN, MSFT, GOOGL, META
- Real-time price data via Frankfurter API (ECB) for forex and Yahoo Finance for commodities, crypto, and stocks
- Technical analysis: FVG, Support/Resistance, BOS, CHoCH, volume zones
- **Market News** with category tabs — Forex, Stocks, Commodities, Crypto — with positive/negative market impact indicators
- **Market Alerts & Events**: institutional activity, price surges, economic events
- **Structure & Pattern Scanner**: BOS, CHoCH, FVG reactions, S/R interactions
- Email subscription for signal alerts
- Risk calculator: position size, pip value, risk/reward, required margin
- Success rate tracking with animated Load All Pairs view
- Cached pairs (stocks, commodities, crypto) hidden from selector when live feeds are unavailable
- Flutter mobile app (Android & iOS)

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
│   ├── app.py        # Multi-asset API + web UI
│   ├── requirements.txt
│   ├── templates/
│   │   ├── landing.html
│   │   ├── forex.html
│   │   └── methodology.html
│   └── static/
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
| `GET /api/forex/signals?pair=EUR/USD` | Signal for a specific pair |
| `GET /api/forex/pairs` | All pairs by category with `yf_live` status |
| `GET /api/forex/news` | Categorised news feed (forex/stocks/commodities/crypto) |
| `GET /api/forex/technical?pair=EUR/USD` | Technical analysis (FVG, S/R, BOS, CHoCH) |
| `GET /api/forex/volatile?timeframe=24h` | Highest-momentum pairs |
| `GET /api/forex/reversals` | Potential trend reversal pairs |
| `GET /api/forex/fvg-scanner` | FVG status for all pairs |
| `GET /api/forex/sr-breakouts` | Support & Resistance breakout levels |
| `GET /api/forex/pattern-scanner` | Market structure pattern scanner |
| `POST /api/forex/subscribe` | Email alert subscription |
