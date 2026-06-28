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

let _gaussNext = null;
function gaussianRandom(mean, std) {
  if (_gaussNext !== null) { const v = _gaussNext; _gaussNext = null; return mean + std * v; }
  let u, v, s;
  do { u = 2 * Math.random() - 1; v = 2 * Math.random() - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
  const f = Math.sqrt(-2 * Math.log(s) / s);
  _gaussNext = v * f;
  return mean + std * u * f;
}

/**
 * Smooth elevation to remove micro‑noise before computing grade.
 * Rolling average over `window` points (default 11 ≈ 100 m on snapped roads).
 */
function smoothElevation(elevations, window = 11) {
  const out = elevations.slice();
  const half = Math.floor(window / 2);
  for (let i = 0; i < out.length; i++) {
    let sum = 0, count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(out.length - 1, i + half); j++) {
      sum += elevations[j]; count++;
    }
    out[i] = sum / count;
  }
  return out;
}

/**
 * Running-grade over a minimum distance window (~100 m) so that
 * a single noisy data point doesn't produce a fake steep grade.
 */
function rollingGrade(elevations, distances, minWindowKm = 0.08) {
  const N = elevations.length;
  const grades = new Array(N).fill(0);
  if (N < 2) return grades;

  grades[0] = (elevations[1] - elevations[0]) / Math.max(0.001, (distances[1] - distances[0]) * 1000);

  for (let i = 1; i < N; i++) {
    let j = i + 1;
    while (j < N && (distances[j] - distances[i]) < minWindowKm) j++;
    if (j >= N) j = N - 1;
    if (j === i) j = i + 1;
    const dKm = distances[j] - distances[i];
    if (dKm > 0.001) {
      grades[i] = (elevations[j] - elevations[i]) / (dKm * 1000);
    } else {
      grades[i] = 0;
    }
  }

  const smoothed = grades.slice();
  for (let i = 1; i < N - 1; i++) {
    smoothed[i] = (grades[i - 1] + grades[i] + grades[i + 1]) / 3;
  }
  return smoothed;
}

/**
 * Realistic grade‑to‑pace multiplier for running.
 */
function gradePaceMultiplier(grade) {
  const g = Math.max(-0.12, Math.min(0.15, grade));
  if (g >= 0) {
    return 1 + 4.0 * g; // uphill: 40% slowdown per 10% grade
  }
  return Math.max(0.91, 1 + 2.5 * g); // downhill: cap speedup at -9% (at 3.6% downhill)
}

function bearing(p1, p2) {
  const toRad = x => x * Math.PI / 180;
  const toDeg = x => x * 180 / Math.PI;
  const lat1 = toRad(p1.lat);
  const lat2 = toRad(p2.lat);
  const dLon = toRad((p2.lng || p2.lon) - (p1.lng || p1.lon));
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function bearingChange(p1, p2, p3) {
  const b1 = bearing(p1, p2);
  const b2 = bearing(p2, p3);
  let diff = b2 - b1;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return Math.abs(diff);
}

const ZONES = { Z1: 124, Z2: 144, Z3: 164, Z4: 184, Z5: 200 };

function effortToHR(effort) {
  if (effort < 0.25) return ZONES.Z1 - 8 + effort * 32;
  if (effort < 0.50) return ZONES.Z1 + (effort - 0.25) * 80;
  if (effort < 0.75) return ZONES.Z2 + (effort - 0.50) * 80;
  if (effort < 0.92) return ZONES.Z3 + (effort - 0.75) * 77;
  return ZONES.Z4 + (effort - 0.92) * 200;
}

export function generatePaceProfile({
  points,
  distances,
  elevations,
  basePaceStr,
  inconsistency,
  isBike,
  startTime,
  hrTarget = 145,
  hrInconsistency = 10,
  cadenceTarget = 170,
  cadenceInconsistency = 10,
}) {
  const basePaceSec = parsePaceToSeconds(basePaceStr);
  const totalDist = distances[distances.length - 1] || 0;
  const startMs = new Date(startTime).getTime();

  const smoothEle = smoothElevation(elevations);
  const grades = rollingGrade(smoothEle, distances);

  const N = points.length;
  const turnAngles = new Array(N).fill(0);
  if (N >= 3) {
    for (let i = 1; i < N - 1; i++) {
      turnAngles[i] = bearingChange(points[i - 1], points[i], points[i + 1]);
    }
  }

  // ── PASS 1: GENERATE RAW PACES (With smooth correlated noise) ──
  const rawPaces = new Array(N);
  let lastNoise = 0;

  for (let i = 0; i < N; i++) {
    const distFromStart = distances[i];
    const grade = grades[i];

    let adjustedPace = basePaceSec;
    if (isBike) {
      if (grade > 0) adjustedPace *= (1 + grade * 5);
      else adjustedPace *= Math.max(0.4, 1 + grade * 3);
    } else {
      adjustedPace *= gradePaceMultiplier(grade);
    }

    const turnAngle = turnAngles[i] || 0;
    if (turnAngle > 25) {
      adjustedPace *= 1 + (turnAngle / 180) * 0.08;
    }

    const progress = totalDist > 0 ? distFromStart / totalDist : 0;
    let sprintFactor = 1;
    if (progress > 0.94) {
      const t = (progress - 0.94) / 0.06;
      sprintFactor = 1 - t * 0.12;
    }

    // Correlated noise (Auto-regressive AR(1) process)
    // This simulates fatigue/running rhythm changing slowly over minutes,
    // rather than jumping wild point-to-point.
    const sigmaPace = (inconsistency / 100) * basePaceSec * 0.04;
    const freshNoise = gaussianRandom(0, sigmaPace);
    // 0.85 correlation coefficient with the previous point
    const currentNoise = i === 0 ? freshNoise : 0.85 * lastNoise + 0.15 * freshNoise;
    lastNoise = currentNoise;

    const maxNoise = (inconsistency / 100) * basePaceSec * 0.08;
    const clampedNoise = Math.max(-maxNoise, Math.min(maxNoise, currentNoise));

    let fatigueFactor = 1;
    if (progress > 0.80) {
      fatigueFactor = 1 + 0.04 * ((progress - 0.80) / 0.20);
    }

    let finalPace = (adjustedPace * sprintFactor + clampedNoise) * fatigueFactor;

    if (isBike) finalPace = Math.max(60, Math.min(600, finalPace));
    else         finalPace = Math.max(180, Math.min(600, finalPace));

    rawPaces[i] = finalPace;
  }

  // ── PASS 2: SMOOTH THE PACE PROFILE ────────────────────────────
  // 5-point rolling window average to smooth out any small leftover jumps
  const smoothedPaces = new Array(N);
  for (let i = 0; i < N; i++) {
    let sum = 0, count = 0;
    const half = N < 8 ? 1 : 2; // adjust window size for very short routes
    for (let j = Math.max(0, i - half); j <= Math.min(N - 1, i + half); j++) {
      sum += rawPaces[j];
      count++;
    }
    smoothedPaces[i] = sum / count;
  }

  // ── PASS 3: CALCULATE PHYSIOLOGICAL METRICS & TIMESTAMPS ───────
  const results = [];
  const timestamps = [startMs];
  const REST_HR = 60;
  let currentHR = hrTarget;

  for (let i = 0; i < N; i++) {
    const distFromStart = distances[i];
    const finalPace = smoothedPaces[i];
    const grade = grades[i];
    const turnAngle = turnAngles[i] || 0;
    const progress = totalDist > 0 ? distFromStart / totalDist : 0;

    let segmentDistKm = 0;
    if (i > 0) {
      segmentDistKm = distances[i] - distances[i - 1];
      const segSeconds = segmentDistKm * finalPace;
      timestamps[i] = timestamps[i - 1] + segSeconds * 1000;
    }

    // 1. Effort computation from smooth pace
    const paceEffort = 0.5 + 0.5 * Math.max(0.7, Math.min(1.3, basePaceSec / finalPace));

    let gradeEffort = 0;
    if (grade > 0.01) {
      gradeEffort = Math.min(0.20, grade * 1.5);
    } else if (grade < -0.05) {
      gradeEffort = Math.max(-0.05, grade * 0.8);
    }

    const turnEffort = turnAngle > 40 ? 0.04 : turnAngle > 25 ? 0.02 : 0;

    const elapsedMin = (timestamps[i] - timestamps[0]) / 60000;
    const driftEffort = (elapsedMin / 60) * 0.03;

    let finishEffort = 0;
    if (progress > 0.94) {
      const t = (progress - 0.94) / 0.06;
      finishEffort = t * 0.12;
    }

    const effort = Math.min(1.0, paceEffort + gradeEffort + turnEffort + driftEffort + finishEffort);

    // 2. Zone-based Heart Rate
    const effortNormalized = effort * (hrTarget / ZONES.Z2);
    let targetHR = effortToHR(effortNormalized);
    targetHR = Math.max(REST_HR + 5, Math.min(ZONES.Z5, targetHR));

    // Warm-up ramp: first ~2 minutes
    if (i > 0) {
      const elapsedSec = (timestamps[i] - timestamps[0]) / 1000;
      if (elapsedSec < 120) {
        const warmRatio = elapsedSec / 120;
        const startHR = Math.round(REST_HR + (hrTarget - REST_HR) * 0.35);
        targetHR = startHR + (targetHR - startHR) * warmRatio;
      }
    }

    // HR thermal inertia (EMA)
    let hr;
    if (i === 0) {
      hr = Math.round(REST_HR + (hrTarget - REST_HR) * 0.35);
    } else {
      const dtMin = Math.max(0.05, segmentDistKm * finalPace / 60);
      const tau = targetHR > currentHR ? 0.75 : 1.0;
      const alpha = 1 - Math.exp(-dtMin / tau);
      hr = currentHR + alpha * (targetHR - currentHR);
    }

    // Minor physiological flutter
    const hrVarSigma = (hrInconsistency / 100) * 3;
    hr += gaussianRandom(0, hrVarSigma * 0.3);
    hr = Math.round(Math.max(REST_HR + 5, Math.min(ZONES.Z5, hr)));
    currentHR = hr;

    // 3. Cadence
    let cad;
    if (isBike) {
      const speedKmh = 3600 / finalPace;
      cad = Math.round(Math.max(60, Math.min(110,
        70 + speedKmh * 0.8 + gaussianRandom(0, 3)
      )));
    } else {
      const effortRatio = (hr - REST_HR) / (hrTarget - REST_HR);
      const turnPenalty = turnAngle > 45 ? 5 : turnAngle > 30 ? 2 : 0;
      const cadAdjust = (effortRatio - 1) * 8;
      const cadSigma = (cadenceInconsistency / 100) * 5;
      cad = Math.round(Math.max(145, Math.min(195,
        cadenceTarget + cadAdjust - turnPenalty + gaussianRandom(0, cadSigma * 0.3)
      )));
    }

    results.push({
      distance: distFromStart,
      elevation: smoothEle[i],
      paceSec: finalPace,
      speed: 1000 / finalPace,
      hr,
      cadence: cad,
      timestamp: timestamps[i],
      timeStr: new Date(timestamps[i]).toISOString(),
    });
  }

  return results;
}
