import * as THREE from 'three';
import { buildRoad } from './RoadBuilder.js';
import { seededVariation } from './TerrainHeight.js';

const UP = new THREE.Vector3(0, 1, 0);
const TERRAIN_DISTANCES = [6.15, 10, 22, 42, 68, 86];
const TERRAIN_MATERIAL = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide });

function sideVector(tangent) { return new THREE.Vector3().crossVectors(UP, tangent).normalize(); }

function terrainHeight(roadY, distance, side, roadDistanceM) {
  if (distance <= 6.15) return roadY - 0.08;
  const wave = Math.sin(roadDistanceM * 0.018) * 1.3 + Math.sin(roadDistanceM * 0.041) * 0.8;
  const bands = side > 0
    ? [[6.15, -0.08], [10, -0.72], [22, 4.5], [42, 15], [68, 24], [86, 22]]
    : [[6.15, -0.08], [10, -2.2], [22, -10], [42, -25], [68, -46], [86, -55]];
  for (let i = 1; i < bands.length; i += 1) {
    if (distance <= bands[i][0]) {
      const t = (distance - bands[i - 1][0]) / (bands[i][0] - bands[i - 1][0]);
      return roadY + THREE.MathUtils.lerp(bands[i - 1][1], bands[i][1], t) + wave * t * 0.7;
    }
  }
  return null;
}

function makeTerrain(module, side) {
  const positions = [];
  const colors = [];
  const indices = [];
  const count = module.points.length - 1;
  const palette = side > 0
    ? [0x596b45, 0x5d794e, 0x446f4c, 0x365e4a, 0x3b6458, 0x3e625a]
    : [0x5c684b, 0x657354, 0x716f63, 0x615f64, 0x4d5868, 0x374d60];
  for (let i = 0; i <= count; i += 1) {
    const u = i / count;
    const sample = module.curve.getPointAt(u);
    const lateral = sideVector(module.curve.getTangentAt(u));
    const distanceM = module.startM + u * module.lengthM;
    TERRAIN_DISTANCES.forEach((distance, band) => {
      positions.push(sample.x + lateral.x * distance * side,
        terrainHeight(sample.y, distance, side, distanceM),
        sample.z + lateral.z * distance * side);
      const color = new THREE.Color(palette[band]);
      const variation = 0.88 + seededVariation(module.index * 50 + i, band + (side > 0 ? 7 : 11)) * 0.17;
      colors.push(color.r * variation, color.g * variation, color.b * variation);
    });
    if (i < count) {
      for (let band = 0; band < TERRAIN_DISTANCES.length - 1; band += 1) {
        const a = i * TERRAIN_DISTANCES.length + band;
        const b = a + TERRAIN_DISTANCES.length;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, TERRAIN_MATERIAL);
  mesh.receiveShadow = true;
  return mesh;
}

function makeScenery(module) {
  const group = new THREE.Group();
  const count = 24;
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.3, 0.44, 2.9, 5),
    new THREE.MeshStandardMaterial({ color: 0x57412d, roughness: 1 }), count,
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.8, 5.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x28583c, roughness: 1, flatShading: true }), count,
  );
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  for (let i = 0; i < count; i += 1) {
    const u = (i + 0.5) / count;
    const side = i % 3 === 0 ? -1 : 1;
    const distance = 15 + seededVariation(i + module.index * 27, 8) * 40;
    const point = module.curve.getPointAt(u);
    const lateral = sideVector(module.curve.getTangentAt(u));
    const groundY = terrainHeight(point.y, distance, side, module.startM + u * module.lengthM);
    if (!Number.isFinite(groundY)) continue;
    const size = 0.72 + seededVariation(i + module.index * 17, 4) * 0.8;
    position.copy(point).addScaledVector(lateral, distance * side);
    scale.setScalar(size);
    position.y = groundY + 1.45 * size - 0.14;
    matrix.compose(position, new THREE.Quaternion(), scale);
    trunks.setMatrixAt(i, matrix);
    position.y = groundY + 5.45 * size - 0.16;
    matrix.compose(position, new THREE.Quaternion(), scale);
    crowns.setMatrixAt(i, matrix);
  }
  trunks.castShadow = true;
  crowns.castShadow = true;
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  group.add(trunks, crowns);
  const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x63685b, roughness: 1, flatShading: true });
  for (let i = 0; i < 5; i += 1) {
    const u = (i + 0.35) / 5;
    const side = i % 2 ? 1 : -1;
    const distance = 19 + seededVariation(module.index * 11 + i, 12) * 27;
    const point = module.curve.getPointAt(u);
    const lateral = sideVector(module.curve.getTangentAt(u));
    const size = 1.2 + seededVariation(module.index * 13 + i, 16) * 1.35;
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.scale.set(size * 1.2, size * 0.75, size);
    rock.rotation.y = seededVariation(module.index * 9 + i, 17) * Math.PI;
    rock.position.copy(point).addScaledVector(lateral, distance * side);
    rock.position.y = terrainHeight(point.y, distance, side, module.startM + u * module.lengthM) + size * 0.45;
    rock.castShadow = true;
    group.add(rock);
  }
  return group;
}

function makeDistantMountains(module) {
  const group = new THREE.Group();
  group.name = 'Blue and violet distant mountain layers';
  const geometry = new THREE.ConeGeometry(1, 1, 5);
  const palette = [0x345d8b, 0x4d6799, 0x5d6595, 0x745f94];
  for (let i = 0; i < 4; i += 1) {
    const u = (i + 0.45) / 4;
    const point = module.curve.getPointAt(u);
    const side = sideVector(module.curve.getTangentAt(u));
    const direction = i === 3 ? 1 : -1;
    const distance = 150 + i * 24 + seededVariation(module.index * 7 + i, 51) * 30;
    const radius = 54 + seededVariation(module.index * 13 + i, 53) * 37;
    const height = 135 + seededVariation(module.index * 19 + i, 55) * 70;
    const mountain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color: palette[(module.index + i) % palette.length], roughness: 1, flatShading: true,
    }));
    mountain.position.copy(point).addScaledVector(side, direction * distance);
    mountain.position.y = point.y - 75 + height * 0.5;
    mountain.scale.set(radius, height, radius);
    mountain.rotation.y = (module.index * 0.81 + i * 1.3) % Math.PI;
    group.add(mountain);
  }
  return group;
}

function makeCurveSigns(module) {
  const group = new THREE.Group();
  group.name = 'Yellow chevron bend signs';
  if (!module.angle) return group;
  const fractions = module.type === 'turn' ? [0.38] : [0.2, 0.43, 0.66];
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffd428, roughness: 0.8, side: THREE.DoubleSide });
  const black = new THREE.MeshBasicMaterial({ color: 0x141820, side: THREE.DoubleSide });
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x565e67, roughness: 0.7, metalness: 0.25 });
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(-0.48, 0.5);
  arrowShape.lineTo(0.03, 0);
  arrowShape.lineTo(-0.48, -0.5);
  arrowShape.lineTo(-0.2, -0.5);
  arrowShape.lineTo(0.37, 0);
  arrowShape.lineTo(-0.2, 0.5);
  arrowShape.closePath();
  const arrowGeometry = new THREE.ShapeGeometry(arrowShape);
  fractions.forEach((u) => {
    const point = module.curve.getPointAt(u);
    const side = sideVector(module.curve.getTangentAt(u));
    const outside = -module.turnSign;
    const distance = 7.9;
    const sign = new THREE.Group();
    sign.position.copy(point).addScaledVector(side, outside * distance);
    sign.position.y = terrainHeight(point.y, distance, outside, module.startM + u * module.lengthM);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.65, 0.14), poleMaterial);
    pole.position.y = 0.83;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.55, 0.12), yellow);
    panel.position.y = 2.22;
    const arrow = new THREE.Mesh(arrowGeometry, black);
    arrow.position.set(0, 2.22, 0.08);
    arrow.scale.x = module.turnSign > 0 ? -1 : 1;
    sign.add(pole, panel, arrow);
    sign.lookAt(point.x, sign.position.y + 2.2, point.z);
    group.add(sign);
  });
  return group;
}

function disposeGroup(group) {
  const geometries = new Set();
  const materials = new Set();
  group.traverse((object) => {
    if (!object.isMesh && !object.isLine) return;
    if (object.geometry) geometries.add(object.geometry);
    const list = Array.isArray(object.material) ? object.material : [object.material];
    list.forEach((material) => { if (material && material !== TERRAIN_MATERIAL) materials.add(material); });
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

export class EndlessWorld {
  constructor(scene, route) {
    this.scene = scene;
    this.route = route;
    this.chunkGroups = new Map();
    this.sync(0);
  }

  sync(distanceM) {
    this.route.ensureAhead(distanceM + 520);
    for (const module of this.route.modules) {
      if (this.chunkGroups.has(module.index)) continue;
      const group = new THREE.Group();
      group.name = `Road module ${module.index}: ${module.type}`;
      group.add(buildRoad(module.curve, { segments: module.points.length - 1 }),
        makeTerrain(module, -1), makeTerrain(module, 1), makeScenery(module),
        makeDistantMountains(module), makeCurveSigns(module));
      this.scene.add(group);
      this.chunkGroups.set(module.index, group);
    }
    for (const module of this.route.pruneBehind(distanceM)) {
      const group = this.chunkGroups.get(module.index);
      if (!group) continue;
      this.scene.remove(group);
      disposeGroup(group);
      this.chunkGroups.delete(module.index);
    }
  }

  getTerrainHeight(x, z, { moduleIndex = null } = {}) {
    let nearest = null;
    let bestDistanceSq = Infinity;
    for (const module of this.route.modules) {
      if (moduleIndex != null && Math.abs(module.index - moduleIndex) > 1) continue;
      for (let i = 0; i < module.points.length; i += 1) {
        const point = module.points[i];
        const dx = x - point.x;
        const dz = z - point.z;
        const square = dx * dx + dz * dz;
        if (square < bestDistanceSq) {
          bestDistanceSq = square;
          nearest = { module, i, point };
        }
      }
    }
    if (!nearest) return null;
    const tangent = nearest.module.curve.getTangentAt(nearest.i / (nearest.module.points.length - 1));
    const lateral = sideVector(tangent);
    const signed = (x - nearest.point.x) * lateral.x + (z - nearest.point.z) * lateral.z;
    return terrainHeight(nearest.point.y, Math.abs(signed), Math.sign(signed) || 1,
      nearest.module.startM + nearest.i * nearest.module.lengthM / (nearest.module.points.length - 1));
  }

  reset() {
    for (const group of this.chunkGroups.values()) {
      this.scene.remove(group);
      disposeGroup(group);
    }
    this.chunkGroups.clear();
    this.sync(0);
  }
}
