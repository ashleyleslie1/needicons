# NeedIcons

AI-powered icon pack generator. Create, refine, and export professional icon sets using OpenAI's image generation models.

![Generate Page](docs/screenshots/generate-page.png)

## Features

- **AI Icon Generation** -- Generate icons from text prompts using GPT Image 1.5, GPT Image Mini, or DALL-E models
- **AI Prompt Enhancement** -- Automatically expand simple prompts into detailed icon descriptions using GPT-5.4-nano
- **AI Refine** -- Edit generated icons with natural language instructions via OpenAI's Responses API
- **Batch Generation** -- Generate hundreds of icons at once with concurrent API calls and live progress tracking
- **Generation Queue** -- Persistent SQLite-backed queue tracks per-icon status; failed items can be retried manually
- **Duplicate Detection** -- Warns before generating icons with names that already exist; filter, group, and clean up duplicates
- **Multiple Styles** -- Solid, Outline, Colorful, Flat, Sticker with mood modifiers (Minimal, Cinematic, Energetic, Bold, Elegant, Soft)
- **Variation Control** -- Choose 1-4 variations per icon; click to pick favorites, hover to refine
- **Project Management** -- Organize icons into projects with pick/unpick workflow
- **Search & Filter** -- Search by name/prompt, filter unpicked or duplicate entries, grouped duplicate view with per-group actions
- **Multi-Format Export** -- PNG, WebP, SVG in a single ZIP with folder structure
- **SVG Tracing** -- Raster-to-vector conversion via vtracer with smoothing and scour optimization
- **Per-Icon Preview** -- Preview any icon in PNG/WebP/SVG with quality settings and file size
- **React/React Native SVG** -- Export SVGs as React JSX or React Native components
- **Virtualized Lists** -- Handles thousands of icons with constant memory via `@tanstack/react-virtual`
- **Self-Hosted** -- Runs locally, your API key, your data

## Quick Start

### Prerequisites

- **Python 3.11+**
- **OpenAI API key** with access to image generation models

Node.js is **not required** -- the frontend is pre-built in `frontend/dist/`. For development with hot reload, install Node.js 18+.

### Installation

```bash
git clone https://github.com/ashleyleslie1/needicons.git
cd needicons
pip install -e .
```

### Running

```bash
# Production (serves pre-built frontend, no Node.js needed)
python -m needicons

# Development (hot reload for frontend + backend, requires Node.js)
python -m needicons --dev
```

Open [http://localhost:8420](http://localhost:8420) (production) or [http://localhost:5173](http://localhost:5173) (dev).

### First-Time Setup

1. Go to **Settings** (gear icon in sidebar)
2. Enter your **OpenAI API key**
3. Go to **Generate** tab
4. Type a prompt and click **Generate**

![Settings Page](docs/screenshots/settings-page.png)

## Usage

### Generating Icons

Type icon names separated by `;` for multiple icons:

```
house; tree; car; bicycle
```

Use `:` for custom prompts per icon:

```
house: a cozy cottage with chimney; tree: tall oak tree with leaves
```

| Option | Description |
|--------|-------------|
| **Model** | GPT Image 1.5 (best quality), GPT Image Mini (faster/cheaper) |
| **Style** | Solid, Outline, Colorful, Flat, Sticker |
| **Mood** | Minimal, Cinematic, Energetic, Bold, Elegant, Soft |
| **Quality** | Auto, High, Medium, Low |
| **Variations** | 1-4 variations generated per icon |
| **AI Enhance** | Rewrites your prompt into a detailed icon description |

### Picking & Filtering

- **Click** any variation to pick it as your favorite
- **Hover** to reveal the **Refine** button
- **Search** by icon name or prompt text
- **Show unpicked** to find icons without a selection
- **Show duplicates** to see icons generated multiple times, grouped by name with delete actions

![Duplicates Filter](docs/screenshots/duplicates-filter.png)

### AI Refine

Hover over a variation and click **Refine** to open the editor:

- *"Remove the background"*
- *"Clean up edges, make it crisp"*
- *"Simplify the design"*

Quick action presets are available for common operations.

![AI Refine Modal](docs/screenshots/refine-modal.png)

### Project & Export

1. **Pick** your favorite variations (click the image)
2. Switch to the **Project** tab
3. Click **Export Pack** to download a ZIP

![Project Page](docs/screenshots/project-page.png)

| Setting | Values |
|---------|--------|
| **Sizes** | 1024, 512, 256, 128, 64, 32, 16px |
| **Formats** | PNG, WebP, SVG (all selectable) |
| **SVG Smoothing** | 1-5 |
| **SVG Optimize** | Scour minification |

ZIP structure:
```
needicons-MyProject.zip
  png/1024/house.png
  png/512/house.png
  webp/1024/house.webp
  svg/house.svg
  manifest.json
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.11+, FastAPI, Uvicorn |
| **AI** | OpenAI Images API + Responses API |
| **Image Processing** | Pillow, NumPy, OpenCV |
| **SVG** | vtracer, scour |
| **Storage** | SQLite (WAL mode) |
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS |
| **Components** | shadcn/ui, Radix UI, lucide-react |
| **Virtualization** | @tanstack/react-virtual |
| **Data Fetching** | TanStack Query |

## Configuration

All data stored locally in `~/.needicons/`:

| File | Purpose |
|------|---------|
| `config.yaml` | API keys (encrypted at rest via Fernet), provider settings |
| `needicons.db` | SQLite database |
| `images/` | Generated icon images |

## Development

```bash
pip install -e ".[dev]"
cd frontend && npm install && cd ..

python -m needicons --dev

# Tests
python -m pytest

# TypeScript check
cd frontend && npx tsc --noEmit
```

## License

AGPL-3.0 -- see [LICENSE](LICENSE)
