"""Export packager — builds ZIP files with resolution folders."""
from __future__ import annotations
import io
import json
import zipfile
from datetime import datetime, timezone
from PIL import Image
from needicons.core.pipeline.resize import resize_multi


def build_zip(
    icons: dict[str, Image.Image],
    pack_name: str,
    sizes: list[int],
    formats: list[str],
    sharpen_below: int = 48,
    profile_name: str = "",
) -> bytes:
    buf = io.BytesIO()
    manifest_icons = {}

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, image in icons.items():
            resized = resize_multi(image, sizes, sharpen_below)
            manifest_icons[name] = {"sizes": list(resized.keys()), "formats": formats}

            for size, img in resized.items():
                for fmt in formats:
                    img_buf = io.BytesIO()
                    save_format = "PNG" if fmt == "png" else fmt.upper()
                    if save_format == "WEBP":
                        img.save(img_buf, format="WEBP", lossless=True)
                    else:
                        img.save(img_buf, format=save_format)
                    zf.writestr(f"{size}x/{name}.{fmt}", img_buf.getvalue())

        manifest = {
            "pack_name": pack_name,
            "profile": profile_name,
            "sizes": sizes,
            "formats": formats,
            "icons": manifest_icons,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        zf.writestr("manifest.json", json.dumps(manifest, indent=2))

    return buf.getvalue()
