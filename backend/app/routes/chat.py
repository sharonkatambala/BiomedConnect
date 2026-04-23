import random

from fastapi import APIRouter, Depends

from app.schemas import (
    ChatDetailResponse,
    ChatMessage,
    ChatRequest,
    ChatResponse,
    ChatSummary,
    DeleteChatResponse,
    UpdateChatRequest,
)
from app.services.ai import classify_domain_relevance, generate_ai_reply, get_simple_response
from app.services.auth import AuthenticatedUser, get_current_user
from app.services.db import (
    create_chat,
    delete_chat,
    get_chat,
    get_messages,
    list_chats,
    save_message,
    toggle_star,
    update_chat,
)

router = APIRouter(prefix="/api", tags=["chat"])

OFF_TOPIC_RESPONSES = [
    "I'm focused on biomedical engineering, healthcare, and medical technology. Ask me anything in those areas.",
    "That topic is outside my scope. I can help with biomedical engineering, healthcare, and medical devices.",
    "I specialize in biomedical and healthcare topics. Feel free to ask about those.",
    "I can only assist with biomedical engineering, healthcare, and related health technology. What would you like to know?",
    "My expertise is in biomedical engineering and healthcare. How can I help you with that?",
    "I only cover biomedical engineering, healthcare, and medical technology. Ask me something in those fields.",
]


def build_off_topic_response() -> str:
    return random.choice(OFF_TOPIC_RESPONSES)


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


@router.put("/chats/{chat_id}", response_model=ChatSummary)
async def update_chat_title(chat_id: str, request: UpdateChatRequest, current_user: AuthenticatedUser = Depends(get_current_user)) -> ChatSummary:
    updated_chat = update_chat(current_user.id, chat_id, title=request.title)
    return ChatSummary(**updated_chat)


@router.post("/chats/{chat_id}/star", response_model=ChatSummary)
async def toggle_chat_star(chat_id: str, current_user: AuthenticatedUser = Depends(get_current_user)) -> ChatSummary:
    updated_chat = toggle_star(current_user.id, chat_id)
    return ChatSummary(**updated_chat)


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

    messages_for_model = history + [{"role": "user", "content": request.message}]

    simple_reply = get_simple_response(request.message)
    if simple_reply:
        assistant_text = simple_reply
    elif not await classify_domain_relevance(messages_for_model):
        assistant_text = build_off_topic_response()
    else:
        assistant_text = await generate_ai_reply(messages_for_model, mode)

    if chat_id is None:
        chat_record = create_chat(current_user.id, request.message, request.mode)
        chat_id = chat_record["id"]

    save_message(current_user.id, chat_id, "user", request.message)
    assistant_message = save_message(current_user.id, chat_id, "assistant", assistant_text)

    # Keep chat preview stable: it should reflect the first user question (one-line summary),
    # not the latest assistant reply. We still update updated_at for ordering.
    updated_chat = update_chat(current_user.id, chat_id)

    return ChatResponse(
        chat=ChatSummary(**updated_chat),
        assistant_message=ChatMessage(**assistant_message),
    )
