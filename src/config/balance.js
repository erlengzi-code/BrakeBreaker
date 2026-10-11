export const BALANCE = Object.freeze({
  initialSpeedMps: 12,
  minSpeedMps: 4.5,
  maxSpeedMps: 34,
  baseDownhillAcceleration: 1.65,
  naturalDrag: 0.28,
  speedDrag: 0.009,
  brakeBaseDeceleration: 10.5,
  pressTimeToMax: 1,
  releaseTime: 0.2,
  maxDeltaSec: 0.05,
  crashDurationSec: 2.35,
});

export const SECTION_ACCELERATION = Object.freeze([1.15, 1.5, 1.85, 2.55, 2.1]);
