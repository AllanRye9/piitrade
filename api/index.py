"""
Vercel serverless entrypoint for PiiTrade – AI Forex Signal Hub.

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
    # Fallback ASGI app that reports the import error instead of crashing
    # with an opaque 500. This makes diagnostics much easier.
    import json as _json

    _error_message = str(_import_error)

    async def app(scope, receive, send):  # type: ignore[misc]
        if scope["type"] == "http":
            body = _json.dumps(
                {"error": "Failed to load application: " + _error_message}
            ).encode()
            await send({
                "type": "http.response.start",
                "status": 500,
                "headers": [
                    [b"content-type", b"application/json"],
                    [b"content-length", str(len(body)).encode()],
                ],
            })
            await send({"type": "http.response.body", "body": body})
