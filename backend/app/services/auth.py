from dataclasses import dataclass

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class AuthenticatedUser:
    id: str
    email: str | None
    full_name: str

    @property
    def avatar_label(self) -> str:
        parts = [part for part in self.full_name.split() if part]
        if not parts:
            return "BC"
        return "".join(part[0].upper() for part in parts[:2])


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthenticatedUser:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required.",
        )

    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase auth is not configured on the server.",
        )

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {credentials.credentials}",
                "apikey": settings.supabase_anon_key,
            },
        )

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session is invalid or expired.",
        )

    payload = response.json()
    metadata = payload.get("user_metadata") or {}
    email = payload.get("email")
    full_name = metadata.get("full_name") or (email.split("@")[0] if email else "BiomedConnect User")

    return AuthenticatedUser(
        id=payload["id"],
        email=email,
        full_name=full_name,
    )
