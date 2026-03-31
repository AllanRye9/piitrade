"""
Root-level entrypoint for Yot-Presentation.

This module re-exports the Flask ``app`` object from ``web/app.py`` so that
deployment platforms (Render, Railway, Heroku, gunicorn, etc.) that scan for
a Python entrypoint in the repository root can discover the application.

Acceptable entrypoint paths checked by most platforms:
    app.py  ← this file
    main.py, server.py, wsgi.py, …

Usage
-----
Direct:    python app.py
Gunicorn:  gunicorn app:app
Waitress:  waitress-serve --call app:app
"""

import os
import sys
from pathlib import Path

# Ensure the repo root is on sys.path so that ``web.app`` can be imported
# regardless of the working directory.
_root = Path(__file__).parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from web.app import app  # noqa: E402 – re-export for WSGI servers

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(debug=debug, host="0.0.0.0", port=port)
