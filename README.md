# NeedIcons

AI-powered icon pack generator with professional post-processing.

Generate consistent, production-ready icon packs using AI (OpenAI GPT-4o / DALL-E 3) with automated background removal, centering, styling, and multi-resolution export.

## Features

- **AI Generation** — GPT-4o and DALL-E 3 support with precision (1 icon) and economy (4 icons) modes
- **Auto Post-Processing** — Background removal, edge cleanup, visual weight normalization
- **Consistent Styling** — Stroke, shape mask, color overlay, shadows — applied uniformly across your pack
- **Multi-Resolution Export** — Resize to any target sizes with auto-sharpening, packaged as ZIP
- **Grid Detection** — Automatically splits multi-icon images into individual candidates
- **Processing Profiles** — Save and reuse pipeline configurations
- **GPU Accelerated** — DirectML (any DX12 GPU on Windows), CUDA (NVIDIA on Linux), CPU fallback
- **Self-Hosted** — Your machine, your API key, your data

## Quick Start

```bash
git clone https://github.com/youruser/needicons.git
cd needicons
pip install -e .
python -m needicons
```

Opens `http://localhost:8420` — enter your OpenAI API key and start generating.

## Requirements

- Python 3.10+
- 4GB RAM
- OpenAI API key
- GPU optional (any DirectX 12 GPU on Windows, CUDA on Linux)

## License

AGPL-3.0 — see [LICENSE](LICENSE)
