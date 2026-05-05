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

**Python:**
```bash
python -m http.server 8080
```

**Node.js:**
```bash
npx serve . -p 8080
```

Then open [http://localhost:8080](http://localhost:8080)

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
├── index.html          # App shell and layout
├── style.css           # Dark space theme, responsive grid
├── app.js              # API logic and gallery rendering
├── config.js           # NASA API key (gitignored)
├── config.example.js   # Example config file
└── AGENTS.md           # Project conventions for agents
```

## Notes

- EPIC images are published in batches roughly every 1–2 hours and are typically a few hours to a day behind live
- This is a static frontend app with no backend or build step
- **Never commit your API key.** `config.js` is gitignored by default.

## Data Source

- [NASA EPIC API](https://api.nasa.gov)
- [EPIC Archive](https://epic.gsfc.nasa.gov)
