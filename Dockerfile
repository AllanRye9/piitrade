# ─── Yot-Presentation Web App – Docker Image ───────────────────────────────
# Builds a production-ready container for the Flask-based voice-controlled
# presentation viewer.
#
# Build:   docker build -t yot-presentation .
# Run:     docker run -p 5000:5000 yot-presentation
# Compose: docker-compose up
# ────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim

# System dependencies needed by PyMuPDF (libmupdf) and Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
        libglib2.0-0 \
        libsm6 \
        libxext6 \
        libxrender1 \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (layer cache)
COPY web/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy web application source
COPY web/ .

# Persistent directory for the ML learning database and uploaded files.
# Mount this path as a named volume in docker-compose to survive restarts.
RUN mkdir -p /app/data

EXPOSE 5000

# Disable Flask debug mode by default; override with -e FLASK_DEBUG=1
ENV PORT=5000 \
    FLASK_DEBUG=0 \
    DATA_DIR=/app/data

CMD ["python", "app.py"]
