"""
Notes Agent - Personal notes stored locally in MongoDB
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any

from agents.base_agent import BaseAgent
from db.connection import get_database

logger = logging.getLogger(__name__)


class NotesAgent(BaseAgent):
    async def handle(self, user_message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        action = await self._determine_action(user_message, context)
        logger.info("[notes] action: %s", action)

        if action == "create":
            return await self.create_note(user_message, context)
        if action == "delete":
            return await self.delete_note(user_message, context)
        return await self.list_notes()

    async def _determine_action(self, msg: str, context: Dict[str, Any]) -> str:
        params = await self.extract_parameters(
            user_message=msg,
            schema_description='action: one of "create", "list", "delete"',
            example_output='{"action": "create"}',
            context=context,
        )
        return params.get("action", "list")

    async def create_note(self, user_message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        params = await self.extract_parameters(
            user_message=user_message,
            schema_description="""
- title: note title
- content: note content or note details
            """,
            example_output='''{
  "title": "Project ideas",
  "content": "Explore a local-first assistant workflow"
}''',
            context=context,
        )

        title = (params.get("title") or "").strip()
        content = (params.get("content") or "").strip()

        if not title and not content:
            return self.failure(
                error="VALIDATION_ERROR",
                message="Please tell me what note to create.",
            )

        if not title:
            title = self._derive_title(content or user_message)
        if not content:
            content = title

        now = datetime.utcnow()
        note = {
            "user_id": self.user_id,
            "title": title,
            "content": content,
            "created_at": now,
            "updated_at": now,
        }

        try:
            logger.info("?? Creating note in MongoDB")
            result = await self._run_db_operation(
                "create note",
                lambda: get_database().notes.insert_one(note),
            )
            return self.success(
                summary=f"Created note '{title}'",
                data={"note_id": str(result.inserted_id), "note": self._serialize_note(note)},
            )
        except Exception:
            return self._db_error_response()

    async def list_notes(self) -> Dict[str, Any]:
        try:
            logger.info("?? Fetching notes")
            notes = await self._run_db_operation(
                "list notes",
                self._fetch_notes,
                retry_on_failure=True,
            )
            if not notes:
                return self.success(summary="No notes found.", data={"notes": []})

            summary_lines = []
            serialized_notes = []
            for note in notes:
                serialized = self._serialize_note(note)
                serialized_notes.append(serialized)
                summary_lines.append(
                    f"- {serialized['title']}: {self._preview_content(serialized.get('content', ''))}"
                )

            return self.success(
                summary="Your notes:\n" + "\n".join(summary_lines),
                data={"notes": serialized_notes},
            )
        except Exception:
            return self._db_error_response()

    async def delete_note(self, user_message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        params = await self.extract_parameters(
            user_message=user_message,
            schema_description='title: title or partial title of the note to delete',
            example_output='{"title": "Old note"}',
            context=context,
        )
        title = (params.get("title") or "").strip()
        if not title:
            return self.failure(
                error="VALIDATION_ERROR",
                message="Please tell me which note to delete.",
            )

        try:
            result = await self._run_db_operation(
                "delete note",
                lambda: get_database().notes.delete_one(
                    {"user_id": self.user_id, "title": {"$regex": title, "$options": "i"}}
                ),
                retry_on_failure=True,
            )
            if result.deleted_count:
                return self.success(summary=f"Deleted note '{title}'")
            return self.success(summary=f"No note found matching '{title}'", data={"deleted": False})
        except Exception:
            return self._db_error_response()

    async def _fetch_notes(self):
        cursor = get_database().notes.find(
            {"user_id": self.user_id},
            sort=[("updated_at", -1), ("created_at", -1)],
            limit=20,
        )
        return await cursor.to_list(length=20)

    async def _run_db_operation(self, label: str, operation, retry_on_failure: bool = False):
        attempts = 2 if retry_on_failure else 1
        last_error = None

        for attempt in range(1, attempts + 1):
            try:
                return await operation()
            except Exception as exc:
                last_error = exc
                logger.error("?? MongoDB error during %s (attempt %s): %s", label, attempt, exc)
                if attempt < attempts:
                    await asyncio.sleep(0.2)

        raise last_error

    def _db_error_response(self) -> Dict[str, Any]:
        logger.error("?? MongoDB error")
        return self.failure(
            error="DB_ERROR",
            message="Failed to process note operation",
        )

    def _serialize_note(self, note: Dict[str, Any]) -> Dict[str, Any]:
        serialized = dict(note)
        if "_id" in serialized:
            serialized["_id"] = str(serialized["_id"])
        return serialized

    def _preview_content(self, content: str) -> str:
        cleaned = (content or "").strip()
        if len(cleaned) <= 60:
            return cleaned or "No content"
        return cleaned[:57] + "..."

    def _derive_title(self, text: str) -> str:
        cleaned = " ".join((text or "").strip().split())
        if not cleaned:
            return "Untitled Note"
        return " ".join(cleaned.split()[:8])[:80]
