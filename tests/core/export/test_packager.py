import pytest
import json
import zipfile
import io
from PIL import Image
from needicons.core.export.packager import build_zip


def _make_icon(color=(255, 0, 0, 255)):
    return Image.new("RGBA", (256, 256), color)


def test_build_zip_creates_valid_zip():
    icons = {"tent": _make_icon(), "jerky": _make_icon((0, 255, 0, 255))}
    data = build_zip(
        icons=icons,
        pack_name="TestPack",
        sizes=[128, 64],
        formats=["png"],
    )
    zf = zipfile.ZipFile(io.BytesIO(data))
    names = zf.namelist()
    assert "png/128/tent.png" in names
    assert "png/128/jerky.png" in names
    assert "png/64/tent.png" in names
    assert "png/64/jerky.png" in names
    assert "manifest.json" in names


def test_build_zip_manifest():
    icons = {"tent": _make_icon()}
    data = build_zip(icons=icons, pack_name="Test", sizes=[64], formats=["png"])
    zf = zipfile.ZipFile(io.BytesIO(data))
    manifest = json.loads(zf.read("manifest.json"))
    assert manifest["pack_name"] == "Test"
    assert manifest["sizes"] == [64]
    assert "tent" in manifest["icons"]


def test_build_zip_correct_sizes():
    icons = {"tent": _make_icon()}
    data = build_zip(icons=icons, pack_name="Test", sizes=[128, 32], formats=["png"])
    zf = zipfile.ZipFile(io.BytesIO(data))
    img_data = zf.read("png/32/tent.png")
    img = Image.open(io.BytesIO(img_data))
    assert img.size == (32, 32)


def test_build_zip_webp_format():
    icons = {"tent": _make_icon()}
    data = build_zip(icons=icons, pack_name="Test", sizes=[64], formats=["webp"])
    zf = zipfile.ZipFile(io.BytesIO(data))
    assert "webp/64/tent.webp" in zf.namelist()


def test_build_zip_svg_format():
    icons = {"tent": _make_icon()}
    data = build_zip(icons=icons, pack_name="Test", sizes=[64], formats=["svg"])
    zf = zipfile.ZipFile(io.BytesIO(data))
    assert "svg/tent.svg" in zf.namelist()
    svg_content = zf.read("svg/tent.svg").decode()
    assert "<svg" in svg_content


def test_build_zip_multi_format():
    icons = {"tent": _make_icon()}
    data = build_zip(icons=icons, pack_name="Test", sizes=[64], formats=["png", "svg"])
    zf = zipfile.ZipFile(io.BytesIO(data))
    names = zf.namelist()
    assert "png/64/tent.png" in names
    assert "svg/tent.svg" in names


def test_build_zip_empty_icons():
    data = build_zip(icons={}, pack_name="Empty", sizes=[64], formats=["png"])
    zf = zipfile.ZipFile(io.BytesIO(data))
    manifest = json.loads(zf.read("manifest.json"))
    assert manifest["icons"] == {}
