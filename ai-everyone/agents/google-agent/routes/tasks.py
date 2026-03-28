"""
Tasks Routes - Personal tasks/notes CRUD
"""

import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId
from models.schemas import TaskCreate, TaskUpdate, TaskResponse
from utils.auth_deps import get_current_user
from db.connection import get_database

logger = logging.getLogger(__name__)
router = APIRouter()


def serialize_task(task):
    task["id"] = str(task.pop("_id"))
    return task


@router.post("/", response_model=dict)
async def create_task(
    task: TaskCreate,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    now = datetime.utcnow()
    doc = {
        "user_id": current_user["google_id"],
        "title": task.title,
        "description": task.description,
        "status": "pending",
        "due_date": task.due_date,
        "priority": task.priority,
        "tags": task.tags,
        "created_at": now,
        "updated_at": now
    }
    result = await db.tasks.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return {"task": doc}


@router.get("/")
async def get_tasks(
    status: str = Query(None),
    priority: str = Query(None),
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    query = {"user_id": current_user["google_id"]}
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority

    cursor = db.tasks.find(query, sort=[("created_at", -1)], limit=50)
    tasks = await cursor.to_list(length=50)
    return {"tasks": [serialize_task(t) for t in tasks]}


@router.patch("/{task_id}")
async def update_task(
    task_id: str,
    update: TaskUpdate,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()

    result = await db.tasks.find_one_and_update(
        {"_id": ObjectId(task_id), "user_id": current_user["google_id"]},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"task": serialize_task(result)}


@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    result = await db.tasks.delete_one({
        "_id": ObjectId(task_id),
        "user_id": current_user["google_id"]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted"}
