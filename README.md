# PiiTrade – AI Forex Signal Hub

AI & machine learning backed financial market analysis, fundamental news and signal platform.

## Features

- Live forex signals for major, cross, and commodity pairs (XAU/USD)
- Real-time price data via Frankfurter API (ECB) and Yahoo Finance (gold)
- Technical analysis: FVG, Support/Resistance, BOS, CHoCH, volume zones
- News sentiment feed
- Email subscription for signal alerts
- Flutter mobile app (Android & iOS)

## Deployment

### Vercel (recommended)

The project is structured for zero-config Vercel deployment:

```
vercel deploy
```

All requests are routed to `api/index.py` → `web/app.py` (Flask).

### Local development

```bash
pip install -r web/requirements.txt
python -m flask --app web/app run --debug
```

## Project Structure

```
piitrade/
├── api/              # Vercel serverless entrypoint
│   ├── index.py
│   └── requirements.txt
├── web/              # Flask application
│   ├── app.py        # Forex API + web UI
│   ├── requirements.txt
│   ├── templates/
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
