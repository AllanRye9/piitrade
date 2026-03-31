# PiiTrade Mobile 📱

Flutter mobile app for [PiiTrade](../) — AI Forex Signal Hub for **Android** and **iOS**.

> **Note:** This Flutter app is an **independent mobile service**. It is not part of the Docker deployment. Only the web application (`web/`) is deployed via Docker.

---

## Features

- 📈 **Live forex signals** — AI/ML-backed buy/sell signals for major forex pairs and XAU/USD
- 📊 **Technical analysis** — RSI, MACD, Bollinger Bands and trend indicators
- 📰 **News sentiment** — market sentiment from live news headlines
- 📉 **Pair history** — historical rate charts for all supported pairs
- ⚙️ **Configurable server** — point the app at any PiiTrade Flask backend

---

## Requirements

| Tool | Version |
|------|---------|
| Flutter SDK | ≥ 3.22 |
| Dart SDK | ≥ 3.4 |
| Android | API 21+ (Android 5) |
| iOS | 12.0+ |

---

## Quick Start

### 1 — Start the PiiTrade web server

```bash
# From the repository root (Docker)
docker build -t piitrade .
docker run -p 5000:5000 piitrade

# or run locally
cd web && pip install -r requirements.txt && python app.py
```

### 2 — Install the Flutter app

```bash
cd flutter
flutter pub get
flutter run            # on a connected device / emulator
```

### 3 — Configure the server URL

Open the ⚙️ **Settings** screen inside the app and enter the address of
the machine running the Flask server, e.g. `http://192.168.1.100:5000`.

> **Tip:** Make sure your phone and the server are on the same network (or use the deployed URL).

---

## Project Structure

```
flutter/
├── lib/
│   ├── main.dart                  # App entry point & splash screen
│   ├── screens/
│   │   ├── forex_screen.dart      # Live signals, rates & pair history
│   │   └── settings_screen.dart   # Server URL configuration
│   ├── services/
│   │   └── api_service.dart       # HTTP client for the PiiTrade Flask API
│   └── models/                    # Data models
├── android/                       # Android project files
├── ios/                           # iOS project files
├── test/
│   └── widget_test.dart           # Widget tests
├── pubspec.yaml                   # Flutter dependencies
└── analysis_options.yaml          # Lint rules
```

---

## Running Tests

```bash
flutter test
```

---

## Building for Release

### Android APK

```bash
flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk
```

### iOS (requires macOS + Xcode)

```bash
flutter build ios --release
```

---

## Deployment Note

The Flutter app is **not** included in the Docker image. It is developed and
distributed independently as an Android/iOS application. The Docker image only
contains the Python/Flask web application.

