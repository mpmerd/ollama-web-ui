"""Pydantic schemas for API request/response validation."""

from typing import Optional, List
from pydantic import BaseModel, Field


class ModelInfo(BaseModel):
    name: str
    size: int
    digest: str
    modified_at: str
    details: dict = {}

class FileAttachment(BaseModel):
    type: str = "text"
    filename: str
    content: Optional[str] = None
    data_url: Optional[str] = None

class ChatMessage(BaseModel):
    role: str
    content: str
    images: list[str] = []

class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    model: str
    message: str
    system_prompt: str = ""
    temperature: float = 0.7
    max_tokens: int = 2048
    images: list[str] = []
    files: list[FileAttachment] = []

class ChatTitleRequest(BaseModel):
    title: str

class ConversationCreate(BaseModel):
    model: str
    system_prompt: str = ""
    temperature: float = 0.7
    max_tokens: int = 2048

class ConversationUpdate(BaseModel):
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None

class AppSettings(BaseModel):
    model_timeout_minutes: int = Field(ge=1, le=120)
    ollama_keep_alive: str = "10m"
    auth_token: str = ""
    max_loaded_models: Optional[int] = Field(None, ge=1, le=3)
    ram_warning_percent: Optional[int] = Field(None, ge=50, le=99)

class ModelLoadRequest(BaseModel):
    model: str

class ModelUnloadRequest(BaseModel):
    model: str
