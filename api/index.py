"""
Vercel / ASGI entrypoint for PiiTrade – AI Forex Signal Hub.

This module re-exports the FastAPI `app` object from `web/app.py` so that
Vercel's Python runtime can use it as an ASGI handler.
"""
import logging
import sys
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

# Ensure the repository root is on sys.path so `web.app` can be imported.
_root = Path(__file__).parent.parent
if _root.is_dir() and str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

try:
    from web.app import app  # noqa: E402 -- ASGI handler for Vercel
except ImportError as _import_error:
    logger.error(f"Failed to import 'web.app': {_import_error}")

    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    app = FastAPI()

    @app.get("/health")
    async def health_check():
        """Basic endpoint for checking application health."""
        return {"status": "ok"}

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    async def _error_handler(path: str = ""):
        """Catch-all route for failed application startup."""
        return JSONResponse(
            {"error": f"Application failed to start due to: {_import_error}. Check deployment logs."},
            status_code=500,
        )
