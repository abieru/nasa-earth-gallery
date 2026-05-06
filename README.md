# NASA EPIC Earth Gallery

A static HTML/CSS/JS app that displays real Earth imagery from NASA's EPIC (Earth Polychromatic Imaging Camera) aboard the DSCOVR satellite.

## Setup

1. Clone the repository
2. Copy the example config and add your NASA API key:
   ```bash
   cp config.example.js config.js
   ```
3. Get a free API key at [https://api.nasa.gov](https://api.nasa.gov)
4. Paste your key into `config.js`

## Run Locally

### Gallery page only

Any static file server works for the main gallery page:

**Python:**
```bash
python -m http.server 8080
```

**Node.js:**
```bash
npx serve . -p 8080
```

Then open [http://localhost:8080](http://localhost:8080)

### 3D viewer page (`earth3d.html`)

The 3D viewer loads NASA EPIC images as WebGL textures. NASA's image archive server (`epic.gsfc.nasa.gov`) does **not** send CORS headers, so a same-origin proxy is required for the textures to load.

**Plain static servers like `npx serve` or `python -m http.server` will NOT work** for the 3D page because they cannot proxy the image requests.

Use the included Python dev server which serves static files **and** proxies `/proxy/` to NASA:

```bash
python dev-server.py 8080
```

Then open [http://localhost:8080/earth3d.html](http://localhost:8080/earth3d.html)

> **Note:** If you use a plain static server for the 3D page, image textures will not load because the browser blocks cross-origin WebGL textures without CORS. Use `dev-server.py` for local 3D development, or use Docker (which has the proxy built into nginx).

## Docker

You can run the app inside a Docker container. The container uses `nginx:alpine` to serve the static files.

### Quick Start (Pre-built Image)

No need to clone or build. Just run the image directly from GitHub Container Registry:

```bash
docker run -e NASA_API_KEY=your_key_here -e PORT=8080 -p 8080:8080 ghcr.io/abieru/nasa-earth-gallery:latest
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NASA_API_KEY` | **Yes** | — | Your NASA API key from [https://api.nasa.gov](https://api.nasa.gov) |
| `PORT` | No | `80` | Internal port nginx listens on |

The entrypoint script injects `NASA_API_KEY` into `config.js` at startup, so your key is **never baked into the image**.

### Build Locally

If you prefer to build the image yourself:

```bash
docker build -t nasa-epic .
docker run -e NASA_API_KEY=your_key_here -e PORT=8080 -p 8080:8080 nasa-epic
```

## Features

- Automatically loads the latest EPIC images on page load
- Date picker to browse historical image batches
- Click any image to open a modal with full metadata:
  - Centroid coordinates
  - DSCOVR spacecraft position
  - Sun position
  - Image caption

## File Structure

```
├── index.html              # App shell and layout
├── style.css               # Dark space theme, responsive grid
├── app.js                  # API logic and gallery rendering
├── config.js               # NASA API key (gitignored)
├── config.example.js       # Example config file
├── Dockerfile              # Docker image definition
├── docker-entrypoint.sh    # Runtime config injection script
├── .dockerignore           # Docker build exclusions
└── AGENTS.md               # Project conventions for agents
```

## Notes

- EPIC images are published in batches roughly every 1–2 hours and are typically a few hours to a day behind live
- This is a static frontend app with no backend or build step
- **Never commit your API key.** `config.js` is gitignored by default.

## Data Source

- [NASA EPIC API](https://api.nasa.gov)
- [EPIC Archive](https://epic.gsfc.nasa.gov)
