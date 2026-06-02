"""
Ollama Web UI — FastAPI Backend

Lightweight chat interface for local LLMs with automatic model
load/unload management to minimize resource usage.
"""

import os
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import init_db
from .services.ollama_client import OllamaClient
from .services.model_manager import ModelManager
from .routers import models, chat, conversations, system

# ── Logging ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Globals (set during lifespan) ───────────────────────────────────────
ollama_client: OllamaClient = None
model_manager: ModelManager = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    global ollama_client, model_manager

    # Ensure data dir
    os.makedirs(settings.data_dir, exist_ok=True)

    # Init DB
    await init_db()
    logger.info("Database initialized at %s", settings.data_dir)

    # Init services
    ollama_client = OllamaClient()
    model_manager = ModelManager(ollama_client)
    await model_manager.start()
    logger.info("Services started")

    yield  # ← app runs here

    # Shutdown
    await model_manager.stop()
    logger.info("Services stopped")


app = FastAPI(
    title="Ollama Web UI",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth middleware (optional) ──────────────────────────────────────────
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if settings.auth_token:
        # Skip auth for health check
        if request.url.path == "/api/system/health":
            return await call_next(request)

        auth = request.headers.get("Authorization", "")
        if auth != f"Bearer {settings.auth_token}":
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or missing auth token"},
            )
    return await call_next(request)


# ── Register routers ────────────────────────────────────────────────────
app.include_router(models.router)
app.include_router(chat.router)
app.include_router(conversations.router)
app.include_router(system.router)


# ── Error handlers ──────────────────────────────────────────────────────
@app.exception_handler(RuntimeError)
async def runtime_error_handler(request: Request, exc: RuntimeError):
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.exception_handler(Exception)
async def general_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# ── Serve frontend static files in production ────────────────────────
STATIC_DIR = Path("/app/static")
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
    logger.info("Serving frontend from %s", STATIC_DIR)


# ── Entry point ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
        log_level="info",
    )
