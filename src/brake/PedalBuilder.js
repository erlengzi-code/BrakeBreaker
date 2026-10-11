import * as THREE from 'three';
import { MATERIALS, REINFORCEMENTS, getThicknessFactors, normalizeBuild } from '../config/materials.js';

export function getPedalDimensions(build) {
  const normalized = normalizeBuild(build);
  const thickness = getThicknessFactors(normalized.thickness);
  const armWidth = 0.19 * thickness.visualScale;
  return Object.freeze({ armWidth, padDepth: 0.17 + armWidth * 0.22 });
}

export function getPedalPose(pressDepth) {
  const depth = Math.max(0, Math.min(1, pressDepth));
  const pedalRotationX = depth * 0.75;
  const cos = Math.cos(pedalRotationX);
  const sin = Math.sin(pedalRotationX);
  const pedalY = 0.9;
  const pedalZ = -0.65;
  const padY = pedalY - 0.85 * cos - 0.8 * sin;
  const padZ = pedalZ - 0.85 * sin + 0.8 * cos;
  return Object.freeze({
    // The pedal rotates around the front mount while the shoe keeps its
    // attitude and travels forward into the pad instead of pivoting on a heel.
    pedalRotationX,
    pedalY,
    pedalZ,
    padY,
    padZ,
    footX: -0.38,
    footY: -0.72 - depth * 0.1,
    footZ: 1.05 - depth * 0.68,
    footRotationX: 0.82,
  });
}

export class PedalModel {
  constructor(build) {
    this.group = new THREE.Group();
    this.group.name = 'Shared Parameterized Pedal Model';
    this.build = null;
    this.movingPart = null;
    this.padAssembly = null;
    this.breakElapsed = 0;
    this.broken = false;
    this.setBuild(build);
  }

  setBuild(build) {
    const normalized = normalizeBuild(build);
    if (this.build
      && normalized.materialId === this.build.materialId
      && normalized.thickness === this.build.thickness
      && normalized.reinforcementId === this.build.reinforcementId) return;
    this.clear();
    this.build = normalized;
    this.buildGeometry();
    this.reset();
  }

  buildGeometry() {
    const materialConfig = MATERIALS[this.build.materialId];
    const reinforcement = REINFORCEMENTS[this.build.reinforcementId];
    const dimensions = getPedalDimensions(this.build);
    const pedalMaterial = new THREE.MeshStandardMaterial({
      color: materialConfig.color,
      roughness: materialConfig.roughness,
      metalness: materialConfig.metalness,
      flatShading: true,
    });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x23282d, roughness: 0.58, metalness: 0.55 });
    const gripMaterial = new THREE.MeshStandardMaterial({ color: 0x899294, roughness: 0.82, metalness: 0.08 });
    const braceMaterial = new THREE.MeshStandardMaterial({ color: 0x849ca0, roughness: 0.4, metalness: 0.62 });

    const backbone = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.32, 0.18), darkMaterial);
    backbone.position.set(0, 0.39, -0.96);
    backbone.name = 'Front firewall support';
    this.group.add(backbone);

    const frontMount = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.55, 0.34), darkMaterial);
    frontMount.position.set(0, 0.9, -0.91);
    frontMount.name = 'Fixed front-wall brake mount';
    this.group.add(frontMount);

    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.08, 10), darkMaterial);
    hinge.rotation.z = Math.PI * 0.5;
    hinge.position.set(0, 0.9, -0.65);
    hinge.name = 'Fixed front pedal pivot shaft';
    this.group.add(hinge);

    for (const side of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.07, 10), braceMaterial);
      cap.rotation.z = Math.PI * 0.5;
      cap.position.set(side * 0.58, 0.9, -0.65);
      this.group.add(cap);
    }

    this.movingPart = new THREE.Group();
    this.movingPart.name = 'Detachable pedal assembly';
    this.movingPart.position.set(0, 0.9, -0.65);

    const armWidth = dimensions.armWidth;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(armWidth, 1.16, Math.max(0.13, armWidth * 0.72)), pedalMaterial);
    arm.position.set(0, -0.425, 0.4);
    arm.rotation.x = -0.755;
    arm.castShadow = true;
    this.movingPart.add(arm);

    const padAssembly = new THREE.Group();
    padAssembly.name = 'Brake pad and non-slip ribs';
    padAssembly.position.set(0, -0.85, 0.8);
    padAssembly.rotation.x = -0.12;
    const pad = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.68, dimensions.padDepth), pedalMaterial);
    pad.castShadow = true;
    padAssembly.add(pad);
    const rubberFace = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.57, 0.035), darkMaterial);
    rubberFace.position.z = dimensions.padDepth * 0.5 + 0.02;
    padAssembly.add(rubberFace);
    for (const ribY of [-0.21, -0.07, 0.07, 0.21]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.035, 0.025), gripMaterial);
      rib.position.set(0, ribY, dimensions.padDepth * 0.5 + 0.052);
      padAssembly.add(rib);
    }
    this.movingPart.add(padAssembly);
    this.padAssembly = padAssembly;

    for (let i = 0; i < reinforcement.braceCount; i += 1) {
      const direction = i === 0 ? -1 : 1;
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.84, 0.08), braceMaterial);
      brace.position.set(direction * (armWidth * 0.75 + 0.09), -0.32, 0.31);
      brace.rotation.x = -0.755;
      brace.castShadow = true;
      this.movingPart.add(brace);
    }

    this.group.add(this.movingPart);
  }

  setPressDepth(pressDepth) {
    if (this.broken || !this.movingPart) return;
    const pose = getPedalPose(pressDepth);
    this.movingPart.position.set(0, pose.pedalY, pose.pedalZ);
    this.movingPart.rotation.x = pose.pedalRotationX;
    // Counter-pitch the broad plate so the arm travels without making the
    // brake face flop into a floor-mounted accelerator shape.
    this.padAssembly.rotation.x = -0.12 - pose.pedalRotationX * 0.8;
  }

  breakApart() {
    if (this.broken) return false;
    this.broken = true;
    this.breakElapsed = 0;
    this.breakStartRotationX = this.movingPart.rotation.x;
    return true;
  }

  updateBroken(dt) {
    if (!this.broken || !this.movingPart) return;
    this.breakElapsed += dt;
    const t = Math.min(2.1, this.breakElapsed);
    this.movingPart.position.set(t * 3.15, 0.9 + t * 1.9 - t * t * 0.98, -0.65 + t * 2.1);
    this.movingPart.rotation.set(this.breakStartRotationX - t * 3.8, t * 3.1, t * 4.5);
  }

  reset() {
    this.broken = false;
    this.breakElapsed = 0;
    if (this.movingPart) {
      this.movingPart.position.set(0, 0.9, -0.65);
      this.movingPart.rotation.set(0, 0, 0);
      this.movingPart.visible = true;
    }
    if (this.movingPart) this.setPressDepth(0);
  }

  clear() {
    this.group.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.group.clear();
    this.padAssembly = null;
  }
}
