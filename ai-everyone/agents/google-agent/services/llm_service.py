"""
Unified LLM Service
Supports Ollama, OpenAI, and Google Gemini with dynamic switching
"""

import json
import logging
import os
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


class LLMService:
    """Unified LLM service that abstracts over multiple providers."""

    def __init__(self):
        self.default_provider = os.getenv("LLM_PROVIDER", "ollama")
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.ollama_model = os.getenv("OLLAMA_MODEL", "qwen3:8b")
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "")
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    async def complete(
        self,
        messages: List[Dict[str, str]],
        provider: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        system_prompt: Optional[str] = None,
        tools: Optional[List[Dict]] = None,
        json_mode: bool = False,
    ) -> str:
        provider = provider or self.default_provider
        if system_prompt:
            messages = [{"role": "system", "content": system_prompt}] + messages

        logger.info("?? LLM request via provider: %s", provider)

        if provider == "ollama":
            return await self._complete_ollama(messages, temperature, max_tokens, json_mode)
        if provider == "openai":
            return await self._complete_openai(messages, temperature, max_tokens, tools)
        if provider == "gemini":
            return await self._complete_gemini(messages, temperature, max_tokens)

        logger.warning("Unknown provider '%s', falling back to ollama", provider)
        return await self._complete_ollama(messages, temperature, max_tokens, json_mode)

    async def stream(
        self,
        messages: List[Dict[str, str]],
        provider: Optional[str] = None,
        temperature: float = 0.7,
        system_prompt: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        provider = provider or self.default_provider
        if system_prompt:
            messages = [{"role": "system", "content": system_prompt}] + messages

        if provider == "ollama":
            async for token in self._stream_ollama(messages, temperature):
                yield token
        elif provider == "openai":
            async for token in self._stream_openai(messages, temperature):
                yield token
        else:
            response = await self.complete(messages, provider, temperature)
            yield response

    async def _complete_ollama(
        self,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
        json_mode: bool = False,
    ) -> str:
        payload: Dict[str, Any] = {
            "model": self.ollama_model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }
        if json_mode:
            payload["format"] = "json"

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(f"{self.ollama_base_url}/api/chat", json=payload)
                response.raise_for_status()
                data = response.json()
                return data.get("message", {}).get("content", "")
        except Exception as exc:
            logger.error("Ollama error: %s", exc)
            return f"[LLM Error] Could not get response from Ollama: {exc}"

    async def _stream_ollama(
        self,
        messages: List[Dict[str, str]],
        temperature: float,
    ) -> AsyncGenerator[str, None]:
        payload = {
            "model": self.ollama_model,
            "messages": messages,
            "stream": True,
            "options": {"temperature": temperature},
        }
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream("POST", f"{self.ollama_base_url}/api/chat", json=payload) as response:
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        data = json.loads(line)
                        content = data.get("message", {}).get("content")
                        if content:
                            yield content
                        if data.get("done"):
                            break
        except Exception as exc:
            logger.error("Ollama stream error: %s", exc)
            yield f"[Error] {exc}"
    async def _complete_openai(
        self,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
        tools: Optional[List[Dict]] = None,
    ) -> str:
        if not self.openai_api_key:
            return "[Error] OpenAI API key not configured. Set OPENAI_API_KEY in .env"

        payload: Dict[str, Any] = {
            "model": self.openai_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.openai_api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                choice = data["choices"][0]
                if choice.get("finish_reason") == "tool_calls":
                    return json.dumps({"tool_calls": choice["message"].get("tool_calls", [])})
                return choice["message"]["content"]
        except Exception as exc:
            logger.error("OpenAI error: %s", exc)
            return f"[LLM Error] OpenAI request failed: {exc}"

    async def _stream_openai(
        self,
        messages: List[Dict[str, str]],
        temperature: float,
    ) -> AsyncGenerator[str, None]:
        if not self.openai_api_key:
            yield "[Error] OpenAI API key not configured"
            return

        payload = {
            "model": self.openai_model,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
        }
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST",
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.openai_api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                ) as response:
                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            delta = data["choices"][0].get("delta", {})
                            if delta.get("content"):
                                yield delta["content"]
                        except json.JSONDecodeError:
                            continue
        except Exception as exc:
            yield f"[Error] {exc}"

    async def _complete_gemini(
        self,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
    ) -> str:
        if not self.gemini_api_key:
            return "[Error] Gemini API key not configured. Set GEMINI_API_KEY in .env"

        gemini_contents = []
        system_parts = []
        for msg in messages:
            if msg["role"] == "system":
                system_parts.append({"text": msg["content"]})
            elif msg["role"] == "user":
                gemini_contents.append({"role": "user", "parts": [{"text": msg["content"]}]})
            elif msg["role"] == "assistant":
                gemini_contents.append({"role": "model", "parts": [{"text": msg["content"]}]})

        payload: Dict[str, Any] = {
            "contents": gemini_contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }
        if system_parts:
            payload["systemInstruction"] = {"parts": system_parts}

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent?key={self.gemini_api_key}",
                    headers={"Content-Type": "application/json"},
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as exc:
            logger.error("Gemini error: %s", exc)
            return f"[LLM Error] Gemini request failed: {exc}"
    def _extract_json_candidate(self, response: str) -> str:
        clean = response.strip()
        if clean.startswith("```"):
            clean = clean.split("```", 2)[1]
            if clean.startswith("json"):
                clean = clean[4:]
            clean = clean.strip()

        if clean:
            return clean

        return response.strip()

    async def complete_json(
        self,
        messages: List[Dict[str, str]],
        provider: Optional[str] = None,
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get a JSON-structured response from the LLM."""
        json_system = (system_prompt or "") + "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no explanation."
        provider = provider or self.default_provider
        response = await self.complete(
            messages,
            provider=provider,
            system_prompt=json_system,
            json_mode=True,
        )

        clean = self._extract_json_candidate(response)

        try:
            return json.loads(clean)
        except json.JSONDecodeError:
            start_object = clean.find("{")
            end_object = clean.rfind("}")
            if start_object != -1 and end_object > start_object:
                candidate = clean[start_object:end_object + 1]
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    pass

            start_array = clean.find("[")
            end_array = clean.rfind("]")
            if start_array != -1 and end_array > start_array:
                candidate = clean[start_array:end_array + 1]
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    pass

            logger.error("JSON parse error: unable to parse response\nResponse: %s", clean)
            return {"error": "Failed to parse LLM JSON response", "raw": clean}


llm_service = LLMService()
