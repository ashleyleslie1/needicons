"""Settings API endpoints."""
from __future__ import annotations
from fastapi import APIRouter, Request
from needicons.server.crypto import encrypt_value, decrypt_value

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _detect_gpu() -> dict:
    result = {"backend": "cpu", "available": False, "detail": "CPU only"}
    try:
        import onnxruntime as ort
        providers = ort.get_available_providers()
        if "DmlExecutionProvider" in providers:
            result = {"backend": "directml", "available": True, "detail": "DirectML (DirectX 12 GPU)"}
        elif "CUDAExecutionProvider" in providers:
            result = {"backend": "cuda", "available": True, "detail": "CUDA (NVIDIA GPU)"}
        else:
            result = {"backend": "cpu", "available": True, "detail": "CPU (no GPU acceleration)"}
    except ImportError:
        pass
    return result


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


def _get_plaintext_key(stored: str) -> str:
    """Decrypt an API key from config. Handles both encrypted and legacy plaintext keys."""
    if not stored:
        return ""
    try:
        return decrypt_value(stored)
    except Exception:
        # Legacy plaintext key — return as-is
        return stored


def get_api_key(state) -> str:
    """Public helper: get the decrypted API key from config."""
    raw = state.config.get("provider", {}).get("api_key", "")
    return _get_plaintext_key(raw)


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
async def gpu_info():
    return _detect_gpu()
