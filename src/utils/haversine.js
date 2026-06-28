// Returns distance in km between two lat/lon coordinates
export function haversineDistance(coords1, coords2) {
  function toRad(x) {
    return (x * Math.PI) / 180;
  }

  const lat1 = coords1.lat;
  const lon1 = coords1.lng || coords1.lon;
  const lat2 = coords2.lat;
  const lon2 = coords2.lng || coords2.lon;

  const R = 6371; // Earth's radius in km
  const x1 = lat2 - lat1;
  const dLat = toRad(x1);
  const x2 = lon2 - lon1;
  const dLon = toRad(x2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;

  return d;
}

export function calculateTotalDistance(waypoints) {
  let total = 0;
  for (let i = 1; i < waypoints.length; i++) {
    total += haversineDistance(waypoints[i - 1], waypoints[i]);
  }
  return total;
}
