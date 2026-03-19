"""
api/server.py — FastAPI REST API for the Todo AI Agent.
Mapped to executeAgentTask via POST /todo/action
"""
from __future__ import annotations

import logging
import os
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from db.firestore import (
    add_task, delete_task, get_tasks,
    mark_done, update_task, get_tasks_by_date
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Todo AI Agent API",
    description="AI-powered task manager for SnitchX.",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic schemas ───────────────────────────────────────────────────────────

class AgentTaskRequest(BaseModel):
    taskId: str
    userId: str
    agentId: str
    action: str
    # Parameters that the Next.js parent LLM will extract:
    title: str | None = None
    datetime: str | None = None
    task_id: str | None = None
    status: str | None = None

class AgentTaskResponse(BaseModel):
    status: str
    type: str | None = None
    error: str | None = None
    message: str | None = None
    tasks: list[dict] | None = None
    displayName: str | None = None

# ── Routes ─────────────────────────────────────────────────────────────────────

@app.post("/todo/action", response_model=AgentTaskResponse)
def execute_todo_action(req: AgentTaskRequest) -> AgentTaskResponse:
    user_id = req.userId
    action = req.action

    try:
        if action == "add_task":
            if not req.title:
                return AgentTaskResponse(status="failed", error="Title is required")
            
            task_dict = {"title": req.title}
            if req.datetime:
                task_dict["datetime"] = req.datetime
                
            tid = add_task(user_id, task_dict)
            return AgentTaskResponse(
                status="success", 
                type="todo_action",
                message=f"Added task: {req.title}",
                displayName=req.title
            )
            
        elif action == "list_tasks":
            # The parent LLM might ask to list pending tasks or all tasks
            tasks = get_tasks(user_id, status=req.status)
            return AgentTaskResponse(
                status="success", 
                type="todo_list",
                tasks=tasks,
                message=f"Found {len(tasks)} tasks.",
                displayName="View Tasks"
            )

        elif action == "list_tasks_by_date":
            if not req.datetime:
                return AgentTaskResponse(status="failed", error="Date string is required in YYYY-MM-DD format")
            tasks = get_tasks_by_date(user_id, req.datetime)
            return AgentTaskResponse(
                status="success", 
                type="todo_list",
                tasks=tasks,
                message=f"Found {len(tasks)} tasks for {req.datetime}.",
                displayName=f"Tasks for {req.datetime}"
            )
            
        elif action == "delete_task":
            tid = req.task_id
            if not tid and req.title:
                all_t = get_tasks(user_id)
                found = [t for t in all_t if (t.get('title') or '').lower() == req.title.lower() or req.title.lower() in (t.get('title') or '').lower()]
                if len(found) == 1:
                    tid = found[0]["_id"]
                elif len(found) > 1:
                    return AgentTaskResponse(status="failed", error="Multiple tasks match that title. Please clarify.")

            if not tid:
                return AgentTaskResponse(status="failed", error="Could not find a unique task to delete.")
                
            ok = delete_task(user_id, tid)
            if ok:
                return AgentTaskResponse(status="success", type="todo_action", message="Task deleted", displayName="Deleted Task")
            return AgentTaskResponse(status="failed", error="Task not found or permission denied")
            
        elif action == "mark_done":
            tid = req.task_id
            if not tid and req.title:
                all_t = get_tasks(user_id, status="pending")
                found = [t for t in all_t if (t.get('title') or '').lower() == req.title.lower() or req.title.lower() in (t.get('title') or '').lower()]
                if len(found) == 1:
                    tid = found[0]["_id"]
                elif len(found) > 1:
                    return AgentTaskResponse(status="failed", error="Multiple tasks match that title. Please clarify.")

            if not tid:
                return AgentTaskResponse(status="failed", error="Could not find a unique pending task to complete.")
                
            ok = mark_done(user_id, tid)
            if ok:
                return AgentTaskResponse(status="success", type="todo_action", message="Task marked as complete", displayName="Completed Task")
            return AgentTaskResponse(status="failed", error="Task not found or permission denied")
            
        else:
            return AgentTaskResponse(status="failed", error=f"Unknown action: {action}")
            
    except Exception as e:
        logger.exception("Error executing todo action")
        return AgentTaskResponse(status="failed", error=str(e))

@app.get("/health", tags=["System"])
def health():
    return {
        "status": "healthy",
        "agent": "todo-agent"
    }
