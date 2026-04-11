"""Export packager — builds ZIP files with resolution folders."""
from __future__ import annotations
import io
import json
import re
import zipfile
from datetime import datetime, timezone
from PIL import Image
from needicons.core.pipeline.resize import resize_multi
from needicons.core.pipeline.signature import encode as _sign


def _simplify_path_precision(svg_str: str, precision: int = 1) -> str:
    """Reduce coordinate precision in SVG path data to shrink file size.

    Rounds all floating-point numbers in path 'd' attributes to fewer decimal places.
    This is the main size reduction for computer-generated SVGs from vtracer.
    """
    def _round_numbers_in_d(match: re.Match) -> str:
        d_value = match.group(1)
        # Round all floating point numbers to specified precision
        def _round(m: re.Match) -> str:
            val = float(m.group(0))
            rounded = round(val, precision)
            # Use integer if no fractional part
            if rounded == int(rounded):
                return str(int(rounded))
            return f"{rounded:.{precision}f}"
        rounded_d = re.sub(r'-?\d+\.\d+', _round, d_value)
        return f'd="{rounded_d}"'
    return re.sub(r'd="([^"]*)"', _round_numbers_in_d, svg_str)


def _merge_adjacent_paths(svg_str: str) -> str:
    """Merge <path> elements with the same fill color into one path.

    vtracer outputs many small path elements with the same color — merging
    them into a single path with combined 'd' data significantly reduces file size.
    Uses regex to avoid XML namespace prefix issues from ElementTree.
    """
    # Extract all path elements with their attributes
    path_pattern = re.compile(r'<path\s+([^>]*)/?>', re.DOTALL)
    paths = path_pattern.findall(svg_str)
    if len(paths) < 2:
        return svg_str

    # Parse each path's attributes
    def parse_attrs(attr_str: str) -> dict:
        return dict(re.findall(r'(\w[\w-]*)="([^"]*)"', attr_str))

    # Group by fill + transform + opacity (visual identity)
    groups: dict[str, list[dict]] = {}
    for attr_str in paths:
        attrs = parse_attrs(attr_str)
        key = (
            attrs.get("fill", ""),
            attrs.get("fill-opacity", ""),
            attrs.get("opacity", ""),
            attrs.get("transform", ""),
        )
        groups.setdefault(str(key), []).append(attrs)

    # Only merge if we'd actually reduce path count
    mergeable = sum(1 for g in groups.values() if len(g) > 1)
    if mergeable == 0:
        return svg_str

    # Build merged paths
    merged_paths = []
    for group_paths in groups.values():
        if len(group_paths) == 1:
            merged_paths.append(group_paths[0])
        else:
            merged = group_paths[0].copy()
            merged["d"] = " ".join(p.get("d", "") for p in group_paths)
            merged_paths.append(merged)

    # Rebuild SVG: keep everything outside paths, replace paths with merged
    # Remove old paths
    cleaned = path_pattern.sub("", svg_str)
    # Find insertion point (before </svg>)
    insert_pos = cleaned.rfind("</svg>")
    if insert_pos == -1:
        return svg_str

    # Build new path elements
    new_paths = []
    for attrs in merged_paths:
        attr_pairs = " ".join(f'{k}="{v}"' for k, v in attrs.items())
        new_paths.append(f'<path {attr_pairs} />')

    return cleaned[:insert_pos] + "\n".join(new_paths) + "\n" + cleaned[insert_pos:]


def _posterize_svg_colors(svg_str: str, max_colors: int = 12) -> str:
    """Reduce the number of unique fill colors in SVG by clustering similar colors.

    Finds all fill colors, clusters them via nearest-neighbor into max_colors
    buckets, then replaces each path's fill with its nearest cluster center.
    After this, _merge_adjacent_paths can combine paths that now share a color.
    """
    path_pattern = re.compile(r'<path\s+([^>]*)/?>', re.DOTALL)
    paths = path_pattern.findall(svg_str)
    if not paths:
        return svg_str

    def parse_hex(color: str) -> tuple | None:
        color = color.strip()
        if color.startswith("#") and len(color) == 7:
            try:
                return (int(color[1:3], 16), int(color[3:5], 16), int(color[5:7], 16))
            except ValueError:
                return None
        if color.startswith("rgb("):
            nums = re.findall(r'\d+', color)
            if len(nums) >= 3:
                return (int(nums[0]), int(nums[1]), int(nums[2]))
        return None

    def to_hex(rgb: tuple) -> str:
        return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"

    # Collect all unique fill colors
    all_colors = set()
    for attr_str in paths:
        attrs = dict(re.findall(r'(\w[\w-]*)="([^"]*)"', attr_str))
        fill = attrs.get("fill", "")
        rgb = parse_hex(fill)
        if rgb:
            all_colors.add(rgb)

    if len(all_colors) <= max_colors:
        return svg_str  # Already few enough colors

    # Simple k-means-style clustering: pick initial centers spread across colors,
    # then assign each color to nearest center
    color_list = list(all_colors)
    # Use median-cut-like initialization: sort by luminance and pick evenly spaced
    color_list.sort(key=lambda c: c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114)
    step = max(1, len(color_list) // max_colors)
    centers = [color_list[i * step] for i in range(min(max_colors, len(color_list)))]

    # Assign each color to nearest center
    def nearest(rgb: tuple) -> tuple:
        best = centers[0]
        best_dist = sum((a - b) ** 2 for a, b in zip(rgb, best))
        for c in centers[1:]:
            d = sum((a - b) ** 2 for a, b in zip(rgb, c))
            if d < best_dist:
                best_dist = d
                best = c
        return best

    color_map = {to_hex(c): to_hex(nearest(c)) for c in all_colors}

    # Replace fill colors in SVG
    def replace_fill(match: re.Match) -> str:
        attr_str = match.group(1)
        def swap_color(m: re.Match) -> str:
            old = m.group(1)
            return f'fill="{color_map.get(old, old)}"'
        new_attrs = re.sub(r'fill="([^"]*)"', swap_color, attr_str)
        return f'<path {new_attrs} />'

    return path_pattern.sub(replace_fill, svg_str)


def optimize_svg(svg_str: str) -> str:
    """Optimize SVG with scour — shortens coordinates (absolute→relative),
    removes redundant path commands, minifies to single line. ~4-5 seconds.
    """
    from scour.scour import scourString
    from scour import scour as scour_mod

    options = scour_mod.parse_args([
        "--enable-id-stripping",
        "--enable-comment-stripping",
        "--shorten-ids",
        "--indent=none",
        "--no-line-breaks",
        "--remove-metadata",
    ])
    options.remove_descriptive_elements = True
    options.strip_xml_prolog = False
    return scourString(svg_str, options=options)


def svg_to_react(svg_str: str, component_name: str = "Icon") -> str:
    """Convert raw SVG to a React functional component (JSX)."""
    # Extract inner content and attributes
    match = re.search(r'<svg([^>]*)>(.*)</svg>', svg_str, re.DOTALL)
    if not match:
        return svg_str
    attrs_str, inner = match.group(1), match.group(2)

    # Extract width/height
    w = re.search(r'width="(\d+)"', attrs_str)
    h = re.search(r'height="(\d+)"', attrs_str)
    width = w.group(1) if w else "24"
    height = h.group(1) if h else "24"

    # Convert SVG attributes to JSX (kebab-case to camelCase)
    inner = inner.replace('fill-rule', 'fillRule')
    inner = inner.replace('clip-rule', 'clipRule')
    inner = inner.replace('stroke-width', 'strokeWidth')
    inner = inner.replace('stroke-linecap', 'strokeLinecap')
    inner = inner.replace('stroke-linejoin', 'strokeLinejoin')

    return f'''import * as React from "react";

const {component_name} = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={{{width}}} height={{{height}}} {{...props}}>
    {inner.strip()}
  </svg>
);

export default {component_name};
'''


def svg_to_react_native(svg_str: str, component_name: str = "Icon") -> str:
    """Convert raw SVG to a React Native component using react-native-svg."""
    match = re.search(r'<svg([^>]*)>(.*)</svg>', svg_str, re.DOTALL)
    if not match:
        return svg_str
    attrs_str, inner = match.group(1), match.group(2)

    w = re.search(r'width="(\d+)"', attrs_str)
    h = re.search(r'height="(\d+)"', attrs_str)
    width = w.group(1) if w else "24"
    height = h.group(1) if h else "24"

    # Convert <path to <Path, <circle to <Circle, etc.
    inner = re.sub(r'<(path|circle|rect|ellipse|line|polyline|polygon|g)', lambda m: f'<{m.group(1).capitalize()}', inner)
    inner = re.sub(r'</(path|circle|rect|ellipse|line|polyline|polygon|g)>', lambda m: f'</{m.group(1).capitalize()}>', inner)
    inner = inner.replace('fill-rule', 'fillRule')
    inner = inner.replace('clip-rule', 'clipRule')
    inner = inner.replace('stroke-width', 'strokeWidth')

    # Collect used SVG elements for imports
    elements = set(re.findall(r'<(Path|Circle|Rect|Ellipse|Line|Polyline|Polygon|G)', inner))
    imports = ", ".join(sorted(elements))

    return f'''import * as React from "react";
import Svg, {{ {imports} }} from "react-native-svg";

const {component_name} = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width={{{width}}} height={{{height}}} {{...props}}>
    {inner.strip()}
  </Svg>
);

export default {component_name};
'''


def _raster_to_svg(image: Image.Image, smoothing: int = 1) -> str:
    """Convert a PIL RGBA image to SVG using vtracer.

    Key to small file size: quantize colors so vtracer traces fewer regions,
    then merge same-color paths and reduce coordinate precision.
    """
    import vtracer
    import numpy as np

    img = image.convert("RGBA")

    # Smoothing 1-5: apply increasing Gaussian blur before tracing
    s = max(1, min(5, smoothing))
    if s > 1:
        from PIL import ImageFilter
        blur_radius = [0, 0.5, 1.0, 1.5, 2.5][s - 1]
        img = img.filter(ImageFilter.GaussianBlur(radius=blur_radius))

    arr = np.array(img)

    # Remove near-invisible noise
    arr[arr[:, :, 3] < 10] = [0, 0, 0, 0]

    # Quantize colors: reduce to 32 colors.
    alpha = arr[:, :, 3].copy()
    rgb_img = Image.fromarray(arr[:, :, :3], "RGB")
    quantized = rgb_img.quantize(colors=32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    rgb_back = quantized.convert("RGB")
    result = np.array(rgb_back)

    # Recompose with original alpha, binary threshold for clean edges
    final = np.dstack([result, np.where(alpha > 128, 255, 0).astype(np.uint8)])
    img = Image.fromarray(final, "RGBA")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    png_bytes = buf.getvalue()

    svg_str = vtracer.convert_raw_image_to_svg(
        png_bytes,
        img_format="png",
        colormode="color",
        hierarchical="stacked",
        filter_speckle=8,
        color_precision=4,
        layer_difference=32,
        corner_threshold=60,
        length_threshold=4.0,
        max_iterations=10,
        splice_threshold=45,
        path_precision=2,
    )

    return svg_str


def build_zip(
    icons: dict[str, Image.Image | tuple[Image.Image, list[int]]],
    pack_name: str,
    sizes: list[int],
    formats: list[str],
    sharpen_below: int = 48,
    profile_name: str = "",
    svg_smoothing: int = 1,
    svg_optimize: bool = False,
) -> bytes:
    buf = io.BytesIO()
    manifest_icons = {}
    has_svg = "svg" in formats
    raster_formats = [f for f in formats if f != "svg"]

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, entry in icons.items():
            if isinstance(entry, tuple):
                image, icon_sizes = entry
            else:
                image, icon_sizes = entry, sizes
            resized = resize_multi(image, icon_sizes, sharpen_below)
            manifest_icons[name] = {"sizes": list(resized.keys()), "formats": formats}

            for fmt in raster_formats:
                for size, img in resized.items():
                    # Tag processed images with pipeline signature
                    out = _sign(img) if fmt == "png" else img
                    img_buf = io.BytesIO()
                    save_format = "PNG" if fmt == "png" else fmt.upper()
                    if save_format == "WEBP":
                        out.save(img_buf, format="WEBP", lossless=True)
                    else:
                        out.save(img_buf, format=save_format)
                    zf.writestr(f"{fmt}/{size}/{name}.{fmt}", img_buf.getvalue())

            if has_svg:
                largest = resized[max(resized.keys())]
                svg_str = _raster_to_svg(largest, smoothing=svg_smoothing)
                if svg_optimize:
                    svg_str = optimize_svg(svg_str)
                zf.writestr(f"svg/{name}.svg", svg_str)

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
