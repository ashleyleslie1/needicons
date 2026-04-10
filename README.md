# NeedIcons

AI-powered icon pack generator. Create, refine, and export professional icon sets using OpenAI's image generation models.

![Generate Page](docs/screenshots/generate-page.png)

## Features

- **AI Icon Generation** — Generate icons from text prompts using GPT Image 1.5, GPT Image Mini, or DALL-E models
- **AI Prompt Enhancement** — Automatically expand simple prompts into detailed icon descriptions using GPT-5.4-nano
- **AI Refine** — Edit generated icons with natural language instructions via OpenAI's Responses API with partial image streaming
- **Batch Generation** — Generate up to 1000 icons at once with 10 concurrent API calls per batch
- **Multiple Styles** — Solid, Outline, Colorful, Flat, Sticker styles with mood modifiers (Minimal, Cinematic, Energetic, Bold, Elegant, Soft)
- **Project Management** — Organize icons into projects, pick favorites from variations
- **Post-Processing** — Outline stroke, drop shadow, background fill with corner radius
- **Multi-Format Export** — PNG, WebP, SVG in a single ZIP with folder structure (`png/1024/icon.png`)
- **SVG Tracing** — Raster-to-vector conversion via vtracer with color quantization, smoothing, and scour optimization
- **Per-Icon Preview** — Preview any icon in PNG/WebP/SVG with quality settings and file size before exporting
- **React/React Native SVG** — Export SVGs as React JSX or React Native components
- **Self-Hosted** — Runs locally, your API key, your data

![AI Refine Modal](docs/screenshots/refine-modal.png)

## Quick Start

### Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **OpenAI API key** with access to image generation models

### Installation

```bash
# Clone the repository
git clone https://github.com/ashleyleslie1/needicons.git
cd needicons

# Install Python dependencies
pip install -e ".[dev]"

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Running Locally

Start both the backend API server and frontend dev server:

```bash
# Terminal 1 — Backend (port 8420)
python -m uvicorn needicons.server.app:create_app --factory --host 0.0.0.0 --port 8420

# Terminal 2 — Frontend (port 5173)
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### First-Time Setup

1. Go to **Settings** (gear icon in sidebar)
2. Enter your **OpenAI API key**
3. Go back to **Generate** tab
4. Type a prompt (e.g., `house; tree; car`) and click **Generate**

![Settings Page](docs/screenshots/settings-page.png)

## Usage

### Generating Icons

Type icon names in the prompt field, separated by `;` for multiple icons:

```
house; tree; car; bicycle
```

Use `:` for custom prompts per icon:

```
house: a cozy cottage with chimney; tree: tall oak tree with leaves
```

**Options:**
| Option | Description |
|--------|-------------|
| **Model** | GPT Image 1.5 (best quality), GPT Image Mini (faster/cheaper) |
| **Style** | Solid, Outline, Colorful, Flat, Sticker |
| **Mood** | Minimal, Cinematic, Energetic, Bold, Elegant, Soft |
| **Quality** | Auto, High, Low (maps to OpenAI API quality parameter) |
| **AI Enhance** | Rewrites your prompt into a detailed icon description for better results |

### AI Refine

Click any generated variation to open the **Refine** modal. Type natural language instructions:

- *"Remove all background, keep only the icon"*
- *"Clean up edges, make it crisp"*
- *"Simplify the design, reduce detail"*

The AI edits your icon in real-time with partial image streaming. Use quick action presets for common operations.

### Project & Export

1. **Pick** variations you like (click the `+` button on each variation)
2. Switch to the **Project** tab to see all picked icons
3. Apply **post-processing**: outline stroke, drop shadow, background fill with corner radius
4. Click **Export Pack** to download a ZIP with all icons

**Export options:**
| Setting | Values |
|---------|--------|
| **Sizes** | 1024, 512, 256, 128, 64, 32, 16px |
| **Formats** | PNG, WebP, SVG (all selectable together) |
| **SVG Smoothing** | 1-5 (pre-blur before vector tracing) |
| **SVG Optimize** | Scour minification (coordinate shortening, single-line output) |
| **Quality** | Lossless, High (90%), Medium (75%), Low (50%) for PNG/WebP |

**ZIP structure:**
```
needicons-MyProject.zip
  png/1024/house.png
  png/512/house.png
  webp/1024/house.webp
  svg/house.svg
  manifest.json
```

Duplicate names are handled automatically: `house`, `house_colorful`, `house_solid_2`.

### Per-Icon Preview

In the **Project** tab, hover over any icon and click **Preview** to inspect it in any format:

- Format selector (PNG / WebP / SVG)
- Quality levels for raster formats
- SVG smoothing, optimize toggle, output format (Raw SVG / React JSX / React Native)
- Live file size display
- Direct download button

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.11+, FastAPI, Uvicorn |
| **AI** | OpenAI Images API + Responses API (editing) |
| **Image Processing** | Pillow, NumPy, OpenCV |
| **SVG** | vtracer (raster-to-vector), scour (optimization) |
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS, glassmorphism dark theme |
| **Components** | shadcn/ui, lucide-react icons |
| **Data Fetching** | TanStack Query |

## Configuration

All data is stored locally in `~/.needicons/`:

| File | Purpose |
|------|---------|
| `config.yaml` | API keys (encrypted at rest), provider settings |
| `projects.yaml` | Project data, icon lists, post-processing settings |
| `generations.yaml` | Generation history with all variations |
| `images/` | Generated and processed icon images |

## Development

```bash
# Install with dev dependencies
pip install -e ".[dev]"
cd frontend && npm install && cd ..

# Run tests
python -m pytest

# Run specific tests
python -m pytest tests/core/export/test_packager.py -v

# TypeScript check
cd frontend && npx tsc --noEmit

# Frontend dev server with hot reload
cd frontend && npm run dev
```

## License

MIT
