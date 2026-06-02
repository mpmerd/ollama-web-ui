"""Application configuration via environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Ollama connection
    ollama_host: str = "http://host.docker.internal:11434"

    # Application
    host: str = "0.0.0.0"
    port: int = 8000
    data_dir: str = "/data"  # mounted volume for persistence
    auth_token: str = ""  # leave empty for no auth

    # Model timeout in minutes (inactivity before auto-unload)
    model_timeout_minutes: int = 15

    # Ollama keep_alive for active chats (how long Ollama itself keeps the model)
    ollama_keep_alive: str = "10m"

    # Multi-user / multi-model resource limits
    max_loaded_models: int = 2    # max models loaded simultaneously (1-3)
    ram_warning_percent: int = 90  # show warning when RAM usage hits this %

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
