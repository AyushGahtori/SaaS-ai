"""
FastAPI server for the Google Agent.

Exposes a POST /google/action endpoint that receives task data
from the Firebase Cloud Function or Next.js local orchestrator.

Run with:
    python server.py (or uvicorn server:app --host 0.0.0.0 --port 8300)
"""

import os
import logging
import time
from pathlib import Path
from contextlib import asynccontextmanager

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Database
from db.connection import connect_to_mongo, close_mongo_connection

# Agents
from agents.calendar_agent import CalendarAgent
from agents.gmail_agent import GmailAgent
from agents.meet_agent import MeetAgent
from agents.contacts_agent import ContactsAgent
from agents.drive_agent import DriveAgent
from agents.calling_agent import CallingAgent
from agents.web_search_agent import WebSearchAgent
from agents.notes_agent import NotesAgent
from agents.tasks_agent import TasksAgent

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    logger.info("🚀 Starting Google Workspace Agent...")
    await connect_to_mongo()
    yield
    logger.info("🛑 Shutting down Google Workspace Agent...")
    await close_mongo_connection()

app = FastAPI(
    title="SnitchX Google Workspace Agent",
    description="Agent for Google Services (Gmail, Calendar, Meet, Tasks, Drive)",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GoogleActionRequest(BaseModel):
    """Request body from SnitchX Orchestrator."""
    agent_type: str  # "gmail", "calendar", "meet", "tasks", "drive", "web_search", "notes", "contacts"
    action: str
    parameters: str | None = None
    
    # Optional fields from Orchestrator task execution
    taskId: str | None = None
    userId: str | None = None
    agentId: str | None = None


class GoogleActionResponse(BaseModel):
    status: str
    type: str | None = None
    agent_type: str | None = None
    action: str | None = None
    result: dict | str | list | None = None
    error: str | None = None
    execution_time_ms: float | None = None


@app.get("/health")
async def health_check():
    return {"status": "healthy", "agent": "google-agent", "version": "1.0.0"}


@app.post("/google/action", response_model=GoogleActionResponse)
async def google_action(data: GoogleActionRequest):
    """
    Execute a Google agent action.
    """
    agent_map = {
        "calendar": CalendarAgent,
        "gmail": GmailAgent,
        "meet": MeetAgent,
        "contacts": ContactsAgent,
        "drive": DriveAgent,
        "calling": CallingAgent,
        "web_search": WebSearchAgent,
        "notes": NotesAgent,
        "tasks": TasksAgent,
    }

    agent_class = agent_map.get(data.agent_type.lower() if data.agent_type else "")
    if not agent_class:
        raise HTTPException(status_code=400, detail=f"Unknown or missing agent_type: {data.agent_type}")

    start = time.time()
    
    # In a real deployed environment, these tokens would be dynamically fetched from the DB via the user_id attached.
    # We pass empty for now, assuming the agent implements an internal fallback or default config.
    try:
        agent = agent_class(
            access_token="",
            user_id=data.userId or "default_user",
            refresh_token="",
        )

        user_message = f"{data.action} {data.parameters or ''}"
        
        result = await agent.handle(
            user_message=user_message,
            context={"direct": True, "taskId": data.taskId},
        )
        
        return GoogleActionResponse(
            status=result.get("status", "success"),
            type=f"google_{data.agent_type}",
            agent_type=data.agent_type,
            action=data.action,
            result=result.get("data", result),
            execution_time_ms=(time.time() - start) * 1000,
            error=result.get("error")
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Google Agent execution failed: {str(exc)}",
        )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8300"))
    uvicorn.run(app, host="0.0.0.0", port=port)
