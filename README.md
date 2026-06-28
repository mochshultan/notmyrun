<p align="center">
    <img src="public/favicon.svg" alt="NotMyRun" width="96" height="96">
</p>

<h1 align="center">NotMyRun</h1>

<p align="center">
    Create realistic GPX running and cycling routes directly from your browser.
</p>

<p align="center">
    <a href="https://github.com/mochshultan/notmyrun/blob/main/LICENSE">
        <img alt="MIT License" src="https://img.shields.io/github/license/mochshultan/notmyrun?color=FC5200&style=flat-square&label=License" />
    </a>
    <a href="https://github.com/mochshultan/notmyrun/stargazers">
        <img alt="Stars" src="https://img.shields.io/github/stars/mochshultan/notmyrun?color=FC5200&style=flat-square&label=Stars" />
    </a>
    <a href="https://github.com/mochshultan/notmyrun/issues">
        <img alt="Issues" src="https://img.shields.io/github/issues/mochshultan/notmyrun?color=FC5200&style=flat-square&label=Issues" />
    </a>
</p>

## Features

- Draw routes on an interactive OpenStreetMap — click waypoints or use presets (Heart, Circle)
- Road snapping via OSRM — paths follow real roads automatically
- Live stats — distance, duration, pace, elevation gain, heart rate, cadence
- Run / Bike mode with grade-adjusted pacing, HR drift, and cadence modeling
- Download GPX files or upload directly to Strava in one click
- Export image cards — share card (1080×1080), story (1080×1920), or minimal route art
- Location search with fuzzy caching

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm

### Quick Setup

```sh
git clone https://github.com/mochshultan/notmyrun.git
cd notmyrun
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Build

```sh
npm run build
```

Output goes to `dist/`. Serve with any static hosting — GitHub Pages, Vercel, Netlify.

## How It Works

```
Place waypoints  →  Snapped to roads (OSRM)
       ↓
  Elevation data fetched (Open-Elevation API)
       ↓
  Pace, HR, cadence generated — grade-adjusted, with fatigue curves and Gaussian noise
       ↓
  Download GPX or upload to Strava
```

## Tech Stack

| Tool | Purpose |
|------|---------|
| React 19 | UI framework |
| Vite 8 | Build tool |
| Tailwind CSS v4 | Styling |
| Leaflet + react-leaflet | Interactive maps |
| Recharts | Data charts |
| Lucide | Icons |
| Geist | Typeface |

### Public APIs Used

- [OSRM](http://project-osrm.org/) — road snapping
- [Nominatim](https://nominatim.org/) — location search
- [Open-Elevation API](https://open-elevation.com/) — elevation lookup

No API keys required.

## License

[MIT](LICENSE)
