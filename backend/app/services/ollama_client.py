"""Async HTTP client for the Ollama API."""

import json
import logging
from typing import AsyncGenerator, Optional

import httpx

from ..config import settings

logger = logging.getLogger(__name__)

OLLAMA_TIMEOUT = httpx.Timeout(300.0, connect=5.0)


class OllamaClient:
    """Thin wrapper around Ollama REST API."""

    def __init__(self):
        self._base = settings.ollama_host.rstrip("/")

    async def _request(self, method: str, path: str, json_body: dict = None,
                       timeout: httpx.Timeout = None) -> dict:
        """Make a JSON request to Ollama."""
        t = timeout or httpx.Timeout(30.0)
        logger.info(f"_request: {method} {self._base}{path} timeout={t}")
        async with httpx.AsyncClient(timeout=t) as client:
            try:
                resp = await client.request(method, f"{self._base}{path}",
                                            json=json_body)
                logger.info(f"_request response: {resp.status_code}")
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPStatusError as e:
                detail = e.response.text[:500]
                logger.error(f"Ollama HTTP {e.response.status_code}: {detail}")
                raise RuntimeError(f"Ollama error ({e.response.status_code}): {detail}")
            except httpx.RequestError as e:
                logger.error(f"Ollama connection error: {e}")
                raise RuntimeError(f"Cannot reach Ollama at {self._base}: {e}")

    async def _request_stream(self, path: str, json_body: dict) -> AsyncGenerator[dict, None]:
        """Stream JSON lines from Ollama."""
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            async with client.stream("POST", f"{self._base}{path}", json=json_body) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.strip():
                        try:
                            yield json.loads(line)
                        except json.JSONDecodeError:
                            logger.warning(f"Bad JSON line from Ollama: {line[:200]}")
                            continue

    async def list_models(self) -> list:
        """GET /api/tags -> list of installed models."""
        data = await self._request("GET", "/api/tags")
        return data.get("models", [])

    async def check_model(self, name: str) -> bool:
        """Check if a model exists and optionally load it via keep_alive.
        Uses a very long timeout because loading a model into memory can
        take 30-120+ seconds depending on model size and hardware.
        """
        data = await self._request("POST", "/api/generate", {
            "model": name,
            "prompt": "",
            "keep_alive": settings.ollama_keep_alive,
        }, timeout=httpx.Timeout(300.0, connect=10.0))
        return data.get("done", False)

    async def unload_model(self, name: str) -> bool:
        """Force-unload a model from Ollama memory."""
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
                resp = await client.post(f"{self._base}/api/generate", json={
                    "model": name,
                    "prompt": "",
                    "keep_alive": "0s",
                })
                resp.raise_for_status()
            logger.info(f"Model '{name}' unloaded from Ollama")
            return True
        except Exception as e:
            logger.warning(f"Failed to unload model '{name}': {e}")
            return False

    async def list_loaded(self) -> list:
        """List currently loaded models via /api/ps if available (Ollama 0.5+)."""
        try:
            data = await self._request("GET", "/api/ps")
            return data.get("models", [])
        except (RuntimeError, Exception):
            return []

    async def show_model(self, name: str) -> dict:
        """Get full model info including modelfile."""
        data = await self._request("POST", "/api/show", {"name": name})
        return data

    async def supports_images(self, name: str) -> bool:
        """Check if a model supports image input (llava, gemma4-vision, etc)."""
        try:
            info = await self.show_model(name)
            mf = info.get("modelfile", "")
            # Check for image-related keywords in modelfile
            return any(kw in mf.upper() for kw in [
                "IMAGE", "PICTURE", "VISION", "/IMAGE", "LLAVA",
                "CLIP", "PHOTO", "PICTURE"
            ])
        except Exception:
            return False

    async def chat_stream(self, model: str, messages: list,
                          temperature: float = 0.7, max_tokens: int = 2048,
                          system_prompt: str = "",
                          images: list = None) -> AsyncGenerator[dict, None]:
        """Stream chat completion from Ollama. Yields dicts with 'type' and 'content'.
        'type' is 'token' for regular content, 'thinking' for model reasoning,
        and 'done' for the final chunk.
        """
        opts = {
            "temperature": temperature,
            "num_predict": max_tokens,
        }

        # Build messages, prepending system prompt if present
        chat_messages = list(messages)
        if system_prompt:
            chat_messages.insert(0, {"role": "system", "content": system_prompt})

        # Add image to last user message if provided
        if images and len(images) > 0 and chat_messages and chat_messages[-1]["role"] == "user":
            chat_messages[-1]["images"] = images

        body = {
            "model": model,
            "messages": chat_messages,
            "options": opts,
            "stream": True,
            "keep_alive": settings.ollama_keep_alive,
        }

        async for chunk in self._request_stream("/api/chat", body):
            msg = chunk.get("message", {})
            content = msg.get("content", "")
            thinking = msg.get("thinking", "")

            if thinking:
                yield {"type": "thinking", "content": thinking}
            if content:
                yield {"type": "token", "content": content}

            if chunk.get("done"):
                yield {"type": "done", "content": ""}
                break
