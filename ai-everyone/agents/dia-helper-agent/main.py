"""Process launcher for dia-helper-agent.

Used by tooling that expects a main.py entrypoint.
"""

from server import app  # noqa: F401  - imported for side effects when uvicorn loads this module

if __name__ == "__main__":
    # Delegate to server.py so there is a single uvicorn configuration.
    import server  # noqa

