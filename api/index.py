"""
Vercel / ASGI entrypoint for PiiTrade – AI Forex Signal Hub.

This module re-exports the FastAPI ``app`` object from ``web/app.py`` so that
Vercel's Python runtime can use it as an ASGI handler.
"""

import sys
from pathlib import Path

# Ensure the repository root is on sys.path so ``web.app`` can be imported.
_root = Path(__file__).parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

try:
    from web.app import app  # noqa: E402 -- ASGI handler for Vercel
except Exception as _import_error:
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    _error_message = str(_import_error)
    app = FastAPI()

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    async def _error_handler(path: str = ""):
        return JSONResponse(
            {"error": "Application failed to start. Check deployment logs."},
            status_code=500,
        )
