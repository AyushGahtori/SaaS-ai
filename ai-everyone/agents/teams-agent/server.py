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
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from teams_agent import run_teams_action
from email_agent import run_email_action
from calendar_agent import run_calendar_action
from graph_client import auth_store

app = FastAPI(
    title="Pian Teams Agent",
    description="Microsoft Teams agent for Pian — handles calls and messages.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class TeamsActionRequest(BaseModel):
    """Request body for the /teams/action endpoint."""
    action: str  # "make_call", "send_message", or "schedule_meeting"
    contact: str | None = None   # For make_call / send_message
    message: str | None = None   # Message text (for send_message) or description (for meeting)

    # Meeting-specific fields
    title: str | None = None
    attendees: list[str] | None = None
    date: str | None = None      # YYYY-MM-DD
    time: str | None = None      # HH:MM
    duration: int | None = None  # minutes
    description: str | None = None

    # Additional fields that may come from the Cloud Function
    taskId: str | None = None
    userId: str | None = None
    agentId: str | None = None
    access_token: str | None = None
    refresh_token: str | None = None


class TeamsActionResponse(BaseModel):
    """Response body from the /teams/action endpoint."""
    status: str                             # "success" or "failed"
    type: str | None = None                 # "teams_call" | "teams_message" | "teams_meeting"
    # Call / Message fields
    url: str | None = None                  # msteams:// URL for call/message
    displayName: str | None = None
    email: str | None = None
    # Meeting fields
    teamsUrl: str | None = None             # https://teams.microsoft.com/l/meeting/...
    outlookUrl: str | None = None           # https://outlook.office.com/calendar/...
    title: str | None = None
    date: str | None = None
    time: str | None = None
    duration: int | None = None
    resolvedAttendees: list[dict] | None = None
    unresolvedAttendees: list[str] | None = None
    description: str | None = None
    error: str | None = None
    flow: dict | None = None


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

@app.post("/email/action")
async def email_action(data: dict):
    """Execute an Email action."""
    try:
        result = run_email_action(data)
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Agent execution failed: {str(exc)}",
        )

@app.post("/calendar/action")
async def calendar_action(data: dict):
    """Execute a Calendar action."""
    try:
        result = run_calendar_action(data)
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Agent execution failed: {str(exc)}",
        )


@app.post("/auth/poll")
def auth_poll():
    msal_app = auth_store.get("msal_app")
    flow = auth_store.get("flow")

    if not msal_app or not flow:
        raise HTTPException(status_code=400, detail="No active device flow.")

    result = msal_app.acquire_token_by_device_flow(flow, exit_condition=lambda f: True)

    if "access_token" in result:
        auth_store["token"] = result["access_token"]
        auth_store["flow"] = None
        return {"status": "authenticated"}

    error = result.get("error", "")
    if error == "authorization_pending":
        return {"status": "pending"}
    if error == "expired_token":
        auth_store["flow"] = None
        return {"status": "expired"}

    return {"status": "pending", "error": result.get("error_description", "")}

@app.get("/auth/status")
def auth_status():
    token = auth_store.get("token")
    if token:
        return {"authenticated": True}
    return {"authenticated": False}

@app.post("/auth/logout")
def auth_logout():
    auth_store["token"] = None
    auth_store["flow"] = None
    return {"status": "logged_out"}



# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8100"))
    uvicorn.run(app, host="0.0.0.0", port=port)
