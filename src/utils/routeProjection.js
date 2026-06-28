// Projects a [lat, lon] to pixel coordinates given a bounding box and a canvas size
// This uses a simple Web Mercator projection approach suitable for small areas

function lonToX(lon) {
  return (lon + 180) / 360;
}

function latToY(lat) {
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
  return y;
}

export function projectRoute(waypoints, width, height, padding = 40) {
  if (waypoints.length === 0) return [];

  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  waypoints.forEach(wp => {
    const lat = wp.lat;
    const lon = wp.lng || wp.lon;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });

  const minX = lonToX(minLon);
  const maxX = lonToX(maxLon);
  const minY = latToY(maxLat); // maxLat has a smaller Y
  const maxY = latToY(minLat);

  const dx = maxX - minX;
  const dy = maxY - minY;

  // We want to fit the route into width/height with padding
  const availW = width - padding * 2;
  const availH = height - padding * 2;

  // To prevent divide by zero for a single point or vertical/horizontal line
  const safeDx = dx || 0.0001;
  const safeDy = dy || 0.0001;

  const scale = Math.min(availW / safeDx, availH / safeDy);

  // Center the route
  const cx = minX + dx / 2;
  const cy = minY + dy / 2;

  return waypoints.map(wp => {
    const x = lonToX(wp.lng || wp.lon);
    const y = latToY(wp.lat);

    const px = width / 2 + (x - cx) * scale;
    const py = height / 2 + (y - cy) * scale;
    
    return { x: px, y: py };
  });
}
