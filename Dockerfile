# ── Python Flask web application ───────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies (gunicorn added for production serving)
COPY web/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Flask application
COPY web/ web/

ENV PYTHONUNBUFFERED=1

EXPOSE 10000

# Shell form so ${PORT:-5000} is expanded at container start-up by the shell
CMD gunicorn --bind "0.0.0.0:${PORT:-5000}" --workers 2 "web.app:app"
