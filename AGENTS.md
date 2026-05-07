# Agent Notes

## Project Type
Static frontend app (HTML/CSS/vanilla JS). No build system, no package manager, no tests.

## API Key
- Stored in `config.js` as the global constant `NASA_API_KEY`.
- `config.js` is loaded in `<head>` before `app.js`.
- Get a free key at https://api.nasa.gov. Do not commit real keys.

## Running Locally

### Simple static server (Gallery page only)
For the gallery page, any static file server works:

```bash
python -m http.server 8080
# or
npx serve .
```

Then open `http://localhost:8080`.

### Development server (3D viewer + Gallery)
The 3D viewer loads NASA EPIC images as WebGL textures. NASA's image archive server (`epic.gsfc.nasa.gov`) does **not** send CORS headers, so a same-origin proxy is required for the textures to load.

**Why `npx serve` doesn't work for 3D:** Plain static servers cannot proxy image requests. When Three.js tries to load a texture directly from `epic.gsfc.nasa.gov`, the browser blocks it due to missing `Access-Control-Allow-Origin` headers. The result is a gray/black sphere with no Earth texture.

Use the included Python dev server which serves static files **and** proxies `/proxy/` to NASA:

```bash
python dev-server.py 8080
```

Then open `http://localhost:8080/earth3d.html`.

> **Note:** Use `dev-server.py` for local 3D development, or use Docker (which has the proxy built into nginx). Plain static servers only work for the gallery page.

## Architecture
- **Entry point:** `index.html`
- **Scripts:** `config.js` (API key) → `app.js` (logic)
- **Styling:** `style.css` (dark space theme, responsive grid)
- **Data source:** NASA EPIC API — `https://api.nasa.gov/EPIC/api/natural`
- **Image archive:** `https://epic.gsfc.nasa.gov/archive/natural/{YYYY}/{MM}/{DD}/png/{IMAGE}.png`

## Key Code Facts
- `app.js` fetches `/images?api_key=` for the latest batch, or `/date/{YYYY-MM-DD}?api_key=` for historical.
- Image URLs are constructed manually from the API response; they are not direct URLs in the JSON.
- The modal displays `centroid_coordinates`, `dscovr_j2000_position`, `sun_j2000_position`, and `caption`.

## Docker

Build and run the app inside a container.

### Build

```bash
docker build -t nasa-epic .
```

### Run

Pass the NASA API key and desired internal port via environment variables. Map the container port to a host port with `-p`.

```bash
# Example: expose container port 8080 on host port 8080
docker run -e NASA_API_KEY=your_key_here -e PORT=8080 -p 8080:8080 nasa-epic
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NASA_API_KEY` | Yes | — | Your NASA API key from https://api.nasa.gov |
| `PORT` | No | `80` | Internal port nginx listens on |

The entrypoint script injects `NASA_API_KEY` into `config.js` at container startup, so the key is never baked into the image.

## Chrome DevTools MCP (Agent Rules)

When using the `chrome-devtools` MCP to debug or test the frontend:

1. **Always open a new isolated Chrome instance.**
   - Use a temporary profile directory: `--user-data-dir="$env:TEMP\chrome-mcp-<timestamp>"`.
   - This prevents interference with any existing Chrome windows the user already has open.

2. **Never kill existing Chrome processes.**
   - **Do NOT** use `taskkill`, `Stop-Process`, `killall`, or any command that terminates Chrome.
   - If the default debugging port `9222` is occupied, find an alternative free port instead of killing the process using it.

3. **Use this PowerShell pattern to start Chrome on Windows:**
   ```powershell
   $port = 9222
   # Check if port is in use; if so, increment until free
   while ((Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue)) { $port++ }
   $profile = "$env:TEMP\chrome-mcp-$(Get-Date -Format 'yyyyMMddHHmmss')"
   New-Item -ItemType Directory -Path $profile -Force | Out-Null
   Start-Process -FilePath "C:\Program Files\Google\Chrome\Application\chrome.exe" `
       -ArgumentList "--remote-debugging-port=$port", "--no-first-run", "--no-default-browser-check", "--user-data-dir=$profile", "http://localhost:8080" `
       -WindowStyle Hidden
   ```

4. **Connect the MCP to the new instance.**
   - After starting Chrome, verify it's listening: `Invoke-RestMethod -Uri "http://localhost:$port/json/version"`.
   - Use the returned WebSocket URL for subsequent `chrome-devtools` tool calls.
