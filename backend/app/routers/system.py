"""API routes for system health, settings, and resource monitoring."""

import os
import logging
import asyncio

from fastapi import APIRouter, HTTPException

from ..config import settings
from ..schemas import AppSettings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0", "ollama_host": settings.ollama_host}


@router.get("/ram")
async def ram_status():
    """Detailed RAM info with warning flags."""
    total_mb = 0
    available_mb = 0
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    total_mb = int(line.split()[1]) // 1024
                elif line.startswith("MemAvailable:"):
                    available_mb = int(line.split()[1]) // 1024
    except Exception:
        return {"available": False, "message": "RAM info unavailable"}

    used_mb = total_mb - available_mb
    percent = int((used_mb / total_mb) * 100)
    warning = percent >= 90
    critical = percent >= 95

    return {
        "total_mb": total_mb,
        "available_mb": available_mb,
        "used_mb": used_mb,
        "percent": percent,
        "warning": warning,
        "critical": critical,
        "warning_threshold": settings.ram_warning_percent,
    }


@router.get("/stats")
async def system_stats():
    """Full system stats including RAM, GPU, models, and limits."""
    stats = {
        "model_timeout_minutes": settings.model_timeout_minutes,
        "ollama_keep_alive": settings.ollama_keep_alive,
        "max_loaded_models": settings.max_loaded_models,
        "ram_warning_percent": settings.ram_warning_percent,
    }

    # RAM
    stats["ram"] = await _ram_dict()

    # GPU
    stats["gpu"] = await _gpu_info()

    # Model manager status
    from ..main import model_manager
    tracked = model_manager.all_status()
    stats["tracked_models"] = tracked
    stats["loaded_count"] = sum(1 for s in tracked.values() if s.get("loaded"))

    return stats


@router.get("/settings")
async def get_settings():
    return {
        "model_timeout_minutes": settings.model_timeout_minutes,
        "ollama_keep_alive": settings.ollama_keep_alive,
        "max_loaded_models": settings.max_loaded_models,
        "ram_warning_percent": settings.ram_warning_percent,
        "auth_enabled": bool(settings.auth_token),
    }


@router.post("/settings")
async def update_settings(new_settings: AppSettings):
    settings.model_timeout_minutes = new_settings.model_timeout_minutes
    settings.ollama_keep_alive = new_settings.ollama_keep_alive
    settings.auth_token = new_settings.auth_token

    if hasattr(new_settings, "max_loaded_models") and new_settings.max_loaded_models is not None:
        if 1 <= new_settings.max_loaded_models <= 3:
            settings.max_loaded_models = new_settings.max_loaded_models
        else:
            raise HTTPException(status_code=400, detail="max_loaded_models must be 1-3")

    if hasattr(new_settings, "ram_warning_percent") and new_settings.ram_warning_percent is not None:
        settings.ram_warning_percent = new_settings.ram_warning_percent

    from ..main import model_manager
    model_manager.default_timeout_s = settings.model_timeout_minutes * 60

    logger.info("Settings updated: timeout=%dmin, max_models=%d",
                settings.model_timeout_minutes, settings.max_loaded_models)
    return {"status": "updated"}


async def _ram_dict() -> dict:
    try:
        with open("/proc/meminfo") as f:
            mem = {}
            for line in f:
                parts = line.split(":")
                if len(parts) == 2:
                    mem[parts[0].strip()] = parts[1].strip()
            return {
                "total": mem.get("MemTotal", "N/A"),
                "available": mem.get("MemAvailable", "N/A"),
                "free": mem.get("MemFree", "N/A"),
            }
    except Exception:
        return {"info": "unavailable"}


async def _gpu_info() -> dict:
    try:
        proc = await asyncio.create_subprocess_exec(
            "nvidia-smi", "--query-gpu=index,name,memory.used,memory.total",
            "--format=csv,noheader,nounits",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        if stdout:
            lines = stdout.decode().strip().split("\n")
            gpus = []
            for line in lines:
                parts = [p.strip() for p in line.split(",")]
                if len(parts) >= 4:
                    gpus.append({
                        "index": parts[0], "name": parts[1],
                        "memory_used_mib": int(float(parts[2])),
                        "memory_total_mib": int(float(parts[3])),
                    })
            return {"nvidia": gpus}
    except Exception:
        pass
    return {"available": False, "note": "no GPU monitoring tools found"}
