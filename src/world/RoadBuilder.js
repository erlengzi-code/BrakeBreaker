import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);

export function buildRoad(curve, { width = 10.4, segments = 620, terrainSampler = null } = {}) {
  const group = new THREE.Group();
  group.name = 'Asphalt Mountain Road';

  const foundation = makeRoadFoundation(curve, width + 2.2, segments);

  const shoulder = makeRibbon(curve, width + 2.2, segments, 0.015, new THREE.MeshStandardMaterial({
    color: 0x2a3033,
    roughness: 1,
    metalness: 0,
  }));
  shoulder.name = 'Roadbed and shoulders';

  const asphalt = makeRibbon(curve, width, segments, 0.09, new THREE.MeshStandardMaterial({
    color: 0x24272b,
    roughness: 0.91,
    metalness: 0.02,
    flatShading: true,
  }), true);
  asphalt.name = 'Dark asphalt surface';
  asphalt.receiveShadow = true;

  const leftEdge = makeOffsetLine(curve, width * 0.5 - 0.32, 0xffffff, segments);
  const rightEdge = makeOffsetLine(curve, -width * 0.5 + 0.32, 0xffffff, segments);
  const centerMarkings = buildCenterMarkings(curve);
  const rails = buildGuardRails(curve, width, terrainSampler);

  group.add(foundation, shoulder, asphalt, leftEdge, rightEdge, centerMarkings, rails);
  return group;
}

function makeRoadFoundation(curve, width, segments) {
  const positions = [];
  const indices = [];
  const side = new THREE.Vector3();
  const halfWidth = width * 0.5;
  for (let i = 0; i <= segments; i += 1) {
    const u = i / segments;
    const point = curve.getPointAt(u);
    side.crossVectors(UP, curve.getTangentAt(u)).normalize();
    const leftX = point.x + side.x * halfWidth;
    const leftZ = point.z + side.z * halfWidth;
    const rightX = point.x - side.x * halfWidth;
    const rightZ = point.z - side.z * halfWidth;
    positions.push(
      leftX, point.y - 0.025, leftZ,
      rightX, point.y - 0.025, rightZ,
      leftX, point.y - 1.45, leftZ,
      rightX, point.y - 1.45, rightZ,
    );
    if (i < segments) {
      const base = i * 4;
      const next = base + 4;
      indices.push(
        base, base + 2, next,
        base + 2, next + 2, next,
        base + 1, next + 1, base + 3,
        base + 3, next + 1, next + 3,
        base + 2, base + 3, next + 2,
        base + 3, next + 3, next + 2,
      );
    }
  }
  indices.push(0, 1, 2, 1, 3, 2);
  const end = segments * 4;
  indices.push(end, end + 2, end + 1, end + 1, end + 2, end + 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const foundation = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: 0x45443b,
    roughness: 1,
    flatShading: true,
    side: THREE.DoubleSide,
  }));
  foundation.name = 'Solid road foundation';
  foundation.castShadow = true;
  foundation.receiveShadow = true;
  return foundation;
}

function makeRibbon(curve, width, segments, height, material, varyAsphalt = false) {
  const positions = [];
  const colors = [];
  const indices = [];
  const side = new THREE.Vector3();

  for (let i = 0; i <= segments; i += 1) {
    const u = i / segments;
    const point = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u).normalize();
    side.crossVectors(UP, tangent).normalize();
    positions.push(
      point.x + side.x * width * 0.5, point.y + height, point.z + side.z * width * 0.5,
      point.x - side.x * width * 0.5, point.y + height, point.z - side.z * width * 0.5,
    );
    if (varyAsphalt) {
      const shade = 0.84 + ((i * 17) % 11) / 100;
      colors.push(shade, shade, shade, shade * 0.97, shade * 0.97, shade * 0.97);
    }
    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (varyAsphalt) {
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    material.vertexColors = true;
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

function makeOffsetLine(curve, offset, color, segments) {
  const points = [];
  const side = new THREE.Vector3();
  for (let i = 0; i <= segments; i += 1) {
    const u = i / segments;
    const point = curve.getPointAt(u);
    side.crossVectors(UP, curve.getTangentAt(u)).normalize();
    points.push(point.clone().addScaledVector(side, offset).addScaledVector(UP, 0.17));
  }
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.94 }),
  );
  line.name = 'Road edge line';
  return line;
}

function buildCenterMarkings(curve) {
  const group = new THREE.Group();
  group.name = 'Yellow center markings';
  const geometry = new THREE.BoxGeometry(0.22, 0.045, 4.2);
  const material = new THREE.MeshBasicMaterial({ color: 0xf5c842 });
  const tangent = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();

  for (let u = 0.01; u < 0.995; u += 0.016) {
    const mark = new THREE.Mesh(geometry, material);
    mark.position.copy(curve.getPointAt(u)).addScaledVector(UP, 0.18);
    tangent.copy(curve.getTangentAt(u)).normalize();
    quaternion.setFromUnitVectors(FORWARD, tangent);
    mark.quaternion.copy(quaternion);
    group.add(mark);
  }
  return group;
}

function buildGuardRails(curve, width, terrainSampler) {
  const group = new THREE.Group();
  group.name = 'Guard rails';
  const routeLength = curve.getLength();
  const spacingM = 5.15;
  const sampleCount = Math.ceil(routeLength / spacingM);
  const instanceCount = sampleCount * 2;
  const postGeometry = new THREE.BoxGeometry(0.2, 1.15, 0.2);
  const railGeometry = new THREE.BoxGeometry(0.16, 0.28, 1);
  const reflectorGeometry = new THREE.BoxGeometry(0.25, 0.2, 0.08);
  const metal = new THREE.MeshStandardMaterial({ color: 0xd7dde0, roughness: 0.38, metalness: 0.76 });
  const red = new THREE.MeshStandardMaterial({ color: 0xe85542, roughness: 0.55, metalness: 0.18 });
  const posts = new THREE.InstancedMesh(postGeometry, metal, instanceCount);
  const beamCount = Math.max(0, sampleCount - 1) * 2;
  const rails = new THREE.InstancedMesh(railGeometry, metal, beamCount);
  const reflectorCount = Math.ceil(sampleCount / 6) * 2;
  const reflectors = new THREE.InstancedMesh(reflectorGeometry, red, reflectorCount);
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  const beamDirection = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const identity = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const unitScale = new THREE.Vector3(1, 1, 1);
  const scale = new THREE.Vector3(1, 1, 1);
  let postIndex = 0;
  let reflectorIndex = 0;

  const edgeSamples = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const u = (index + 0.5) / sampleCount;
    const point = curve.getPointAt(u);
    tangent.copy(curve.getTangentAt(u)).normalize();
    side.crossVectors(UP, tangent).normalize();
    const sampleEdges = [];
    [-1, 1].forEach((direction) => {
      const edgeOffset = width * 0.5 + 0.62;
      const edgeX = point.x + side.x * edgeOffset * direction;
      const edgeZ = point.z + side.z * edgeOffset * direction;
      const groundY = terrainSampler?.getTerrainHeightAtU(u, edgeX, edgeZ) ?? point.y;
      sampleEdges.push(new THREE.Vector3(edgeX, groundY, edgeZ));
      position.set(edgeX, groundY + 0.575, edgeZ);
      matrix.compose(position, identity, unitScale);
      posts.setMatrixAt(postIndex, matrix);
      if (index % 6 === 0 && reflectorIndex < reflectorCount) {
        position.set(edgeX - side.x * direction * 0.12, groundY + 1.03, edgeZ - side.z * direction * 0.12);
        matrix.compose(position, identity, unitScale);
        reflectors.setMatrixAt(reflectorIndex, matrix);
        reflectorIndex += 1;
      }
      postIndex += 1;
    });
    edgeSamples.push(sampleEdges);
  }
  let beamIndex = 0;
  for (let index = 0; index < edgeSamples.length - 1; index += 1) {
    for (let edge = 0; edge < 2; edge += 1) {
      const start = edgeSamples[index][edge];
      const end = edgeSamples[index + 1][edge];
      beamDirection.subVectors(end, start);
      const length = beamDirection.length();
      if (length < 0.001) continue;
      quaternion.setFromUnitVectors(FORWARD, beamDirection.normalize());
      position.copy(start).add(end).multiplyScalar(0.5);
      position.y += 1.02;
      scale.set(1, 1, length * 1.015);
      matrix.compose(position, quaternion, scale);
      rails.setMatrixAt(beamIndex, matrix);
      beamIndex += 1;
    }
  }
  posts.count = postIndex;
  rails.count = beamIndex;
  reflectors.count = reflectorIndex;
  posts.instanceMatrix.needsUpdate = true;
  rails.instanceMatrix.needsUpdate = true;
  reflectors.instanceMatrix.needsUpdate = true;
  posts.castShadow = true;
  rails.castShadow = true;
  group.add(posts, rails, reflectors);
  return group;
}
