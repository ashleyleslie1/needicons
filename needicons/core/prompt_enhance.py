"""AI prompt enhancement using gpt-5.4-nano for richer icon generation prompts."""
from __future__ import annotations
from openai import AsyncOpenAI

_SYSTEM_PROMPT = (
    "You are a prompt engineer for icon generation. "
    "Given the user's subject, style, and mood, write a 2-3 sentence image generation prompt. "
    "Focus on visual details specific to the subject. "
    "Include style and mood naturally. "
    "Always end with: Isolated on transparent background, centered."
)


async def enhance_prompt(
    subject: str,
    description: str,
    style: str,
    mood: str,
    style_prompt: str,
    api_key: str,
) -> str:
    """Use gpt-5.4-nano to rewrite generation params into a rich 2-3 sentence prompt."""
    client = AsyncOpenAI(api_key=api_key)

    parts = [f"Subject: {subject}"]
    if description:
        parts.append(f"Description: {description}")
    parts.append(f"Style: {style}")
    if mood and mood != "none":
        parts.append(f"Mood: {mood}")
    if style_prompt:
        parts.append(f"Additional style guide: {style_prompt}")

    user_message = "\n".join(parts)

    response = await client.chat.completions.create(
        model="gpt-5.4-nano",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        max_tokens=200,
        temperature=0.7,
    )

    return response.choices[0].message.content or ""
