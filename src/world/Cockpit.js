import * as THREE from 'three';
import { drawBrakeLabMark } from '../brand/LogoMark.js';

export function buildCockpit(camera) {
  const group = new THREE.Group();
  group.name = 'Low Poly Compact Cockpit';

  const dashMaterial = new THREE.MeshStandardMaterial({ color: 0x11151a, roughness: 0.74, metalness: 0.14 });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x303840, roughness: 0.48, metalness: 0.5 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xf1c945, roughness: 0.42, metalness: 0.18 });
  const screenMaterial = new THREE.MeshBasicMaterial({ color: 0x152b30 });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: 0x7de1ce });

  const dashboard = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.48, 1.26), dashMaterial);
  dashboard.position.set(0, -1.23, -2.15);
  dashboard.rotation.x = -0.11;
  group.add(dashboard);

  const dashLip = new THREE.Mesh(new THREE.BoxGeometry(5.35, 0.12, 0.38), trimMaterial);
  dashLip.position.set(0, -0.93, -2.42);
  group.add(dashLip);

  const instrumentHood = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.34, 0.48), dashMaterial);
  instrumentHood.position.set(-1.02, -0.89, -2.12);
  instrumentHood.rotation.x = -0.08;
  group.add(instrumentHood);

  const instrumentFace = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.25), screenMaterial);
  instrumentFace.position.set(-1.02, -0.9, -1.86);
  group.add(instrumentFace);
  [-0.2, 0, 0.2].forEach((x, index) => {
    const light = new THREE.Mesh(new THREE.CircleGeometry(index === 1 ? 0.055 : 0.035, 10), index === 1 ? accentMaterial : glowMaterial);
    light.position.set(-1.02 + x, -0.9, -1.84);
    group.add(light);
  });

  const wheel = new THREE.Group();
  wheel.name = 'Steering Wheel';
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.055, 8, 24), dashMaterial);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.155, 0.09, 16), accentMaterial);
  hub.rotation.x = Math.PI * 0.5;
  wheel.add(rim, hub);
  const logoCanvas = document.createElement('canvas');
  logoCanvas.width = 256;
  logoCanvas.height = 256;
  const logoContext = logoCanvas.getContext('2d');
  const logoTexture = new THREE.CanvasTexture(logoCanvas);
  logoTexture.colorSpace = THREE.SRGBColorSpace;
  const logoFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.125, 32),
    new THREE.MeshBasicMaterial({ map: logoTexture }),
  );
  logoFace.position.z = 0.058;
  wheel.add(logoFace);
  [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].forEach((angle) => {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.29, 0.045), trimMaterial);
    spoke.position.set(Math.sin(angle) * 0.13, Math.cos(angle) * 0.13, 0.015);
    spoke.rotation.z = -angle;
    wheel.add(spoke);
  });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xf0b58b, roughness: 0.95, flatShading: true });
  const sleeveMaterial = new THREE.MeshStandardMaterial({ color: 0x253f74, roughness: 1, flatShading: true });
  const cuffMaterial = new THREE.MeshStandardMaterial({ color: 0x1a2c50, roughness: 1 });
  [-1, 1].forEach((side) => {
    const hand = new THREE.Group();
    hand.name = side < 0 ? 'Left hand gripping steering wheel' : 'Right hand gripping steering wheel';
    const grip = new THREE.Mesh(new THREE.DodecahedronGeometry(0.145, 0), skinMaterial);
    grip.position.set(side * 0.32, -0.015, 0.13);
    grip.scale.set(0.9, 0.72, 0.62);
    hand.add(grip);
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.055, 0.075), skinMaterial);
    thumb.position.set(side * 0.22, -0.105, 0.16);
    thumb.rotation.z = side * 0.36;
    hand.add(thumb);
    for (let finger = 0; finger < 3; finger += 1) {
      const curl = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.1, 0.07), skinMaterial);
      curl.position.set(side * (0.352 + finger * 0.014), 0.055 - finger * 0.047, 0.047);
      hand.add(curl);
    }
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.18, 6), skinMaterial);
    wrist.position.set(side * 0.395, -0.155, 0.19);
    wrist.rotation.z = side * 0.32;
    hand.add(wrist);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.17, 0.57, 6), sleeveMaterial);
    sleeve.position.set(side * 0.53, -0.44, 0.28);
    sleeve.rotation.z = side * 0.44;
    hand.add(sleeve);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.112, 0.09, 6), cuffMaterial);
    cuff.position.set(side * 0.43, -0.22, 0.21);
    cuff.rotation.z = side * 0.44;
    hand.add(cuff);
    wheel.add(hand);
  });
  wheel.position.set(-0.45, -0.82, -1.52);
  wheel.rotation.x = Math.PI * 0.12;
  group.add(wheel);

  const accentStrip = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.035, 0.05), accentMaterial);
  accentStrip.position.set(0, -0.88, -1.86);
  group.add(accentStrip);

  const consoleBody = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.62, 0.54), trimMaterial);
  consoleBody.position.set(0.55, -1.13, -1.94);
  consoleBody.rotation.x = -0.08;
  group.add(consoleBody);
  const consoleScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.26), screenMaterial);
  consoleScreen.position.set(0.55, -1.03, -1.65);
  group.add(consoleScreen);
  [-0.15, 0, 0.15].forEach((x) => {
    const button = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.035, 0.025), accentMaterial);
    button.position.set(0.55 + x, -1.28, -1.65);
    group.add(button);
  });

  const ventGeometry = new THREE.BoxGeometry(0.46, 0.18, 0.08);
  [-0.08, 1.18].forEach((x) => {
    const vent = new THREE.Mesh(ventGeometry, trimMaterial);
    vent.position.set(x, -0.91, -1.88);
    group.add(vent);
  });

  const windshieldFrame = new THREE.Group();
  windshieldFrame.name = 'Complete windshield frame';
  const pillarGeometry = new THREE.BoxGeometry(0.14, 2.28, 0.16);
  [-2.42, 2.42].forEach((x) => {
    const pillar = new THREE.Mesh(pillarGeometry, dashMaterial);
    pillar.position.set(x, 0.08, -2.5);
    pillar.rotation.z = x < 0 ? -0.16 : 0.16;
    windshieldFrame.add(pillar);
    const innerTrim = new THREE.Mesh(new THREE.BoxGeometry(0.035, 2.14, 0.04), trimMaterial);
    innerTrim.position.set(x + (x < 0 ? 0.09 : -0.09), 0.08, -2.4);
    innerTrim.rotation.z = pillar.rotation.z;
    windshieldFrame.add(innerTrim);
  });
  const windshieldTop = new THREE.Mesh(new THREE.BoxGeometry(5.14, 0.15, 0.17), dashMaterial);
  windshieldTop.position.set(0, 1.17, -2.5);
  const windshieldTopTrim = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.032, 0.04), trimMaterial);
  windshieldTopTrim.position.set(0, 1.075, -2.4);
  const windshieldSill = new THREE.Mesh(new THREE.BoxGeometry(5.06, 0.11, 0.19), dashMaterial);
  windshieldSill.position.set(0, -0.91, -2.48);
  windshieldFrame.add(windshieldTop, windshieldTopTrim, windshieldSill);
  group.add(windshieldFrame);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.16, 1.15), new THREE.MeshStandardMaterial({
    color: 0xc84438,
    roughness: 0.52,
    metalness: 0.28,
  }));
  hood.position.set(0, -1.02, -3.1);
  hood.rotation.x = 0.08;
  group.add(hood);

  const restingPosition = new THREE.Vector3(0, 0, -0.08);
  group.position.copy(restingPosition);
  camera.add(group);

  function paintFallbackLogo() {
    drawBrakeLabMark(logoContext);
    logoTexture.needsUpdate = true;
  }

  function setLogo(dataUrl) {
    if (!dataUrl) {
      paintFallbackLogo();
      return;
    }
    const image = new Image();
    image.onload = () => {
      logoContext.clearRect(0, 0, 256, 256);
      logoContext.drawImage(image, 0, 0, 256, 256);
      logoTexture.needsUpdate = true;
    };
    image.onerror = paintFallbackLogo;
    image.src = dataUrl;
  }

  paintFallbackLogo();
  function setBrakeFeedback(depth, vibration = 0) {
    const amount = THREE.MathUtils.clamp(depth, 0, 1);
    group.position.set(
      restingPosition.x + vibration,
      restingPosition.y - amount * 0.022,
      restingPosition.z + amount * 0.045,
    );
    wheel.rotation.x = Math.PI * 0.12 + amount * 0.025;
  }

  function setViewportCompact(compact) {
    restingPosition.y = compact ? -0.15 : 0;
    group.position.y = restingPosition.y;
  }

  return { group, wheel, setLogo, setBrakeFeedback, setViewportCompact };
}
