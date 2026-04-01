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

# Use gunicorn with uvicorn worker for production ASGI serving.
# exec replaces the shell so gunicorn receives OS signals (SIGTERM/SIGINT) directly.
CMD ["sh", "-c", "exec gunicorn -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000} --workers 2 web.app:app"]
