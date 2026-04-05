from typing import Literal

from pydantic import BaseModel, Field


class ProfileResponse(BaseModel):
    id: str
    email: str | None = None
    full_name: str
    role_label: str
    avatar_label: str


class AuthMeResponse(BaseModel):
    profile: ProfileResponse


class ChatSummary(BaseModel):
    id: str
    title: str
    mode: Literal["general", "report", "device", "troubleshoot"]
    preview: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class ChatMessage(BaseModel):
    id: str | None = None
    role: Literal["user", "assistant"]
    content: str
    created_at: str | None = None


class ChatDetailResponse(BaseModel):
    chat: ChatSummary
    messages: list[ChatMessage]


class ChatRequest(BaseModel):
    chat_id: str | None = None
    message: str = Field(min_length=1, max_length=6000)
    mode: Literal["general", "report", "device", "troubleshoot"] = "general"


class ChatResponse(BaseModel):
    chat: ChatSummary
    assistant_message: ChatMessage


class DeleteChatResponse(BaseModel):
    success: bool = True


class HealthResponse(BaseModel):
    status: str
    supabase_configured: bool
    groq_configured: bool
