# Agent Notes

## Project Type
Static frontend app (HTML/CSS/vanilla JS). No build system, no package manager, no tests.

## API Key
- Stored in `config.js` as the global constant `NASA_API_KEY`.
- `config.js` is loaded in `<head>` before `app.js`.
- Get a free key at https://api.nasa.gov. Do not commit real keys.

## Running Locally
Serve the repo root with any static file server:

```bash
python -m http.server 8080
# or
npx serve .
```

Then open `http://localhost:8080`.

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
