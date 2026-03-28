"""
Agent Routes - Direct agent execution endpoint
"""

import logging
import time

from fastapi import APIRouter, Depends, HTTPException

from models.schemas import AgentRunRequest, AgentRunResponse
from utils.auth_deps import get_current_user_with_tokens

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/run", response_model=AgentRunResponse)
async def run_agent(
    request: AgentRunRequest,
    current_user: dict = Depends(get_current_user_with_tokens),
):
    """Directly run a specific agent with action and parameters."""
    from agents.calendar_agent import CalendarAgent
    from agents.calling_agent import CallingAgent
    from agents.contacts_agent import ContactsAgent
    from agents.drive_agent import DriveAgent
    from agents.gmail_agent import GmailAgent
    from agents.meet_agent import MeetAgent
    from agents.notes_agent import NotesAgent
    from agents.tasks_agent import TasksAgent
    from agents.web_search_agent import WebSearchAgent

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

    agent_key = request.agent_type.value if hasattr(request.agent_type, "value") else request.agent_type
    agent_class = agent_map.get(agent_key)
    if not agent_class:
        raise HTTPException(status_code=400, detail=f"Unknown agent: {request.agent_type}")

    start = time.time()
    agent = agent_class(
        access_token=current_user.get("access_token", ""),
        user_id=current_user["google_id"],
        refresh_token=current_user.get("refresh_token", ""),
    )

    result = await agent.handle(
        user_message=f"{request.action} {request.parameters}",
        context={"direct": True},
    )

    return AgentRunResponse(
        agent_type=request.agent_type,
        action=request.action,
        status=result.get("status", "unknown"),
        result=result.get("data"),
        execution_time_ms=(time.time() - start) * 1000,
        error=result.get("error"),
    )


@router.get("/list")
async def list_agents():
    """List all available agents and their capabilities."""
    return {
        "agents": [
            {"name": "calendar", "description": "Google Calendar - create, list, update, delete events"},
            {"name": "gmail", "description": "Gmail - send, draft, reply, summarize emails"},
            {"name": "meet", "description": "Google Meet - schedule meetings, generate links"},
            {"name": "contacts", "description": "Google Contacts - search and retrieve contacts"},
            {"name": "calling", "description": "Phone calls via Twilio"},
            {"name": "drive", "description": "Google Drive - list, search, upload, and read files"},
            {"name": "web_search", "description": "Real-time web search via DuckDuckGo"},
            {"name": "notes", "description": "Personal notes stored locally in MongoDB"},
            {"name": "tasks", "description": "Google Tasks - create, list, and complete tasks"},
            {"name": "task_planner", "description": "Multi-step task decomposition and planning"},
        ]
    }

