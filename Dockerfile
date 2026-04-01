# ── PiiTrade – FastAPI web application ────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies
COPY web/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy FastAPI application
COPY web/ web/

ENV PYTHONUNBUFFERED=1

EXPOSE 10000

# Use gunicorn with uvicorn worker for production ASGI serving
CMD gunicorn -k uvicorn.workers.UvicornWorker --bind "0.0.0.0:${PORT:-8000}" --workers 1 "web.app:app"
