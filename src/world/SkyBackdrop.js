import * as THREE from 'three';

export class SkyBackdrop {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'Sunset sky and sun';
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(820, 24, 12),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          topColor: { value: new THREE.Color(0x6b66af) },
          horizonColor: { value: new THREE.Color(0xed8fa4) },
          bottomColor: { value: new THREE.Color(0xffbd71) },
        },
        vertexShader: 'varying vec3 vDirection; void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 bottomColor;
          varying vec3 vDirection;
          void main() {
            float h = normalize(vDirection).y;
            vec3 upper = mix(horizonColor, topColor, smoothstep(0.02, 0.7, h));
            vec3 color = mix(bottomColor, upper, smoothstep(-0.4, 0.055, h));
            gl_FragColor = vec4(color, 1.0);
          }`,
      }),
    );
    sky.renderOrder = -100;
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(43, 20, 12),
      new THREE.MeshBasicMaterial({ color: 0xffec79, fog: false }),
    );
    sun.position.set(-260, 48, 670);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(61, 20, 12),
      new THREE.MeshBasicMaterial({ color: 0xffad75, transparent: true, opacity: 0.24, depthWrite: false, fog: false }),
    );
    halo.position.copy(sun.position);
    this.group.add(sky, halo, sun);
    scene.add(this.group);
  }

  follow(position) {
    this.group.position.copy(position);
  }
}
