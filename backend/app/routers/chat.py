"""API routes for chat: send messages, stream responses, file uploads."""

import uuid
import json
import base64
import os
import logging
import re
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse

from ..schemas import ChatRequest, ChatTitleRequest
from ..database import (
    get_conversation, create_conversation, save_message,
    update_conversation_title, get_conversations,
)
from ..services.ollama_client import OllamaClient
from ..services.model_manager import ModelManager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])


def _get_deps():
    from ..main import ollama_client, model_manager
    return ollama_client, model_manager


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a file and return its processed content.
    - Images → base64 data URL (for vision models)
    - Text files (.txt, .md, .csv, .py, .log, etc) → plain text content
    - PDF → placeholder warning (needs pdfplumber on server)
    """
    content = await file.read()
    filename = file.filename or "file"
    mime = file.content_type or _guess_mime(filename)

    if mime and mime.startswith("image/"):
        # Image: return base64 data URL for vision models
        b64 = base64.b64encode(content).decode()
        return {
            "type": "image",
            "filename": filename,
            "mime_type": mime,
            "data_url": f"data:{mime};base64,{b64}",
            "size_bytes": len(content),
        }

    # Text file: try to decode and return text
    text = ""
    try:
        text = content.decode("utf-8").strip()
    except UnicodeDecodeError:
        try:
            text = content.decode("latin-1").strip()
        except Exception:
            text = f"[Binary file: {filename} ({len(content)} bytes)]"

    # Clean and truncate very large files
    max_chars = 50000
    if len(text) > max_chars:
        text = text[:max_chars] + f"\n\n... [truncated, original: {len(text)} chars]"

    return {
        "type": "text",
        "filename": filename,
        "mime_type": mime,
        "content": text,
        "size_bytes": len(content),
        "truncated": len(content) > max_chars,
    }


@router.post("/send")
async def send_message(req: ChatRequest):
    """
    Send a message and stream the response.
    Creates a conversation if conversation_id is not provided.
    """
    client, mm = _get_deps()

    conv_id = req.conversation_id or str(uuid.uuid4())
    system_prompt = req.system_prompt
    temperature = req.temperature
    max_tokens = req.max_tokens
    title_generated = False

    # ── Create conversation if new ──
    existing = await get_conversation(conv_id)
    if not existing:
        await create_conversation(
            conv_id, req.model, system_prompt, temperature, max_tokens,
        )
        await mm.inc_conversations(req.model)

    # ── Build message content with file contexts ──
    message_text = req.message
    if req.files:
        file_contexts = []
        for f in req.files:
            if f.content:
                file_contexts.append(
                    f"[File: {f.filename}]\n{f.content}\n[/File]"
                )
            elif f.data_url:
                file_contexts.append(f"[Image attached: {f.filename}]")
        if file_contexts:
            message_text = message_text + "\n\n" + "\n\n".join(file_contexts)

    # ── Save user message ──
    user_msg_id = str(uuid.uuid4())
    await save_message(user_msg_id, conv_id, "user", message_text, req.images)

    # ── Get conversation messages ──
    conv = await get_conversation(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages_for_api = [{"role": m["role"], "content": m["content"]} for m in conv["messages"]]
    model_needs_load = not mm.is_loaded(req.model)

    # ── Enforce max loaded models ──
    from ..config import settings
    max_models = settings.max_loaded_models

    if model_needs_load:
        loaded_now = sum(1 for s in mm.all_status().values() if s.get("loaded"))
        if loaded_now >= max_models:
            # Need to evict one. Priority: models with NO active conversations, oldest first
            candidates = []
            for other_name, other_status in mm.all_status().items():
                if other_name != req.model and other_status.get("loaded"):
                    active = other_status.get("active_conversations", 0)
                    last = other_status.get("last_activity", 0)
                    if active == 0:
                        candidates.append((last, other_name))
            if candidates:
                # Unload the oldest inactive model
                candidates.sort()
                to_kill = candidates[0][1]
                logger.info("Slot full (%d/%d): evicting oldest '%s'", loaded_now, max_models, to_kill)
                await mm.unload_model(to_kill)
            else:
                # All loaded models have active conversations — refuse
                names = [n for n, s in mm.all_status().items() if s.get("loaded")]
                raise HTTPException(
                    status_code=429,
                    detail=f"All {max_models} model slots are in use by active conversations: {names}. Close a conversation or wait."
                )

        # Unload inactive models before loading the new one
        for other_name, other_status in mm.all_status().items():
            if other_name != req.model and other_status.get("loaded"):
                active_convos = other_status.get("active_conversations", 0)
                if active_convos > 0:
                    logger.info("Keeping '%s': %d active conversations", other_name, active_convos)
                else:
                    logger.info("Unloading inactive '%s' to free slot", other_name)
                    await mm.unload_model(other_name)

        free_mb = _get_free_ram_mb()
        logger.info("Free RAM before loading '%s': %d MB", req.model, free_mb)

    # ── Streaming response ──
    async def event_stream():
        nonlocal title_generated
        full_response = ""
        assistant_msg_id = str(uuid.uuid4())
        token_count = 0

        try:
            yield f"data: {json.dumps({'type': 'start', 'message_id': assistant_msg_id, 'conversation_id': conv_id})}\n\n"

            if model_needs_load:
                yield f"data: {json.dumps({'type': 'status', 'content': '⏳ Loading model into memory...'})}\n\n"
                ok = await mm.load_model(req.model)
                if not ok:
                    yield f"data: {json.dumps({'type': 'error', 'content': f'Failed to load {req.model}.'})}\n\n"
                    return
                yield f"data: {json.dumps({'type': 'status', 'content': '✅ Model loaded! Generating...'})}\n\n"
            else:
                await mm.track_activity(req.model)

            async for chunk in client.chat_stream(
                model=req.model,
                messages=messages_for_api,
                temperature=temperature,
                max_tokens=max_tokens,
                system_prompt=system_prompt if not existing else "",
                images=req.images,
            ):
                if chunk['type'] == 'token':
                    full_response += chunk['content']
                    token_count += 1
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk['content'], 'message_id': assistant_msg_id})}\n\n"
                elif chunk['type'] == 'thinking':
                    yield f"data: {json.dumps({'type': 'thinking', 'content': chunk['content'], 'message_id': assistant_msg_id})}\n\n"
                elif chunk['type'] == 'done':
                    break

            await save_message(assistant_msg_id, conv_id, "assistant", full_response)

            if not title_generated and conv["title"] == "New Chat":
                title_candidate = _generate_title(req.message[:80])
                await update_conversation_title(conv_id, title_candidate)
                yield f"data: {json.dumps({'type': 'title', 'title': title_candidate})}\n\n"

            yield f"data: {json.dumps({'type': 'done', 'token_count': token_count})}\n\n"

        except RuntimeError as e:
            logger.error(f"Chat stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        except Exception as e:
            logger.exception("Unexpected streaming error")
            yield f"data: {json.dumps({'type': 'error', 'content': f'Internal error: {str(e)}'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/title")
async def set_title(conv_id: str, req: ChatTitleRequest):
    await update_conversation_title(conv_id, req.title)
    return {"status": "ok"}


def _guess_mime(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    mimes = {
        "txt": "text/plain", "md": "text/markdown", "csv": "text/csv",
        "py": "text/x-python", "js": "text/javascript", "json": "application/json",
        "html": "text/html", "xml": "text/xml", "log": "text/plain",
        "pdf": "application/pdf", "png": "image/png", "jpg": "image/jpeg",
        "jpeg": "image/jpeg", "gif": "image/gif", "webp": "image/webp",
    }
    return mimes.get(ext, "application/octet-stream")


def _generate_title(text: str) -> str:
    text = text.strip()
    if len(text) <= 50:
        return text
    sentences = text.split(".")
    if len(sentences[0]) <= 50:
        return sentences[0].strip()
    return text[:47].strip() + "..."


def _get_free_ram_mb() -> int:
    """Read free RAM in MB from /proc/meminfo (Linux)."""
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemAvailable:"):
                    return int(line.split()[1]) // 1024
    except Exception:
        pass
    return 99999  # unknown, assume plenty
