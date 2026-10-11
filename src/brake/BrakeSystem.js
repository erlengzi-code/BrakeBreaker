import { MATERIALS, REINFORCEMENTS, getThicknessFactors, normalizeBuild } from '../config/materials.js';
import { getEnchantmentEffects } from '../config/enchantments.js';
import { CINEMATICS } from '../config/cinematics.js';

export const PEDAL_DAMAGE = Object.freeze({
  basePerSecond: 0.35,
  heavyPerSecond: 3.2,
});

const REFERENCE_SPEED_MPS = 35;
const referenceHighSpeed = (REFERENCE_SPEED_MPS - 15) / 22;
const referenceFullPressDamage = (PEDAL_DAMAGE.basePerSecond + PEDAL_DAMAGE.heavyPerSecond)
  * (1 + referenceHighSpeed);

function getFatigueScale(maxDurability, damageMultiplier) {
  // Compress the extreme DIY combinations without erasing their relative strengths.
  // Tune the physical build only; enchantment multipliers retain their full effect.
  const nominalSeconds = maxDurability / (referenceFullPressDamage * damageMultiplier);
  const tunedSeconds = Math.max(2.7, Math.min(45.8, 3.7 * nominalSeconds ** 0.44));
  return nominalSeconds / tunedSeconds;
}

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
  const buildDurability = material.durability * thickness.durabilityMultiplier
    * reinforcement.durabilityMultiplier;
  const buildDamageMultiplier = material.damageMultiplier * thickness.damageMultiplier
    * reinforcement.damageMultiplier;
  const maxDurability = buildDurability * enchantment.durability;
  const damageMultiplier = buildDamageMultiplier * enchantment.damage;
  return Object.freeze({
    maxDurability,
    damageMultiplier,
    fatigueScale: getFatigueScale(buildDurability, buildDamageMultiplier),
    instantLoadLimit: material.durability * (0.6 + normalized.thickness / 100) * reinforcement.durabilityMultiplier,
    brakeMultiplier: enchantment.brake,
  });
}

export function calculatePedalDamage(pressDepth, dt, stats, speedMps = 0) {
  const depth = Math.max(0, Math.min(1, pressDepth));
  if (depth === 0 || dt <= 0) return 0;
  const rate = PEDAL_DAMAGE.basePerSecond * depth + PEDAL_DAMAGE.heavyPerSecond * depth * depth;
  const highSpeed = Math.max(0, Math.min(1.5, (speedMps - 15) / 22));
  return rate * (1 + highSpeed * depth * depth) * stats.damageMultiplier * stats.fatigueScale * dt;
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

  update(pressDepth, dt, speedMps = 0) {
    if (this.broken) return false;
    this.durability -= calculatePedalDamage(pressDepth, dt, this.stats, speedMps);
    if (this.durability > 0) return false;
    this.durability = 0;
    this.broken = true;
    if (this.breakEventConsumed) return false;
    this.breakEventConsumed = true;
    return true;
  }
}
