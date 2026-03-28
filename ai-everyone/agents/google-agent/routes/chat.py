"""
Chat Routes
Main conversation endpoint with streaming support and agent orchestration
"""

import logging
from datetime import datetime
from typing import Any, Dict, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from db.connection import get_database
from models.schemas import ChatRequest
from services.llm_service import llm_service
from services.orchestrator import orchestrator
from utils.auth_deps import get_current_user_with_tokens

logger = logging.getLogger(__name__)
router = APIRouter()


async def get_or_create_chat(db, user_id: str, chat_id: Optional[str] = None) -> str:
    """Get existing chat or create new one."""
    if chat_id:
        try:
            chat_object_id = ObjectId(chat_id)
        except InvalidId:
            chat_object_id = None

        if chat_object_id:
            chat = await db.chats.find_one({"_id": chat_object_id, "user_id": user_id})
            if chat:
                return str(chat["_id"])

    result = await db.chats.insert_one(
        {
            "user_id": user_id,
            "title": "New Chat",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "message_count": 0,
            "pending_task": None,
            "memory_summary": "",
        }
    )
    return str(result.inserted_id)


async def get_chat_context(db, chat_id: str) -> Dict[str, Any]:
    """Get structured state stored for the chat."""
    chat = await db.chats.find_one({"_id": ObjectId(chat_id)})
    if not chat:
        return {}

    return {
        "pending_task": chat.get("pending_task"),
        "memory_summary": chat.get("memory_summary", ""),
    }


async def get_conversation_history(db, chat_id: str, limit: int = 30) -> list:
    """Get recent conversation history for context."""
    cursor = db.messages.find({"chat_id": chat_id}, sort=[("created_at", -1)], limit=limit)
    messages = await cursor.to_list(length=limit)
    messages.reverse()

    return [
        {"role": msg["role"], "content": msg["content"]}
        for msg in messages
        if msg["role"] in ["user", "assistant"]
    ]


async def save_messages(
    db,
    chat_id: str,
    user_message: str,
    assistant_response: str,
    assistant_metadata: Optional[Dict[str, Any]] = None,
):
    """Save user and assistant messages to MongoDB."""
    now = datetime.utcnow()
    assistant_doc: Dict[str, Any] = {
        "chat_id": chat_id,
        "role": "assistant",
        "content": assistant_response,
        "created_at": now,
    }
    if assistant_metadata:
        assistant_doc["metadata"] = assistant_metadata

    await db.messages.insert_many(
        [
            {
                "chat_id": chat_id,
                "role": "user",
                "content": user_message,
                "created_at": now,
            },
            assistant_doc,
        ]
    )

    update_doc: Dict[str, Any] = {
        "$inc": {"message_count": 2},
        "$set": {"updated_at": now},
    }
    if assistant_metadata and "pending_task" in assistant_metadata:
        update_doc["$set"]["pending_task"] = assistant_metadata["pending_task"]
    elif assistant_metadata and assistant_metadata.get("clear_pending_task"):
        update_doc["$set"]["pending_task"] = None

    await db.chats.update_one({"_id": ObjectId(chat_id)}, update_doc)


async def update_chat_title(db, chat_id: str, user_message: str):
    """Auto-generate chat title from first message."""
    chat = await db.chats.find_one({"_id": ObjectId(chat_id)})
    if chat and chat.get("title") == "New Chat":
        title = user_message[:50].strip()
        if len(user_message) > 50:
            title += "..."
        await db.chats.update_one({"_id": ObjectId(chat_id)}, {"$set": {"title": title}})


def build_assistant_metadata(result: Dict[str, Any]) -> Dict[str, Any]:
    """Build message metadata from orchestrator results."""
    metadata: Dict[str, Any] = {"mode": result.get("mode", "direct")}
    if result.get("pending_task"):
        metadata["pending_task"] = result["pending_task"]
    if result.get("clear_pending_task"):
        metadata["clear_pending_task"] = True
    return metadata


@router.post("/")
async def chat(request: ChatRequest, current_user: dict = Depends(get_current_user_with_tokens)):
    """
    Main chat endpoint.
    Analyzes intent, routes to agents or direct LLM, returns response.
    """
    db = get_database()
    user_id = current_user["google_id"]
    access_token = current_user.get("access_token", "")
    refresh_token = current_user.get("refresh_token", "")

    chat_id = await get_or_create_chat(db, user_id, request.chat_id)
    history = await get_conversation_history(db, chat_id, limit=request.context_window)
    chat_context = await get_chat_context(db, chat_id)

    try:
        pending_task = chat_context.get("pending_task")
        normalized_message = request.message.strip().lower()
        if pending_task and normalized_message in {"cancel", "cancel it", "never mind", "nevermind", "stop"}:
            response_text = f"Okay, I canceled the pending {pending_task.get('agent', 'assistant')} request for this chat."
            assistant_metadata = {"clear_pending_task": True, "mode": "agent"}
            await save_messages(
                db,
                chat_id,
                request.message,
                response_text,
                assistant_metadata=assistant_metadata,
            )
            await update_chat_title(db, chat_id, request.message)
            return {
                "chat_id": chat_id,
                "response": response_text,
                "agent_logs": [],
                "execution_steps": ["Canceled pending task"],
                "mode": "agent",
                "intent": {
                    "mode": "agent",
                    "agents_required": [pending_task.get("agent")],
                    "primary_intent": "Cancel pending task",
                    "sub_tasks": [],
                    "confidence": 1.0,
                },
            }

        intent = await orchestrator.analyze_intent(
            request.message,
            history,
            chat_context=chat_context,
        )
        logger.info(f"Intent: {intent}")

        result = await orchestrator.execute(
            user_message=request.message,
            intent=intent,
            user_id=user_id,
            chat_id=chat_id,
            access_token=access_token,
            refresh_token=refresh_token,
            conversation_history=history,
            llm_provider=request.llm_provider or "ollama",
            chat_context=chat_context,
        )

        response_text = result["response"]
        assistant_metadata = build_assistant_metadata(result)

        await save_messages(
            db,
            chat_id,
            request.message,
            response_text,
            assistant_metadata=assistant_metadata,
        )
        await update_chat_title(db, chat_id, request.message)

        if result.get("agent_logs"):
            await db.agent_logs.insert_many(
                [
                    {
                        "user_id": user_id,
                        "chat_id": chat_id,
                        "agent": log.get("agent"),
                        "status": log.get("status"),
                        "summary": log.get("summary", ""),
                        "created_at": datetime.utcnow(),
                    }
                    for log in result["agent_logs"]
                ]
            )

        return {
            "chat_id": chat_id,
            "response": response_text,
            "agent_logs": result.get("agent_logs", []),
            "execution_steps": result.get("execution_steps", []),
            "mode": result.get("mode", "direct"),
            "intent": intent,
        }

    except Exception as exc:
        logger.error(f"Chat error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {exc}")


@router.post("/stream")
async def chat_stream(request: ChatRequest, current_user: dict = Depends(get_current_user_with_tokens)):
    """Streaming chat endpoint."""
    db = get_database()
    user_id = current_user["google_id"]
    chat_id = await get_or_create_chat(db, user_id, request.chat_id)
    history = await get_conversation_history(db, chat_id, limit=request.context_window)

    async def generate():
        full_response = ""
        async for token in llm_service.stream(
            messages=history + [{"role": "user", "content": request.message}],
            provider=request.llm_provider or "ollama",
        ):
            full_response += token
            yield f"data: {token}\n\n"

        await save_messages(db, chat_id, request.message, full_response)
        await update_chat_title(db, chat_id, request.message)
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
