"""
ModelManager — Gestión inteligente del ciclo de vida de los modelos.

Se asegura de que los modelos SOLO estén cargados en memoria cuando se usan
activamente, y los descarga automáticamente tras un período de inactividad.
"""

import time
import asyncio
import logging
from typing import Dict, Optional

from .ollama_client import OllamaClient
from ..config import settings

logger = logging.getLogger(__name__)


class ModelManager:
    """Tracks model load state and auto-unloads after inactivity."""

    def __init__(self, client: OllamaClient):
        self.client = client
        self._models: Dict[str, dict] = {}  # model_name -> state
        self._lock = asyncio.Lock()
        self._task: Optional[asyncio.Task] = None
        self._running = False
        self.default_timeout_s = settings.model_timeout_minutes * 60

    async def start(self):
        self._running = True
        self._task = asyncio.create_task(self._cleanup_loop())
        logger.info("ModelManager started (timeout=%ds)", self.default_timeout_s)

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("ModelManager stopped")

    def _ensure_model(self, model_name: str):
        """Ensure model entry exists (caller must hold lock)."""
        if model_name not in self._models:
            self._models[model_name] = {
                "loaded": False,
                "last_activity": 0,
                "active_conversations": 0,
                "custom_timeout": None,
            }

    async def track_activity(self, model_name: str):
        """Register that a model was just used. Resets its inactivity timer."""
        async with self._lock:
            self._ensure_model(model_name)
            self._models[model_name]["loaded"] = True
            self._models[model_name]["last_activity"] = time.time()

    async def inc_conversations(self, model_name: str):
        """Increment active conversation counter (prevents unload)."""
        async with self._lock:
            self._ensure_model(model_name)
            self._models[model_name]["active_conversations"] += 1

    async def dec_conversations(self, model_name: str):
        """Decrement active conversation counter."""
        async with self._lock:
            if model_name in self._models:
                self._models[model_name]["active_conversations"] = max(
                    0, self._models[model_name].get("active_conversations", 0) - 1
                )

    async def load_model(self, model_name: str) -> bool:
        """Lazy-load a model into memory."""
        try:
            await self.client.check_model(model_name)
            await self.track_activity(model_name)
            logger.info("Model '%s' loaded into memory", model_name)
            return True
        except RuntimeError as e:
            logger.error("Failed to load model '%s': %s", model_name, e)
            return False

    async def unload_model(self, model_name: str) -> bool:
        """Force-unload a model from memory NOW."""
        async with self._lock:
            state = self._models.get(model_name, {})
            if state.get("active_conversations", 0) > 0:
                logger.info(
                    "Skipping unload of '%s': %d active conversations",
                    model_name, state["active_conversations"],
                )
                return False

        ok = await self.client.unload_model(model_name)
        async with self._lock:
            if model_name in self._models:
                self._models[model_name]["loaded"] = not ok
        return ok

    def get_status(self, model_name: str) -> dict:
        """Return status dict for a model."""
        state = self._models.get(model_name, {
            "loaded": False,
            "last_activity": 0,
            "active_conversations": 0,
        })
        result = dict(state)
        if state.get("loaded"):
            inactive = time.time() - state["last_activity"]
            timeout = state.get("custom_timeout") or self.default_timeout_s
            remaining = max(0, timeout - inactive)
            result["remaining_seconds"] = int(remaining)
            result["remaining_minutes"] = round(remaining / 60, 1)
        else:
            result["remaining_seconds"] = 0
            result["remaining_minutes"] = 0
        return result

    def all_status(self) -> dict:
        """Return status for all tracked models."""
        return {name: self.get_status(name) for name in self._models}

    def is_loaded(self, model_name: str) -> bool:
        return self._models.get(model_name, {}).get("loaded", False)

    async def _cleanup_loop(self):
        """Background loop: periodically unload expired models."""
        while self._running:
            try:
                await self._unload_expired()
            except Exception as e:
                logger.exception("Error in model cleanup: %s", e)
            await asyncio.sleep(15)

    async def _unload_expired(self):
        """Unload models inactive beyond their timeout."""
        now = time.time()
        to_unload: list[str] = []
        async with self._lock:
            for name, state in self._models.items():
                if not state.get("loaded"):
                    continue
                if state.get("active_conversations", 0) > 0:
                    continue
                inactive = now - state["last_activity"]
                timeout = state.get("custom_timeout") or self.default_timeout_s
                if inactive >= timeout:
                    to_unload.append(name)

        for name in to_unload:
            logger.info("Auto-unloading '%s' after inactivity", name)
            await self.unload_model(name)
