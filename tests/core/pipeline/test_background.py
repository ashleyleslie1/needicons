import pytest
from PIL import Image
from needicons.core.pipeline.background import BackgroundRemovalStep


def test_skip_if_already_transparent(icon_on_transparent):
    step = BackgroundRemovalStep()
    assert step.can_skip(icon_on_transparent, {"enabled": True}) is True


def test_does_not_skip_opaque(icon_on_white):
    step = BackgroundRemovalStep()
    assert step.can_skip(icon_on_white, {"enabled": True}) is False


def test_skip_if_disabled(icon_on_white):
    step = BackgroundRemovalStep()
    assert step.can_skip(icon_on_white, {"enabled": False}) is True


def test_process_removes_background(icon_on_white):
    step = BackgroundRemovalStep()
    result = step.process(icon_on_white, {"model": "u2net", "alpha_matting": False})
    # Corner pixel (was white) should now have low alpha
    corner_alpha = result.getpixel((0, 0))[3]
    # Center pixel (was red) should retain high alpha
    center_alpha = result.getpixel((128, 128))[3]
    assert center_alpha > corner_alpha


def test_has_correct_name():
    step = BackgroundRemovalStep()
    assert step.name == "background_removal"
