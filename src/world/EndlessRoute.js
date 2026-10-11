import * as THREE from 'three';

export const ROAD_HALF_WIDTH = 5.2;
export const ROAD_EXIT_OFFSET = 5.55;
const SAMPLE_STEP_M = 4;
const GRADE_TRANSITION_M = 40;

function random(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function pickRoadType(index, randomValue) {
  if (index < 2) return index === 0 ? 'straight' : 'turn';
  const weights = index < 6
    ? [['straight', 38], ['turn', 44], ['steep', 18]]
    : index < 14
      ? [['straight', 18], ['turn', 28], ['hairpin', 28], ['steep', 26]]
      : [['straight', 9], ['turn', 17], ['hairpin', 25], ['steep', 20], ['s-bend', 29]];
  let threshold = randomValue * weights.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [type, weight] of weights) {
    threshold -= weight;
    if (threshold < 0) return type;
  }
  return weights.at(-1)[0];
}

function smoothstep(t) { return t * t * (3 - 2 * t); }

function transitionGrade(entryGrade, targetGrade, distanceM, transitionM) {
  const t = THREE.MathUtils.clamp(distanceM / transitionM, 0, 1);
  return THREE.MathUtils.lerp(entryGrade, targetGrade, smoothstep(t));
}

export function getRoadGrade(module, distanceM) {
  return transitionGrade(module.entryGrade, module.grade,
    distanceM - module.startM, module.gradeTransitionM);
}

function turnProfile(type, turnSign, progress, angle) {
  if (type === 's-bend') {
    return turnSign * angle * Math.sin(progress * Math.PI * 2);
  }
  return turnSign * angle * smoothstep(progress);
}

export class EndlessRoute {
  constructor(seed = 20261011) {
    this.seed = seed;
    this.reset();
  }

  reset() {
    this.rng = random(this.seed);
    this.modules = [];
    this.nextIndex = 0;
    this.cursor = { x: 0, y: 132, z: 0, heading: 0, distanceM: 0 };
    this.ensureAhead(560);
  }

  createModule() {
    const index = this.nextIndex++;
    const type = pickRoadType(index, this.rng());
    const turnSign = this.rng() < 0.5 ? -1 : 1;
    const difficulty = Math.min(1, index / 20);
    const lengthM = type === 'hairpin' ? 148 : type === 's-bend' ? 168 : 124 + this.rng() * 46;
    const angle = type === 'hairpin' ? 1.02 + difficulty * 0.32
      : type === 'turn' ? 0.32 + difficulty * 0.32 : type === 's-bend' ? 0.68 : 0;
    const grade = type === 'steep' ? 0.16 + difficulty * 0.08 : 0.055 + difficulty * 0.035;
    const entryGrade = this.modules.at(-1)?.grade ?? grade;
    const gradeTransitionM = Math.min(GRADE_TRANSITION_M, lengthM * 0.3);
    const start = { ...this.cursor };
    const count = Math.ceil(lengthM / SAMPLE_STEP_M);
    const points = [new THREE.Vector3(start.x, start.y, start.z)];
    let x = start.x;
    let y = start.y;
    let z = start.z;
    for (let i = 1; i <= count; i += 1) {
      const t = (i - 0.5) / count;
      const heading = start.heading + turnProfile(type, turnSign, t, angle);
      const step = lengthM / count;
      x += Math.sin(heading) * step;
      z += Math.cos(heading) * step;
      y -= transitionGrade(entryGrade, grade, (i - 0.5) * step, gradeTransitionM) * step;
      points.push(new THREE.Vector3(x, y, z));
    }
    const finalHeading = start.heading + (type === 's-bend' ? 0 : turnSign * angle);
    this.cursor = { x, y, z, heading: finalHeading, distanceM: start.distanceM + lengthM };
    const module = {
      index, type, turnSign, lengthM, startM: start.distanceM, endM: this.cursor.distanceM,
      grade, entryGrade, gradeTransitionM, angle, points,
      safeSpeedKmh: type === 'hairpin' ? 53 - difficulty * 8 : type === 's-bend' ? 66 - difficulty * 8 : type === 'turn' ? 81 - difficulty * 6 : null,
      warningDistanceM: type === 'hairpin' ? 120 : 95,
    };
    module.name = ({ straight: '普通直坡', turn: '普通弯道', hairpin: '急弯', steep: '陡坡', 's-bend': '连续弯' })[type];
    module.curve = {
      getPointAt: (u) => this.sampleModule(module, u).position,
      getTangentAt: (u) => this.sampleModule(module, u).tangent,
      getLength: () => lengthM,
    };
    this.modules.push(module);
    return module;
  }

  sampleModule(module, u) {
    const scaled = THREE.MathUtils.clamp(u, 0, 1) * (module.points.length - 1);
    const index = Math.min(module.points.length - 2, Math.floor(scaled));
    const fraction = scaled - index;
    const position = module.points[index].clone().lerp(module.points[index + 1], fraction);
    const startTangent = this.vertexTangent(module, index);
    const endTangent = this.vertexTangent(module, index + 1);
    const tangent = startTangent.lerp(endTangent, fraction).normalize();
    return { position, tangent, u, module };
  }

  vertexTangent(module, index) {
    const last = module.points.length - 1;
    const modulePosition = this.modules.indexOf(module);
    const previous = index > 0
      ? module.points[index - 1]
      : this.modules[modulePosition - 1]?.points.at(-2) ?? module.points[0];
    const next = index < last
      ? module.points[index + 1]
      : this.modules[modulePosition + 1]?.points[1] ?? module.points[last];
    return next.clone().sub(previous).normalize();
  }

  ensureAhead(distanceM) {
    const created = [];
    while (this.cursor.distanceM < distanceM) created.push(this.createModule());
    return created;
  }

  pruneBehind(distanceM) {
    const removed = [];
    while (this.modules.length > 4 && this.modules[0].endM < distanceM - 220) {
      removed.push(this.modules.shift());
    }
    return removed;
  }

  moduleAt(distanceM) {
    this.ensureAhead(distanceM + 1);
    return this.modules.find((module) => distanceM <= module.endM) ?? this.modules.at(-1);
  }

  sample(distanceM) {
    const module = this.moduleAt(distanceM);
    const u = THREE.MathUtils.clamp((distanceM - module.startM) / module.lengthM, 0, 1);
    return this.sampleModule(module, u);
  }

  getUpcomingHazard(distanceM) {
    return this.modules.find((module) => module.safeSpeedKmh && module.startM + module.lengthM * 0.25 >= distanceM)
      ?? null;
  }
}
