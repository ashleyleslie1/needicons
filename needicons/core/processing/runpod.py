"""RunPod serverless client for offloading heavy ML processing."""
from __future__ import annotations

import asyncio
import base64
import io
import logging
from typing import Optional

import httpx
from PIL import Image

logger = logging.getLogger(__name__)

RUNPOD_API_BASE = "https://api.runpod.ai/v2"


class RunPodError(Exception):
    pass


class RunPodClient:
    """Async client for RunPod serverless endpoints."""

    def __init__(self, api_key: str, endpoint_id: str, timeout: float = 120.0):
        self._api_key = api_key
        self._endpoint_id = endpoint_id
        self._timeout = timeout
        self._base_url = f"{RUNPOD_API_BASE}/{endpoint_id}"
        self._headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    async def health_check(self) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{self._base_url}/health", headers=self._headers)
            resp.raise_for_status()
            return resp.json()

    async def remove_background(
        self, image: Image.Image, model: str = "isnet-general-use",
        alpha_matting: bool = True, fg_threshold: int = 240, bg_threshold: int = 20,
    ) -> Image.Image:
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        image_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        payload = {
            "input": {
                "image_b64": image_b64, "model": model,
                "alpha_matting": alpha_matting,
                "fg_threshold": fg_threshold, "bg_threshold": bg_threshold,
            }
        }

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(f"{self._base_url}/runsync", headers=self._headers, json=payload)

            if resp.status_code == 200:
                result = resp.json()
                if result.get("status") == "COMPLETED":
                    return self._decode_result(result)
                elif result.get("status") == "FAILED":
                    raise RunPodError(f"Job failed: {result.get('error', 'unknown')}")

            if resp.status_code in (200, 201):
                result = resp.json()
                job_id = result.get("id")
                if job_id:
                    return await self._poll_job(client, job_id)

            resp.raise_for_status()
            raise RunPodError(f"Unexpected response: {resp.status_code}")

    async def _poll_job(self, client: httpx.AsyncClient, job_id: str) -> Image.Image:
        poll_url = f"{self._base_url}/status/{job_id}"
        for _ in range(int(self._timeout / 2)):
            await asyncio.sleep(2.0)
            resp = await client.get(poll_url, headers=self._headers)
            resp.raise_for_status()
            result = resp.json()
            status = result.get("status")
            if status == "COMPLETED":
                return self._decode_result(result)
            elif status == "FAILED":
                raise RunPodError(f"Job failed: {result.get('error', 'unknown')}")
            elif status in ("IN_QUEUE", "IN_PROGRESS"):
                continue
            else:
                raise RunPodError(f"Unknown job status: {status}")
        raise RunPodError(f"Job {job_id} timed out after {self._timeout}s")

    def _decode_result(self, result: dict) -> Image.Image:
        output = result.get("output", {})
        result_b64 = output.get("result_b64")
        if not result_b64:
            raise RunPodError("No result_b64 in RunPod response")
        return Image.open(io.BytesIO(base64.b64decode(result_b64))).convert("RGBA")


def create_client(config: dict) -> Optional[RunPodClient]:
    """Create a RunPod client from config, or None if not configured."""
    if not config.get("enabled"):
        return None
    api_key = config.get("api_key", "")
    endpoint_id = config.get("endpoint_id", "")
    if not api_key or not endpoint_id:
        return None
    return RunPodClient(api_key=api_key, endpoint_id=endpoint_id)
