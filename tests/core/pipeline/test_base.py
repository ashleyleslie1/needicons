import pytest
from PIL import Image
from needicons.core.pipeline.base import PipelineStep


class InvertAlphaStep(PipelineStep):
    name = "invert_alpha"

    def process(self, image: Image.Image, config: dict) -> Image.Image:
        """Test step: inverts alpha channel."""
        r, g, b, a = image.split()
        from PIL import ImageChops
        a = ImageChops.invert(a)
        return Image.merge("RGBA", (r, g, b, a))

    def can_skip(self, image: Image.Image, config: dict) -> bool:
        return config.get("skip", False)


def test_step_has_name():
    step = InvertAlphaStep()
    assert step.name == "invert_alpha"


def test_step_process(solid_red_image):
    step = InvertAlphaStep()
    result = step.process(solid_red_image, {})
    assert result.getpixel((128, 128))[3] == 0


def test_step_can_skip(solid_red_image):
    step = InvertAlphaStep()
    assert step.can_skip(solid_red_image, {"skip": False}) is False
    assert step.can_skip(solid_red_image, {"skip": True}) is True


def test_abstract_step_cannot_instantiate():
    with pytest.raises(TypeError):
        PipelineStep()
