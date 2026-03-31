"""
Vercel serverless entrypoint for PiiTrade – AI Forex Signal Hub.

This module re-exports the Flask ``app`` object from ``web/app.py`` so that
Vercel's Python runtime can use it as a WSGI handler.
"""

import sys
from pathlib import Path

# Ensure the repository root is on sys.path so ``web.app`` can be imported.
_root = Path(__file__).parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

try:
    from web.app import app  # noqa: E402 -- WSGI handler for Vercel
except Exception as _import_error:
    # Fallback WSGI app that reports the import error instead of crashing
    # with an opaque 500. This makes diagnostics much easier.
    import json as _json

    _error_message = str(_import_error)

    def app(environ, start_response):  # type: ignore[misc]
        body = _json.dumps({"error": "Failed to load application: " + _error_message}).encode()
        start_response(
            "500 Internal Server Error",
            [
                ("Content-Type", "application/json"),
                ("Content-Length", str(len(body))),
            ],
        )
        return [body]
