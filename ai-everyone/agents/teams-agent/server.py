"""
FastAPI server for the Teams Agent.

Exposes a POST /teams/action endpoint that receives task data
from the Firebase Cloud Function and returns structured results.

Run with:
    uvicorn server:app --host 0.0.0.0 --port 8100

Or via Docker (see Dockerfile).
"""

import os

# Load .env file BEFORE importing teams_agent, because teams_agent.py
# reads env vars (GRAPH_CLIENT_ID, etc.) at module-level import time.
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from teams_agent import run_teams_action

app = FastAPI(
    title="SnitchX Teams Agent",
    description="Microsoft Teams agent for SnitchX — handles calls and messages.",
    version="1.0.0",
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class TeamsActionRequest(BaseModel):
    """Request body for the /teams/action endpoint."""
    action: str  # "make_call" or "send_message"
    contact: str  # Person name or email
    message: str | None = None  # Message text (for send_message)

    # Additional fields that may come from the Cloud Function
    taskId: str | None = None
    userId: str | None = None
    agentId: str | None = None


class TeamsActionResponse(BaseModel):
    """Response body from the /teams/action endpoint."""
    status: str  # "success" or "failed"
    type: str | None = None  # "teams_call" or "teams_message"
    url: str | None = None  # msteams:// URL
    displayName: str | None = None
    email: str | None = None
    error: str | None = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy", "agent": "teams-agent", "version": "1.0.0"}


@app.post("/teams/action", response_model=TeamsActionResponse)
async def teams_action(data: TeamsActionRequest):
    """
    Execute a Teams action (make_call or send_message).

    Called by the Firebase Cloud Function when an agentTask is created
    with agentId="teams-agent".
    """
    try:
        result = run_teams_action(data.model_dump())
        return TeamsActionResponse(**result)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Agent execution failed: {str(exc)}",
        )


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8100"))
    uvicorn.run(app, host="0.0.0.0", port=port)
