from fastapi import APIRouter

from app.config import get_settings
from app.schemas import HealthResponse

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        supabase_configured=bool(settings.supabase_url and settings.supabase_service_role_key and settings.supabase_anon_key),
        groq_configured=bool(settings.groq_api_key),
    )
