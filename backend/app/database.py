"""SQLite database setup and helpers using aiosqlite."""

import os
import json
import aiosqlite
from .config import settings

DB_PATH = os.path.join(settings.data_dir, "ollama_ui.db")


async def get_db():
    """Return a context-managed aiosqlite connection."""
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    try:
        yield db
    finally:
        await db.close()


async def init_db():
    """Create tables if they don't exist."""
    os.makedirs(settings.data_dir, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT 'New Chat',
                model TEXT NOT NULL,
                system_prompt TEXT DEFAULT '',
                temperature REAL DEFAULT 0.7,
                max_tokens INTEGER DEFAULT 2048,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
                content TEXT NOT NULL,
                images TEXT DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
            CREATE INDEX IF NOT EXISTS idx_conv_updated ON conversations(updated_at DESC);
        """)
        await db.commit()


async def get_conversations():
    """List all conversations, newest first."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            "SELECT id, title, model, created_at, updated_at FROM conversations ORDER BY updated_at DESC"
        )
        rows = await cur.fetchall()
        return [dict(r) for r in rows]


async def get_conversation(conv_id: str):
    """Get a single conversation with all its messages."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            "SELECT * FROM conversations WHERE id = ?", (conv_id,)
        )
        conv = await cur.fetchone()
        if not conv:
            return None
        conv = dict(conv)

        cur = await db.execute(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
            (conv_id,),
        )
        conv["messages"] = [dict(r) for r in await cur.fetchall()]
        return conv


async def create_conversation(conv_id: str, model: str, system_prompt: str = "",
                               temperature: float = 0.7, max_tokens: int = 2048):
    """Create a new conversation."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO conversations (id, model, system_prompt, temperature, max_tokens)
               VALUES (?, ?, ?, ?, ?)""",
            (conv_id, model, system_prompt, temperature, max_tokens),
        )
        await db.commit()


async def update_conversation_title(conv_id: str, title: str):
    """Update conversation title (e.g. from first message)."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?",
            (title, conv_id),
        )
        await db.commit()


async def update_conversation(conv_id: str, **kwargs):
    """Update conversation fields."""
    if not kwargs:
        return
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [conv_id]
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            f"UPDATE conversations SET {sets}, updated_at = datetime('now') WHERE id = ?",
            vals,
        )
        await db.commit()


async def delete_conversation(conv_id: str):
    """Delete a conversation and its messages (cascade)."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM messages WHERE conversation_id = ?", (conv_id,))
        await db.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
        await db.commit()


async def save_message(msg_id: str, conversation_id: str, role: str, content: str, images: list = None):
    """Save a message to a conversation."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO messages (id, conversation_id, role, content, images)
               VALUES (?, ?, ?, ?, ?)""",
            (msg_id, conversation_id, role, content, json.dumps(images or [])),
        )
        await db.execute(
            "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?",
            (conversation_id,),
        )
        await db.commit()


async def export_conversation(conv_id: str):
    """Export conversation as JSON dict."""
    conv = await get_conversation(conv_id)
    if not conv:
        return None
    return {
        "version": 1,
        "title": conv["title"],
        "model": conv["model"],
        "system_prompt": conv["system_prompt"],
        "temperature": conv["temperature"],
        "max_tokens": conv["max_tokens"],
        "created_at": conv["created_at"],
        "messages": [
            {"role": m["role"], "content": m["content"], "images": json.loads(m["images"])}
            for m in conv["messages"]
        ],
    }


async def import_conversation(data: dict, new_id: str):
    """Import conversation from JSON dict."""
    await create_conversation(
        new_id, data.get("model", "unknown"),
        data.get("system_prompt", ""),
        data.get("temperature", 0.7),
        data.get("max_tokens", 2048),
    )
    await update_conversation_title(new_id, data.get("title", "Imported Chat"))
    for msg in data.get("messages", []):
        import uuid
        await save_message(
            str(uuid.uuid4()), new_id,
            msg["role"], msg["content"], msg.get("images", []),
        )
