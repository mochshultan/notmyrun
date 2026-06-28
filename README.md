<p align="center">
  <img src="public/favicon.svg" alt="NotMyRun" width="80" height="80">
</p>

<h1 align="center">NotMyRun</h1>

<p align="center">
  Create realistic GPX running and cycling routes directly from your browser.
</p>

<p align="center">
  Draw on the map, generate data with real-world pacing, elevation, heart rate, and cadence — then export to GPX or upload straight to Strava.
</p>

## Features

- **Draw routes** on an interactive OpenStreetMap — click waypoints or use presets (Heart, Circle shapes)
- **Road snapping** via OSRM — paths follow real roads automatically
- **Live computations** — distance, duration, pace, elevation gain, heart rate, cadence
- **Data charts** — pace profile, elevation profile, heart rate
- **Run / Bike mode** — adjusts pacing formulas, HR, and cadence per activity
- **Strava integration** — generates GPX file and opens Strava upload in one click
- **Export image cards** — share card (1080×1080), story card (1080×1920), or minimal route art
- **Search locations** via OpenStreetMap Nominatim with fuzzy caching

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm (included with Node.js)

## Getting started

```bash
git clone https://github.com/mochshultan/notmyrun.git
cd notmyrun
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

To create a production build:

```bash
npm run build
```

The output is in the `dist/` folder and can be served with any static hosting (GitHub Pages, Vercel, Netlify, etc.).

## How it works

```
Place waypoints  →  Snapped to roads (OSRM)
       ↓
  Elevation data fetched (Open-Elevation API)
       ↓
  Pace, HR, cadence generated (grade-adjusted)
       ↓
  Download GPX or upload to Strava
```

The pace engine uses a grade-adjusted model with fatigue curves, Gaussian noise for realism, and optional heart rate drift. A 5-point moving average smooths the HR output.

## Tech stack

| Tool | Purpose |
|------|---------|
| [React](https://react.dev/) 19 | UI framework |
| [Vite](https://vite.dev/) 8 | Build tool |
| [Tailwind CSS](https://tailwindcss.com/) v4 | Styling & design tokens |
| [Leaflet](https://leafletjs.com/) + [react-leaflet](https://react-leaflet.js.org/) | Interactive maps |
| [Recharts](https://recharts.org/) | Data charts |
| [OSRM](http://project-osrm.org/) | Road snapping |
| [Open-Elevation API](https://open-elevation.com/) | Elevation data |
| [Lucide](https://lucide.dev/) | Icons |
| [Geist](https://vercel.com/font) | Typeface |

## APIs used

The app relies on three public APIs (no key required):

- **[OSRM](http://project-osrm.org/)** — snaps waypoints to the road network via `/driving` or `/cycling` profile
- **[Nominatim](https://nominatim.org/)** — location search with fuzzy text matching
- **[Open-Elevation API](https://open-elevation.com/)** — point elevation lookup

## Roadmap

- [ ] Offline mode (cache OSRM responses)
- [ ] GPX import for editing existing routes
- [ ] More shape presets (loop, out-and-back, figure-8)
- [ ] Weather data overlay

## Contributing

Contributions are welcome. Open an issue or pull request.

## License

MIT
