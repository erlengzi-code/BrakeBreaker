import * as THREE from 'three';
import { crossedDistance } from '../utils/math.js';

export class RouteFollower {
  constructor(curve, checkpoints) {
    this.curve = curve;
    this.routeLengthM = curve.getLength();
    this.checkpoints = checkpoints.map((checkpoint) => ({
      ...checkpoint,
      distanceM: checkpoint.u * this.routeLengthM,
      passed: false,
    }));
    this.position = new THREE.Vector3();
    this.tangent = new THREE.Vector3();
  }

  reset() {
    this.checkpoints.forEach((checkpoint) => { checkpoint.passed = false; });
  }

  sample(distanceM) {
    const u = Math.min(1, Math.max(0, distanceM / this.routeLengthM));
    this.curve.getPointAt(u, this.position);
    this.curve.getTangentAt(u, this.tangent).normalize();
    return { u, position: this.position, tangent: this.tangent };
  }

  findCrossedCheckpoint(previousDistanceM, currentDistanceM) {
    return this.checkpoints.find((checkpoint) =>
      !checkpoint.passed && crossedDistance(previousDistanceM, currentDistanceM, checkpoint.distanceM));
  }

  getUpcomingCheckpoint(distanceM) {
    return this.checkpoints.find((checkpoint) => !checkpoint.passed && checkpoint.distanceM >= distanceM) ?? null;
  }
}
