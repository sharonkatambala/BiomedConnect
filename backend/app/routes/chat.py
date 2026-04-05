from fastapi import APIRouter, Depends

from app.schemas import (
    ChatDetailResponse,
    ChatMessage,
    ChatRequest,
    ChatResponse,
    ChatSummary,
    DeleteChatResponse,
)
from app.services.ai import generate_ai_reply
from app.services.auth import AuthenticatedUser, get_current_user
from app.services.db import (
    build_preview,
    create_chat,
    delete_chat,
    get_chat,
    get_messages,
    list_chats,
    save_message,
    update_chat,
)

router = APIRouter(prefix="/api", tags=["chat"])


@router.get("/chats", response_model=list[ChatSummary])
async def get_chats(current_user: AuthenticatedUser = Depends(get_current_user)) -> list[ChatSummary]:
    return [ChatSummary(**chat) for chat in list_chats(current_user.id)]


@router.get("/chats/{chat_id}", response_model=ChatDetailResponse)
async def get_chat_detail(chat_id: str, current_user: AuthenticatedUser = Depends(get_current_user)) -> ChatDetailResponse:
    chat = get_chat(current_user.id, chat_id)
    messages = get_messages(current_user.id, chat_id)
    return ChatDetailResponse(
        chat=ChatSummary(**chat),
        messages=[ChatMessage(**message) for message in messages],
    )


@router.delete("/chats/{chat_id}", response_model=DeleteChatResponse)
async def remove_chat(chat_id: str, current_user: AuthenticatedUser = Depends(get_current_user)) -> DeleteChatResponse:
    delete_chat(current_user.id, chat_id)
    return DeleteChatResponse(success=True)


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, current_user: AuthenticatedUser = Depends(get_current_user)) -> ChatResponse:
    history: list[dict]

    if request.chat_id:
        chat_record = get_chat(current_user.id, request.chat_id)
        chat_id = chat_record["id"]
        mode = chat_record["mode"]
        history = get_messages(current_user.id, chat_id)
    else:
        chat_record = {}
        chat_id = None
        mode = request.mode
        history = []

    assistant_text = await generate_ai_reply(
        history + [{"role": "user", "content": request.message}],
        mode,
    )

    if chat_id is None:
        chat_record = create_chat(current_user.id, request.message, request.mode)
        chat_id = chat_record["id"]

    save_message(current_user.id, chat_id, "user", request.message)
    assistant_message = save_message(current_user.id, chat_id, "assistant", assistant_text)

    updated_chat = update_chat(
        current_user.id,
        chat_id,
        preview=build_preview(assistant_text),
    )

    return ChatResponse(
        chat=ChatSummary(**updated_chat),
        assistant_message=ChatMessage(**assistant_message),
    )
