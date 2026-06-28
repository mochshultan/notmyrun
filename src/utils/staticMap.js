function lon2tile(lon, zoom) {
  return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
}

function lat2tile(lat, zoom) {
  return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180)
    + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
}

export function latlon2pixel(lat, lon, zoom, tileSize, originTileX, originTileY) {
  const tileX = (lon + 180) / 360 * Math.pow(2, zoom);
  const tileY = (1 - Math.log(Math.tan(lat * Math.PI / 180)
    + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom);
  return {
    x: (tileX - originTileX) * tileSize,
    y: (tileY - originTileY) * tileSize
  };
}

function chooseBestZoom(bbox, targetPx = 600) {
  for (let z = 16; z >= 10; z--) {
    const minX = lon2tile(bbox.minLon, z);
    const maxX = lon2tile(bbox.maxLon, z);
    const minY = lat2tile(bbox.maxLat, z);
    const maxY = lat2tile(bbox.minLat, z);
    const width = (maxX - minX + 1) * 256;
    const height = (maxY - minY + 1) * 256;
    if (width <= targetPx && height <= targetPx) return z;
  }
  return 10;
}

export async function stitchMapCanvas(snappedPoints, padding = 0.0005) {
  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  snappedPoints.forEach(wp => {
    if (wp.lon < minLon) minLon = wp.lon;
    if (wp.lon > maxLon) maxLon = wp.lon;
    if (wp.lat < minLat) minLat = wp.lat;
    if (wp.lat > maxLat) maxLat = wp.lat;
  });

  const bbox = { minLat, maxLat, minLon, maxLon };
  const paddedBbox = {
    minLat: bbox.minLat - padding, maxLat: bbox.maxLat + padding,
    minLon: bbox.minLon - padding, maxLon: bbox.maxLon + padding,
  };
  
  const zoom = chooseBestZoom(paddedBbox);
  const TILE = 256;
  const minTileX = lon2tile(paddedBbox.minLon, zoom);
  const maxTileX = lon2tile(paddedBbox.maxLon, zoom);
  const minTileY = lat2tile(paddedBbox.maxLat, zoom);
  const maxTileY = lat2tile(paddedBbox.minLat, zoom);
  
  const cols = maxTileX - minTileX + 1;
  const rows = maxTileY - minTileY + 1;
  
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = cols * TILE;
  mapCanvas.height = rows * TILE;
  const ctx = mapCanvas.getContext('2d');

  // Fetch tiles in parallel
  const fetches = [];
  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      fetches.push(
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve({ img, tx, ty });
          img.onerror = () => resolve({ img: null, tx, ty });
          // Must match User-Agent in node, but browser fetch handles it.
          img.src = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
        })
      );
    }
  }
  
  const tiles = await Promise.all(fetches);
  
  // Fill dark background in case tiles fail to load
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
  
  tiles.forEach(({ img, tx, ty }) => {
    if (img) {
      const x = (tx - minTileX) * TILE;
      const y = (ty - minTileY) * TILE;
      ctx.drawImage(img, x, y, TILE, TILE);
    }
  });

  // Dim overlay
  ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
  ctx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);

  // Project route onto the map canvas
  const routePixels = snappedPoints.map(pt =>
    latlon2pixel(pt.lat, pt.lon, zoom, TILE, minTileX, minTileY)
  );

  return { mapCanvas, routePixels, mapWidth: mapCanvas.width, mapHeight: mapCanvas.height };
}

export function drawRouteOnCanvas(ctx, routePixels, color = '#FC5200', lineWidth = 5) {
  if (routePixels.length === 0) return;

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  
  routePixels.forEach((pt, i) => {
    if (i === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  });
  ctx.stroke();
  
  // Start dot
  ctx.beginPath();
  ctx.arc(routePixels[0].x, routePixels[0].y, 6, 0, 2 * Math.PI);
  ctx.fillStyle = '#22C55E';
  ctx.fill();
  
  // End dot
  const last = routePixels[routePixels.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 6, 0, 2 * Math.PI);
  ctx.fillStyle = '#EF4444';
  ctx.fill();
}
