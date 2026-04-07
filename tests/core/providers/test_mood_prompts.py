"""Tests for mood prompt integration."""
import pytest
from needicons.core.providers.openai import _MOOD_PROMPTS, _build_single_prompt
from needicons.core.providers.base import GenerationConfig
from needicons.core.models import IconStyle


def test_mood_prompts_dict_exists():
    assert isinstance(_MOOD_PROMPTS, dict)
    assert "none" in _MOOD_PROMPTS
    assert "cinematic" in _MOOD_PROMPTS
    assert "vibrant" in _MOOD_PROMPTS
    assert "dynamic" in _MOOD_PROMPTS
    assert "fashion" in _MOOD_PROMPTS
    assert "portrait" in _MOOD_PROMPTS
    assert "stock_photo" in _MOOD_PROMPTS


def test_mood_none_is_empty():
    assert _MOOD_PROMPTS["none"] == ""


def test_mood_included_in_prompt():
    config = GenerationConfig(style_prompt="", subject="rocket", mood="cinematic")
    prompt = _build_single_prompt(config)
    assert "Dramatic lighting" in prompt


def test_mood_none_not_in_prompt():
    config = GenerationConfig(style_prompt="", subject="rocket", mood="none")
    prompt = _build_single_prompt(config)
    assert "Dramatic lighting" not in prompt
    assert "Saturated" not in prompt


def test_mood_default_empty():
    config = GenerationConfig(style_prompt="", subject="rocket")
    assert config.mood == ""
