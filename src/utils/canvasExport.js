import { drawRouteOnCanvas } from './staticMap';

function formatDist(km) {
  return km.toFixed(2) + ' km';
}

function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatPace(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function drawStat(ctx, value, label, centerX, y) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#F8FAFC'; // slate-50
  ctx.font = 'bold 72px "Courier New", monospace';
  ctx.fillText(value, centerX, y);
  
  ctx.fillStyle = '#64748B'; // slate-500
  ctx.font = '22px -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(label, centerX, y + 36);
}

function drawHeader(ctx, title, dateStr, y) {
  ctx.fillStyle = '#FC5200'; // Strava orange
  ctx.beginPath(); 
  ctx.arc(60, y - 10, 8, 0, 2 * Math.PI); 
  ctx.fill();
  
  ctx.textAlign = 'left';
  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 36px -apple-system, sans-serif';
  ctx.fillText(title || 'Morning Run', 90, y);
  
  const d = new Date(dateStr);
  const dateFormatted = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  
  ctx.textAlign = 'right';
  ctx.fillStyle = '#94A3B8';
  ctx.font = '28px -apple-system, sans-serif';
  ctx.fillText(dateFormatted, 1020, y);
}

export function renderShareCard({ mapCanvas, routePixels, mapWidth, mapHeight, stats }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  // 1. Draw Map to fill ENTIRE 1080x1080 canvas
  const scale = Math.max(1080 / mapWidth, 1080 / mapHeight);
  const drawW = mapWidth * scale;
  const drawH = mapHeight * scale;
  const offsetX = (1080 - drawW) / 2;
  const offsetY = (1080 - drawH) / 2;
  
  ctx.drawImage(mapCanvas, offsetX, offsetY, drawW, drawH);
  
  // Project route pixels using same scale and offset
  const scaledRoute = routePixels.map(pt => ({
    x: pt.x * scale + offsetX,
    y: pt.y * scale + offsetY
  }));
  
  drawRouteOnCanvas(ctx, scaledRoute, '#FC5200', 8);

  // 2. Stats Panel Overlay (bottom 40% -> 432px)
  const mapH = 648; 
  
  // Dark semi-transparent overlay
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; // slate-900 with 85% opacity
  ctx.fillRect(0, mapH, 1080, 432);

  // Divider line
  ctx.fillStyle = '#FC5200';
  ctx.fillRect(0, mapH, 1080, 4);

  drawHeader(ctx, stats.runName, stats.startTime, mapH + 70);

  // Top divider
  ctx.fillStyle = 'rgba(51, 65, 85, 0.6)';
  ctx.fillRect(40, mapH + 110, 1000, 2);

  // Stats Row 1 (y = mapH + 200)
  const row1Y = mapH + 200;
  drawStat(ctx, formatDist(stats.distance), 'DISTANCE', 180, row1Y);
  drawStat(ctx, formatDuration(stats.totalTimeSec), 'TIME', 540, row1Y);
  drawStat(ctx, `+${stats.elevation}m`, 'ELEVATION', 900, row1Y);

  // Middle divider
  ctx.fillStyle = 'rgba(51, 65, 85, 0.6)';
  ctx.fillRect(40, row1Y + 80, 1000, 2);

  // Stats Row 2 (y = mapH + 360)
  const row2Y = mapH + 360;
  drawStat(ctx, formatPace(stats.paceSec), 'AVG PACE', 180, row2Y);
  if (stats.includeHr) drawStat(ctx, `${stats.hr}`, 'AVG HR', 540, row2Y);
  if (stats.includeCadence) drawStat(ctx, `${stats.cadence}`, 'CADENCE', 900, row2Y);

  return canvas;
}

export function renderStoryCard({ mapCanvas, routePixels, mapWidth, mapHeight, stats }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');

  // 1. Draw Map to fill ENTIRE 1080x1920 canvas
  const scale = Math.max(1080 / mapWidth, 1920 / mapHeight);
  const drawW = mapWidth * scale;
  const drawH = mapHeight * scale;
  const offsetX = (1080 - drawW) / 2;
  const offsetY = (1920 - drawH) / 2;
  
  ctx.drawImage(mapCanvas, offsetX, offsetY, drawW, drawH);
  
  const scaledRoute = routePixels.map(pt => ({
    x: pt.x * scale + offsetX,
    y: pt.y * scale + offsetY
  }));
  
  drawRouteOnCanvas(ctx, scaledRoute, '#FC5200', 8);

  // 2. Stats Panel Overlay
  const mapH = 1056; // Start of overlay
  
  // Dark semi-transparent overlay
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(0, mapH, 1080, 1920 - mapH);
  
  ctx.fillStyle = '#FC5200';
  ctx.fillRect(0, mapH, 1080, 4);

  drawHeader(ctx, stats.runName, stats.startTime, mapH + 100);
  
  ctx.fillStyle = 'rgba(51, 65, 85, 0.6)';
  ctx.fillRect(40, mapH + 150, 1000, 2);

  // Grid layout for stats
  // R1: Dist | Time
  // R2: Elev | Pace
  // R3: HR | Cad
  
  const drawStoryStat = (value, label, col, row) => {
    const x = col === 1 ? 300 : 780;
    const y = mapH + 300 + (row * 180);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 80px "Courier New", monospace';
    ctx.fillText(value, x, y);
    
    ctx.fillStyle = '#64748B';
    ctx.font = '24px -apple-system, sans-serif';
    ctx.fillText(label, x, y + 40);
  };

  drawStoryStat(formatDist(stats.distance), 'DISTANCE', 1, 0);
  drawStoryStat(formatDuration(stats.totalTimeSec), 'TIME', 2, 0);
  
  drawStoryStat(`+${stats.elevation}m`, 'ELEVATION', 1, 1);
  drawStoryStat(formatPace(stats.paceSec), 'AVG PACE', 2, 1);

  if (stats.includeHr) drawStoryStat(`${stats.hr}`, 'AVG HR', 1, 2);
  if (stats.includeCadence) drawStoryStat(`${stats.cadence}`, 'CADENCE', 2, 2);

  return canvas;
}

export function renderRouteArt({ routePixels, mapWidth, mapHeight, stats }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 1080, 1080);

  // Calculate route bounding box from pixels
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  routePixels.forEach(pt => {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  });

  const routeW = maxX - minX;
  const routeH = maxY - minY;

  // Scale to fit 80% of canvas (864px)
  const scale = Math.min(864 / routeW, 864 / routeH);
  
  // Center it
  const offsetX = (1080 - routeW * scale) / 2 - minX * scale;
  const offsetY = (1080 - routeH * scale) / 2 - minY * scale;

  const scaledRoute = routePixels.map(pt => ({
    x: pt.x * scale + offsetX,
    y: pt.y * scale + offsetY
  }));

  const drawNeonLine = () => {
    ctx.beginPath();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    scaledRoute.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();
  };

  // Outer dark glow
  ctx.shadowColor = '#FC5200';
  ctx.shadowBlur = 30;
  ctx.strokeStyle = 'rgba(252, 82, 0, 0.4)';
  ctx.lineWidth = 12;
  drawNeonLine();

  // Inner bright core
  ctx.shadowBlur = 10;
  ctx.strokeStyle = '#FFEDD5';
  ctx.lineWidth = 4;
  drawNeonLine();

  // Bottom text
  ctx.shadowBlur = 0;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#94A3B8';
  ctx.font = '28px "Courier New", monospace';
  const text = `${formatDist(stats.distance)} · ${formatDuration(stats.totalTimeSec)} · +${stats.elevation}m`;
  ctx.fillText(text, 1040, 1040);
  
  // App brand
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FC5200';
  ctx.font = 'bold italic 28px -apple-system, sans-serif';
  ctx.fillText('NotMyRun', 40, 1040);

  return canvas;
}
