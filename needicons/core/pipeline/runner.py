"""Pipeline runner — executes steps in configured order with backend selection."""
from __future__ import annotations

import datetime
from enum import Enum
from typing import Optional

from PIL import Image

from needicons.core.pipeline.base import PipelineStep


class ProcessingBackend(str, Enum):
    LOCAL_CPU = "local_cpu"
    LOCAL_GPU = "local_gpu"
    RUNPOD = "runpod"


# Steps that can be offloaded to RunPod (heavy ML)
_RUNPOD_ELIGIBLE_STEPS = {"background_removal"}


class ProcessingLogEntry:
    """Records which backend was used for a processing operation."""

    def __init__(self, operation: str, backend: ProcessingBackend, duration_ms: float = 0, detail: str = ""):
        self.timestamp = datetime.datetime.utcnow().isoformat()
        self.operation = operation
        self.backend = backend.value
        self.duration_ms = round(duration_ms, 1)
        self.detail = detail

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "operation": self.operation,
            "backend": self.backend,
            "duration_ms": self.duration_ms,
            "detail": self.detail,
        }


# In-memory processing log (most recent 100 entries)
_processing_log: list[dict] = []
_MAX_LOG_ENTRIES = 100


def log_processing(operation: str, backend: ProcessingBackend, duration_ms: float = 0, detail: str = ""):
    """Add an entry to the processing history log."""
    entry = ProcessingLogEntry(operation, backend, duration_ms, detail)
    _processing_log.append(entry.to_dict())
    if len(_processing_log) > _MAX_LOG_ENTRIES:
        _processing_log.pop(0)


def get_processing_log() -> list[dict]:
    """Return the processing history log (newest first)."""
    return list(reversed(_processing_log))


def clear_processing_log():
    """Clear the processing history."""
    _processing_log.clear()


class PipelineRunner:
    """Runs a sequence of PipelineSteps on an image."""

    def __init__(self, steps: list[PipelineStep]):
        self._steps = steps

    @property
    def step_names(self) -> list[str]:
        return [s.name for s in self._steps]

    def run(self, image: Image.Image, configs: dict[str, dict]) -> Image.Image:
        """Execute all steps on the image.

        Args:
            image: Input image (any mode, converted to RGBA).
            configs: Dict mapping step name -> config dict for that step.

        Returns:
            Processed RGBA image.
        """
        if image.mode != "RGBA":
            image = image.convert("RGBA")

        for step in self._steps:
            config = configs.get(step.name, {})
            if step.can_skip(image, config):
                continue
            import time
            t0 = time.perf_counter()
            image = step.process(image, config)
            elapsed = (time.perf_counter() - t0) * 1000
            # Log processing for ML-heavy steps
            if step.name in _RUNPOD_ELIGIBLE_STEPS or elapsed > 100:
                gpu_provider = config.get("gpu_provider", "cpu")
                backend = ProcessingBackend.LOCAL_GPU if gpu_provider != "cpu" else ProcessingBackend.LOCAL_CPU
                log_processing(step.name, backend, elapsed, f"local pipeline step")

        return image


def select_backend(config: dict) -> ProcessingBackend:
    """Determine the best processing backend based on configuration.

    Priority: RunPod (if enabled+configured) > Local GPU > Local CPU
    """
    runpod_config = config.get("runpod", {})
    if runpod_config.get("enabled") and runpod_config.get("api_key") and runpod_config.get("endpoint_id"):
        return ProcessingBackend.RUNPOD

    gpu_config = config.get("gpu", {})
    preference = gpu_config.get("provider", "auto")
    if preference != "cpu":
        try:
            import onnxruntime as ort
            available = ort.get_available_providers()
            if any(p != "CPUExecutionProvider" for p in available):
                return ProcessingBackend.LOCAL_GPU
        except ImportError:
            pass

    return ProcessingBackend.LOCAL_CPU


def is_runpod_eligible(step_name: str) -> bool:
    """Check if a pipeline step can be offloaded to RunPod."""
    return step_name in _RUNPOD_ELIGIBLE_STEPS
