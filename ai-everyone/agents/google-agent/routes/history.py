"""
History Routes - Chat history management
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId
from datetime import datetime
from utils.auth_deps import get_current_user
from db.connection import get_database

logger = logging.getLogger(__name__)
router = APIRouter()


def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict."""
    if doc is None:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("/chats")
async def get_chats(
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get all chats for the current user."""
    db = get_database()
    cursor = db.chats.find(
        {"user_id": current_user["google_id"]},
        sort=[("updated_at", -1)],
        limit=limit
    )
    chats = await cursor.to_list(length=limit)
    return {"chats": [serialize_doc(c) for c in chats]}


@router.get("/chats/{chat_id}/messages")
async def get_chat_messages(
    chat_id: str,
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user)
):
    """Get messages for a specific chat."""
    db = get_database()

    # Verify chat belongs to user
    chat = await db.chats.find_one({
        "_id": ObjectId(chat_id),
        "user_id": current_user["google_id"]
    })
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    cursor = db.messages.find(
        {"chat_id": chat_id},
        sort=[("created_at", 1)],
        limit=limit
    )
    messages = await cursor.to_list(length=limit)
    return {
        "chat": serialize_doc(chat),
        "messages": [serialize_doc(m) for m in messages]
    }


@router.delete("/chats/{chat_id}")
async def delete_chat(
    chat_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a chat and all its messages."""
    db = get_database()
    result = await db.chats.delete_one({
        "_id": ObjectId(chat_id),
        "user_id": current_user["google_id"]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Chat not found")

    await db.messages.delete_many({"chat_id": chat_id})
    return {"message": "Chat deleted"}


@router.get("/search")
async def search_chats(
    q: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user)
):
    """Full-text search across chat titles and messages."""
    db = get_database()
    user_id = current_user["google_id"]

    # Search in chat titles
    title_cursor = db.chats.find(
        {
            "user_id": user_id,
            "title": {"$regex": q, "$options": "i"}
        },
        limit=10
    )
    title_results = await title_cursor.to_list(length=10)

    # Search in message content
    msg_cursor = db.messages.find(
        {"content": {"$regex": q, "$options": "i"}},
        limit=20
    )
    msg_results = await msg_cursor.to_list(length=20)

    # Get unique chat IDs from messages
    msg_chat_ids = list(set([m["chat_id"] for m in msg_results]))
    matched_chats = []
    for cid in msg_chat_ids[:10]:
        chat = await db.chats.find_one({"_id": ObjectId(cid), "user_id": user_id})
        if chat:
            matched_chats.append(serialize_doc(chat))

    all_chats = [serialize_doc(c) for c in title_results] + matched_chats
    # Deduplicate
    seen = set()
    unique_chats = []
    for c in all_chats:
        if c["id"] not in seen:
            seen.add(c["id"])
            unique_chats.append(c)

    return {"results": unique_chats, "query": q}
