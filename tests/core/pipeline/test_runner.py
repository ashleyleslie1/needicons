import pytest
from PIL import Image
from needicons.core.pipeline.base import PipelineStep
from needicons.core.pipeline.runner import PipelineRunner


class AddRedTintStep(PipelineStep):
    name = "red_tint"

    def process(self, image: Image.Image, config: dict) -> Image.Image:
        """Adds 50 to red channel (capped at 255)."""
        pixels = image.load()
        for x in range(image.width):
            for y in range(image.height):
                r, g, b, a = pixels[x, y]
                pixels[x, y] = (min(r + 50, 255), g, b, a)
        return image

    def can_skip(self, image: Image.Image, config: dict) -> bool:
        return config.get("skip", False)


class FlipHorizontalStep(PipelineStep):
    name = "flip"

    def process(self, image: Image.Image, config: dict) -> Image.Image:
        return image.transpose(Image.FLIP_LEFT_RIGHT)

    def can_skip(self, image: Image.Image, config: dict) -> bool:
        return False


def test_runner_executes_steps_in_order(solid_red_image):
    runner = PipelineRunner(steps=[AddRedTintStep(), FlipHorizontalStep()])
    configs = {"red_tint": {}, "flip": {}}
    result = runner.run(solid_red_image, configs)
    assert result.size == solid_red_image.size
    assert result.mode == "RGBA"


def test_runner_skips_when_can_skip(solid_red_image):
    runner = PipelineRunner(steps=[AddRedTintStep()])
    dark = Image.new("RGBA", (10, 10), (100, 0, 0, 255))

    result_no_skip = runner.run(dark.copy(), {"red_tint": {"skip": False}})
    assert result_no_skip.getpixel((0, 0))[0] == 150

    result_skip = runner.run(dark.copy(), {"red_tint": {"skip": True}})
    assert result_skip.getpixel((0, 0))[0] == 100


def test_runner_empty_steps(solid_red_image):
    runner = PipelineRunner(steps=[])
    result = runner.run(solid_red_image, {})
    assert result.getpixel((128, 128)) == solid_red_image.getpixel((128, 128))


def test_runner_converts_to_rgba():
    rgb_image = Image.new("RGB", (10, 10), (255, 0, 0))
    runner = PipelineRunner(steps=[])
    result = runner.run(rgb_image, {})
    assert result.mode == "RGBA"


def test_runner_reports_steps():
    runner = PipelineRunner(steps=[AddRedTintStep(), FlipHorizontalStep()])
    assert runner.step_names == ["red_tint", "flip"]
