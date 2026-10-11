import * as THREE from 'three';

export const ROUTE_CONTROL_POINTS = [
  [0, 180, 0],
  [95, 166, -82],
  [225, 150, -35],
  [305, 133, 95],
  [185, 113, 205],
  [15, 97, 165],
  [-140, 81, 58],
  [-225, 67, 195],
  [-82, 51, 338],
  [125, 35, 278],
  [275, 20, 398],
  [135, 6, 535],
].map(([x, y, z]) => new THREE.Vector3(x, y, z));

export const ROUTE_SECTIONS = Object.freeze([
  { id: 'start', name: '1. 新手坡', startU: 0, endU: 0.19, color: 0x43c59e },
  { id: 'first-turn', name: '2. 高速下坡', startU: 0.19, endU: 0.35, color: 0xf5b642 },
  { id: 'hairpins', name: '3. 连续弯道', startU: 0.35, endU: 0.64, color: 0xff6b5e },
  { id: 'gravity', name: '4. 重力邀请', startU: 0.64, endU: 0.83, color: 0x6e72e8 },
  { id: 'last-brake', name: '5. 终极失控', startU: 0.83, endU: 1, color: 0xed4d9a },
]);

export const CHECKPOINTS = Object.freeze([
  { id: 'turn-1', u: 0.22, safeSpeedKmh: 64, warningDistanceM: 145, label: '首次急弯' },
  { id: 'turn-2', u: 0.39, safeSpeedKmh: 58, warningDistanceM: 155, label: '发卡弯·一' },
  { id: 'turn-3', u: 0.53, safeSpeedKmh: 54, warningDistanceM: 165, label: '发卡弯·二' },
  { id: 'turn-4', u: 0.71, safeSpeedKmh: 72, warningDistanceM: 175, label: '重力邀请弯' },
  { id: 'turn-5', u: 0.91, safeSpeedKmh: 52, warningDistanceM: 180, label: '终点弯道' },
]);

export function createRouteCurve() {
  return new THREE.CatmullRomCurve3(ROUTE_CONTROL_POINTS, false, 'centripetal', 0.45);
}

export function getSectionAtProgress(u) {
  return ROUTE_SECTIONS.find((section) => u >= section.startU && u < section.endU) ?? ROUTE_SECTIONS.at(-1);
}
