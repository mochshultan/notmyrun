# NotMyRun

> **Generate realistic GPX routes for running & cycling — with live stats, elevation profiles, and Strava upload.**

[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)

---

## ✨ Features

- 🗺️ **Draw routes on an interactive map** — click to place waypoints, or use built-in shapes (Heart, Circle)
- 🛣️ **Road-snapped paths** via OSRM — your route follows real roads
- ⛰️ **Elevation profiles** with realistic pace adjustments based on grade
- 📊 **Live stats** — distance, duration, pace, heart rate, cadence
- 📈 **Data visualizations** — pace, elevation, and heart rate charts
- 🚴 **Run / Bike modes** — adjust pacing, HR, and cadence per activity type
- 📁 **Download GPX files** — ready for your GPS device or phone app
- 🔗 **Upload directly to Strava** — auto-downloads GPX and opens Strava upload page
- 🖼️ **Export share cards** — square, story, or minimal route art (PNG)
- ⚡ **Realistic data engine** — grade-adjusted pace, fatigue curves, HR drift, cadence modeling

---

## 🚀 Quick Start

```bash
git clone https://github.com/mochshultan/notmyrun.git
cd notmyrun
npm install
npm run dev
```

---

## 🛠️ Tech Stack

| Tool | Purpose |
|------|---------|
| **React 19** | UI framework |
| **Vite 8** | Build tool |
| **Tailwind CSS v4** | Styling |
| **Leaflet + react-leaflet** | Interactive maps |
| **Recharts** | Data charts |
| **OSRM API** | Road snapping |
| **OpenStreetMap Nominatim** | Location search |
| **Open-Elevation API** | Elevation data |
| **Lucide** | Icons |

---

## 📄 License

[MIT](LICENSE)
