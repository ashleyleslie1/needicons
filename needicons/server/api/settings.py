"""Settings API endpoints."""
from __future__ import annotations
from fastapi import APIRouter, Request
from needicons.server.crypto import encrypt_value, decrypt_value

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _detect_gpu() -> dict:
    """Detect available GPU acceleration backends."""
    result = {
        "active_provider": "cpu",
        "available_providers": [{"id": "cpu", "name": "CPU", "available": True}],
        "detail": "CPU only",
    }
    try:
        import onnxruntime as ort
        available = ort.get_available_providers()
        providers = [{"id": "cpu", "name": "CPU", "available": True}]

        if "DmlExecutionProvider" in available:
            providers.append({
                "id": "directml",
                "name": "DirectML (DirectX 12 GPU)",
                "available": True,
            })
            result["active_provider"] = "directml"
            result["detail"] = "DirectML (DirectX 12 GPU)"

        if "CUDAExecutionProvider" in available:
            providers.append({
                "id": "cuda",
                "name": "CUDA (NVIDIA GPU)",
                "available": True,
            })
            result["active_provider"] = "cuda"
            result["detail"] = "CUDA (NVIDIA GPU)"

        if "ROCMExecutionProvider" in available:
            providers.append({
                "id": "rocm",
                "name": "ROCm (AMD GPU)",
                "available": True,
            })
            result["active_provider"] = "rocm"
            result["detail"] = "ROCm (AMD GPU)"

        result["available_providers"] = providers
    except ImportError:
        pass
    return result


def _get_plaintext_key(stored: str) -> str:
    """Decrypt an API key from config. Returns empty string if decryption fails."""
    if not stored:
        return ""
    try:
        return decrypt_value(stored)
    except Exception:
        return ""


def get_api_key(state) -> str:
    """Public helper: get the decrypted API key from config."""
    raw = state.config.get("provider", {}).get("api_key", "")
    return _get_plaintext_key(raw)


@router.get("")
async def get_settings(request: Request):
    state = request.app.state.app_state
    provider = state.config.get("provider", {})
    raw_key = provider.get("api_key", "")
    api_key = _get_plaintext_key(raw_key)
    return {
        "provider": {
            "api_key": (api_key[:8] + "..." if len(api_key) > 8 else "***") if api_key else "",
            "api_key_set": bool(api_key),
            "default_model": provider.get("default_model", "dall-e-3"),
        }
    }


@router.put("/provider")
async def update_provider(request: Request):
    body = await request.json()
    state = request.app.state.app_state
    # Encrypt API key before storing
    if "api_key" in body and body["api_key"]:
        body["api_key"] = encrypt_value(body["api_key"])
    state.update_config("provider", body)
    return {"status": "ok"}


@router.get("/gpu")
async def gpu_info(request: Request):
    state = request.app.state.app_state
    gpu = _detect_gpu()
    # Override active_provider with user preference if set
    gpu_config = state.config.get("gpu", {})
    preference = gpu_config.get("provider", "auto")
    gpu["preference"] = preference
    return gpu


# Hardcoded model capabilities — OpenAI has no API to discover these.
_MODEL_CAPABILITIES = {
    "gpt-image-1.5": {
        "label": "GPT Image 1.5",
        "description": "Best quality, transparent backgrounds",
        "supports_n": True,
        "max_n": 10,
        "supports_transparent_bg": True,
        "sizes": ["1024x1024"],
        "qualities": ["low", "medium", "high", "auto"],
        "economy_mode": "n=4 (single call, 4 separate images)",
        "precision_mode": "n=1 (4 calls, 1 image each)",
    },
    "gpt-image-1": {
        "label": "GPT Image 1",
        "description": "High quality, transparent backgrounds",
        "supports_n": True,
        "max_n": 10,
        "supports_transparent_bg": True,
        "sizes": ["1024x1024"],
        "qualities": ["low", "medium", "high", "auto"],
        "economy_mode": "n=4 (single call, 4 separate images)",
        "precision_mode": "n=1 (4 calls, 1 image each)",
    },
    "gpt-image-1-mini": {
        "label": "GPT Image Mini",
        "description": "Fast & cheap, transparent backgrounds",
        "supports_n": True,
        "max_n": 10,
        "supports_transparent_bg": True,
        "sizes": ["1024x1024"],
        "qualities": ["low", "medium", "high", "auto"],
        "economy_mode": "n=4 (single call, 4 separate images)",
        "precision_mode": "n=1 (4 calls, 1 image each)",
    },
    "dall-e-3": {
        "label": "DALL-E 3",
        "description": "Classic, no transparent bg support",
        "supports_n": False,
        "max_n": 1,
        "supports_transparent_bg": False,
        "sizes": ["1024x1024"],
        "qualities": ["standard", "hd"],
        "economy_mode": "2x2 grid in single image (needs splitting)",
        "precision_mode": "1 image per call (4 calls)",
    },
}


@router.get("/models")
async def get_model_capabilities():
    return _MODEL_CAPABILITIES


@router.put("/gpu")
async def update_gpu(request: Request):
    body = await request.json()
    state = request.app.state.app_state
    preference = body.get("provider", "auto")
    state.update_config("gpu", {"provider": preference})
    # Clear cached sessions so new provider takes effect
    from needicons.core.pipeline.background import clear_session_cache
    clear_session_cache()
    return {"status": "ok", "provider": preference}
