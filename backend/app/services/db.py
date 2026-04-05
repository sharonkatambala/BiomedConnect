from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.services.auth import AuthenticatedUser
from app.services.supabase_client import get_supabase_admin


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_preview(text: str, length: int = 88) -> str:
    compact = " ".join(text.split())
    return compact if len(compact) <= length else f"{compact[: length - 1].rstrip()}…"


def build_title(text: str, length: int = 48) -> str:
    compact = " ".join(text.split())
    return compact if len(compact) <= length else f"{compact[: length - 1].rstrip()}…"


def ensure_profile(user: AuthenticatedUser) -> dict:
    client = get_supabase_admin()
    payload = {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role_label": "Biomedical Workspace Member",
        "avatar_label": user.avatar_label,
        "updated_at": iso_now(),
    }
    response = client.table("profiles").upsert(payload, on_conflict="id").execute()
    if response.data:
        return response.data[0]
    return payload


def list_chats(user_id: str) -> list[dict]:
    client = get_supabase_admin()
    response = (
        client.table("chats")
        .select("id,title,mode,preview,created_at,updated_at")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .execute()
    )
    return response.data or []


def get_chat(user_id: str, chat_id: str) -> dict:
    client = get_supabase_admin()
    response = (
        client.table("chats")
        .select("id,title,mode,preview,created_at,updated_at")
        .eq("id", chat_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")
    return response.data[0]


def get_messages(user_id: str, chat_id: str) -> list[dict]:
    client = get_supabase_admin()
    response = (
        client.table("messages")
        .select("id,role,content,created_at")
        .eq("chat_id", chat_id)
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .execute()
    )
    return response.data or []


def create_chat(user_id: str, first_message: str, mode: str) -> dict:
    client = get_supabase_admin()
    now = iso_now()
    response = (
        client.table("chats")
        .insert(
            {
                "user_id": user_id,
                "title": build_title(first_message),
                "mode": mode,
                "preview": build_preview(first_message),
                "created_at": now,
                "updated_at": now,
            }
        )
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to create chat.")
    return response.data[0]


def update_chat(user_id: str, chat_id: str, **fields) -> dict:
    client = get_supabase_admin()
    fields.setdefault("updated_at", iso_now())
    response = (
        client.table("chats")
        .update(fields)
        .eq("id", chat_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")
    return response.data[0]


def save_message(user_id: str, chat_id: str, role: str, content: str) -> dict:
    client = get_supabase_admin()
    response = (
        client.table("messages")
        .insert(
            {
                "chat_id": chat_id,
                "user_id": user_id,
                "role": role,
                "content": content,
            }
        )
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to save message.")
    return response.data[0]


def delete_chat(user_id: str, chat_id: str) -> None:
    client = get_supabase_admin()
    response = client.table("chats").delete().eq("id", chat_id).eq("user_id", user_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")
