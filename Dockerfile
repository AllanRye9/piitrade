# ── Python FastAPI web application ─────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies
COPY web/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy FastAPI application
COPY web/ web/

ENV PYTHONUNBUFFERED=1

EXPOSE 10000

# Use uvicorn with gunicorn worker manager for production
CMD gunicorn --bind "0.0.0.0:${PORT:-8000}" --workers 2 \
    --worker-class uvicorn.workers.UvicornWorker "web.app:app"
