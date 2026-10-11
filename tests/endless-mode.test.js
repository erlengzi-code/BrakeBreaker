import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EndlessRoute, ROAD_EXIT_OFFSET, getRoadGrade, pickRoadType } from '../src/world/EndlessRoute.js';
import { EndlessWorld } from '../src/world/EndlessWorld.js';
import { getRoadCurvature, stepBodyRoll, stepLateralMotion } from '../src/core/SteeringModel.js';
import { stepEndlessSpeed } from '../src/core/DrivingModel.js';
import { BrakeSystem, calculatePedalDamage, calculatePedalStats } from '../src/brake/BrakeSystem.js';
import { MATERIAL_ORDER, REINFORCEMENT_ORDER, createDefaultBuild } from '../src/config/materials.js';
import { ENCHANTMENT_ORDER } from '../src/config/enchantments.js';

test('every DIY pedal can break under sustained full braking while strength differences remain', () => {
  for (const materialId of MATERIAL_ORDER) {
    for (const thickness of [0, 50, 100]) {
      for (const reinforcementId of REINFORCEMENT_ORDER) {
        for (const enchantmentId of [null, ...ENCHANTMENT_ORDER]) {
          const stats = calculatePedalStats({ materialId, thickness, reinforcementId, enchantmentId });
          const fullPressSeconds = stats.maxDurability / calculatePedalDamage(1, 1, stats, 35);
          assert.ok(fullPressSeconds >= 2 && fullPressSeconds <= 55,
            `${materialId}/${thickness}/${reinforcementId}/${enchantmentId}: ${fullPressSeconds}`);
          assert.equal(calculatePedalDamage(0, 1, stats, 35), 0);
        }
      }
    }
  }
  const weak = calculatePedalStats({ materialId: 'tofu', thickness: 0, reinforcementId: 'none' });
  const normal = calculatePedalStats(createDefaultBuild());
  const strong = calculatePedalStats({ materialId: 'titanium', thickness: 100, reinforcementId: 'ultimate' });
  const seconds = (stats) => stats.maxDurability / calculatePedalDamage(1, 1, stats, 35);
  assert.ok(seconds(weak) < seconds(normal) && seconds(normal) < seconds(strong));
  const enchanted = calculatePedalStats({ ...createDefaultBuild(), enchantmentId: 'steel_will' });
  assert.ok(Math.abs(seconds(enchanted) / seconds(normal) - 1.2) < 1e-10);
  const brake = new BrakeSystem({ materialId: 'titanium', thickness: 100, reinforcementId: 'ultimate' });
  let breaks = 0;
  for (let i = 0; i < 60 * 60; i += 1) breaks += Number(brake.update(1, 1 / 60, 35));
  assert.equal(breaks, 1);
  brake.reset();
  assert.equal(brake.durability, brake.stats.maxDurability);
});

test('downhill entrance and exit grades ramp continuously and acceleration follows the ramp', () => {
  const route = new EndlessRoute(42);
  route.ensureAhead(6000);
  const steepIndex = route.modules.findIndex((module, i) => i > 0
    && module.type === 'steep' && route.modules[i - 1].type !== 'steep');
  assert.ok(steepIndex > 0);
  const before = route.modules[steepIndex - 1];
  const steep = route.modules[steepIndex];
  const after = route.modules[steepIndex + 1];
  assert.equal(getRoadGrade(before, before.endM), getRoadGrade(steep, steep.startM));
  assert.equal(getRoadGrade(steep, steep.endM), getRoadGrade(after, after.startM));
  const entrance = getRoadGrade(steep, steep.startM);
  const middle = getRoadGrade(steep, steep.startM + steep.gradeTransitionM / 2);
  const full = getRoadGrade(steep, steep.startM + steep.gradeTransitionM);
  assert.ok(entrance < middle && middle < full);
  const speeds = [entrance, middle, full].map((grade) => stepEndlessSpeed({
    speedMps: 20, brakeDepth: 0, grade, distanceM: steep.startM,
  }, 1 / 60));
  assert.ok(speeds[0] < speeds[1] && speeds[1] < speeds[2]);
  const firstSlope = (steep.points[0].y - steep.points[1].y) * (steep.points.length - 1) / steep.lengthM;
  assert.ok(Math.abs(firstSlope - entrance) < 0.01);
  const previousSlope = (before.points.at(-2).y - before.points.at(-1).y)
    * (before.points.length - 1) / before.lengthM;
  assert.ok(Math.abs(firstSlope - previousSlope) < 0.002,
    'the road surface must not form a visible fold at the downhill entrance');
});

test('road heading stays continuous through bends and module joins without moving the path', () => {
  const route = new EndlessRoute(42);
  route.ensureAhead(3500);
  for (const module of route.modules) {
    const count = module.points.length - 1;
    for (let i = 1; i < count; i += 1) {
      const before = route.sampleModule(module, (i - 0.001) / count);
      const after = route.sampleModule(module, (i + 0.001) / count);
      assert.ok(before.tangent.angleTo(after.tangent) < THREE.MathUtils.degToRad(0.02));
      assert.ok(route.sampleModule(module, i / count).position.distanceTo(module.points[i]) < 1e-9);
    }
  }
  for (let i = 1; i < route.modules.length; i += 1) {
    const previous = route.sampleModule(route.modules[i - 1], 1);
    const next = route.sampleModule(route.modules[i], 0);
    assert.ok(previous.position.distanceTo(next.position) < 1e-9);
    assert.ok(previous.tangent.angleTo(next.tangent) < 1e-6);
  }
});

test('vehicle body leans outward in bends, stays subtle, and settles when straight', () => {
  const rightTurn = { steer: 0, speedMps: 25, curvature: 0.01 };
  const leftTurn = { ...rightTurn, curvature: -0.01 };
  const rightRoll = stepBodyRoll(0, rightTurn, 0.1);
  const leftRoll = stepBodyRoll(0, leftTurn, 0.1);
  assert.ok(rightRoll > 0 && leftRoll < 0);
  assert.ok(stepBodyRoll(0, { ...rightTurn, speedMps: 10 }, 0.1) < rightRoll);
  assert.ok(stepBodyRoll(0, { steer: 1, speedMps: 15, curvature: 0 }, 0.1) > 0);
  let roll = 0;
  for (let i = 0; i < 120; i += 1) {
    roll = stepBodyRoll(roll, { steer: 1, speedMps: 43, curvature: 0.03 }, 1 / 60);
  }
  assert.ok(roll <= 0.075 && roll > 0.07);
  const released = stepBodyRoll(roll, { steer: 0, speedMps: 20, curvature: 0 }, 0.1);
  assert.ok(released >= 0 && released < roll);
  assert.equal(stepBodyRoll(roll, rightTurn, 0), roll);
});

test('无限道路按距离生成、难度递增且片段首尾连续', () => {
  const route = new EndlessRoute(42);
  route.ensureAhead(6200);
  assert.equal(route.modules[0].type, 'straight');
  assert.equal(route.modules[1].type, 'turn');
  assert.ok(route.modules.slice(14).some((module) => module.type === 's-bend'));
  for (let i = 1; i < route.modules.length; i += 1) {
    const previous = route.modules[i - 1];
    const current = route.modules[i];
    assert.ok(Math.abs(previous.endM - current.startM) < 1e-8);
    assert.ok(previous.points.at(-1).distanceTo(current.points[0]) < 1e-8);
    assert.ok(current.points.at(-1).y < current.points[0].y);
  }
  const copy = new EndlessRoute(42);
  copy.ensureAhead(6200);
  assert.deepEqual(route.modules.map((module) => module.type), copy.modules.map((module) => module.type));
  assert.ok(route.sample(6000).position instanceof THREE.Vector3);
});

test('道路片段在车辆前方生成且后方可回收，保持少量活动片段', () => {
  const route = new EndlessRoute(7);
  for (let distance = 0; distance <= 8000; distance += 150) {
    route.ensureAhead(distance + 520);
    route.pruneBehind(distance);
    assert.ok(route.modules.length <= 9);
    assert.ok(route.modules[0].startM <= distance);
    assert.ok(route.modules.at(-1).endM >= distance + 520);
  }
});

test('无限场景按路线分块建模、地形接住路肩且旧网格释放', () => {
  const route = new EndlessRoute(9);
  const scene = new THREE.Scene();
  const world = new EndlessWorld(scene, route);
  const bendGroup = world.chunkGroups.get(1);
  assert.ok(bendGroup.getObjectByName('Blue and violet distant mountain layers')?.children.length === 4);
  assert.ok(bendGroup.getObjectByName('Yellow chevron bend signs')?.children.length > 0);
  const start = route.sample(30);
  const side = new THREE.Vector3(0, 1, 0).cross(start.tangent).normalize();
  const shoulder = start.position.clone().addScaledVector(side, 6.15);
  const groundY = world.getTerrainHeight(shoulder.x, shoulder.z, { moduleIndex: start.module.index });
  assert.ok(Math.abs(groundY - (start.position.y - 0.08)) < 0.6);
  for (let distance = 0; distance < 5500; distance += 175) {
    world.sync(distance);
    assert.ok(world.chunkGroups.size <= 9);
    assert.equal(scene.children.length, world.chunkGroups.size);
  }
  route.reset();
  world.reset();
  assert.ok(world.chunkGroups.size <= 9);
});

test('左右操控、弯道外甩与道路边缘失败阈值', () => {
  const hairpin = { type: 'hairpin', turnSign: 1, angle: 1.2, startM: 0, lengthM: 140 };
  const curvature = getRoadCurvature(hairpin, 70);
  assert.ok(curvature > 0);
  const noSteer = stepLateralMotion({ offsetM: 0, velocityMps: 0, steer: 0, speedMps: 32, curvature }, 0.1);
  const corrective = stepLateralMotion({ offsetM: 0, velocityMps: 0, steer: -1, speedMps: 32, curvature }, 0.1);
  assert.ok(noSteer.offsetM < 0);
  assert.ok(corrective.offsetM > noSteer.offsetM);
  const rightInput = stepLateralMotion({ offsetM: 0, velocityMps: 0, steer: 1, speedMps: 15, curvature: 0 }, 0.1);
  const leftInput = stepLateralMotion({ offsetM: 0, velocityMps: 0, steer: -1, speedMps: 15, curvature: 0 }, 0.1);
  assert.ok(rightInput.offsetM < 0, 'D/right must move toward the visible right side');
  assert.ok(leftInput.offsetM > 0, 'A/left must move toward the visible left side');
  assert.ok(ROAD_EXIT_OFFSET > 5.2);
});

test('陡坡自动加速且 SPACE 制动，高速深踩额外磨损', () => {
  const coast = stepEndlessSpeed({ speedMps: 18, brakeDepth: 0, grade: 0.2, type: 'steep', distanceM: 2000 }, 0.1);
  const brake = stepEndlessSpeed({ speedMps: 18, brakeDepth: 0.8, grade: 0.2, type: 'steep', distanceM: 2000 }, 0.1);
  assert.ok(coast > 18);
  assert.ok(brake < coast);
  const stats = calculatePedalStats(createDefaultBuild());
  assert.ok(calculatePedalDamage(1, 1, stats, 35) > calculatePedalDamage(1, 1, stats, 10));
  assert.ok(calculatePedalDamage(0.3, 1, stats, 35) < calculatePedalDamage(1, 1, stats, 35));
  const system = new BrakeSystem(createDefaultBuild());
  system.update(1, 1, 35);
  assert.ok(system.durability < system.stats.maxDurability);
  system.reset();
  assert.equal(system.durability, system.stats.maxDurability);
});

test('道路类型权重从前期平缓逐渐引入危险组合', () => {
  for (let value = 0; value < 1; value += 0.01) {
    assert.notEqual(pickRoadType(3, value), 'hairpin');
    assert.notEqual(pickRoadType(3, value), 's-bend');
  }
  const late = new Set(Array.from({ length: 100 }, (_, i) => pickRoadType(22, i / 100)));
  assert.ok(late.has('hairpin'));
  assert.ok(late.has('s-bend'));
});
