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
  // Box-Muller with cached second value
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

  // first point
  grades[0] = (elevations[1] - elevations[0]) / Math.max(0.001, (distances[1] - distances[0]) * 1000);

  for (let i = 1; i < N; i++) {
    // Look ahead until we've covered at least minWindowKm or hit the end
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

  // Smooth grades with a 3‑point moving average
  const smoothed = grades.slice();
  for (let i = 1; i < N - 1; i++) {
    smoothed[i] = (grades[i - 1] + grades[i] + grades[i + 1]) / 3;
  }
  return smoothed;
}

/**
 * Realistic grade‑to‑pace multiplier for running.
 * Based on research (Daniels, Tinman): ~4-5% slowdown per % grade uphill,
 * ~2-3% speed-up per % grade downhill (capped).
 */
function gradePaceMultiplier(grade) {
  const g = Math.max(-0.12, Math.min(0.15, grade));
  if (g >= 0) {
    // uphill: 5% slowdown per % grade → at 15% grade it's 1.75×
    return 1 + 4.0 * g;
  }
  // downhill: 3% speed-up per % grade, capped at −9% (91%)
  return Math.max(0.91, 1 + 2.5 * g);
}

/**
 * Bearing (degrees) from p1 to p2.
 */
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

/**
 * Absolute angle change (degrees) at p2 between segment p1→p2 and p2→p3.
 */
function bearingChange(p1, p2, p3) {
  const b1 = bearing(p1, p2);
  const b2 = bearing(p2, p3);
  let diff = b2 - b1;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return Math.abs(diff);
}

/**
 * Heart‑rate zones based on a runner profile.
 * Z1 (very light)  <124  · Z2 (light)  124–144
 * Z3 (moderate)    144–164 · Z4 (hard)  164–184
 * Z5 (max)         >184
 */
const ZONES = { Z1: 124, Z2: 144, Z3: 164, Z4: 184, Z5: 200 };

/**
 * Map an effort level (0…1) to a target HR zone mid‑point.
 */
function effortToHR(effort) {
  if (effort < 0.25) return ZONES.Z1 - 8 + effort * 32;         // 110→124
  if (effort < 0.50) return ZONES.Z1 + (effort - 0.25) * 80;     // 124→144
  if (effort < 0.75) return ZONES.Z2 + (effort - 0.50) * 80;     // 144→164
  if (effort < 0.92) return ZONES.Z3 + (effort - 0.75) * 77;     // 164→184
  return ZONES.Z4 + (effort - 0.92) * 200;                        // 184→200
}

/**
 * Generate full run profile with pace, HR, cadence, and timestamps.
 *
 *  – Grade is computed over a rolling 80 m window to suppress noise.
 *  – Pace adjusts realistically: hills and corners have a modest effect.
 *  – Inconsistency produces gentle undulation, not wild spikes.
 *  – HR follows effort zones (Z2–Z5), NOT a linear function of pace.
 *  – HR has thermal inertia: rises in ~45 s, recovers in ~60 s.
 *  – Warm‑up (~2 min), cardiac drift (+4 bpm/hr), finish kick.
 */
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

  // Smooth elevation before computing grade
  const smoothEle = smoothElevation(elevations);
  const grades = rollingGrade(smoothEle, distances);

  const N = points.length;
  const timestamps = [startMs];
  const results = [];

  // Pre‑compute turn angles (need at least 3 points)
  const turnAngles = new Array(N).fill(0);
  if (N >= 3) {
    for (let i = 1; i < N - 1; i++) {
      turnAngles[i] = bearingChange(points[i - 1], points[i], points[i + 1]);
    }
  }

  // ── Determine an effective flat pace from user's target ─────────
  // The user slider sets the *average* pace they want the whole run to feel like.
  // We adjust in real time so actual average ≈ target average.
  const targetAvgPace = basePaceSec;

  // ── HR state ────────────────────────────────────────────────────
  const REST_HR = 60;
  let currentHR = hrTarget;   // inertia EMA state
  let warmupComplete = false;

  for (let i = 0; i < N; i++) {
    const distFromStart = distances[i];
    let segmentDistKm = 0;
    if (i > 0) segmentDistKm = distances[i] - distances[i - 1];
    const grade = grades[i];

    // ── 1. PACE FROM GRADE ────────────────────────────────────────
    let adjustedPace = targetAvgPace;
    if (isBike) {
      if (grade > 0) adjustedPace *= (1 + grade * 5);
      else adjustedPace *= Math.max(0.4, 1 + grade * 3);
    } else {
      adjustedPace *= gradePaceMultiplier(grade);
    }

    // ── 2. CORNER SLOWDOWN ────────────────────────────────────────
    const turnAngle = turnAngles[i] || 0;
    if (turnAngle > 25) {
      // Hairpin (180°) costs at most 8 %; 90° turn ~4 %
      adjustedPace *= 1 + (turnAngle / 180) * 0.08;
    }

    // ── 3. SPRINT FINISH (last 6 %) ───────────────────────────────
    const progress = totalDist > 0 ? distFromStart / totalDist : 0;
    let sprintFactor = 1;
    if (progress > 0.94) {
      const t = (progress - 0.94) / 0.06;   // 0 → 1
      sprintFactor = 1 - t * 0.12;           // up to 12 % faster
    }

    // ── 4. PACE VARIATION (gentle, not wild) ──────────────────────
    // At inconsistency=100 %, realistic band is ~±8 % of base pace.
    // At inconsistency=0 %, no noise at all.
    const sigmaPace = (inconsistency / 100) * targetAvgPace * 0.04;
    const rawPace = adjustedPace * sprintFactor;
    // Use a small random offset, but re‑centered to avoid drift
    const noiseOffset = gaussianRandom(0, sigmaPace);
    // Clamp noise so it can't swing >inconsistency% from adjusted
    const maxNoise = (inconsistency / 100) * targetAvgPace * 0.08;
    const clampedNoise = Math.max(-maxNoise, Math.min(maxNoise, noiseOffset));

    // Fatigue: last 20 % distance → up to 4 % slowdown
    let fatigueFactor = 1;
    if (progress > 0.80) {
      fatigueFactor = 1 + 0.04 * ((progress - 0.80) / 0.20);
    }

    let finalPace = (rawPace + clampedNoise) * fatigueFactor;

    // Clamp
    if (isBike) finalPace = Math.max(60, Math.min(600, finalPace));
    else         finalPace = Math.max(180, Math.min(600, finalPace));

    // ── 5. TIMESTAMPS ─────────────────────────────────────────────
    if (i > 0) {
      const segSeconds = segmentDistKm * finalPace;
      timestamps[i] = timestamps[i - 1] + segSeconds * 1000;
    }

    // ── 6. HEART RATE — ZONE‑BASED (stable, not bouncing) ────────
    // Determine effort demand from combined inputs.
    let effort = 0;

    // 6a. Pace effort: how hard is the current pace vs flat target?
    //     slower → less effort; faster → higher effort; capped.
    const paceEffort = 0.5 + 0.5 * Math.max(0.7, Math.min(1.3, targetAvgPace / finalPace));
    // paceEffort: 0.85–1.15 roughly (0.6–1.4 unbounded range)

    // 6b. Grade effort: uphills add effort, downhills subtract a little
    let gradeEffort = 0;
    if (grade > 0.01) {
      gradeEffort = Math.min(0.20, grade * 1.5);    // max +0.20 at ~13%
    } else if (grade < -0.05) {
      gradeEffort = Math.max(-0.05, grade * 0.8);   // mild relief
    }

    // 6c. Corner effort
    const turnEffort = turnAngle > 40 ? 0.04 : turnAngle > 25 ? 0.02 : 0;

    // 6d. Fatigue drift: effort creeps up over time
    const elapsedMin = (timestamps[i] - timestamps[0]) / 60000;
    const driftEffort = (elapsedMin / 60) * 0.03;   // +0.03/hr

    // 6e. Sprint finish: extra effort
    let finishEffort = 0;
    if (progress > 0.94) {
      const t = (progress - 0.94) / 0.06;
      finishEffort = t * 0.12;                      // up to +0.12
    }

    effort = Math.min(1.0, paceEffort + gradeEffort + turnEffort + driftEffort + finishEffort);

    // 6f. Map effort → target HR (zone mid‑points)
    //     Scale the effort so that user‑set hrTarget aligns with
    //     "steady state" effort (≈ 0.55 effort → ~145 bpm)
    const effortNormalized = effort * (hrTarget / ZONES.Z2);
    let targetHR = effortToHR(effortNormalized);
    targetHR = Math.max(REST_HR + 5, Math.min(ZONES.Z5, targetHR));

    // 6g. Warm‑up ramp: first ~2 minutes
    if (i > 0) {
      const elapsedSec = (timestamps[i] - timestamps[0]) / 1000;
      if (elapsedSec < 120) {
        const warmRatio = elapsedSec / 120;
        const startHR = Math.round(REST_HR + (hrTarget - REST_HR) * 0.35);
        targetHR = startHR + (targetHR - startHR) * warmRatio;
      } else {
        warmupComplete = true;
      }
    }

    // 6h. HR inertia (EMA) — rise τ=45s, fall τ=60s
    let hr;
    if (i === 0) {
      hr = Math.round(REST_HR + (hrTarget - REST_HR) * 0.35);
    } else {
      const dtMin = Math.max(0.05, segmentDistKm * finalPace / 60);
      const tau = targetHR > currentHR ? 0.75 : 1.0;   // minutes
      const alpha = 1 - Math.exp(-dtMin / tau);
      hr = currentHR + alpha * (targetHR - currentHR);
    }

    // 6i. Tiny variability (barely noticeable — matches real data)
    const hrVarSigma = (hrInconsistency / 100) * 3;
    hr += gaussianRandom(0, hrVarSigma * 0.3);

    hr = Math.round(Math.max(REST_HR + 5, Math.min(ZONES.Z5, hr)));
    currentHR = hr;

    // ── 7. CADENCE ────────────────────────────────────────────────
    let cad;
    if (isBike) {
      const speedKmh = 3600 / finalPace;
      cad = Math.round(Math.max(60, Math.min(110,
        70 + speedKmh * 0.8 + gaussianRandom(0, 3)
      )));
    } else {
      // Cadence changes with effort, not directly with grade
      const effortRatio = (hr - REST_HR) / (hrTarget - REST_HR);
      const turnPenalty = turnAngle > 45 ? 5 : turnAngle > 30 ? 2 : 0;
      const cadAdjust = (effortRatio - 1) * 8;    // ±8 spm around target
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
