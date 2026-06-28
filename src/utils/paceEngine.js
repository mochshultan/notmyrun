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

/**
 * 0% Inconsistency Model (Steady/Ideal Runner Strategy)
 *  - Warm-up (0% to 8% distance): slow start, ramping to target
 *  - Cruising (8% to 70% distance): highly stable at target pace
 *  - Fatigue Drift (70% to 93% distance): very mild gradual slowdown
 *  - Sprint Finish (93% to 100% distance): accelerate to tape
 */
function getIdealPaceFactor(progress) {
  if (progress < 0.08) {
    const t = progress / 0.08;
    return 1.25 - 0.25 * (1 - Math.pow(1 - t, 2)); // parabolic curve from 1.25 down to 1.00
  } else if (progress < 0.70) {
    return 1.00;
  } else if (progress < 0.93) {
    const t = (progress - 0.70) / (0.93 - 0.70);
    return 1.00 + 0.03 * Math.sin(t * Math.PI / 2); // smooth climb up to 1.03 (3% fatigue slowdown)
  } else {
    const t = (progress - 0.93) / (1.0 - 0.93);
    return 1.03 - 0.13 * t; // accelerate down to 0.90 (sprint finish)
  }
}

/**
 * 100% Inconsistency Model (Run-Walk-Run Interval Strategy)
 *  - Alternates running (faster than target) and walking (much slower)
 *  - 800 meter cycle: 550m running, 250m walking
 *  - Smooth transition curve
 */
function getIntervalPaceFactor(distKm) {
  const cycleLength = 0.8; // 800 meters cycle
  const phase = (distKm % cycleLength) / cycleLength; // 0 to 1

  if (phase < 0.70) {
    // Cruising run pace: 0.90x target (faster than base)
    return 0.90;
  } else {
    // Walking interval: decelerate smoothly to 1.50x target, then accelerate back
    const t = (phase - 0.70) / 0.30;
    return 0.90 + 0.60 * Math.sin(t * Math.PI);
  }
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

  // ── PASS 1: GENERATE BLENDED PACE PROFILE ─────────────────────
  const rawPaces = new Array(N);
  const inconsistencyRatio = Math.max(0, Math.min(100, inconsistency)) / 100;
  let lastNoise = 0;

  for (let i = 0; i < N; i++) {
    const distFromStart = distances[i];
    const grade = grades[i];
    const progress = totalDist > 0 ? distFromStart / totalDist : 0;

    // 1. Get base pacing factor by interpolating between Ideal (0%) and Interval (100%)
    let baseFactor = 1.0;
    if (isBike) {
      // Bikes don't run-walk, they just pace steadily or have high noise
      baseFactor = (1 - inconsistencyRatio) * 1.0 + inconsistencyRatio * (1.0 + gaussianRandom(0, 0.08));
    } else {
      const idealFactor = getIdealPaceFactor(progress);
      const intervalFactor = getIntervalPaceFactor(distFromStart);
      baseFactor = (1 - inconsistencyRatio) * idealFactor + inconsistencyRatio * intervalFactor;
    }

    let adjustedPace = basePaceSec * baseFactor;

    // 2. Grade adjustment
    if (isBike) {
      if (grade > 0) adjustedPace *= (1 + grade * 5);
      else adjustedPace *= Math.max(0.4, 1 + grade * 3);
    } else {
      adjustedPace *= gradePaceMultiplier(grade);
    }

    // 3. Corner slowdown
    const turnAngle = turnAngles[i] || 0;
    if (turnAngle > 25) {
      adjustedPace *= 1 + (turnAngle / 180) * 0.08;
    }

    // 4. Minor random flutter (only scales with inconsistency, 0 at 0%)
    const sigmaPace = inconsistencyRatio * basePaceSec * 0.025;
    const freshNoise = gaussianRandom(0, sigmaPace);
    const currentNoise = i === 0 ? freshNoise : 0.80 * lastNoise + 0.20 * freshNoise; // smooth out jitter
    lastNoise = currentNoise;

    const maxNoise = inconsistencyRatio * basePaceSec * 0.06;
    const clampedNoise = Math.max(-maxNoise, Math.min(maxNoise, currentNoise));

    let finalPace = adjustedPace + clampedNoise;

    if (isBike) finalPace = Math.max(60, Math.min(600, finalPace));
    else         finalPace = Math.max(180, Math.min(600, finalPace));

    rawPaces[i] = finalPace;
  }

  // ── PASS 2: SMOOTH THE PACE PROFILE (Gentle rolling filter) ──
  const smoothedPaces = new Array(N);
  for (let i = 0; i < N; i++) {
    let sum = 0, count = 0;
    const half = N < 8 ? 1 : 2;
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
    // If running, effort is normal-high. If walking (finalPace > 1.30 * basePaceSec), effort drops.
    const paceEffort = 0.5 + 0.5 * Math.max(0.4, Math.min(1.4, basePaceSec / finalPace));

    let gradeEffort = 0;
    if (grade > 0.01) {
      gradeEffort = Math.min(0.20, grade * 1.5);
    } else if (grade < -0.05) {
      gradeEffort = Math.max(-0.05, grade * 0.8);
    }

    const turnEffort = turnAngle > 40 ? 0.04 : turnAngle > 25 ? 0.02 : 0;

    const elapsedMin = (timestamps[i] - timestamps[0]) / 60000;
    const driftEffort = (elapsedMin / 60) * 0.03;

    const effort = Math.min(1.0, Math.max(0.1, paceEffort + gradeEffort + turnEffort + driftEffort));

    // 2. Zone-based Heart Rate
    const effortNormalized = effort * (hrTarget / ZONES.Z2);
    let targetHR = effortToHR(effortNormalized);
    targetHR = Math.max(REST_HR + 5, Math.min(ZONES.Z5, targetHR));

    // Warm-up ramp (only for steady pace, intervals warm up dynamically)
    if (i > 0 && progress < 0.08) {
      const elapsedSec = (timestamps[i] - timestamps[0]) / 1000;
      if (elapsedSec < 120) {
        const warmRatio = elapsedSec / 120;
        const startHR = Math.round(REST_HR + (hrTarget - REST_HR) * 0.35);
        targetHR = startHR + (targetHR - startHR) * warmRatio;
      }
    }

    // HR thermal inertia (EMA) - slower fall than rise matches real walking recovery
    let hr;
    if (i === 0) {
      hr = Math.round(REST_HR + (hrTarget - REST_HR) * 0.35);
    } else {
      const dtMin = Math.max(0.05, segmentDistKm * finalPace / 60);
      const isClimbingOrSprinting = targetHR > currentHR;
      const tau = isClimbingOrSprinting ? 0.70 : 1.10; // τ=42s for rise, τ=66s for recovery
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
      // If walking, cadence drops significantly (e.g. to 110-120 spm)
      const isWalking = finalPace > basePaceSec * 1.25;
      const targetCadence = isWalking ? 115 : cadenceTarget;

      const cadAdjust = isWalking ? 0 : (effortRatio - 1) * 8;
      const cadSigma = (cadenceInconsistency / 100) * 5;
      cad = Math.round(Math.max(100, Math.min(195,
        targetCadence + cadAdjust - turnPenalty + gaussianRandom(0, cadSigma * 0.3)
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
