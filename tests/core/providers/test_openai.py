import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from PIL import Image
import io
import base64

from needicons.core.providers.base import ImageProvider, GenerationConfig
from needicons.core.providers.openai import OpenAIProvider
from needicons.core.models import GenerationMode


def _make_fake_b64_png(width=256, height=256) -> str:
    img = Image.new("RGBA", (width, height), (255, 0, 0, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def test_provider_is_abc():
    assert issubclass(OpenAIProvider, ImageProvider)


def test_generation_config_defaults():
    cfg = GenerationConfig(style_prompt="flat icons", subject="tent")
    assert cfg.mode == GenerationMode.PRECISION
    assert cfg.model == ""


@pytest.mark.asyncio
async def test_precision_generates_one_call():
    provider = OpenAIProvider(api_key="test-key")
    fake_b64 = _make_fake_b64_png()

    mock_response = MagicMock()
    mock_response.data = [MagicMock(b64_json=fake_b64)]

    with patch.object(provider, "_client") as mock_client:
        mock_client.images.generate = AsyncMock(return_value=mock_response)
        config = GenerationConfig(
            style_prompt="flat icons",
            subject="tent",
            mode=GenerationMode.PRECISION,
        )
        images = await provider.generate(config)
        assert len(images) >= 1
        assert images[0].mode == "RGBA"


@pytest.mark.asyncio
async def test_economy_mode_prompt_includes_four():
    provider = OpenAIProvider(api_key="test-key")
    fake_b64 = _make_fake_b64_png()

    mock_response = MagicMock()
    mock_response.data = [MagicMock(b64_json=fake_b64)]

    with patch.object(provider, "_client") as mock_client:
        mock_client.images.generate = AsyncMock(return_value=mock_response)
        config = GenerationConfig(
            style_prompt="flat",
            subject="tent",
            mode=GenerationMode.ECONOMY,
        )
        await provider.generate(config)
        call_kwargs = mock_client.images.generate.call_args
        prompt = call_kwargs.kwargs.get("prompt", "") or call_kwargs[1].get("prompt", "")
        assert "four" in prompt.lower() or "4" in prompt
