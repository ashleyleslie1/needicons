"""Settings API endpoints."""
from __future__ import annotations
import asyncio
import subprocess
import sys
import json as _json
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
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
    """Public helper: get the decrypted OpenAI API key from config."""
    raw = state.config.get("provider", {}).get("api_key", "")
    return _get_plaintext_key(raw)


def get_stability_key(state) -> str:
    """Public helper: get the decrypted Stability AI API key from config."""
    raw = state.config.get("stability", {}).get("api_key", "")
    return _get_plaintext_key(raw)


def get_openrouter_key(state) -> str:
    """Public helper: get the decrypted OpenRouter API key from config."""
    raw = state.config.get("openrouter", {}).get("api_key", "")
    return _get_plaintext_key(raw)


@router.get("")
async def get_settings(request: Request):
    state = request.app.state.app_state
    provider = state.config.get("provider", {})
    raw_key = provider.get("api_key", "")
    api_key = _get_plaintext_key(raw_key)
    from needicons.core.pipeline.runner import select_backend
    backend = select_backend(state.config)
    stability = state.config.get("stability", {})
    raw_stability_key = stability.get("api_key", "")
    stability_key = _get_plaintext_key(raw_stability_key)
    openrouter = state.config.get("openrouter", {})
    raw_openrouter_key = openrouter.get("api_key", "")
    openrouter_key = _get_plaintext_key(raw_openrouter_key)

    return {
        "edition": state.edition,
        "provider": {
            "api_key": (api_key[:8] + "..." if len(api_key) > 8 else "***") if api_key else "",
            "api_key_set": bool(api_key),
            "default_model": provider.get("default_model", "dall-e-3"),
        },
        "stability": {
            "api_key": (stability_key[:8] + "..." if len(stability_key) > 8 else "***") if stability_key else "",
            "api_key_set": bool(stability_key),
        },
        "openrouter": {
            "api_key": (openrouter_key[:8] + "..." if len(openrouter_key) > 8 else "***") if openrouter_key else "",
            "api_key_set": bool(openrouter_key),
        },
        "processing": {
            "active_backend": backend.value,
        },
    }


@router.put("/provider")
async def update_provider(request: Request):
    body = await request.json()
    state = request.app.state.app_state
    if "api_key" in body:
        if body["api_key"]:
            body["api_key"] = encrypt_value(body["api_key"])
        else:
            body["api_key"] = ""  # Clear key
    state.update_config("provider", body)
    return {"status": "ok"}


@router.put("/stability")
async def update_stability(request: Request):
    body = await request.json()
    state = request.app.state.app_state
    if "api_key" in body:
        if body["api_key"]:
            body["api_key"] = encrypt_value(body["api_key"])
        else:
            body["api_key"] = ""  # Clear key
    state.update_config("stability", body)
    return {"status": "ok"}


@router.put("/openrouter")
async def update_openrouter(request: Request):
    body = await request.json()
    state = request.app.state.app_state
    if "api_key" in body:
        if body["api_key"]:
            body["api_key"] = encrypt_value(body["api_key"])
        else:
            body["api_key"] = ""  # Clear key
    state.update_config("openrouter", body)
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
        "legacy": False,
    },
    "gpt-image-1-mini": {
        "label": "GPT Image 1 Mini",
        "description": "Fast & cheap, transparent backgrounds",
        "supports_n": True,
        "max_n": 10,
        "supports_transparent_bg": True,
        "sizes": ["1024x1024"],
        "qualities": ["low", "medium", "high", "auto"],
        "economy_mode": "n=4 (single call, 4 separate images)",
        "precision_mode": "n=1 (4 calls, 1 image each)",
        "legacy": False,
    },
    "dall-e-3": {
        "label": "DALL-E 3",
        "description": "Legacy — no transparent bg, limited control",
        "supports_n": False,
        "max_n": 1,
        "supports_transparent_bg": False,
        "sizes": ["1024x1024"],
        "qualities": ["standard", "hd"],
        "economy_mode": "2x2 grid in single image (needs splitting)",
        "precision_mode": "1 image per call (4 calls)",
        "legacy": True,
    },
}


_STABILITY_MODEL_CAPABILITIES = {
    "sd3.5-flash": {
        "label": "SD 3.5 Flash",
        "description": "Fast & cheap (2.5 credits)",
        "supports_n": False,
        "max_n": 1,
        "supports_transparent_bg": False,
        "sizes": ["1024x1024"],
        "qualities": [],
        "economy_mode": "1 image per call",
        "precision_mode": "1 image per call",
        "legacy": False,
        "provider": "stability",
    },
    "sd3.5-medium": {
        "label": "SD 3.5 Medium",
        "description": "Balanced quality & speed (3.5 credits)",
        "supports_n": False,
        "max_n": 1,
        "supports_transparent_bg": False,
        "sizes": ["1024x1024"],
        "qualities": [],
        "economy_mode": "1 image per call",
        "precision_mode": "1 image per call",
        "legacy": False,
        "provider": "stability",
    },
    "sd3.5-large-turbo": {
        "label": "SD 3.5 Large Turbo",
        "description": "High quality, fast (4 credits)",
        "supports_n": False,
        "max_n": 1,
        "supports_transparent_bg": False,
        "sizes": ["1024x1024"],
        "qualities": [],
        "economy_mode": "1 image per call",
        "precision_mode": "1 image per call",
        "legacy": False,
        "provider": "stability",
    },
    "sd3.5-large": {
        "label": "SD 3.5 Large",
        "description": "Best quality (6.5 credits)",
        "supports_n": False,
        "max_n": 1,
        "supports_transparent_bg": False,
        "sizes": ["1024x1024"],
        "qualities": [],
        "economy_mode": "1 image per call",
        "precision_mode": "1 image per call",
        "legacy": False,
        "provider": "stability",
    },
}


_OPENROUTER_MODEL_CAPABILITIES = {
    "openrouter/openai/gpt-5.4-image-2": {
        "label": "GPT-5.4 Image 2 (OpenRouter)",
        "description": "Newest OpenAI image model — via OpenRouter",
        "supports_n": False,
        "max_n": 1,
        "supports_transparent_bg": True,
        "sizes": ["1024x1024"],
        "qualities": [],
        "economy_mode": "1 image per call",
        "precision_mode": "1 image per call",
        "legacy": False,
        "provider": "openrouter",
    },
    "openrouter/openai/gpt-5-image": {
        "label": "GPT-5 Image (OpenRouter)",
        "description": "Full-quality OpenAI image — via OpenRouter",
        "supports_n": False,
        "max_n": 1,
        "supports_transparent_bg": True,
        "sizes": ["1024x1024"],
        "qualities": [],
        "economy_mode": "1 image per call",
        "precision_mode": "1 image per call",
        "legacy": False,
        "provider": "openrouter",
    },
    "openrouter/openai/gpt-5-image-mini": {
        "label": "GPT-5 Image Mini (OpenRouter)",
        "description": "Fast & cheap OpenAI image — via OpenRouter",
        "supports_n": False,
        "max_n": 1,
        "supports_transparent_bg": True,
        "sizes": ["1024x1024"],
        "qualities": [],
        "economy_mode": "1 image per call",
        "precision_mode": "1 image per call",
        "legacy": False,
        "provider": "openrouter",
    },
}


@router.get("/models")
async def get_model_capabilities(request: Request):
    state = request.app.state.app_state
    models = {}
    # Only include OpenAI models if key is set
    openai_key = get_api_key(state)
    if openai_key:
        models.update(_MODEL_CAPABILITIES)
    # Only include Stability models if key is set
    stability_key = get_stability_key(state)
    if stability_key:
        models.update(_STABILITY_MODEL_CAPABILITIES)
    # Only include OpenRouter models if key is set
    openrouter_key = get_openrouter_key(state)
    if openrouter_key:
        models.update(_OPENROUTER_MODEL_CAPABILITIES)
    return models


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


# Security: only these packages can be installed via the GUI
_ALLOWED_GPU_PACKAGES = {
    "onnxruntime-directml": "DirectML (DirectX 12 GPU)",
    "onnxruntime-gpu": "CUDA (NVIDIA GPU)",
}


@router.post("/gpu/install")
async def gpu_install(request: Request):
    """Validate package and return instructions for streaming install."""
    body = await request.json()
    package = body.get("package", "")
    if package not in _ALLOWED_GPU_PACKAGES:
        raise HTTPException(status_code=400, detail=f"Package not allowed. Must be one of: {', '.join(_ALLOWED_GPU_PACKAGES.keys())}")
    try:
        subprocess.run([sys.executable, "-m", "pip", "--version"], capture_output=True, check=True, timeout=10)
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        raise HTTPException(status_code=500, detail="pip is not available")
    return {"status": "ok", "package": package}


@router.get("/gpu/install/stream")
async def gpu_install_stream(package: str):
    """SSE stream of pip install output for a GPU package."""
    if package not in _ALLOWED_GPU_PACKAGES:
        raise HTTPException(status_code=400, detail=f"Package not allowed")

    async def event_stream():
        yield f"event: start\ndata: {_json.dumps({'package': package, 'message': f'Installing {package}...'})}\n\n"
        try:
            proc = await asyncio.create_subprocess_exec(
                sys.executable, "-m", "pip", "install", "--user", package,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
            )
            async for line in proc.stdout:
                text = line.decode("utf-8", errors="replace").rstrip()
                if text:
                    yield f"event: output\ndata: {_json.dumps({'line': text})}\n\n"
            await proc.wait()
            if proc.returncode == 0:
                gpu_info = _detect_gpu()
                yield f"event: complete\ndata: {_json.dumps({'success': True, 'providers': gpu_info['available_providers'], 'active_provider': gpu_info['active_provider']})}\n\n"
            else:
                yield f"event: complete\ndata: {_json.dumps({'success': False, 'error': f'pip exited with code {proc.returncode}'})}\n\n"
        except Exception as e:
            yield f"event: complete\ndata: {_json.dumps({'success': False, 'error': str(e)[:200]})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/runpod")
async def get_runpod_settings(request: Request):
    state = request.app.state.app_state
    runpod_config = state.config.get("runpod", {})
    api_key = runpod_config.get("api_key", "")
    if api_key:
        try:
            api_key = _get_plaintext_key(api_key)
        except Exception:
            api_key = ""
    return {
        "enabled": runpod_config.get("enabled", False),
        "api_key": (api_key[:8] + "..." if len(api_key) > 8 else "***") if api_key else "",
        "api_key_set": bool(api_key),
        "endpoint_id": runpod_config.get("endpoint_id", ""),
    }


@router.put("/runpod")
async def update_runpod_settings(request: Request):
    body = await request.json()
    state = request.app.state.app_state
    update = {}
    if "enabled" in body:
        update["enabled"] = bool(body["enabled"])
    if "api_key" in body and body["api_key"]:
        update["api_key"] = encrypt_value(body["api_key"])
    if "endpoint_id" in body:
        update["endpoint_id"] = body["endpoint_id"]
    state.update_config("runpod", update)
    return {"status": "ok"}


@router.post("/runpod/test")
async def test_runpod_connection(request: Request):
    state = request.app.state.app_state
    runpod_config = state.config.get("runpod", {})
    api_key = runpod_config.get("api_key", "")
    if api_key:
        try:
            api_key = decrypt_value(api_key)
        except Exception:
            pass
    endpoint_id = runpod_config.get("endpoint_id", "")
    if not api_key or not endpoint_id:
        raise HTTPException(status_code=400, detail="RunPod API key and endpoint ID are required")
    from needicons.core.processing.runpod import RunPodClient, RunPodError
    client = RunPodClient(api_key=api_key, endpoint_id=endpoint_id)
    try:
        health = await client.health_check()
        return {"status": "connected", "health": health}
    except (RunPodError, Exception) as e:
        return {"status": "error", "error": str(e)[:200]}


@router.get("/processing-log")
async def get_processing_log_endpoint():
    """Return recent processing history showing which backend was used."""
    from needicons.core.pipeline.runner import get_processing_log
    return {"entries": get_processing_log()}


@router.delete("/processing-log")
async def clear_processing_log_endpoint():
    """Clear the processing history."""
    from needicons.core.pipeline.runner import clear_processing_log
    clear_processing_log()
    return {"status": "cleared"}
