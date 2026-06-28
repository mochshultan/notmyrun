function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

async function fetchElevationBatch(points) {
  const locations = points.map(wp => ({
    latitude: wp.lat,
    longitude: wp.lng || wp.lon
  }));

  try {
    const response = await fetch('https://api.open-elevation.com/api/v1/lookup', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ locations })
    });

    if (!response.ok) {
      console.warn("Open Elevation API returned an error:", response.status);
      return points.map(() => 0); // fallback
    }

    const data = await response.json();
    return data.results.map(res => res.elevation);
  } catch (error) {
    console.error("Failed to fetch elevation batch:", error);
    return points.map(() => 0);
  }
}

export async function fetchElevations(snappedPoints) {
  if (snappedPoints.length === 0) return [];
  
  // Chunk into batches of 200 to avoid API limits
  const chunks = chunkArray(snappedPoints, 200);
  
  // Fetch sequentially to be nice to the free API (or use Promise.all if it's robust enough, but Promise.all can trigger rate limits. Prompt says Promise.all)
  const results = await Promise.all(chunks.map(chunk => fetchElevationBatch(chunk)));
  
  return results.flat();
}

export function calculateElevationGain(elevations) {
  let gain = 0;
  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1];
    if (diff > 0) gain += diff;
  }
  return Math.round(gain);
}

export function calculateElevationLoss(elevations) {
  let loss = 0;
  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i - 1] - elevations[i];
    if (diff > 0) loss += diff;
  }
  return Math.round(loss);
}
