export const MATERIALS = Object.freeze({
  steel: Object.freeze({ id: 'steel', label: '钢铁', color: 0x737c84, durability: 150, damageMultiplier: 0.9, roughness: 0.42, metalness: 0.72, hint: '稳定、耐用，适合第一次测试。' }),
  aluminum: Object.freeze({ id: 'aluminum', label: '铝合金', color: 0xb7c2c9, durability: 115, damageMultiplier: 1, roughness: 0.36, metalness: 0.78, hint: '轻巧但不爱被猛踹。' }),
  plastic: Object.freeze({ id: 'plastic', label: '塑料', color: 0xf05b47, durability: 80, damageMultiplier: 1.18, roughness: 0.72, metalness: 0, hint: '工程塑料，重音读在“工程”。' }),
  titanium: Object.freeze({ id: 'titanium', label: '钛合金', color: 0x8b91bf, durability: 190, damageMultiplier: 0.72, roughness: 0.3, metalness: 0.86, hint: '不设预算，所以真的可以选这个。' }),
  wood: Object.freeze({ id: 'wood', label: '木头', color: 0x8a5b38, durability: 65, damageMultiplier: 1.34, roughness: 0.92, metalness: 0, hint: '木纹是大自然的加强筋，大概。' }),
  tofu: Object.freeze({ id: 'tofu', label: '豆腐', color: 0xe9e2bc, durability: 18, damageMultiplier: 2.4, roughness: 1, metalness: 0, hint: '符合食品安全标准，未承诺交通安全。' }),
  cookie: Object.freeze({ id: 'cookie', label: '饼干', color: 0xb8793e, durability: 30, damageMultiplier: 1.9, roughness: 0.95, metalness: 0, hint: '建议搭配牛奶，不建议搭配长下坡。' }),
});

export const MATERIAL_ORDER = Object.freeze(['steel', 'aluminum', 'plastic', 'titanium', 'wood', 'tofu', 'cookie']);

export const REINFORCEMENTS = Object.freeze({
  none: Object.freeze({ id: 'none', label: '不加固', durabilityMultiplier: 1, damageMultiplier: 1, braceCount: 0 }),
  normal: Object.freeze({ id: 'normal', label: '普通加固', durabilityMultiplier: 1.35, damageMultiplier: 0.75, braceCount: 1 }),
  ultimate: Object.freeze({ id: 'ultimate', label: '究极加固', durabilityMultiplier: 1.8, damageMultiplier: 0.55, braceCount: 2 }),
});

export const REINFORCEMENT_ORDER = Object.freeze(['none', 'normal', 'ultimate']);

export function createDefaultBuild() {
  return {
    materialId: 'steel',
    thickness: 50,
    reinforcementId: 'normal',
    logoDataUrl: null,
    logoRevision: 0,
    logoFingerprint: 'blank-v1',
    enchantmentId: null,
    enchantmentRevision: null,
    enchantmentFingerprint: null,
    enchantmentHistory: {},
  };
}

export function normalizeBuild(build = {}) {
  return {
    materialId: MATERIALS[build.materialId] ? build.materialId : 'steel',
    thickness: Math.max(0, Math.min(100, Number(build.thickness) || 0)),
    reinforcementId: REINFORCEMENTS[build.reinforcementId] ? build.reinforcementId : 'normal',
    logoDataUrl: typeof build.logoDataUrl === 'string' ? build.logoDataUrl : null,
    logoRevision: Number.isInteger(build.logoRevision) ? build.logoRevision : 0,
    logoFingerprint: typeof build.logoFingerprint === 'string' ? build.logoFingerprint : 'blank-v1',
    enchantmentId: typeof build.enchantmentId === 'string' ? build.enchantmentId : null,
    enchantmentRevision: Number.isInteger(build.enchantmentRevision) ? build.enchantmentRevision : null,
    enchantmentFingerprint: typeof build.enchantmentFingerprint === 'string' ? build.enchantmentFingerprint : null,
    enchantmentHistory: build.enchantmentHistory && typeof build.enchantmentHistory === 'object'
      ? { ...build.enchantmentHistory }
      : {},
  };
}

export function getThicknessFactors(thickness) {
  const normalized = Math.max(0, Math.min(100, thickness)) / 100;
  return {
    visualScale: 0.62 + normalized * 1.28,
    durabilityMultiplier: 0.7 + normalized * 0.8,
    damageMultiplier: 1.45 - normalized * 0.83,
  };
}

export function getBuildLabels(build) {
  const normalized = normalizeBuild(build);
  return {
    material: MATERIALS[normalized.materialId].label,
    thickness: `${Math.round(normalized.thickness)}`,
    reinforcement: REINFORCEMENTS[normalized.reinforcementId].label,
  };
}
