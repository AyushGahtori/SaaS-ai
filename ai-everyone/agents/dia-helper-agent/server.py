"""
server.py - Dia Helper Agent root entry-point.
Re-exports the FastAPI app from api/server.py for deployment consistency.
"""

import os

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover - optional dependency
    pass

from api.server import app  # noqa: F401


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8020"))
    print(f"Starting Dia Helper Agent on port {port}")
    uvicorn.run("api.server:app", host="0.0.0.0", port=port, reload=False)

