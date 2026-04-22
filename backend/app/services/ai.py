import re

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
- Answer ONLY about biomedical engineering, healthcare, medicine, medical devices, health technology, and closely related areas (including AI/ML, software, and engineering when clearly tied to healthcare or biomedical applications)
- If the user asks about topics clearly outside that scope (general history, sports, entertainment, unrelated politics, etc.), briefly decline and invite them to ask something in your domain—do not provide substantive detail on off-topic subjects
- Use proper biomedical terminology
- If unsure, say what is uncertain and suggest a way to verify it
"""

DOMAIN_CLASSIFIER_PROMPT = """You classify whether the assistant should answer the user's request in a biomedical/healthcare-focused app.

Reply with exactly one word: YES or NO (uppercase).

Answer YES when the latest user message (with conversation context) is about:
- Biomedical engineering, clinical engineering, medical devices, hospital/clinical technology
- Medicine, human physiology, pathology, or healthcare workflows (when educational or technical)
- Health informatics, medical software, regulatory topics for medical devices (e.g. FDA, ISO 13485) when tied to healthcare
- AI, machine learning, or software development when clearly related to healthcare, medicine, or biomedical applications
- Short follow-ups that only make sense in an ongoing biomedical/healthcare discussion (e.g. "thanks", "explain more", "what about the risks", "ok")

Answer NO when the request is primarily about topics with no meaningful link to healthcare or biomedical technology, such as:
- General world history, wars, unrelated geography, sports, celebrities, pure entertainment
- General programming/AI/math with no healthcare or biomedical angle when the user is not in an established biomedical thread

If unsure, prefer NO.

Examples that MUST be NO (reply NO): "explain maji maji war", "what caused World War 2", "who was Napoleon", "tell me about the Roman Empire", "French Revolution summary".

Examples that MUST be YES: "how does an MRI work", "ECG lead placement", "FDA class II device", "machine learning for sepsis prediction", "thanks" (after assistant gave medical content)."""

MODE_SYSTEM_PROMPTS = {
    "general": "",
    "report": "Prioritize clear academic structure, polished technical writing, and professional report organization.",
    "device": "Prioritize explanation of device components, working principles, safety considerations, and clinical context.",
    "troubleshoot": "Prioritize safe, step-by-step troubleshooting with practical diagnostics and escalation guidance.",
}

# If the latest user text matches this, it is in scope unless a strong "off" pattern matches below.
_BIO_ANCHOR = re.compile(
    r"\b(medical|medicine|medicare|health|healthcare|patient|clinical|hospital|biomedical|"
    r"physio|patholog|diagnos|disease|symptom|symptoms|treatment|therap|device|fda|"
    r"iso\s*13485|mri|ct\s*scan|ecg|ekg|eeg|emg|usg|ultrasound|pacemaker|ventilator|"
    r"defibrillator|prosthetic|implant|stent|catheter|drug|pharma|pharmac|surgical|"
    r"anatomy|epidemic|pandemic|infection|sepsis|virus|bacteria|microbio|vaccin|"
    r"immunolog|oncolog|cardio|neuro|orthopedic|radiology|x-?ray|imaging|dicom|"
    r"ehr|emr|informatics|biosensor|biomechan|bioinstrument|telemetry|"
    r"wearable|prosthesis|dialysis|endoscope|laparoscop|sterilization\s+of\s+instruments|"
    r"biostat|lab\s+test|glp|gcp|hipaa|irb|clinical\s+trial|"
    r"ptsd|psychiatr|mental\s+health|nutrition\s+and\s+disease)\b",
    re.I,
)

# Strong off-domain when the message has no biomedical anchor above.
_HISTORY_OR_GENERAL_OFF = re.compile(
    r"\b(maji\s*maji|world\s+war\s*[12]?|ww\s*[12]\b|cold\s+war|"
    r"civil\s+war|holocaust|crusades|napoleon|hitler|stalin|"
    r"roman\s+empire|byzantine|ottoman\s+empire|american\s+revolution|"
    r"french\s+revolution|russian\s+revolution|treaty\s+of\s+versailles|"
    r"colonial\s+(war|rule|africa)|rebellion\s+against|who\s+won\s+the|"
    r"battle\s+of\s+\w+|ancient\s+egypt|ancient\s+greece|mesopotamia|"
    r"explain\s+.+\bwar\b|what\s+caused\s+the\s+\w+\s+war|history\s+of\s+(the\s+)?\w+|"
    r"timeline\s+of\s+(the\s+)?(war|empire|dynasty)|"
    r"\b(soccer|football|nba|nfl|basketball|olympics|celebrity|movie|netflix)\b)",
    re.I,
)


def _latest_user_content(chat_messages: list[dict]) -> str:
    for turn in reversed(chat_messages):
        if turn.get("role") == "user":
            return str(turn.get("content") or "")
    return ""


def quick_off_topic_reject(latest_user: str) -> bool:
    """
    Fast path: reject obvious general-history / sports / entertainment questions
    when the user did not tie the question to healthcare or biomedical topics.
    """
    text = (latest_user or "").strip()
    if len(text) < 4:
        return False
    if _BIO_ANCHOR.search(text):
        return False
    return bool(_HISTORY_OR_GENERAL_OFF.search(text))


def _format_classifier_transcript(chat_messages: list[dict], max_chars: int = 1200) -> str:
    """Last few turns for domain classification (user + assistant only)."""
    lines: list[str] = []
    for turn in chat_messages[-8:]:
        role = turn.get("role")
        if role not in ("user", "assistant"):
            continue
        label = "User" if role == "user" else "Assistant"
        text = (turn.get("content") or "")[:max_chars]
        lines.append(f"{label}: {text}")
    return "\n".join(lines)


def _parse_yes_no(raw: str) -> bool | None:
    s = (raw or "").strip().upper()
    if not s:
        return None
    for match in re.finditer(r"\b(YES|NO)\b", s):
        return match.group(1) == "YES"
    first = s.split()[0] if s.split() else ""
    if first.startswith("YES"):
        return True
    if first.startswith("NO"):
        return False
    return None


async def classify_domain_relevance(chat_messages: list[dict]) -> bool:
    """
    Returns True if the latest user turn is in scope for BiomedConnect (biomedical / healthcare / related tech).
    Uses a fast keyword gate first, then a small LLM. On LLM HTTP errors only, returns True (fail open).
    On empty or unparseable classifier text, returns False (fail closed) so off-topic questions do not leak through.
    """
    settings = get_settings()
    if not settings.groq_api_key:
        return True

    latest = _latest_user_content(chat_messages)
    if quick_off_topic_reject(latest):
        return False

    transcript = _format_classifier_transcript(chat_messages)
    if not transcript.strip():
        return True

    model = (settings.groq_classifier_model or "").strip() or settings.groq_model

    user_block = (
        "Conversation (latest message is the last User line):\n"
        f"{transcript}\n\n"
        "Should this app answer the latest user message? Reply YES or NO only."
    )

    async with httpx.AsyncClient(timeout=min(30.0, settings.request_timeout_seconds)) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.groq_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": DOMAIN_CLASSIFIER_PROMPT},
                    {"role": "user", "content": user_block},
                ],
                "temperature": 0,
                "max_tokens": 8,
            },
        )

    if response.status_code >= 400:
        return True

    payload = response.json()
    content = payload.get("choices", [{}])[0].get("message", {}).get("content") or ""
    parsed = _parse_yes_no(content)
    if parsed is None:
        return False
    return parsed


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
