import * as THREE from 'three';
import { drawBrakeLabMark } from '../brand/LogoMark.js';

const FORWARD = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);

export class CrashCar {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Reusable Low Poly Crash Car';
    this.group.visible = false;
    this.origin = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, 1);
    this.side = new THREE.Vector3(1, 0, 0);
    this.baseQuaternion = new THREE.Quaternion();
    this.logoCanvas = document.createElement('canvas');
    this.logoCanvas.width = 256;
    this.logoCanvas.height = 256;
    this.logoContext = this.logoCanvas.getContext('2d');
    this.logoTexture = new THREE.CanvasTexture(this.logoCanvas);
    this.logoTexture.colorSpace = THREE.SRGBColorSpace;
    this.buildModel();
  }

  buildModel() {
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xc84438, roughness: 0.52, metalness: 0.28, flatShading: true });
    const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x263c47, roughness: 0.24, metalness: 0.18, flatShading: true });
    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x12171c, roughness: 0.8 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xf1c945, roughness: 0.42, metalness: 0.18 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.72, 5.3), bodyMaterial);
    body.position.y = 0.8;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.55, 1.05, 2.45), glassMaterial);
    cabin.position.set(0, 1.56, -0.15);
    cabin.scale.z = 0.92;
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(3.34, 0.22, 0.26), accentMaterial);
    bumper.position.set(0, 0.7, 2.72);
    const logo = new THREE.Mesh(
      new THREE.CircleGeometry(0.4, 24),
      new THREE.MeshBasicMaterial({ map: this.logoTexture, side: THREE.DoubleSide, toneMapped: false }),
    );
    logo.name = 'Player emblem on crash car hood';
    logo.rotation.x = -Math.PI / 2;
    logo.position.set(0, 1.17, 0.72);
    this.group.add(body, cabin, bumper, logo);

    const wheelGeometry = new THREE.CylinderGeometry(0.54, 0.54, 0.38, 10);
    [-1.48, 1.48].forEach((x) => {
      [-1.65, 1.65].forEach((z) => {
        const wheel = new THREE.Mesh(wheelGeometry, trimMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.45, z);
        this.group.add(wheel);
      });
    });
    this.group.traverse((object) => { if (object.isMesh) object.castShadow = true; });
    this.paintFallbackLogo();
  }

  paintFallbackLogo() {
    drawBrakeLabMark(this.logoContext);
    this.logoTexture.needsUpdate = true;
  }

  setLogo(dataUrl) {
    if (!dataUrl) {
      this.paintFallbackLogo();
      return;
    }
    const image = new Image();
    image.onload = () => {
      this.logoContext.clearRect(0, 0, 256, 256);
      this.logoContext.drawImage(image, 0, 0, 256, 256);
      this.logoTexture.needsUpdate = true;
    };
    image.onerror = () => this.paintFallbackLogo();
    image.src = dataUrl;
  }

  begin(position, tangent, side) {
    this.origin.copy(position).addScaledVector(UP, 0.35);
    this.forward.copy(tangent).normalize();
    this.side.copy(side).normalize();
    this.baseQuaternion.setFromUnitVectors(FORWARD, this.forward);
    this.group.visible = true;
    this.group.position.copy(this.origin);
    this.group.quaternion.copy(this.baseQuaternion);
  }

  update(motion, outsideSign, progress) {
    this.group.position.copy(this.origin)
      .addScaledVector(this.forward, motion.forwardMeters)
      .addScaledVector(this.side, motion.lateralMeters)
      .addScaledVector(UP, motion.liftMeters - motion.dropMeters);
    this.group.quaternion.copy(this.baseQuaternion);
    this.group.rotateZ(-outsideSign * motion.rollRadians);
    this.group.rotateX(motion.pitchRadians);
    this.group.rotateY(outsideSign * progress * 1.8);
  }

  hide() {
    this.group.visible = false;
  }
}
