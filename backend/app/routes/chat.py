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
from app.services.ai import classify_domain_relevance, generate_ai_reply
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

OFF_TOPIC_OPENERS = [
    "I can help with biomedical engineering, healthcare, medical devices, health technology, and AI used in those areas.",
    "This assistant is focused on biomedical engineering, clinical technology, healthcare systems, and related health AI topics.",
    "I am limited to biomedical engineering, healthcare, medical devices, and closely related health technology questions.",
    "My scope is biomedical engineering, healthcare, medical technology, and AI connected to those fields.",
]

OFF_TOPIC_EXAMPLES = [
    "How does an MRI scanner produce images?",
    "What causes a ventilator high-pressure alarm?",
    "Explain ECG lead placement and common mistakes.",
    "How is AI used in radiology workflows?",
    "What are the safety checks for an infusion pump?",
    "How does a pulse oximeter estimate oxygen saturation?",
    "What does FDA Class II mean for a medical device?",
    "How do biomedical engineers maintain hospital equipment?",
]

OFF_TOPIC_CLOSERS = [
    "If you want, ask me a biomedical or healthcare technology question and I will jump straight in.",
    "Try one of the example questions below, or send any biomedical engineering topic you want explained.",
    "I will be most useful if you keep the question within biomedical engineering or healthcare technology.",
]


def build_off_topic_response() -> str:
    examples = random.sample(OFF_TOPIC_EXAMPLES, k=3)
    opener = random.choice(OFF_TOPIC_OPENERS)
    closing = random.choice(OFF_TOPIC_CLOSERS)
    return (
        f"{opener}\n\n"
        "Please ask about biomedical engineering, health, healthcare, medical devices, health technology, "
        "or AI applied to those areas.\n\n"
        "You could ask:\n"
        f"- {examples[0]}\n"
        f"- {examples[1]}\n"
        f"- {examples[2]}\n\n"
        f"{closing}"
    )


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

    if not await classify_domain_relevance(messages_for_model):
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
