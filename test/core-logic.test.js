import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceBrakeDepth, crossedDistance } from '../src/utils/math.js';
import { CHECKPOINTS, createRouteCurve, getSectionAtProgress, ROUTE_SECTIONS } from '../src/config/route.js';
import { RouteFollower } from '../src/world/RouteFollower.js';
import { BALANCE } from '../src/config/balance.js';
import { isCheckpointOverspeed, stepVehicleSpeed } from '../src/core/DrivingModel.js';
import { MATERIALS, normalizeBuild } from '../src/config/materials.js';
import { BrakeSystem, calculatePedalDamage, calculatePedalStats, isPedalBreakCinematicComplete } from '../src/brake/BrakeSystem.js';
import { getPedalDimensions, getPedalPose, PedalModel } from '../src/brake/PedalBuilder.js';
import { analyzeDrawing, canEnchant, drawEnchantment, fingerprintDrawing, getEnchantmentWeights } from '../src/enchant/EnchantmentSystem.js';
import { GAME_PHASE, GameState } from '../src/core/GameState.js';
import { CINEMATICS } from '../src/config/cinematics.js';
import { getBreakCinematicFrame, getCrashCinematicFrame } from '../src/cinematic/CinematicTimeline.js';
import { getFailureLabel, getFunnyTitle } from '../src/core/RunResult.js';
import { createTerrainHeightSampler, getGroundedCenterY, seededVariation } from '../src/world/TerrainHeight.js';
import { getBrakeFeedback } from '../src/ui/GameHUD.js';

test('长按刹车逐渐增加，松开快速回弹且始终限制在 0..1', () => {
  let depth = advanceBrakeDepth(0, true, 0.25, 1, 0.2);
  assert.equal(depth, 0.25);
  depth = advanceBrakeDepth(depth, true, 1, 1, 0.2);
  assert.equal(depth, 1);
  depth = advanceBrakeDepth(depth, false, 0.1, 1, 0.2);
  assert.equal(depth, 0.5);
  depth = advanceBrakeDepth(depth, false, 1, 1, 0.2);
  assert.equal(depth, 0);
});

test('检查点使用上一帧到当前帧的跨越检测，避免高速漏判', () => {
  assert.equal(crossedDistance(99, 101, 100), true);
  assert.equal(crossedDistance(100, 101, 100), false);
  assert.equal(crossedDistance(80, 99, 100), false);
});

test('路线是真实三维曲线且五个检查点距离严格递增', () => {
  const route = new RouteFollower(createRouteCurve(), CHECKPOINTS);
  assert.ok(route.routeLengthM > 1200);
  assert.ok(route.sample(0).position.y > route.sample(route.routeLengthM).position.y);
  const distances = route.checkpoints.map((checkpoint) => checkpoint.distanceM);
  assert.deepEqual(distances, [...distances].sort((a, b) => a - b));
});

test('五个设计路段覆盖完整 0..1 进度', () => {
  assert.deepEqual(ROUTE_SECTIONS.map(({ name }) => name), [
    '1. 新手坡', '2. 高速下坡', '3. 连续弯道', '4. 重力邀请', '5. 终极失控',
  ]);
  assert.equal(getSectionAtProgress(0).id, 'start');
  assert.equal(getSectionAtProgress(0.2).id, 'first-turn');
  assert.equal(getSectionAtProgress(0.5).id, 'hairpins');
  assert.equal(getSectionAtProgress(0.7).id, 'gravity');
  assert.equal(getSectionAtProgress(1).id, 'last-brake');
});

function runRoute(brakingPolicy) {
  const route = new RouteFollower(createRouteCurve(), CHECKPOINTS);
  let distanceM = 0;
  let speedMps = BALANCE.initialSpeedMps;
  let brakeDepth = 0;
  let checkpointIndex = 0;
  let elapsedSec = 0;
  const dt = 0.05;

  while (distanceM < route.routeLengthM && elapsedSec < 360) {
    const sample = route.sample(distanceM);
    const section = getSectionAtProgress(sample.u);
    const sectionIndex = ROUTE_SECTIONS.indexOf(section);
    const upcoming = route.checkpoints[checkpointIndex] ?? null;
    const brakeHeld = brakingPolicy({ distanceM, speedMps, upcoming });
    brakeDepth = advanceBrakeDepth(brakeDepth, brakeHeld, dt, BALANCE.pressTimeToMax, BALANCE.releaseTime);
    speedMps = stepVehicleSpeed({ speedMps, brakeDepth, tangentY: sample.tangent.y, sectionIndex }, dt);
    const previousDistanceM = distanceM;
    distanceM = Math.min(route.routeLengthM, distanceM + speedMps * dt);

    if (upcoming && crossedDistance(previousDistanceM, distanceM, upcoming.distanceM)) {
      if (isCheckpointOverspeed(speedMps, upcoming.safeSpeedKmh)) {
        return { outcome: 'FAIL', checkpointIndex, speedMps, elapsedSec };
      }
      checkpointIndex += 1;
    }
    elapsedSec += dt;
  }

  return { outcome: distanceM >= route.routeLengthM ? 'SUCCESS' : 'TIMEOUT', checkpointIndex, speedMps, elapsedSec };
}

test('全程不刹车会在第一个急弯超速失败', () => {
  const result = runRoute(() => false);
  assert.equal(result.outcome, 'FAIL');
  assert.equal(result.checkpointIndex, 0);
});

test('按安全距离刹车可以通过五个检查点并到达山脚', () => {
  const result = runRoute(({ distanceM, speedMps, upcoming }) => {
    if (!upcoming) return false;
    const targetSpeedMps = (upcoming.safeSpeedKmh - 5) / 3.6;
    const stoppingDistanceM = Math.max(0, (speedMps ** 2 - targetSpeedMps ** 2) / (2 * 6.2));
    return upcoming.distanceM - distanceM <= stoppingDistanceM + 55;
  });
  assert.equal(result.outcome, 'SUCCESS');
  assert.equal(result.checkpointIndex, CHECKPOINTS.length);
});

test('DIY 提供七种材质，材质强度差异明显', () => {
  assert.equal(Object.keys(MATERIALS).length, 7);
  const tofu = calculatePedalStats({ materialId: 'tofu', thickness: 50, reinforcementId: 'normal' });
  const steel = calculatePedalStats({ materialId: 'steel', thickness: 50, reinforcementId: 'normal' });
  const titanium = calculatePedalStats({ materialId: 'titanium', thickness: 50, reinforcementId: 'normal' });
  assert.ok(tofu.maxDurability < steel.maxDurability);
  assert.ok(steel.maxDurability < titanium.maxDurability);
  assert.ok(tofu.damageMultiplier > titanium.damageMultiplier);
});

test('粗细和加固同时影响最大耐久与损耗', () => {
  const weak = calculatePedalStats({ materialId: 'steel', thickness: 0, reinforcementId: 'none' });
  const strong = calculatePedalStats({ materialId: 'steel', thickness: 100, reinforcementId: 'ultimate' });
  assert.ok(strong.maxDurability > weak.maxDurability * 3);
  assert.ok(strong.damageMultiplier < weak.damageMultiplier / 3);
});

test('同配置与同输入的损耗完全可复现，未踩下时不损耗', () => {
  const build = { materialId: 'aluminum', thickness: 63, reinforcementId: 'normal' };
  const first = calculatePedalStats(build);
  const second = calculatePedalStats({ ...build });
  assert.deepEqual(first, second);
  assert.equal(calculatePedalDamage(0, 2, first), 0);
  assert.equal(calculatePedalDamage(0.8, 0.05, first), calculatePedalDamage(0.8, 0.05, second));
});

test('踏板绕前端转轴运动，脚保持角度整体向前踩', () => {
  const released = getPedalPose(0);
  const half = getPedalPose(0.5);
  const pressed = getPedalPose(1);
  assert.ok(pressed.pedalRotationX > released.pedalRotationX);
  assert.equal(pressed.pedalY, released.pedalY);
  assert.equal(pressed.pedalZ, released.pedalZ);
  assert.ok(pressed.padZ < half.padZ && half.padZ < released.padZ);
  assert.ok(pressed.padY < released.padY);
  assert.ok(pressed.footY < half.footY && half.footY < released.footY);
  assert.equal(pressed.footX, released.footX);
  assert.ok(pressed.footZ < half.footZ && half.footZ < released.footZ);
  assert.ok(pressed.footZ < released.footZ - 0.6);
  assert.equal(pressed.footRotationX, released.footRotationX);
  assert.ok(released.footRotationX >= 0.75);
});

test('共用踏板模型不再有侧向推杆，踏板面仍绕轴下压', () => {
  const model = new PedalModel({ materialId: 'steel', thickness: 50, reinforcementId: 'normal' });
  const pivot = model.movingPart.position.clone();
  model.setPressDepth(0);
  model.setPressDepth(0.5);
  model.setPressDepth(1);
  assert.deepEqual(model.movingPart.position.toArray(), pivot.toArray());
  assert.ok(Math.abs(model.movingPart.rotation.x + model.padAssembly.rotation.x) < 0.15);
  assert.equal(model.group.getObjectByName('Visible retracting brake pushrod'), undefined);
  assert.equal(model.group.getObjectByName('Fixed side bracket for brake piston'), undefined);
  assert.equal(model.breakApart(), true);
  model.reset();
  assert.equal(model.broken, false);
  assert.equal(model.movingPart.rotation.x, 0);
});

test('粗细滑块明显改变共用 3D 踏板的几何尺寸', () => {
  const thin = getPedalDimensions({ materialId: 'steel', thickness: 0, reinforcementId: 'none' });
  const thick = getPedalDimensions({ materialId: 'steel', thickness: 100, reinforcementId: 'none' });
  assert.ok(thick.armWidth > thin.armWidth * 2.5);
  assert.ok(thick.padDepth > thin.padDepth);
});

test('断裂只触发一次，重试会重置完整耐久', () => {
  const build = { materialId: 'tofu', thickness: 0, reinforcementId: 'none' };
  const system = new BrakeSystem(build);
  let triggers = 0;
  for (let i = 0; i < 200; i += 1) if (system.update(1, 0.05)) triggers += 1;
  assert.equal(triggers, 1);
  assert.equal(system.broken, true);
  assert.equal(system.update(1, 1), false);
  system.reset(build);
  assert.equal(system.broken, false);
  assert.equal(system.durability, system.stats.maxDurability);
});

test('踏板断裂后模型只分离一次，基础演出结束进入结算', () => {
  const model = new PedalModel({ materialId: 'cookie', thickness: 30, reinforcementId: 'none' });
  assert.equal(model.breakApart(), true);
  assert.equal(model.breakApart(), false);
  const before = model.movingPart.position.clone();
  model.updateBroken(0.5);
  assert.notDeepEqual(model.movingPart.position.toArray(), before.toArray());
  assert.equal(isPedalBreakCinematicComplete(CINEMATICS.brakeBreakDurationSec - 0.01), false);
  assert.equal(isPedalBreakCinematicComplete(CINEMATICS.brakeBreakDurationSec), true);
  model.clear();
});

test('返回 DIY 时配置可原样保留并规范化', () => {
  const build = {
    materialId: 'cookie',
    thickness: 77,
    reinforcementId: 'ultimate',
    logoDataUrl: 'data:image/png;base64,test',
    logoRevision: 4,
    logoFingerprint: 'logo-1-test',
    enchantmentId: 'steel_will',
    enchantmentRevision: 4,
    enchantmentFingerprint: 'logo-1-test',
    enchantmentHistory: { 'logo-1-test': 'steel_will' },
  };
  assert.deepEqual(normalizeBuild(build), build);
});

test('绘图特征统计点数、轨迹长度与覆盖网格', () => {
  const sparse = analyzeDrawing([{ points: [{ x: 10, y: 10 }, { x: 20, y: 20 }] }]);
  const dense = analyzeDrawing([{ points: Array.from({ length: 90 }, (_, index) => ({
    x: (index * 29) % 256,
    y: (index * 47) % 256,
  })) }]);
  assert.equal(sparse.blank, false);
  assert.ok(sparse.strokeLength > 0);
  assert.ok(dense.pointCount > sparse.pointCount);
  assert.ok(dense.coveredCells > sparse.coveredCells);
  assert.ok(dense.density > sparse.density);
});

test('绘画特征会改变半随机附魔权重，随机数可注入复现', () => {
  const blank = analyzeDrawing([]);
  const dense = { ...blank, blank: false, density: 1, coverage: 0.7, coveredCells: 45 };
  const sparse = { ...blank, blank: false, density: 0.05, coverage: 0.04, coveredCells: 3 };
  assert.ok(getEnchantmentWeights(dense).steel_will > getEnchantmentWeights(sparse).steel_will);
  assert.ok(getEnchantmentWeights(sparse).light_brake > getEnchantmentWeights(dense).light_brake);
  assert.ok(getEnchantmentWeights(dense).golden_foot > getEnchantmentWeights(sparse).golden_foot);
  assert.equal(drawEnchantment(dense, () => 0), drawEnchantment(dense, () => 0));

  const sample = (features, count = 8000) => {
    const totals = {};
    for (let index = 0; index < count; index += 1) {
      const id = drawEnchantment(features, () => (index + 0.5) / count);
      totals[id] = (totals[id] ?? 0) + 1;
    }
    return totals;
  };
  const denseResults = sample(dense);
  const sparseResults = sample(sparse);
  assert.ok(denseResults.steel_will > sparseResults.steel_will);
  assert.ok(denseResults.golden_foot > sparseResults.golden_foot);
  assert.ok(sparseResults.light_brake > denseResults.light_brake);
});

test('同一画作只能附魔一次，撤销恢复原画也不能重新刷取', () => {
  const originalStrokes = [{ color: '#111111', size: 10, points: [{ x: 10, y: 10 }, { x: 40, y: 40 }] }];
  const addedStroke = { color: '#e34f39', size: 8, points: [{ x: 80, y: 80 }] };
  const originalFingerprint = fingerprintDrawing(originalStrokes);
  const modifiedFingerprint = fingerprintDrawing([...originalStrokes, addedStroke]);
  const restoredFingerprint = fingerprintDrawing(originalStrokes);
  const build = { enchantmentHistory: { [originalFingerprint]: 'steel_will' } };

  assert.notEqual(modifiedFingerprint, originalFingerprint);
  assert.equal(restoredFingerprint, originalFingerprint);
  assert.equal(canEnchant(build, originalFingerprint), false);
  assert.equal(canEnchant(build, modifiedFingerprint), true);
  assert.equal(canEnchant(build, restoredFingerprint), false);
});

test('数值附魔实际影响耐久、损耗和制动力', () => {
  const baseBuild = { materialId: 'steel', thickness: 50, reinforcementId: 'normal' };
  const base = calculatePedalStats(baseBuild);
  const durable = calculatePedalStats({ ...baseBuild, enchantmentId: 'steel_will' });
  const gentle = calculatePedalStats({ ...baseBuild, enchantmentId: 'light_brake' });
  const golden = calculatePedalStats({ ...baseBuild, enchantmentId: 'golden_foot' });
  assert.equal(durable.maxDurability, base.maxDurability * 1.2);
  assert.equal(gentle.damageMultiplier, base.damageMultiplier * 0.85);
  assert.equal(golden.brakeMultiplier, 1.2);

  const common = { speedMps: 20, brakeDepth: 1, tangentY: 0, sectionIndex: 0 };
  const normalSpeed = stepVehicleSpeed({ ...common, brakeMultiplier: 1 }, 0.1);
  const enchantedSpeed = stepVehicleSpeed({ ...common, brakeMultiplier: golden.brakeMultiplier }, 0.1);
  assert.ok(enchantedSpeed < normalSpeed);
});

test('附魔在重试重置耐久时不会重复叠加', () => {
  const build = { materialId: 'steel', thickness: 50, reinforcementId: 'normal', enchantmentId: 'steel_will' };
  const system = new BrakeSystem(build);
  const firstStats = system.stats;
  system.update(1, 2);
  system.reset(build);
  assert.deepEqual(system.stats, firstStats);
  assert.equal(system.durability, firstStats.maxDurability);
  assert.equal(system.stats.maxDurability, calculatePedalStats(build).maxDurability);
});

test('P4 状态机按驾驶、断裂特写、飞车、结算顺序且重复事件不会再次触发', () => {
  const state = new GameState(GAME_PHASE.DRIVING);
  const transitions = [];
  state.subscribe((next) => transitions.push(next));
  assert.equal(state.set(GAME_PHASE.BRAKE_BREAK_CINEMATIC), true);
  assert.equal(state.set(GAME_PHASE.BRAKE_BREAK_CINEMATIC), false);
  assert.equal(state.set(GAME_PHASE.CRASH_CINEMATIC), true);
  assert.equal(state.set(GAME_PHASE.RESULT), true);
  assert.deepEqual(transitions, [
    GAME_PHASE.BRAKE_BREAK_CINEMATIC,
    GAME_PHASE.CRASH_CINEMATIC,
    GAME_PHASE.RESULT,
  ]);
});

test('连续十局状态循环不会积累重复转换', () => {
  const state = new GameState(GAME_PHASE.RESULT);
  let transitionCount = 0;
  state.subscribe(() => { transitionCount += 1; });
  for (let round = 0; round < 10; round += 1) {
    assert.equal(state.set(GAME_PHASE.DRIVING), true);
    assert.equal(state.set(GAME_PHASE.CRASH_CINEMATIC), true);
    assert.equal(state.set(GAME_PHASE.RESULT), true);
  }
  assert.equal(transitionCount, 30);
});

test('断裂演出使用独立时间轴，先放大猛踩，再断裂并进入飞车', () => {
  const early = getBreakCinematicFrame(CINEMATICS.breakZoomDurationSec * 0.75);
  const impact = getBreakCinematicFrame(CINEMATICS.breakMomentSec);
  const returnFrame = getBreakCinematicFrame(CINEMATICS.breakReturnStartSec + 0.4);
  const cockpitTransition = getBreakCinematicFrame(CINEMATICS.breakCockpitTransitionStartSec + 0.5);
  const finished = getBreakCinematicFrame(CINEMATICS.brakeBreakDurationSec);
  assert.ok(early.zoomProgress > 0.5);
  assert.equal(early.shouldBreak, false);
  assert.equal(impact.shouldBreak, true);
  assert.equal(impact.impactVisible, true);
  assert.ok(returnFrame.returnProgress > 0);
  assert.ok(cockpitTransition.forwardLurchMeters > 0);
  assert.ok(CINEMATICS.brakeBreakDurationSec + CINEMATICS.crashDurationSec >= 6);
  assert.ok(CINEMATICS.brakeBreakDurationSec + CINEMATICS.crashDurationSec <= 8);
  assert.equal(finished.complete, true);
  const crashTransition = getCrashCinematicFrame(CINEMATICS.crashTransitionDurationSec * 0.5);
  assert.ok(crashTransition.transitionProgress > 0 && crashTransition.transitionProgress < 1);
  const crashReveal = getCrashCinematicFrame(CINEMATICS.crashFlightRevealSec + 0.1);
  assert.ok(crashReveal.flightElapsed > 0);
  assert.equal(crashReveal.thirdPerson, false);
  assert.equal(getCrashCinematicFrame(CINEMATICS.crashTransitionDurationSec).thirdPerson, true);
  assert.equal(getCrashCinematicFrame(CINEMATICS.crashTransitionDurationSec).transitionProgress, 1);
  assert.equal(getBreakCinematicFrame(0.4).shake, 0);
  assert.ok(Math.abs(getBreakCinematicFrame(0.08).shake) <= 0.2);
  assert.equal(getCrashCinematicFrame(CINEMATICS.crashDurationSec).complete, true);
});

test('成功和两类失败会得到稳定的原因与搞笑称号', () => {
  const base = { outcome: 'FAIL', distanceM: 400, routeLengthM: 1000, build: { materialId: 'steel', enchantmentId: null } };
  assert.equal(getFunnyTitle({ ...base, failureReason: 'PEDAL_BROKEN' }), '踏板终结者');
  assert.equal(getFunnyTitle({ ...base, failureReason: 'PEDAL_BROKEN', build: { materialId: 'tofu' } }), '豆腐渣工程');
  assert.equal(getFunnyTitle({ ...base, failureReason: 'OVERSPEED', distanceM: 900 }), '就差亿点点');
  assert.equal(getFunnyTitle({ ...base, outcome: 'SUCCESS', failureReason: null }), '下山成功');
  assert.equal(getFailureLabel({ ...base, failureReason: 'OVERSPEED' }), '弯道超速');
});

test('P4.5 路侧物体共享同一地形高度采样且模型底面能够贴地', () => {
  const curve = createRouteCurve();
  const sampler = createTerrainHeightSampler(curve);
  const u = 0.42;
  const point = curve.getPointAt(u);
  const tangent = curve.getTangentAt(u).normalize();
  const distance = 20;
  const x = point.x + tangent.z * distance;
  const z = point.z - tangent.x * distance;
  const terrainY = sampler.getTerrainHeight(x, z);
  assert.ok(terrainY < point.y - 0.2);
  assert.ok(terrainY > point.y - 16.1);
  assert.equal(getGroundedCenterY(terrainY, -1, 3, 0.2), terrainY + 2.8);
  assert.equal(seededVariation(17, 4), seededVariation(17, 4));
});

test('刹车深度映射到轻踩、中踩、深踩与踩到底反馈', () => {
  assert.deepEqual(getBrakeFeedback(0), { label: '未踩', level: 'idle' });
  assert.deepEqual(getBrakeFeedback(0.2), { label: '轻踩', level: 'light' });
  assert.deepEqual(getBrakeFeedback(0.4), { label: '中踩', level: 'medium' });
  assert.deepEqual(getBrakeFeedback(0.7), { label: '深踩', level: 'heavy' });
  assert.deepEqual(getBrakeFeedback(1), { label: '踩到底', level: 'max' });
});
