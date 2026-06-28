export function formatDist(km) {
  return km.toFixed(2) + ' km';
}

export function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatPace(sec) {
  const mVal = Math.floor(sec / 60);
  const sVal = Math.floor(sec % 60);
  return `${mVal}:${sVal.toString().padStart(2, '0')}`;
}

export function formatDate(dateStr, style = 'short') {
  const d = new Date(dateStr);
  if (style === 'short') {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function formatNumber(n, decimals = 2) {
  return Number(n).toFixed(decimals);
}
