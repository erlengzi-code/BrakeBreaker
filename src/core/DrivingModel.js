import { BALANCE, SECTION_ACCELERATION } from '../config/balance.js';
import { clamp } from '../utils/math.js';

export function stepVehicleSpeed({ speedMps, brakeDepth, tangentY, sectionIndex, brakeMultiplier = 1 }, dt) {
  const slopeAcceleration = Math.max(0, -tangentY) * 5.2;
  const acceleration = (SECTION_ACCELERATION[sectionIndex] ?? BALANCE.baseDownhillAcceleration) + slopeAcceleration;
  const drag = BALANCE.naturalDrag + speedMps * BALANCE.speedDrag;
  const brake = BALANCE.brakeBaseDeceleration * brakeDepth * brakeMultiplier;

  return clamp(
    speedMps + (acceleration - drag - brake) * dt,
    BALANCE.minSpeedMps,
    BALANCE.maxSpeedMps,
  );
}

export function isCheckpointOverspeed(speedMps, safeSpeedKmh) {
  return speedMps * 3.6 > safeSpeedKmh;
}
