import { haversineDistance } from './haversine';

export function parsePaceToSeconds(paceStr) {
  const [min, sec] = paceStr.split(':').map(Number);
  return (min * 60) + sec;
}

export function formatSecondsToPace(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function gaussianRandom(mean, std) {
  const u = 1 - Math.random();
  const v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function gradePaceMultiplier(grade) {
  const g = Math.max(-0.45, Math.min(0.45, grade));
  if (g >= 0) return 1 + 4.0 * g;
  if (g >= -0.10) return 1 + 2.0 * g;
  return 1 + 0.5 * g;
}

export function generatePaceProfile({
  points,
  distances,
  elevations,
  basePaceStr,
  inconsistency,
  isBike,
  startTime
}) {
  const basePaceSec = parsePaceToSeconds(basePaceStr);
  const totalDist = distances[distances.length - 1] || 0;
  const startMs = new Date(startTime).getTime();
  
  const results = [];
  const rawHR = [];
  const timestamps = [startMs];
  
  for (let i = 0; i < points.length; i++) {
    const distFromStart = distances[i];
    let grade = 0;
    let segmentDistKm = 0;
    
    if (i > 0) {
      segmentDistKm = distances[i] - distances[i-1];
      if (segmentDistKm > 0) {
        grade = (elevations[i] - elevations[i-1]) / (segmentDistKm * 1000);
      }
    }
    
    // 1. Grade-adjusted pace
    let adjustedPace = basePaceSec;
    if (isBike) {
      // simplified bike grade logic
      if (grade > 0) adjustedPace *= (1 + grade * 5);
      else adjustedPace *= Math.max(0.4, 1 + grade * 3);
    } else {
      adjustedPace *= gradePaceMultiplier(grade);
    }
    
    // 2. Pace variation (inconsistency)
    const sigma = (inconsistency / 100) * basePaceSec * 0.12;
    const noisyPace = adjustedPace + gaussianRandom(0, sigma);
    
    // Fatigue curve
    const progress = totalDist > 0 ? distFromStart / totalDist : 0;
    const fatigueFactor = progress > 0.8 ? 1 + 0.08 * ((progress - 0.8) / 0.2) : 1.0;
    let finalPace = noisyPace * fatigueFactor;
    
    // Clamp limits
    if (isBike) finalPace = Math.max(60, Math.min(600, finalPace));
    else finalPace = Math.max(150, Math.min(900, finalPace));
    
    // 3. Timestamps
    if (i > 0) {
      const segmentSeconds = segmentDistKm * finalPace;
      timestamps[i] = timestamps[i-1] + (segmentSeconds * 1000);
    }
    
    // 4. Heart Rate
    const paceRatio = finalPace / basePaceSec;
    const baseHR = isBike ? 135 : 145;
    const hrRange = 35;
    // Faster pace -> paceRatio < 1 -> (1/paceRatio - 1) > 0 -> HR increases
    const hrFromPace = baseHR + hrRange * (1 / paceRatio - 1) * (isBike ? 2 : 3);
    const hrFromGrade = grade * (isBike ? 150 : 200);
    const drift = (timestamps[i] - timestamps[0]) / (3600 * 1000) * 5; // +5 bpm per hour
    
    rawHR[i] = hrFromPace + hrFromGrade + drift + gaussianRandom(0, 3);
    let hr = Math.round(Math.max(80, Math.min(200, rawHR[i])));
    
    // 5. Cadence
    let cad = 0;
    if (isBike) {
      const speedKmh = 3600 / finalPace;
      cad = Math.round(Math.max(60, Math.min(110, 70 + speedKmh * 0.8 + gaussianRandom(0, 3))));
    } else {
      const baseCadence = 170;
      const cadenceFromPace = baseCadence + (basePaceSec - finalPace) * 0.3;
      cad = Math.round(Math.max(140, Math.min(200, cadenceFromPace + gaussianRandom(0, 4))));
    }
    
    results.push({
      distance: distFromStart,
      elevation: elevations[i],
      paceSec: finalPace,
      speed: 1000 / finalPace, // m/s
      hr,
      cadence: cad,
      timestamp: timestamps[i],
      timeStr: new Date(timestamps[i]).toISOString()
    });
  }
  
  // Apply 5-point moving average to HR
  for (let i = 0; i < results.length; i++) {
    let sum = 0, count = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(results.length - 1, i + 2); j++) {
      sum += results[j].hr;
      count++;
    }
    results[i].hr = Math.round(sum / count);
  }

  return results;
}
