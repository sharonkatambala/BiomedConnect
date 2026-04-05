from fastapi import APIRouter, Depends

from app.schemas import AuthMeResponse, ProfileResponse
from app.services.auth import AuthenticatedUser, get_current_user
from app.services.db import ensure_profile

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=AuthMeResponse)
async def get_me(current_user: AuthenticatedUser = Depends(get_current_user)) -> AuthMeResponse:
    profile = ensure_profile(current_user)
    return AuthMeResponse(profile=ProfileResponse(**profile))
