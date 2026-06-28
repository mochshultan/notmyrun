import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function MapEvents({ onAddPoint }) {
  useMapEvents({ click(e) { onAddPoint({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
  return null;
}

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, 14); }, [center, map]);
  return null;
}

const pinIcon = L.divIcon({
  className: '',
  iconSize: [22, 28],
  iconAnchor: [11, 28],
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 28" width="22" height="28"><path d="M11 0C6.03 0 2 4.03 2 9c0 6.75 9 19 9 19s9-12.25 9-19c0-4.97-4.03-9-9-9z" fill="#FC5200" stroke="#fff" stroke-width="1.5"/><circle cx="11" cy="8" r="3.5" fill="#fff"/></svg>`
});

export default function Map({ waypoints, snappedPoints = [], onAddPoint, showWaypoints, mapCenter }) {
  return (
    <div className="h-full w-full relative z-0">
      <MapContainer center={[40.7128, -74.006]} zoom={13} style={{ height: '100%', width: '100%', backgroundColor: '#0a0a0a' }} zoomControl={false}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" className="map-tiles" />
        <MapEvents onAddPoint={onAddPoint} />
        <MapUpdater center={mapCenter} />
        {showWaypoints && waypoints.map((wp, i) => <Marker key={i} position={wp} icon={pinIcon} />)}
        {snappedPoints.length > 1 && <Polyline positions={snappedPoints} color="#FC5200" weight={4} opacity={0.8} lineCap="round" lineJoin="round" />}
      </MapContainer>
    </div>
  );
}
