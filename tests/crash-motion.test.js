import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getCrashMotion, getOutsideTurnSign, ROAD_EXIT_TIME_SEC } from '../src/core/CrashMotion.js';

describe('overspeed crash motion', () => {
  it('crosses the road edge before the fall begins', () => {
    const beforeEdge = getCrashMotion(ROAD_EXIT_TIME_SEC * 0.75, 30, 2.35);
    const atEdge = getCrashMotion(ROAD_EXIT_TIME_SEC, 30, 2.35);

    assert.equal(beforeEdge.dropMeters, 0);
    assert.equal(atEdge.dropMeters, 0);
    assert.ok(atEdge.lateralMeters > 6.5);
  });

  it('continues outward and drops only after leaving the road', () => {
    const atEdge = getCrashMotion(ROAD_EXIT_TIME_SEC, 30, 2.35);
    const airborne = getCrashMotion(1.2, 30, 2.35);
    const finished = getCrashMotion(2.35, 30, 2.35);

    assert.ok(airborne.dropMeters > 0);
    assert.ok(airborne.liftMeters > 0);
    assert.ok(airborne.lateralMeters > atEdge.lateralMeters);
    assert.ok(finished.forwardMeters > airborne.forwardMeters);
    assert.ok(finished.lateralMeters > airborne.lateralMeters);
    assert.ok(finished.dropMeters > airborne.dropMeters);
  });

  it('keeps forward inertia and chooses the outside of either turn direction', () => {
    const early = getCrashMotion(0.4, 30, 2.35);
    assert.equal(early.forwardMeters, 12);
    assert.ok(early.forwardMeters > early.lateralMeters);

    const forward = { x: 0, z: 1 };
    const rightTurn = { x: 0.5, z: 0.86 };
    const leftTurn = { x: -0.5, z: 0.86 };
    assert.equal(getOutsideTurnSign(forward, rightTurn), -1);
    assert.equal(getOutsideTurnSign(forward, leftTurn), 1);
  });
});
