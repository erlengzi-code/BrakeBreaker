import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
export const TERRAIN_SEGMENTS = 360;
export const TERRAIN_INNER_DISTANCE = 6.2;
export const VALLEY_FLOOR_Y = -17.55;

function smoothstep(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

export function seededVariation(index, salt = 0) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function getTerrainProfile(sampleIndex, direction, roadY = 0) {
  const sideIndex = direction < 0 ? 0 : 1;
  const smoothNoise = (phase) => THREE.MathUtils.clamp(
    0.5 + 0.29 * Math.sin(sampleIndex * 0.047 + sideIndex * 2.2 + phase)
      + 0.21 * Math.sin(sampleIndex * 0.113 + sideIndex * 4.1 + phase * 1.7),
    0,
    1,
  );
  const shoulderNoise = smoothNoise(0.4);
  const slopeNoise = smoothNoise(1.8);
  const cliffNoise = smoothNoise(3.2);
  const slopeHeight = Math.max(VALLEY_FLOOR_Y + 5.8, roadY - (7.5 + slopeNoise * 7));
  const cliffHeight = Math.max(VALLEY_FLOOR_Y + 1.35, roadY - (22 + cliffNoise * 12));
  return Object.freeze({
    innerDistance: TERRAIN_INNER_DISTANCE,
    shoulderDistance: 9.2 + shoulderNoise * 1.5,
    slopeDistance: 33 + slopeNoise * 5,
    cliffDistance: 49 + cliffNoise * 6,
    baseDistance: 68 + slopeNoise * 8,
    innerHeight: roadY - 0.08,
    shoulderHeight: roadY - (1.05 + shoulderNoise * 0.7),
    slopeHeight,
    cliffHeight: Math.min(slopeHeight - 1.1, cliffHeight),
    baseHeight: VALLEY_FLOOR_Y,
  });
}

export function getTerrainCrossSection(profile) {
  return [
    { distance: profile.innerDistance, height: profile.innerHeight },
    { distance: profile.shoulderDistance, height: profile.shoulderHeight },
    { distance: profile.slopeDistance, height: profile.slopeHeight },
    { distance: profile.cliffDistance, height: profile.cliffHeight },
    { distance: profile.baseDistance, height: profile.baseHeight },
  ];
}

export function getTerrainHeightFromProfile(distance, profile) {
  if (!Number.isFinite(distance) || distance > profile.baseDistance + 0.001) return null;
  const crossSection = getTerrainCrossSection(profile);
  if (distance <= crossSection[0].distance) return crossSection[0].height;
  for (let index = 1; index < crossSection.length; index += 1) {
    const previous = crossSection[index - 1];
    const current = crossSection[index];
    if (distance <= current.distance) {
      const blend = smoothstep((distance - previous.distance) / (current.distance - previous.distance));
      return THREE.MathUtils.lerp(previous.height, current.height, blend);
    }
  }
  return null;
}

export function getGroundedCenterY(groundY, localBottomY, scaleY = 1, embed = 0) {
  return groundY - localBottomY * scaleY - embed;
}

export function solveMultiPointGrounding(groundHeights, localBottomY, minimumEmbed = 0.22) {
  const valid = groundHeights.filter(Number.isFinite);
  if (valid.length === 0) return null;
  const highest = Math.max(...valid);
  const lowest = Math.min(...valid);
  const slopeEmbed = Math.max(minimumEmbed, (highest - lowest) * 0.92 + minimumEmbed);
  return highest - localBottomY - slopeEmbed;
}

export class TerrainHeightSampler {
  constructor(curve, segments = TERRAIN_SEGMENTS) {
    this.curve = curve;
    this.segments = segments;
    this.samples = [];
    const side = new THREE.Vector3();
    for (let index = 0; index <= segments; index += 1) {
      const u = index / segments;
      const point = curve.getPointAt(u);
      side.crossVectors(UP, curve.getTangentAt(u)).normalize();
      this.samples.push({ index, u, point, sideX: side.x, sideZ: side.z });
    }
  }

  nearestSample(x, z, uHint = null) {
    const hintedIndex = Number.isFinite(uHint)
      ? Math.round(THREE.MathUtils.clamp(uHint, 0, 1) * this.segments)
      : null;
    const start = hintedIndex == null ? 0 : Math.max(0, hintedIndex - 3);
    const end = hintedIndex == null ? this.samples.length - 1 : Math.min(this.samples.length - 1, hintedIndex + 3);
    let nearest = this.samples[start];
    let nearestDistanceSq = Infinity;
    for (let index = start; index <= end; index += 1) {
      const sample = this.samples[index];
      const dx = x - sample.point.x;
      const dz = z - sample.point.z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq < nearestDistanceSq) {
        nearest = sample;
        nearestDistanceSq = distanceSq;
      }
    }
    return nearest;
  }

  sampleTerrain(x, z, { uHint = null } = {}) {
    const sample = this.nearestSample(x, z, uHint);
    const lateral = (x - sample.point.x) * sample.sideX + (z - sample.point.z) * sample.sideZ;
    const direction = lateral < 0 ? -1 : 1;
    const distance = Math.abs(lateral);
    const profile = getTerrainProfile(sample.index, direction, sample.point.y);
    const height = getTerrainHeightFromProfile(distance, profile);
    return Object.freeze({ valid: Number.isFinite(height), height, distance, direction, profile, sample });
  }

  getTerrainHeight(x, z, options = {}) {
    return this.sampleTerrain(x, z, options).height;
  }

  getTerrainHeightAtU(u, x, z) {
    return this.getTerrainHeight(x, z, { uHint: u });
  }

  getProfileAtU(u, direction) {
    const index = Math.round(THREE.MathUtils.clamp(u, 0, 1) * this.segments);
    const sample = this.samples[index];
    return getTerrainProfile(sample.index, direction, sample.point.y);
  }
}

export function createTerrainHeightSampler(curve) {
  return new TerrainHeightSampler(curve);
}
