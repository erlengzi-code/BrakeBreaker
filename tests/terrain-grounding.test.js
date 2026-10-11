import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRouteCurve } from '../src/config/route.js';
import {
  createTerrainHeightSampler,
  getTerrainCrossSection,
  getTerrainHeightFromProfile,
  getTerrainProfile,
  solveMultiPointGrounding,
  VALLEY_FLOOR_Y,
} from '../src/world/TerrainHeight.js';

describe('P4.6 terrain grounding', () => {
  it('uses the same cross-section values for mesh generation and height queries', () => {
    const profile = getTerrainProfile(120, 1, 88);
    const crossSection = getTerrainCrossSection(profile);
    assert.equal(crossSection.length, 5);
    crossSection.forEach(({ distance, height }) => {
      assert.ok(Math.abs(getTerrainHeightFromProfile(distance, profile) - height) < 1e-8);
    });
    assert.equal(crossSection.at(-1).height, VALLEY_FLOOR_Y);
    assert.equal(getTerrainHeightFromProfile(profile.baseDistance + 1, profile), null);
  });

  it('uses a route hint at hairpins and rejects positions beyond generated terrain', () => {
    const curve = createRouteCurve();
    const sampler = createTerrainHeightSampler(curve);
    const u = 0.53;
    const point = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u).normalize();
    const x = point.x + tangent.z * 18;
    const z = point.z - tangent.x * 18;
    const sample = sampler.sampleTerrain(x, z, { uHint: u });
    assert.equal(sample.valid, true);
    assert.ok(sample.height < point.y);
    const outsideX = point.x + tangent.z * (sample.profile.baseDistance + 3);
    const outsideZ = point.z - tangent.x * (sample.profile.baseDistance + 3);
    assert.equal(sampler.sampleTerrain(outsideX, outsideZ, { uHint: u }).valid, false);
  });

  it('uses multiple rock footprint samples to embed the low side of a slope', () => {
    const localBottomY = -2.4;
    const centerY = solveMultiPointGrounding([10, 11.2, 12, 10.8, null], localBottomY, 0.3);
    const resultingBottom = centerY + localBottomY;
    assert.ok(resultingBottom <= 10.05);
    assert.equal(solveMultiPointGrounding([null, undefined], localBottomY), null);
  });
});
