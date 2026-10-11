import { clamp } from '../utils/math.js';

export const ROAD_EXIT_TIME_SEC = 0.68;
const OUTWARD_ACCELERATION = 33;
const AIRBORNE_OUTWARD_ACCELERATION = 3.5;
const FALL_ACCELERATION = 18;

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

export function getOutsideTurnSign(beforeTangent, aheadTangent) {
  const turnCrossY = beforeTangent.z * aheadTangent.x - beforeTangent.x * aheadTangent.z;
  return Math.abs(turnCrossY) < 0.0001 ? 1 : -Math.sign(turnCrossY);
}

export function getCrashMotion(elapsedSec, speedMps, durationSec) {
  const time = clamp(elapsedSec, 0, durationSec);
  const exitTime = Math.min(time, ROAD_EXIT_TIME_SEC);
  const exitProgress = exitTime / ROAD_EXIT_TIME_SEC;
  const airborneTime = Math.max(0, time - ROAD_EXIT_TIME_SEC);
  const airborneDuration = Math.max(0.001, durationSec - ROAD_EXIT_TIME_SEC);
  const airborneEase = smoothstep(Math.min(1, airborneTime / airborneDuration));
  const outwardSpeedAtEdge = OUTWARD_ACCELERATION * ROAD_EXIT_TIME_SEC;
  const launchLift = airborneTime * 7.2;

  return Object.freeze({
    forwardMeters: Math.max(0, speedMps) * time,
    lateralMeters: 0.5 * OUTWARD_ACCELERATION * exitTime * exitTime
      + outwardSpeedAtEdge * airborneTime
      + 0.5 * AIRBORNE_OUTWARD_ACCELERATION * airborneTime * airborneTime,
    liftMeters: airborneTime === 0 ? Math.sin(exitProgress * Math.PI) * 0.32 : launchLift,
    dropMeters: 0.5 * FALL_ACCELERATION * airborneTime * airborneTime,
    rollRadians: 0.16 * exitProgress + 1.02 * airborneEase,
    pitchRadians: 0.34 * airborneEase,
  });
}
