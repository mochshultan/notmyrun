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
 * Generate full run profile with pace, HR, cadence, and timestamps.
 *
 * HR follows a physiological model:
 *  - Baseline = hrTarget (set by user slider)
 *  - Faster pace → higher HR / slower pace → lower HR
 *  - Uphill adds HR beyond pace (climbing effort)
 *  - Downhill gives slight gravity-assist offset
 *  - Sharp turns cause brief HR elevation
 *  - HR inertia: smooth rise (~20 s), slower fall (~35 s)
 *  - Cardiac drift: +4 bpm/hour over time
 *  - Sprint finish: last 8 % distance → HR spikes toward max(HR)
 *  - hrInconsistency controls short-term variability around the curve
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

  const N = points.length;
  const results = [];
  const timestamps = [startMs];

  // Pre‑compute turn angles at every point (0 at ends)
  const turnAngles = new Array(N).fill(0);
  for (let i = 1; i < N - 1; i++) {
    turnAngles[i] = bearingChange(points[i - 1], points[i], points[i + 1]);
  }

  // Physiological constants
  const MAX_HR = 190;  // ~220 − age(30)
  const REST_HR = 60;

  let currentHR = hrTarget; // inertia state

  for (let i = 0; i < N; i++) {
    const distFromStart = distances[i];
    let grade = 0;
    let segmentDistKm = 0;

    if (i > 0) {
      segmentDistKm = distances[i] - distances[i - 1];
      if (segmentDistKm > 0) {
        grade = (elevations[i] - elevations[i - 1]) / (segmentDistKm * 1000);
      }
    }

    // ── 1. GRADE‑ADJUSTED PACE ──────────────────────────────────
    let adjustedPace = basePaceSec;
    if (isBike) {
      if (grade > 0) adjustedPace *= (1 + grade * 5);
      else adjustedPace *= Math.max(0.4, 1 + grade * 3);
    } else {
      adjustedPace *= gradePaceMultiplier(grade);
    }

    // ── 2. CORNER SLOWDOWN ──────────────────────────────────────
    const turnAngle = turnAngles[i] || 0;
    if (turnAngle > 20) {
      // Gradual slowdown: 0 % at 20° → ~15 % at 180° (hairpin)
      adjustedPace *= 1 + (turnAngle / 180) * 0.15;
    }

    // ── 3. SPRINT FINISH (last 8 %) ─────────────────────────────
    const progress = totalDist > 0 ? distFromStart / totalDist : 0;
    let sprintFactor = 1;
    if (progress > 0.92) {
      const t = (progress - 0.92) / 0.08; // 0 → 1
      sprintFactor = 1 - t * 0.2;          // up to 20 % faster
    }

    // ── 4. PACE VARIATION ───────────────────────────────────────
    const sigma = (inconsistency / 100) * basePaceSec * 0.12;
    const noisyPace = adjustedPace * sprintFactor + gaussianRandom(0, sigma);

    // Fatigue: slight slowdown in last 20 %
    const fatigueFactor = progress > 0.8
      ? 1 + 0.08 * ((progress - 0.8) / 0.2)
      : 1.0;
    let finalPace = noisyPace * fatigueFactor;

    // Clamp
    if (isBike) finalPace = Math.max(60, Math.min(600, finalPace));
    else         finalPace = Math.max(150, Math.min(900, finalPace));

    // ── 5. TIMESTAMPS ───────────────────────────────────────────
    if (i > 0) {
      const segSeconds = segmentDistKm * finalPace;
      timestamps[i] = timestamps[i - 1] + segSeconds * 1000;
    }

    // ── 6. HEART RATE — PHYSIOLOGICAL MODEL ─────────────────────
    const paceRatio = finalPace / basePaceSec;

    // 6a. Pace‑driven component
    //     faster pace (ratio < 1) → HR climbs; slower → HR drops
    const hrFromPace = hrTarget + 30 * (1 - paceRatio);

    // 6b. Grade component — climbs add extra HR beyond pace alone;
    //     steep descents give a small gravity‑assist offset
    let hrFromGrade = 0;
    if (grade > 0.015) {
      hrFromGrade = grade * 120;           // +12 bpm / 10 %
    } else if (grade < -0.06) {
      hrFromGrade = grade * 30;            // −1.8 bpm / 10 % (mild)
    }

    // 6c. Turn spike (~3 bpm over 40°)
    const hrFromTurn = turnAngle > 40 ? 3 : turnAngle > 20 ? 1 : 0;

    // 6d. Warm‑up: first 5 % of distance → HR ramps up
    let warmupRatio = 1;
    if (progress < 0.05) {
      warmupRatio = 0.88 + 0.12 * (progress / 0.05);
    }

    // 6e. Finish kick (last 8 % → HR climbs toward max)
    let finishKick = 0;
    if (progress > 0.92) {
      const t = (progress - 0.92) / 0.08;
      finishKick = t * 15;                 // up to +15 bpm at tape
    }

    // 6f. Combine
    let targetHR = hrFromPace * warmupRatio + hrFromGrade + hrFromTurn + finishKick;

    // Cap targets
    targetHR = Math.max(REST_HR + 10, Math.min(MAX_HR, targetHR));

    // 6g. HR inertia — exponential moving average
    let hr;
    if (i === 0) {
      hr = hrTarget * warmupRatio + gaussianRandom(0, 1);
    } else {
      const timeStep = segmentDistKm * finalPace / 60; // minutes
      const dtMin = Math.max(0.05, timeStep);
      // Rise is faster (τ = 20 s) than recovery (τ = 35 s)
      const tau = targetHR > currentHR ? 0.33 : 0.58;
      const alpha = 1 - Math.exp(-dtMin / tau);
      hr = currentHR + alpha * (targetHR - currentHR);
    }

    // 6h. Cardiac drift: +4 bpm per hour
    const elapsedMin = (timestamps[i] - timestamps[0]) / 60000;
    hr += (elapsedMin / 60) * 4;

    // 6i. Short‑term variability (from user slider)
    const hrVarSigma = (hrInconsistency / 100) * 6;
    hr += gaussianRandom(0, hrVarSigma * 0.4);

    hr = Math.round(Math.max(REST_HR + 10, Math.min(MAX_HR, hr)));
    currentHR = hr;

    // ── 7. CADENCE ──────────────────────────────────────────────
    let cad;
    if (isBike) {
      const speedKmh = 3600 / finalPace;
      cad = Math.round(Math.max(60, Math.min(110,
        70 + speedKmh * 0.8 + gaussianRandom(0, 3)
      )));
    } else {
      // Cadence rises with effort (sprint / climb) and dips on tight turns
      const turnPenalty = turnAngle > 40 ? 6 : turnAngle > 25 ? 3 : 0;
      const effortRatio = (targetHR - REST_HR) / (hrTarget - REST_HR);
      const cadAdjust = (effortRatio - 1) * 12;  // ~±12 spm around target
      const cadSigma = (cadenceInconsistency / 100) * 8;
      cad = Math.round(Math.max(140, Math.min(200,
        cadenceTarget + cadAdjust - turnPenalty + gaussianRandom(0, cadSigma * 0.3)
      )));
    }

    results.push({
      distance: distFromStart,
      elevation: elevations[i],
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
