"""
Base Agent Class
All agents inherit from this, providing common functionality
"""

import asyncio
import json
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

import httpx

from services.google_auth_service import (
    AUTH_REQUIRED_MESSAGE,
    GoogleAuthRequiredError,
    google_auth_service,
)
from services.llm_service import llm_service

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """
    Abstract base class for all agents.
    Provides common LLM extraction, error handling, and logging.
    """

    def __init__(self, access_token: str, user_id: str, refresh_token: str = ""):
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.user_id = user_id
        self.agent_name = self.__class__.__name__

    @abstractmethod
    async def handle(self, user_message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle a user request. Must be implemented by all agents.

        Returns:
            {status, summary, data, agent}
        """

    async def extract_parameters(
        self,
        user_message: str,
        schema_description: str,
        example_output: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Use LLM to extract structured parameters from natural language.
        """
        prompt_sections = ["Extract the following parameters from the user's message."]

        if context:
            pending_task = context.get("pending_task")
            if pending_task:
                prompt_sections.append(
                    "Pending task context:\n"
                    + json.dumps(pending_task, indent=2, ensure_ascii=True, default=str)
                )

            memory_summary = context.get("memory_summary")
            if memory_summary:
                prompt_sections.append(f"Chat memory summary:\n{memory_summary}")

            history = context.get("conversation_history", [])[-8:]
            if history:
                formatted_history = "\n".join(
                    f"- {msg.get('role', 'unknown')}: {msg.get('content', '')[:400]}"
                    for msg in history
                )
                prompt_sections.append(f"Recent conversation history:\n{formatted_history}")

            agent_outputs = context.get("agent_outputs") or pending_task.get("agent_outputs") if pending_task else context.get("agent_outputs")
            if agent_outputs:
                prompt_sections.append(
                    "Agent observations:\n"
                    + json.dumps(agent_outputs, indent=2, ensure_ascii=True, default=str)
                )

        prompt_sections.append(f'User message: "{user_message}"')
        prompt_sections.append(
            f"""Extract: {schema_description}

Return ONLY valid JSON in this format:
{example_output}

If a value is not mentioned, use null.
If the current message is continuing a pending request, merge it with the pending context."""
        )

        prompt = "\n\n".join(prompt_sections)

        return await llm_service.complete_json(
            messages=[{"role": "user", "content": prompt}]
        )

    def success(self, summary: str, data: Any = None) -> Dict[str, Any]:
        """Return a success response."""
        logger.info("? Success [%s] %s", self.agent_name, summary)
        return {
            "status": "success",
            "agent": self.agent_name,
            "summary": summary,
            "data": data,
        }

    def failure(
        self,
        error: str,
        data: Any = None,
        message: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Return a failure response."""
        summary = message or error
        logger.error("[%s] Error: %s", self.agent_name, summary)
        return {
            "status": "error",
            "agent": self.agent_name,
            "summary": summary,
            "error": error,
            "message": summary,
            "data": data,
        }

    def auth_required(self, data: Any = None) -> Dict[str, Any]:
        """Return a structured auth-required response."""
        logger.error("?? Auth Error [%s] %s", self.agent_name, AUTH_REQUIRED_MESSAGE)
        return self.failure(
            error="AUTH_REQUIRED",
            message=AUTH_REQUIRED_MESSAGE,
            data=data,
        )

    async def refresh_google_access_token(self) -> bool:
        """Refresh the Google access token and persist it if possible."""
        try:
            token_data = await google_auth_service.ensure_valid_tokens(
                user_id=self.user_id,
                access_token=self.access_token,
                refresh_token=self.refresh_token,
                force_refresh=True,
            )
        except GoogleAuthRequiredError:
            return False

        self.access_token = token_data["access_token"]
        if token_data.get("refresh_token"):
            self.refresh_token = token_data["refresh_token"]
        return True

    async def request_google_api(
        self,
        method: str,
        url: str,
        retry_on_failure: bool = False,
        **kwargs,
    ) -> httpx.Response:
        """Send a Google API request with token refresh and optional safe retry."""
        extra_headers = kwargs.pop("headers", {})
        max_attempts = 2 if retry_on_failure else 1

        for attempt in range(1, max_attempts + 1):
            headers = await google_auth_service.get_auth_headers(
                user_id=self.user_id,
                access_token=self.access_token,
                refresh_token=self.refresh_token,
                extra_headers=extra_headers,
            )
            self.access_token = headers["Authorization"].replace("Bearer ", "", 1)

            logger.info(
                "?? Google API Call [%s] %s (attempt %s)",
                method.upper(),
                url,
                attempt,
            )

            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.request(method, url, headers=headers, **kwargs)
            except httpx.RequestError:
                if attempt >= max_attempts:
                    raise
                await asyncio.sleep(0.4)
                continue

            if response.status_code == 401:
                logger.warning(
                    "?? Auth Error [%s] %s returned 401, attempting refresh",
                    method.upper(),
                    url,
                )
                refreshed = await google_auth_service.ensure_valid_tokens(
                    user_id=self.user_id,
                    access_token=self.access_token,
                    refresh_token=self.refresh_token,
                    force_refresh=True,
                )
                self.access_token = refreshed["access_token"]
                self.refresh_token = refreshed.get("refresh_token") or self.refresh_token

                retry_headers = {**extra_headers, "Authorization": f"Bearer {self.access_token}"}
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.request(method, url, headers=retry_headers, **kwargs)

                if response.status_code == 401:
                    logger.warning("?? Auth Error [%s] refresh retry also failed", self.agent_name)
                    raise GoogleAuthRequiredError()
                return response

            if retry_on_failure and response.status_code in {429, 500, 502, 503, 504} and attempt < max_attempts:
                await asyncio.sleep(0.4)
                continue

            return response

        raise RuntimeError(f"{self.agent_name} could not complete Google API request")

    def format_google_api_error(self, service_name: str, response: httpx.Response) -> str:
        """Create a readable Google API error message from a response."""
        detail = f"{service_name} API error: {response.status_code}"

        try:
            payload = response.json()
        except ValueError:
            payload = None

        if isinstance(payload, dict):
            error_data = payload.get("error")
            if isinstance(error_data, dict):
                message = error_data.get("message") or error_data.get("status")
                if message:
                    detail += f" - {message}"
            elif isinstance(error_data, str):
                detail += f" - {error_data}"
        else:
            raw_text = response.text.strip()
            if raw_text:
                detail += f" - {raw_text[:300]}"

        if response.status_code == 401:
            detail += ". Please reconnect your Google account if this keeps happening."

        return detail

    def handle_google_exception(
        self,
        service_name: str,
        exc: Exception,
        data: Any = None,
    ) -> Dict[str, Any]:
        """Map Google request exceptions to structured agent responses."""
        if isinstance(exc, GoogleAuthRequiredError):
            return self.auth_required(data=data)
        return self.failure(f"{service_name} request failed: {exc}", data=data)

    def handle_google_api_error(
        self,
        service_name: str,
        response: httpx.Response,
        data: Any = None,
    ) -> Dict[str, Any]:
        """Map Google API responses to structured errors."""
        if response.status_code == 401:
            return self.auth_required(data=data)
        return self.failure(self.format_google_api_error(service_name, response), data=data)

    def get_auth_headers(self) -> Dict[str, str]:
        """Get Google API authorization headers."""
        return {"Authorization": f"Bearer {self.access_token}"}

