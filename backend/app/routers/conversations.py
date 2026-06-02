"""API routes for conversation CRUD, export/import."""

import uuid
import json
import logging

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse

from ..schemas import ConversationCreate, ConversationUpdate
from ..database import (
    get_conversations, get_conversation, create_conversation,
    update_conversation, delete_conversation,
    export_conversation, import_conversation,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("")
async def list_conversations():
    """List all conversations."""
    return {"conversations": await get_conversations()}


@router.get("/{conv_id}")
async def get_single_conversation(conv_id: str):
    """Get a conversation with all messages."""
    conv = await get_conversation(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.post("")
async def new_conversation(req: ConversationCreate):
    """Create a new conversation."""
    conv_id = str(uuid.uuid4())
    await create_conversation(
        conv_id, req.model, req.system_prompt,
        req.temperature, req.max_tokens,
    )
    # Track conversation for model manager
    from ..main import model_manager
    await model_manager.inc_conversations(req.model)
    return {"conversation_id": conv_id, "status": "created"}


@router.put("/{conv_id}")
async def update_single_conversation(conv_id: str, req: ConversationUpdate):
    """Update conversation settings."""
    await update_conversation(
        conv_id,
        **req.model_dump(exclude_none=True),
    )
    return {"status": "updated"}


@router.delete("/{conv_id}")
async def delete_single_conversation(conv_id: str):
    """Delete a conversation and all its messages."""
    conv = await get_conversation(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await delete_conversation(conv_id)
    # Decrement model conversation counter
    from ..main import model_manager
    await model_manager.dec_conversations(conv["model"])
    return {"status": "deleted"}


@router.get("/{conv_id}/export")
async def export_single_conversation(conv_id: str):
    """Export a conversation as downloadable JSON."""
    data = await export_conversation(conv_id)
    if not data:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return JSONResponse(
        content=data,
        headers={"Content-Disposition": f'attachment; filename="conversation-{conv_id[:8]}.json"'},
    )


@router.post("/import")
async def import_conversation_file(file: UploadFile = File(...)):
    """Import a conversation from a JSON file."""
    try:
        content = await file.read()
        data = json.loads(content)
        new_id = str(uuid.uuid4())
        await import_conversation(data, new_id)
        from ..main import model_manager
        await model_manager.inc_conversations(data.get("model", "unknown"))
        return {"conversation_id": new_id, "title": data.get("title", "Imported")}
    except (json.JSONDecodeError, KeyError, Exception) as e:
        raise HTTPException(status_code=400, detail=f"Invalid import file: {e}")
