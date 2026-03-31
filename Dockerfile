# ── Stage 1: Build Flutter web app ────────────────────────────────────────────
FROM ghcr.io/cirruslabs/flutter:stable AS flutter-build

WORKDIR /flutter
COPY flutter/ .
RUN flutter build web --release

# ── Stage 2: Python Flask application ─────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies (gunicorn added for production serving)
COPY web/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Flask application
COPY web/ web/

# Embed the Flutter web build as Flask static files served at /app
COPY --from=flutter-build /flutter/build/web web/static/flutter/

ENV PYTHONUNBUFFERED=1

EXPOSE 10000

# Shell form so ${PORT:-5000} is expanded at container start-up by the shell
CMD gunicorn --bind "0.0.0.0:${PORT:-5000}" --workers 2 "web.app:app"
