# Yot-Presentation Mobile 📱

Flutter mobile app for [Yot-Presentation](../) — voice-controlled presentations on **Android** and **iOS**.

---

## Features

- 🎤 **Voice commands** — say "next", "previous", "go to 5", "last slide" (8 languages, auto-detected)
- 📤 **File upload** — upload PDF, Word, Excel, images, or text directly from your phone
- 📂 **File manager** — list and open presentations already on the server
- 🖼️ **Slide viewer** — pinch-to-zoom for image slides; scrollable text for text slides
- 🔗 **Configurable server** — point the app at any Yot-Presentation Flask backend

---

## Requirements

| Tool | Version |
|------|---------|
| Flutter SDK | ≥ 3.10 |
| Dart SDK | ≥ 3.0 |
| Android | API 21+ (Android 5) |
| iOS | 12.0+ |

---

## Quick Start

### 1 — Start the Flask server

```bash
# From the repository root
docker-compose up
# or
cd web && pip install -r ../requirements.txt && python app.py
```

### 2 — Install the Flutter app

```bash
cd flutter
flutter pub get
flutter run            # on a connected device / emulator
```

### 3 — Configure the server URL

Open the ⚙️ **Settings** screen inside the app and enter the IP address of
the machine running the Flask server, e.g. `http://192.168.1.100:5000`.

> **Tip:** Make sure your phone and the server are on the same Wi-Fi network.

---

## Project Structure

```
flutter/
├── lib/
│   ├── main.dart                  # App entry point
│   ├── screens/
│   │   ├── upload_screen.dart     # File upload & file list
│   │   ├── presentation_screen.dart  # Slide viewer + voice control
│   │   └── settings_screen.dart   # Server URL configuration
│   ├── services/
│   │   ├── api_service.dart       # HTTP client for the Flask API
│   │   └── voice_service.dart     # Wrapper around speech_to_text
│   ├── models/
│   │   ├── slide.dart             # Slide data model
│   │   └── presentation_file.dart # PresentationFile data model
│   └── widgets/
│       ├── slide_view.dart        # Image / text slide renderer
│       └── voice_button.dart      # Animated microphone FAB
├── android/                       # Android project files
├── ios/                           # iOS project files
├── test/
│   └── widget_test.dart           # Unit tests for models & services
├── pubspec.yaml                   # Flutter dependencies
└── analysis_options.yaml          # Lint rules
```

---

## Voice Commands

The app sends your transcript to the `/api/command` endpoint on the Flask
server, which matches it against the same 72+ pattern variations as the web
app.  Supported languages: English, Spanish, French, German, Italian,
Portuguese, Chinese, Japanese.

| What you say | Action |
|---|---|
| "next", "forward", "siguiente" | Next slide |
| "back", "previous", "précédent" | Previous slide |
| "go to 5", "slide 5", "salta a 5" | Jump to slide 5 |
| "first", "beginning" | First slide |
| "last", "end", "final" | Last slide |

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
