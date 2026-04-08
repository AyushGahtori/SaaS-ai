"""
main.py - Career Switch Agent launcher.
Starts the FastAPI server via Uvicorn.
"""

import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8022"))
    print(f"Starting Career Switch Agent on port {port}")
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
