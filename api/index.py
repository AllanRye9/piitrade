"""
Vercel / ASGI entrypoint for PiiTrade – AI Forex Signal Hub.

This module re-exports the FastAPI ``app`` object from ``web/app.py`` so that
Vercel's Python runtime can use it as an ASGI handler.
"""

import sys
from pathlib import Path

# Ensure the repository root is on sys.path so ``web.app`` can be imported,
# and the ``web/`` directory is on sys.path so that ``web/app.py``'s bare
# ``from routers import ...`` imports resolve correctly.
_root = Path(__file__).parent.parent
_web = _root / "web"
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))
if str(_web) not in sys.path:
    sys.path.insert(0, str(_web))

from web.app import app  # noqa: E402 -- ASGI handler for Vercel
