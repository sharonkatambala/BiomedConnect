from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.services.supabase_client import get_supabase_admin


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def add_post(room: str, user_id: str, user_name: str, user_role: str, avatar_label: str, content: str) -> dict:
    client = get_supabase_admin()
    response = (
        client.table("community_posts")
        .insert(
            {
                "room": room,
                "user_id": user_id,
                "user_name": user_name,
                "user_role": user_role,
                "avatar_label": avatar_label,
                "content": content,
                "created_at": iso_now(),
            }
        )
        .execute()
    )
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to save community post.",
        )
    return response.data[0]


def get_posts(room: str) -> list[dict]:
    client = get_supabase_admin()
    response = (
        client.table("community_posts")
        .select("id,room,user_id,user_name,user_role,avatar_label,content,created_at")
        .eq("room", room)
        .order("created_at", desc=False)
        .execute()
    )
    return response.data or []
