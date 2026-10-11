import { MATERIALS, REINFORCEMENTS, getThicknessFactors, normalizeBuild } from '../config/materials.js';
import { getEnchantmentEffects } from '../config/enchantments.js';
import { CINEMATICS } from '../config/cinematics.js';

export const PEDAL_DAMAGE = Object.freeze({
  basePerSecond: 0.35,
  heavyPerSecond: 3.2,
});

export const PEDAL_BREAK_DURATION_SEC = CINEMATICS.brakeBreakDurationSec;

export function isPedalBreakCinematicComplete(elapsedSec) {
  return elapsedSec >= PEDAL_BREAK_DURATION_SEC;
}

export function calculatePedalStats(build) {
  const normalized = normalizeBuild(build);
  const material = MATERIALS[normalized.materialId];
  const reinforcement = REINFORCEMENTS[normalized.reinforcementId];
  const thickness = getThicknessFactors(normalized.thickness);
  const enchantment = getEnchantmentEffects(normalized.enchantmentId);
  return Object.freeze({
    maxDurability: material.durability * thickness.durabilityMultiplier * reinforcement.durabilityMultiplier * enchantment.durability,
    damageMultiplier: material.damageMultiplier * thickness.damageMultiplier * reinforcement.damageMultiplier * enchantment.damage,
    instantLoadLimit: material.durability * (0.6 + normalized.thickness / 100) * reinforcement.durabilityMultiplier,
    brakeMultiplier: enchantment.brake,
  });
}

export function calculatePedalDamage(pressDepth, dt, stats) {
  const depth = Math.max(0, Math.min(1, pressDepth));
  if (depth === 0 || dt <= 0) return 0;
  const rate = PEDAL_DAMAGE.basePerSecond * depth + PEDAL_DAMAGE.heavyPerSecond * depth * depth;
  return rate * stats.damageMultiplier * dt;
}

export class BrakeSystem {
  constructor(build) {
    this.reset(build);
  }

  reset(build = this.build) {
    this.build = normalizeBuild(build);
    this.stats = calculatePedalStats(this.build);
    this.durability = this.stats.maxDurability;
    this.broken = false;
    this.breakEventConsumed = false;
  }

  update(pressDepth, dt) {
    if (this.broken) return false;
    this.durability -= calculatePedalDamage(pressDepth, dt, this.stats);
    if (this.durability > 0) return false;
    this.durability = 0;
    this.broken = true;
    if (this.breakEventConsumed) return false;
    this.breakEventConsumed = true;
    return true;
  }
}
