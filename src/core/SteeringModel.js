export function getRoadCurvature(module, distanceM) {
  if (!module || !module.angle) return 0;
  const t = Math.max(0, Math.min(1, (distanceM - module.startM) / module.lengthM));
  if (module.type === 's-bend') {
    return module.turnSign * module.angle * Math.PI * 2 * Math.cos(t * Math.PI * 2) / module.lengthM;
  }
  return module.turnSign * module.angle * 6 * t * (1 - t) / module.lengthM;
}

export function stepLateralMotion({ offsetM, velocityMps, steer, speedMps, curvature }, dt) {
  // The road's lateral axis is UP × forward, which appears screen-left when driving toward +Z.
  // Invert player input so D/right moves toward the visible right edge of the road.
  const steeringAcceleration = -Math.max(-1, Math.min(1, steer)) * 14;
  const outwardAcceleration = -curvature * speedMps * speedMps * 1.35;
  const nextVelocity = (velocityMps + (steeringAcceleration + outwardAcceleration) * dt)
    * Math.exp(-3.4 * dt);
  return {
    offsetM: offsetM + nextVelocity * dt,
    velocityMps: nextVelocity,
  };
}

export function stepBodyRoll(currentRoll, { steer, speedMps, curvature }, dt) {
  // Positive roll leans the body left, away from a right-hand turn.
  const cornerLoad = curvature * speedMps * speedMps * 0.011;
  const steeringLoad = Math.max(-1, Math.min(1, steer)) * 0.018;
  const targetRoll = Math.max(-0.075, Math.min(0.075, cornerLoad + steeringLoad));
  const follow = 1 - Math.exp(-7 * Math.max(0, dt));
  return currentRoll + (targetRoll - currentRoll) * follow;
}
