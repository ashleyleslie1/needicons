"""Edge cleanup pipeline step — defringe and feather."""
from __future__ import annotations

import cv2
import numpy as np
from PIL import Image

from needicons.core.pipeline.base import PipelineStep


class EdgeCleanupStep(PipelineStep):
    name = "edge_cleanup"

    def can_skip(self, image: Image.Image, config: dict) -> bool:
        return not config.get("enabled", True)

    def process(self, image: Image.Image, config: dict) -> Image.Image:
        arr = np.array(image)
        alpha = arr[:, :, 3].copy()
        rgb = arr[:, :, :3]

        feather = config.get("feather_radius", 1)
        defringe = config.get("defringe", True)

        if defringe:
            mask_semi = (alpha > 20) & (alpha < 230)
            mask_opaque = alpha >= 230
            if np.any(mask_opaque) and np.any(mask_semi):
                kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
                dilated = cv2.dilate(mask_opaque.astype(np.uint8), kernel, iterations=2)
                opaque_fill = cv2.dilate(
                    (rgb * mask_opaque[:, :, None]).astype(np.uint8),
                    kernel,
                    iterations=2,
                )
                blend = mask_semi & (dilated > 0)
                rgb[blend] = opaque_fill[blend]

        if feather > 0:
            edge = cv2.Canny(alpha, 50, 150)
            edge_dilated = cv2.dilate(edge, None, iterations=feather)
            blurred_alpha = cv2.GaussianBlur(alpha, (0, 0), sigmaX=feather)
            edge_mask = edge_dilated > 0
            alpha[edge_mask] = blurred_alpha[edge_mask]

        arr[:, :, :3] = rgb
        arr[:, :, 3] = alpha
        return Image.fromarray(arr, "RGBA")
