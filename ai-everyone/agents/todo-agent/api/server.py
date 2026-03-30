"""
api/server.py — FastAPI REST API for the Todo AI Agent.
Mapped to executeAgentTask via POST /todo/action
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from db.firestore import (
    add_task, delete_task, get_tasks,
    get_tasks_by_date, get_tasks_in_range, mark_done
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
    date: str | None = None
    time: str | None = None
    description: str | None = None
    priority: str | None = None
    duration: int | None = None
    startDate: str | None = None
    task_id: str | None = None
    status: str | None = None

class AgentTaskResponse(BaseModel):
    status: str
    type: str | None = None
    error: str | None = None
    message: str | None = None
    tasks: list[dict] | None = None
    days: list[dict] | None = None
    displayName: str | None = None


def _today_iso() -> str:
    return datetime.utcnow().date().isoformat()


def _week_start_iso(start_date: str | None = None) -> str:
    if start_date:
        return start_date
    today = datetime.utcnow().date()
    monday = today - timedelta(days=today.weekday())
    return monday.isoformat()


def _combine_datetime(date_value: str | None, time_value: str | None, fallback: str | None) -> str:
    if fallback:
        return fallback
    if date_value and time_value:
        return f"{date_value} {time_value}"
    return date_value or ""

# ── Routes ─────────────────────────────────────────────────────────────────────

@app.post("/todo/action", response_model=AgentTaskResponse)
def execute_todo_action(req: AgentTaskRequest) -> AgentTaskResponse:
    user_id = req.userId
    action = req.action

    try:
        if action == "add_task":
            if not req.title:
                return AgentTaskResponse(status="failed", error="Title is required")
            
            task_dict = {
                "title": req.title,
                "description": req.description or "",
                "priority": req.priority or "normal",
                "duration": req.duration or 30,
            }
            task_datetime = _combine_datetime(req.date, req.time, req.datetime)
            if task_datetime:
                task_dict["datetime"] = task_datetime
                
            add_task(user_id, task_dict)
            return AgentTaskResponse(
                status="success", 
                type="todo_action",
                message=f"Added task: {req.title}",
                displayName=req.title
            )

        elif action == "add_to_plan":
            if not req.title:
                return AgentTaskResponse(status="failed", error="Title is required")

            planned_date = req.date or _today_iso()
            task_dict = {
                "title": req.title,
                "description": req.description or "",
                "priority": req.priority or "normal",
                "duration": req.duration or 30,
                "datetime": _combine_datetime(planned_date, req.time, req.datetime) or planned_date,
            }
            add_task(user_id, task_dict)
            return AgentTaskResponse(
                status="success",
                type="todo_action",
                message=f"Added '{req.title}' to your plan for {planned_date}.",
                displayName=req.title,
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
            date_string = req.datetime or req.date
            if not date_string:
                return AgentTaskResponse(status="failed", error="Date string is required in YYYY-MM-DD format")
            tasks = get_tasks_by_date(user_id, date_string)
            return AgentTaskResponse(
                status="success", 
                type="todo_list",
                tasks=tasks,
                message=f"Found {len(tasks)} tasks for {date_string}.",
                displayName=f"Tasks for {date_string}"
            )

        elif action == "get_daily_plan":
            date_string = req.date or req.datetime or _today_iso()
            tasks = get_tasks_by_date(user_id, date_string)
            return AgentTaskResponse(
                status="success",
                type="todo_list",
                tasks=tasks,
                message=f"You have {len(tasks)} item(s) planned for {date_string}.",
                displayName=f"Plan for {date_string}",
            )

        elif action == "get_weekly_overview":
            week_start = _week_start_iso(req.startDate)
            start_day = datetime.fromisoformat(week_start)
            end_day = (start_day + timedelta(days=6)).date().isoformat()
            tasks = get_tasks_in_range(user_id, week_start, end_day)

            days = []
            for offset in range(7):
                current = (start_day + timedelta(days=offset)).date().isoformat()
                current_tasks = [task for task in tasks if str(task.get("datetime", "")).startswith(current)]
                days.append({
                    "date": current,
                    "count": len(current_tasks),
                    "items": current_tasks,
                })

            total_items = sum(day["count"] for day in days)
            return AgentTaskResponse(
                status="success",
                type="todo_week",
                days=days,
                message=f"You have {total_items} planned item(s) for the week starting {week_start}.",
                displayName="Weekly Plan",
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
