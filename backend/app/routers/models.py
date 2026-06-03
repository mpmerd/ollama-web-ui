"""API routes for model listing, loading, unloading, and status."""

import logging

from fastapi import APIRouter, HTTPException
from ..schemas import ModelLoadRequest, ModelUnloadRequest
from ..services.ollama_client import OllamaClient
from ..services.model_manager import ModelManager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/models", tags=["models"])


def _get_deps():
    """Dependency injection helper (set during app startup)."""
    from ..main import ollama_client, model_manager
    return ollama_client, model_manager


@router.get("")
async def list_models():
    """List all models available in Ollama, with load status and context length."""
    client, mm = _get_deps()
    try:
        models_raw = await client.list_models()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    models = []
    for m in models_raw:
        name = m.get("name", "unknown")
        families = m.get("details", {}).get("families", [])
        supports_img = any(f in ["llava", "gemma4", "minicpm", "qwen2", "phi3"] for f in [x.lower() for x in families])
        # Get context length (cached per model, non-blocking)
        ctx_len = await client.get_context_length(name)
        info = {
            "name": name,
            "size": m.get("size", 0),
            "size_human": _human_size(m.get("size", 0)),
            "digest": m.get("digest", ""),
            "modified_at": m.get("modified_at", ""),
            "details": m.get("details", {}),
            "supports_images": supports_img,
            "context_length": ctx_len,
            **mm.get_status(name),
        }
        models.append(info)
    return {"models": models}


@router.get("/loaded")
async def list_loaded_models():
    """List currently loaded models from Ollama's perspective."""
    client, _ = _get_deps()
    try:
        loaded = await client.list_loaded()
        return {"loaded": loaded}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/load")
async def load_model(req: ModelLoadRequest):
    """Load a model into memory. Unloads all other loaded models first to save RAM."""
    _, mm = _get_deps()

    # Unload other models to free RAM before loading the new one
    statuses = mm.all_status()
    for other_name, other_status in statuses.items():
        if other_name != req.model and other_status.get("loaded"):
            logger.info("Switching models: unloading '%s' to load '%s'", other_name, req.model)
            await mm.unload_model(other_name)

    ok = await mm.load_model(req.model)
    if not ok:
        raise HTTPException(status_code=502, detail=f"Failed to load model '{req.model}'")
    return {"status": "loaded", "model": req.model}


@router.post("/unload")
async def unload_model(req: ModelUnloadRequest):
    """Force-unload a model from memory."""
    _, mm = _get_deps()
    ok = await mm.unload_model(req.model)
    if not ok:
        raise HTTPException(status_code=409, detail=f"Cannot unload '{req.model}' (active conversations or error)")
    return {"status": "unloaded", "model": req.model}


@router.get("/status/{model_name:path}")
async def model_status(model_name: str):
    """Get detailed status of a specific model."""
    _, mm = _get_deps()
    return mm.get_status(model_name)


@router.get("/status")
async def all_models_status():
    """Get status of all tracked models."""
    _, mm = _get_deps()
    return mm.all_status()


def _human_size(size: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"
