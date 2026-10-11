export function getFunnyTitle(snapshot) {
  if (snapshot.outcome === 'SUCCESS') return '下山成功';
  if (snapshot.failureReason === 'PEDAL_BROKEN' && snapshot.build.materialId === 'tofu') return '豆腐渣工程';
  if (snapshot.failureReason === 'PEDAL_BROKEN') return '踏板终结者';
  if (snapshot.build.enchantmentId === 'golden_foot') return '重踩艺术家';
  if (snapshot.failureReason === 'OVERSPEED' && snapshot.routeLengthM > 0
    && snapshot.distanceM / snapshot.routeLengthM >= 0.82) return '就差亿点点';
  if (snapshot.failureReason === 'ROAD_EXIT' && snapshot.distanceM >= 3000) return '莽路车神';
  return '刹车研究员';
}

export function getFailureLabel(snapshot) {
  if (snapshot.outcome === 'SUCCESS') return '成功抵达山脚';
  if (snapshot.failureReason === 'PEDAL_BROKEN') return '踏板断裂';
  if (snapshot.failureReason === 'OVERSPEED') return '弯道超速';
  if (snapshot.failureReason === 'ROAD_EXIT') return '冲出山路';
  return '下山失败';
}
