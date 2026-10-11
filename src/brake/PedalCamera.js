import * as THREE from 'three';
import { PedalModel, getPedalPose } from './PedalBuilder.js';
import { getGraphicsProfile } from '../utils/graphics.js';

export class PedalViewport {
  constructor(canvas, build, { withFoot = false } = {}) {
    this.canvas = canvas;
    this.withFoot = withFoot;
    this.graphics = getGraphicsProfile();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.graphics.antialias, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.graphics.maxPixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = withFoot ? 1.38 : 1.18;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(withFoot ? 39 : 38, 1, 0.05, 30);
    this.camera.position.set(withFoot ? 1.8 : 2.7, withFoot ? 1.55 : 1.4, withFoot ? 2.4 : 3.8);
    this.camera.lookAt(0, withFoot ? -0.06 : 0.4, withFoot ? -0.12 : 0);
    this.cameraBasePosition = this.camera.position.clone();
    this.model = new PedalModel(build);
    // The shared model now includes its fixed front-wall mount and piston.
    this.pedalBaseZ = 0;
    this.model.group.position.z = this.pedalBaseZ;
    this.scene.add(this.model.group);
    this.scene.add(new THREE.HemisphereLight(0xeafaff, 0x302c24, withFoot ? 3.25 : 2.6));
    const key = new THREE.DirectionalLight(0xffe0a3, withFoot ? 4.25 : 3.4);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x79dcec, withFoot ? 2.1 : 0.8);
    rim.position.set(-3, 2.4, 1.2);
    this.scene.add(rim);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 8),
      new THREE.MeshStandardMaterial({ color: withFoot ? 0x222b2e : 0x11161a, roughness: 1, transparent: true, opacity: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = withFoot ? -0.85 : -0.91;
    this.scene.add(floor);
    this.foot = withFoot ? this.buildFoot() : null;
    this.footPivot = this.foot?.userData.pivot ?? null;
    const idlePose = getPedalPose(0);
    this.footBasePose = this.foot ? { x: idlePose.footX, y: idlePose.footY, z: idlePose.footZ } : null;
    this.forceFill = withFoot ? document.querySelector('#pedal-force-fill') : null;
    this.forceValue = withFoot ? document.querySelector('#pedal-force-value') : null;
    this.forceMeter = withFoot ? document.querySelector('#pedal-force-meter') : null;
    this.cinematicBroken = false;
    this.elapsed = 0;
    this.resize();
  }

  buildFoot() {
    const group = new THREE.Group();
    group.name = 'Full Low Poly Right Foot Rig';
    const shoeMaterial = new THREE.MeshStandardMaterial({ color: 0xf4df91, roughness: 0.67, flatShading: true });
    const toeMaterial = new THREE.MeshStandardMaterial({ color: 0xffeabb, roughness: 0.62, flatShading: true });
    const soleMaterial = new THREE.MeshStandardMaterial({ color: 0x20282d, roughness: 0.95, flatShading: true });
    const trouserMaterial = new THREE.MeshStandardMaterial({ color: 0x20364e, roughness: 0.94, flatShading: true });
    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0xd1a64b, roughness: 0.7, flatShading: true });

    // The whole lower leg follows the forward braking stroke; the ankle and
    // shoe keep nearly the same attitude instead of rocking on a fixed heel.
    const trouser = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.21, 1.62, 7), trouserMaterial);
    trouser.position.set(0, 1.05, 0.24);
    trouser.rotation.x = 0.25;
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.16, 7), trimMaterial);
    cuff.position.set(0, 0.3, 0.03);
    const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), shoeMaterial);
    ankle.position.set(0, 0.2, 0);
    group.add(trouser, cuff, ankle);

    // Geometry runs toward -Z. The pivot sets one natural resting angle;
    // braking advances this entire foot rig toward the moving pedal face.
    const pivot = new THREE.Group();
    pivot.name = 'Fixed foot attitude mount';
    const shoe = new THREE.Group();
    shoe.name = 'Forward pressing work shoe';
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.35, 1.13), shoeMaterial);
    body.position.set(0, 0.19, -0.57);
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), toeMaterial);
    toe.scale.set(1.06, 0.59, 0.8);
    toe.position.set(0, 0.16, -1.26);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.16, 1.7), soleMaterial);
    sole.position.set(0, -0.06, -0.76);
    const heel = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.18, 0.44), soleMaterial);
    heel.position.set(0, 0, 0.04);
    const vamp = new THREE.Mesh(new THREE.BoxGeometry(0.71, 0.07, 0.38), trimMaterial);
    vamp.position.set(0, 0.39, -0.65);
    shoe.add(body, toe, sole, heel, vamp);
    for (const laceZ of [-0.48, -0.68, -0.88]) {
      const lace = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.025, 0.035), soleMaterial);
      lace.position.set(0, 0.426, laceZ);
      shoe.add(lace);
    }
    pivot.add(shoe);
    group.add(pivot);
    group.userData.pivot = pivot;
    group.position.set(-0.38, -0.72, 1.05);
    group.traverse((object) => { if (object.isMesh) object.castShadow = true; });
    this.scene.add(group);
    return group;
  }

  setBuild(build) {
    this.model.setBuild(build);
  }

  setPressDepth(depth) {
    this.model.setPressDepth(depth);
    this.model.group.position.x = 0;
    if (this.forceFill) {
      const pressure = Math.max(0, Math.min(1, depth));
      this.forceFill.style.width = `${Math.round(pressure * 100)}%`;
      this.forceValue.textContent = `${Math.round(pressure * 100)}%`;
      this.forceMeter.dataset.level = pressure >= 0.86 ? 'max' : pressure >= 0.56 ? 'heavy' : 'normal';
    }
    if (this.foot && !this.model.broken) {
      const pose = getPedalPose(depth);
      this.foot.position.set(this.footBasePose.x, pose.footY, pose.footZ);
      this.footPivot.rotation.x = pose.footRotationX;
    }
  }

  breakApart() {
    this.model.breakApart();
  }

  beginBreakCinematic() {
    this.reset();
    this.cinematicBroken = false;
  }

  updateBreakCinematic(frame, dt) {
    if (!this.withFoot) return;
    if (!frame.shouldBreak) {
      this.setPressDepth(frame.slamDepth);
      // The final kick is a short forward lurch, not an ankle rotation.
      this.foot.position.z -= (frame.slamDepth - 0.72) * 0.11;
    } else {
      if (!this.cinematicBroken) {
        this.cinematicBroken = this.model.breakApart();
      }
      this.model.updateBroken(dt * 0.9);
      const miss = frame.footMissProgress;
      // With no pedal to resist it, the foot continues forward and downward.
      const fullPose = getPedalPose(1);
      this.footPivot.rotation.x = fullPose.footRotationX;
      this.foot.position.y = fullPose.footY - miss * 0.45;
      this.foot.position.z = fullPose.footZ - miss * 0.34;
    }
    this.resize();
    this.renderer.render(this.scene, this.camera);
  }

  reset() {
    this.model.reset();
    this.model.group.position.set(0, 0, this.pedalBaseZ);
    this.model.group.rotation.set(0, 0, 0);
    this.camera.position.copy(this.cameraBasePosition);
    this.cinematicBroken = false;
    if (this.foot) {
      this.foot.scale.setScalar(1);
      this.foot.position.set(this.footBasePose.x, this.footBasePose.y, this.footBasePose.z);
      this.foot.rotation.set(0, 0, 0);
      this.footPivot.rotation.set(0, 0, 0);
    }
    this.setPressDepth(0);
  }

  update(dt, pressDepth = 0, autoRotate = false) {
    this.elapsed += dt;
    if (this.model.broken) {
      this.model.updateBroken(dt);
      if (this.foot) {
        this.foot.position.y -= dt * 0.7;
        this.foot.position.z -= dt * 0.45;
      }
    } else {
      this.setPressDepth(pressDepth);
      if (this.withFoot && pressDepth >= 0.84) {
        const danger = (pressDepth - 0.84) / 0.16;
        this.model.group.position.x = Math.sin(this.elapsed * 38) * danger * 0.012;
        this.foot.position.z += Math.sin(this.elapsed * 38) * danger * 0.009;
        this.camera.position.x = this.cameraBasePosition.x + Math.sin(this.elapsed * 32) * danger * 0.006;
      } else if (this.withFoot) {
        this.camera.position.copy(this.cameraBasePosition);
      }
    }
    if (autoRotate) this.model.group.rotation.y += dt * 0.42;
    this.resize();
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const width = Math.max(1, this.canvas.clientWidth || this.canvas.width || 320);
    const height = Math.max(1, this.canvas.clientHeight || this.canvas.height || 220);
    const pixelRatio = Math.min(window.devicePixelRatio, this.graphics.maxPixelRatio);
    const targetWidth = Math.floor(width * pixelRatio);
    const targetHeight = Math.floor(height * pixelRatio);
    if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
      this.renderer.setPixelRatio(pixelRatio);
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
  }
}

export class PedalCamera extends PedalViewport {
  constructor(canvas, build) {
    super(canvas, build, { withFoot: true });
  }
}
