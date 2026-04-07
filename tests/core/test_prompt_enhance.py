"""Tests for AI prompt enhancement module."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_enhance_prompt_calls_openai():
    from needicons.core.prompt_enhance import enhance_prompt

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content="Enhanced prompt text here."))]
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch("needicons.core.prompt_enhance.AsyncOpenAI", return_value=mock_client):
        result = await enhance_prompt(
            subject="rocket",
            description="a space rocket launching",
            style="solid",
            mood="cinematic",
            style_prompt="Filled, single-color icon.",
            api_key="test-key",
        )

    assert result == "Enhanced prompt text here."
    call_kwargs = mock_client.chat.completions.create.call_args.kwargs
    assert call_kwargs["model"] == "gpt-5.4-nano"
    assert len(call_kwargs["messages"]) == 2
    assert call_kwargs["messages"][0]["role"] == "system"
    assert "prompt engineer" in call_kwargs["messages"][0]["content"]
    assert "rocket" in call_kwargs["messages"][1]["content"]


@pytest.mark.asyncio
async def test_enhance_prompt_returns_content():
    from needicons.core.prompt_enhance import enhance_prompt

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content="A detailed icon of a rocket."))]
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch("needicons.core.prompt_enhance.AsyncOpenAI", return_value=mock_client):
        result = await enhance_prompt(
            subject="rocket", description="", style="outline",
            mood="none", style_prompt="Line-drawn icon.", api_key="test-key",
        )

    assert isinstance(result, str)
    assert len(result) > 0


@pytest.mark.asyncio
async def test_enhance_prompt_includes_all_params():
    from needicons.core.prompt_enhance import enhance_prompt

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content="Result."))]
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch("needicons.core.prompt_enhance.AsyncOpenAI", return_value=mock_client):
        await enhance_prompt(
            subject="tent", description="camping tent",
            style="sticker", mood="vibrant",
            style_prompt="Playful rounded feel.", api_key="test-key",
        )

    call_kwargs = mock_client.chat.completions.create.call_args.kwargs
    user_msg = call_kwargs["messages"][1]["content"]
    assert "tent" in user_msg
    assert "camping tent" in user_msg
    assert "sticker" in user_msg
    assert "vibrant" in user_msg
    assert "Playful rounded feel" in user_msg


@pytest.mark.asyncio
async def test_enhance_prompt_handles_empty_response():
    from needicons.core.prompt_enhance import enhance_prompt

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content=None))]
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch("needicons.core.prompt_enhance.AsyncOpenAI", return_value=mock_client):
        result = await enhance_prompt(
            subject="star", description="", style="flat",
            mood="none", style_prompt="", api_key="test-key",
        )

    assert result == ""
