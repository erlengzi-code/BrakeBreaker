export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function damp(current, target, rate, dt) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

export function advanceBrakeDepth(depth, held, dt, pressTimeToMax, releaseTime) {
  const delta = held ? dt / pressTimeToMax : -dt / releaseTime;
  return clamp(depth + delta, 0, 1);
}

export function crossedDistance(previousDistance, currentDistance, targetDistance) {
  return previousDistance < targetDistance && currentDistance >= targetDistance;
}
