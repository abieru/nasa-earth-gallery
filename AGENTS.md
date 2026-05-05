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
