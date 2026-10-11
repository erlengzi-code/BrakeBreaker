import * as THREE from 'three';
import { ROUTE_SECTIONS } from '../config/route.js';
import {
  getTerrainCrossSection,
  getTerrainProfile,
  seededVariation,
  solveMultiPointGrounding,
  TERRAIN_SEGMENTS,
} from './TerrainHeight.js';

const UP = new THREE.Vector3(0, 1, 0);

export function buildEnvironment(curve, terrainSampler) {
  const group = new THREE.Group();
  group.name = 'Layered Low Poly Mountain Environment';
  group.add(
    buildSky(),
    buildGround(),
    buildFarMountains(),
    buildRoadsideTerrain(curve),
    buildCliffs(curve, terrainSampler),
    buildTrees(curve, terrainSampler),
    buildSectionSigns(curve, terrainSampler),
  );
  return group;
}

function buildSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x568db0) },
      horizonColor: { value: new THREE.Color(0xc5d6bf) },
      bottomColor: { value: new THREE.Color(0xf3c17b) },
    },
    vertexShader: 'varying vec3 vWorld; void main(){ vWorld = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 bottomColor; varying vec3 vWorld; void main(){ float h = normalize(vWorld).y; vec3 c = mix(horizonColor, topColor, smoothstep(0.0, 0.72, h)); c = mix(bottomColor, c, smoothstep(-0.28, 0.12, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(850, 18, 10), material);
  sky.position.set(20, 90, 250);
  sky.name = 'Gradient sky';
  return sky;
}

function buildGround() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1900, 1900),
    new THREE.MeshStandardMaterial({ color: 0x26392f, roughness: 1, flatShading: true }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(10, -18, 240);
  ground.receiveShadow = true;
  return ground;
}

function buildFarMountains() {
  const group = new THREE.Group();
  group.name = 'Far mountain layers';
  const geometry = new THREE.ConeGeometry(1, 1, 7);
  const palette = [0x263d3b, 0x36544b, 0x49675a, 0x587260];
  const points = [
    [-430, 70, -180, 240, 300], [-110, 65, -260, 220, 270], [300, 76, -140, 270, 330],
    [520, 54, 100, 290, 260], [-520, 48, 190, 300, 240], [510, 38, 430, 330, 230],
    [-460, 28, 520, 330, 220], [-80, 24, 760, 390, 250], [410, 18, 760, 350, 230],
  ];
  points.forEach(([x, y, z, radius, height], index) => {
    const mountain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color: palette[index % palette.length],
      roughness: 1,
      flatShading: true,
    }));
    mountain.position.set(x, y, z);
    mountain.scale.set(radius, height, radius);
    mountain.rotation.y = (index * 0.73) % Math.PI;
    mountain.receiveShadow = true;
    group.add(mountain);
  });
  return group;
}

function buildRoadsideTerrain(curve) {
  const group = new THREE.Group();
  group.name = 'Continuous road cut, mountain slopes and valley skirts';
  const sideColors = [
    [0x596044, 0x4c5e3f, 0x40543d, 0x4c4f45, 0x344438],
    [0x566647, 0x476044, 0x3b563f, 0x555448, 0x35483c],
  ];
  const materials = sideColors.map(() => new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    flatShading: true,
    side: THREE.DoubleSide,
  }));
  [-1, 1].forEach((direction, sideIndex) => {
    const positions = [];
    const colors = [];
    const indices = [];
    const side = new THREE.Vector3();
    const segments = TERRAIN_SEGMENTS;
    const bandCount = 5;
    for (let i = 0; i <= segments; i += 1) {
      const u = i / segments;
      const point = curve.getPointAt(u);
      side.crossVectors(UP, curve.getTangentAt(u)).normalize();
      const profile = getTerrainProfile(i, direction, point.y);
      getTerrainCrossSection(profile).forEach((band, bandIndex) => {
        const vertex = point.clone().addScaledVector(side, direction * band.distance);
        vertex.y = band.height;
        positions.push(vertex.x, vertex.y, vertex.z);
        const color = new THREE.Color(sideColors[sideIndex][bandIndex]);
        const shade = 0.93 + seededVariation(i + bandIndex * 17, sideIndex + 11) * 0.1;
        colors.push(color.r * shade, color.g * shade, color.b * shade);
      });
      if (i < segments) {
        const base = i * bandCount;
        for (let bandIndex = 0; bandIndex < bandCount - 1; bandIndex += 1) {
          const next = base + bandCount;
          indices.push(
            base + bandIndex, base + bandIndex + 1, next + bandIndex,
            base + bandIndex + 1, next + bandIndex + 1, next + bandIndex,
          );
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const terrain = new THREE.Mesh(geometry, materials[sideIndex]);
    terrain.receiveShadow = true;
    terrain.name = sideIndex === 0 ? 'Left mountain slope' : 'Right mountain slope';
    group.add(terrain);
  });
  return group;
}

function buildCliffs(curve, terrainSampler) {
  const group = new THREE.Group();
  group.name = 'Roadside cliffs';
  const geometry = new THREE.DodecahedronGeometry(1, 0);
  const rockBounds = new THREE.Box3();
  const materials = [0x59605a, 0x6a695c, 0x4c5752].map((color) => new THREE.MeshStandardMaterial({
    color,
    roughness: 1,
    flatShading: true,
  }));
  const side = new THREE.Vector3();
  for (let i = 4; i < 92; i += 3) {
    const u = i / 96;
    const point = curve.getPointAt(u);
    side.crossVectors(UP, curve.getTangentAt(u)).normalize();
    const direction = i % 4 === 0 ? 1 : -1;
    const rock = new THREE.Mesh(geometry, materials[i % materials.length]);
    const profile = terrainSampler.getProfileAtU(u, direction);
    const distance = profile.shoulderDistance + 3.2
      + seededVariation(i, 13) * Math.max(4, profile.slopeDistance - profile.shoulderDistance - 9);
    rock.position.copy(point).addScaledVector(side, direction * distance);
    const size = 2.5 + seededVariation(i, 17) * 2.2;
    rock.scale.set(size * (0.85 + seededVariation(i, 19) * 0.35), size * (0.9 + seededVariation(i, 23) * 0.5), size);
    rock.rotation.set((seededVariation(i, 29) - 0.5) * 0.36, i * 0.41, (seededVariation(i, 31) - 0.5) * 0.32);
    rock.position.y = 0;
    rock.updateMatrixWorld(true);
    rockBounds.setFromObject(rock);
    const footprint = Math.max(1.1, Math.max(rock.scale.x, rock.scale.z) * 0.52);
    const sampleOffsets = [[0, 0], [footprint, 0], [-footprint, 0], [0, footprint], [0, -footprint]];
    const heights = sampleOffsets.map(([offsetX, offsetZ]) =>
      terrainSampler.getTerrainHeightAtU(u, rock.position.x + offsetX, rock.position.z + offsetZ));
    const groundedY = solveMultiPointGrounding(heights, rockBounds.min.y, 0.3);
    if (!Number.isFinite(groundedY)) continue;
    rock.position.y = groundedY;
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }
  return group;
}

function buildTrees(curve, terrainSampler) {
  const count = 220;
  const group = new THREE.Group();
  group.name = 'Low poly forest';
  const trunkGeometry = new THREE.CylinderGeometry(0.34, 0.48, 3.2, 5);
  const crownGeometry = new THREE.ConeGeometry(2.1, 5.8, 6);
  const trunks = new THREE.InstancedMesh(trunkGeometry, new THREE.MeshStandardMaterial({ color: 0x65452f, roughness: 1 }), count);
  const crowns = new THREE.InstancedMesh(crownGeometry, new THREE.MeshStandardMaterial({ color: 0x245b3b, roughness: 1, flatShading: true }), count);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const side = new THREE.Vector3();

  for (let i = 0; i < count; i += 1) {
    const u = (i + 2) / (count + 5);
    const point = curve.getPointAt(u);
    side.crossVectors(UP, curve.getTangentAt(u)).normalize();
    const direction = i % 2 === 0 ? 1 : -1;
    const profile = terrainSampler.getProfileAtU(u, direction);
    const minimumDistance = profile.shoulderDistance + 3.6;
    const maximumDistance = profile.slopeDistance - 2.4;
    const distance = minimumDistance + seededVariation(i, 2) * Math.max(1, maximumDistance - minimumDistance);
    const size = 0.62 + seededVariation(i, 4) * 0.68;
    position.copy(point).addScaledVector(side, distance * direction);
    const groundY = terrainSampler.getTerrainHeightAtU(u, position.x, position.z);
    quaternion.setFromAxisAngle(UP, seededVariation(i, 6) * Math.PI * 2);
    position.y = groundY + 1.6 * size - 0.08;
    scale.set(size, size, size);
    matrix.compose(position, quaternion, scale);
    trunks.setMatrixAt(i, matrix);
    position.y = groundY + (3.2 + 2.72) * size - 0.12;
    matrix.compose(position, quaternion, scale);
    crowns.setMatrixAt(i, matrix);
  }
  trunks.castShadow = true;
  crowns.castShadow = true;
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  group.add(trunks, crowns);
  return group;
}

function buildSectionSigns(curve, terrainSampler) {
  const group = new THREE.Group();
  group.name = 'Section signs';
  ROUTE_SECTIONS.forEach((section, index) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 144;
    const context = canvas.getContext('2d');
    context.fillStyle = '#f2cb42';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#15191d';
    context.font = '900 40px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(section.name, canvas.width / 2, canvas.height / 2);
    const signU = Math.min(section.startU + 0.025, 0.98);
    const point = curve.getPointAt(signU);
    const side = new THREE.Vector3().crossVectors(UP, curve.getTangentAt(signU)).normalize();
    const direction = index % 2 === 0 ? 1 : -1;
    const signPosition = point.clone().addScaledVector(side, direction * 10.2);
    const groundY = terrainSampler.getTerrainHeightAtU(signU, signPosition.x, signPosition.z);
    const sign = new THREE.Group();
    sign.name = `${section.name} roadside sign`;
    sign.position.set(signPosition.x, groundY, signPosition.z);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(6.6, 1.86),
      new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide }),
    );
    face.position.y = 2.35;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(6.85, 2.05, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x20262b, roughness: 0.8 }),
    );
    frame.position.set(0, 2.35, -0.08);
    const postMaterial = new THREE.MeshStandardMaterial({ color: 0x4b5358, roughness: 0.7, metalness: 0.3 });
    [-2.1, 2.1].forEach((x) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.55, 0.16), postMaterial);
      post.position.set(x, 0.76, -0.1);
      sign.add(post);
    });
    sign.add(frame, face);
    sign.lookAt(point.x, groundY + 2.1, point.z);
    group.add(sign);
  });
  return group;
}
