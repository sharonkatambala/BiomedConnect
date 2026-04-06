from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[1]
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    app_name: str = "BiomedConnect API"
    environment: str = "development"
    frontend_origins: str = "http://127.0.0.1:5173,http://localhost:5173"
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    request_timeout_seconds: float = 45.0

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        origins = [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]
        if origins == ["*"]:
            return ["*"]
        return origins


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
