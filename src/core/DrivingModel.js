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

export function stepEndlessSpeed({ speedMps, brakeDepth, grade, distanceM, brakeMultiplier = 1 }, dt) {
  const difficulty = Math.min(1.45, distanceM / 2700);
  // Extra pull on steep road follows its actual slope instead of switching at a module boundary.
  const hillPush = Math.max(0, Math.min(1.25, (grade - 0.09) / 0.07 * 1.25));
  const acceleration = 1.05 + grade * 12 + difficulty * 0.48 + hillPush;
  const drag = 0.25 + speedMps * 0.017;
  const brake = BALANCE.brakeBaseDeceleration * brakeDepth * brakeMultiplier;
  return clamp(speedMps + (acceleration - drag - brake) * dt, BALANCE.minSpeedMps, 43);
}
