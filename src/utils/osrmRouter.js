import { haversineDistance } from './haversine';

/**
 * Fallback: Straight-line interpolation if OSRM fails.
 * Interpolates points every ~10 meters.
 */
function interpolatePoints(waypoints, maxDistKm = 0.01) {
  if (waypoints.length < 2) return waypoints;
  
  const result = [];
  
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i+1];
    
    const dist = haversineDistance(p1, p2);
    
    result.push({ lat: p1.lat, lon: p1.lng || p1.lon });
    
    if (dist > maxDistKm) {
      const steps = Math.floor(dist / maxDistKm);
      for (let j = 1; j <= steps; j++) {
        const fraction = j / (steps + 1);
        const intLat = p1.lat + (p2.lat - p1.lat) * fraction;
        const intLon = (p1.lng || p1.lon) + ((p2.lng || p2.lon) - (p1.lng || p1.lon)) * fraction;
        result.push({ lat: intLat, lon: intLon });
      }
    }
  }
  
  const last = waypoints[waypoints.length - 1];
  result.push({ lat: last.lat, lon: last.lng || last.lon });
  
  return result;
}

/**
 * Snaps raw waypoints to real roads using OSRM.
 */
export async function snapToRoads(waypoints, isBike = false) {
  if (waypoints.length < 2) {
    return waypoints.map(wp => ({ lat: wp.lat, lon: wp.lng || wp.lon }));
  }

  const profile = isBike ? 'bike' : 'foot';
  const coords = waypoints.map(wp => `${wp.lng || wp.lon},${wp.lat}`).join(';');
  
  const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson&steps=false&annotations=false`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn("OSRM returned error, falling back to interpolation");
      return interpolatePoints(waypoints);
    }

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) {
      console.warn("OSRM returned no routes, falling back to interpolation");
      return interpolatePoints(waypoints);
    }

    // Geometry coordinates are [lon, lat] in GeoJSON
    const snapped = data.routes[0].geometry.coordinates.map(coord => ({
      lat: coord[1],
      lon: coord[0]
    }));

    return snapped;
  } catch (err) {
    console.error("OSRM fetch failed:", err);
    return interpolatePoints(waypoints);
  }
}
