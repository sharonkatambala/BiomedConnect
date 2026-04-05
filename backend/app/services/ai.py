import httpx
from fastapi import HTTPException, status

from app.config import get_settings

SYSTEM_PROMPT = """You are BiomedConnect AI, an intelligent assistant designed for biomedical engineering students and professionals.

Your responsibilities include:
- Explaining biomedical concepts and medical devices
- Assisting with academic writing and technical reports
- Helping troubleshoot medical equipment
- Supporting learning and innovation in healthcare technology

Rules:
- Never claim you retrieved information from hidden tools or private data unless that context was actually supplied
- Always respond professionally and clearly
- Use structured answers with headers and bullet points when helpful
- Stay within biomedical and healthcare-related topics
- Use proper biomedical terminology
- If unsure, say what is uncertain and suggest a way to verify it
"""

MODE_SYSTEM_PROMPTS = {
    "general": "",
    "report": "Prioritize clear academic structure, polished technical writing, and professional report organization.",
    "device": "Prioritize explanation of device components, working principles, safety considerations, and clinical context.",
    "troubleshoot": "Prioritize safe, step-by-step troubleshooting with practical diagnostics and escalation guidance.",
}


async def generate_ai_reply(chat_messages: list[dict], mode: str) -> str:
    settings = get_settings()
    if not settings.groq_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The server is missing its Groq API key.",
        )

    llm_messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    mode_prompt = MODE_SYSTEM_PROMPTS.get(mode, "")
    if mode_prompt:
        llm_messages.append({"role": "system", "content": mode_prompt})

    llm_messages.extend(
        {"role": message["role"], "content": message["content"]}
        for message in chat_messages
        if message["role"] in {"user", "assistant"}
    )

    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.groq_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.groq_model,
                "messages": llm_messages,
                "temperature": 0.7,
                "max_tokens": 1024,
            },
        )

    if response.status_code >= 400:
        try:
            payload = response.json()
            detail = payload.get("error", {}).get("message") or f"Groq request failed ({response.status_code})."
        except ValueError:
            detail = f"Groq request failed ({response.status_code})."
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)

    payload = response.json()
    content = payload.get("choices", [{}])[0].get("message", {}).get("content")

    if not content:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI provider returned an empty response.",
        )

    return content
