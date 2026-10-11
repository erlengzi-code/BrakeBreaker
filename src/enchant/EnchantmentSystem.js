import { ENCHANTMENT_ORDER } from '../config/enchantments.js';

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function analyzeDrawing(strokes, width = 256, height = 256, gridSize = 8) {
  const cells = new Set();
  let pointCount = 0;
  let strokeLength = 0;

  strokes.forEach((stroke) => {
    pointCount += stroke.points.length;
    stroke.points.forEach((point, index) => {
      const cellX = Math.max(0, Math.min(gridSize - 1, Math.floor((point.x / width) * gridSize)));
      const cellY = Math.max(0, Math.min(gridSize - 1, Math.floor((point.y / height) * gridSize)));
      cells.add(`${cellX}:${cellY}`);
      if (index > 0) {
        const previous = stroke.points[index - 1];
        strokeLength += Math.hypot(point.x - previous.x, point.y - previous.y);
      }
    });
  });

  const blank = pointCount === 0;
  const diagonal = Math.hypot(width, height);
  const density = blank ? 0 : clamp01(pointCount / 220 + strokeLength / (diagonal * 18));
  const coverage = cells.size / (gridSize * gridSize);
  return Object.freeze({ pointCount, strokeLength, coveredCells: cells.size, coverage, density, blank });
}

export function fingerprintDrawing(strokes) {
  if (strokes.length === 0) return 'blank-v1';
  const source = strokes.map((stroke) => [
    stroke.color,
    Math.round(stroke.size * 10),
    stroke.points.map((point) => [Math.round(point.x * 10), Math.round(point.y * 10)]),
  ]);
  const serialized = JSON.stringify(source);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `logo-${strokes.length}-${(hash >>> 0).toString(16)}`;
}

export function getEnchantmentWeights(features) {
  const weights = Object.fromEntries(ENCHANTMENT_ORDER.map((id) => [id, 1]));
  if (features.blank) return Object.freeze(weights);

  const sparse = 1 - features.density;
  weights.steel_will += features.density * 3.6;
  weights.youtian_blessing += features.density * 1.8;
  weights.light_brake += sparse * 3.2;
  weights.golden_foot += clamp01(features.coverage * 2.4) * 4.2;
  weights.horn_blessing += clamp01(features.coveredCells / 20) * 0.8;
  return Object.freeze(weights);
}

export function drawEnchantment(features, random = Math.random) {
  const weights = getEnchantmentWeights(features);
  const total = ENCHANTMENT_ORDER.reduce((sum, id) => sum + weights[id], 0);
  let cursor = Math.max(0, Math.min(0.999999999, random())) * total;
  for (const id of ENCHANTMENT_ORDER) {
    cursor -= weights[id];
    if (cursor < 0) return id;
  }
  return ENCHANTMENT_ORDER.at(-1);
}

export function canEnchant(build, fingerprint = build.logoFingerprint) {
  return !fingerprint || !build.enchantmentHistory?.[fingerprint];
}
