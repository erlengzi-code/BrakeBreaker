export const ENCHANTMENTS = Object.freeze({
  steel_will: Object.freeze({
    id: 'steel_will',
    label: '钢铁意志',
    tone: 'positive',
    description: '密集线条凝成一股不讲道理的硬气。',
    effectLabel: '最大耐久 ×1.20',
    effects: Object.freeze({ durability: 1.2, damage: 1, brake: 1 }),
  }),
  light_brake: Object.freeze({
    id: 'light_brake',
    label: '轻盈制动',
    tone: 'positive',
    description: '留白让踏板学会了少受一点罪。',
    effectLabel: '踏板损耗 ×0.85',
    effects: Object.freeze({ durability: 1, damage: 0.85, brake: 1 }),
  }),
  golden_foot: Object.freeze({
    id: 'golden_foot',
    label: '重踩艺术家',
    tone: 'mixed',
    description: '画面铺得够满，制动力和踏板损耗一起拉满。',
    effectLabel: '制动力 ×1.20 / 损耗 ×1.25',
    effects: Object.freeze({ durability: 1, damage: 1.25, brake: 1.2 }),
  }),
  youtian_blessing: Object.freeze({
    id: 'youtian_blessing',
    label: '实验室祝福',
    tone: 'positive',
    description: '玄学认证：今天的踏板稍微更有底气。',
    effectLabel: '最大耐久 ×1.10',
    effects: Object.freeze({ durability: 1.1, damage: 1, brake: 1 }),
  }),
  fate_exhausted: Object.freeze({
    id: 'fate_exhausted',
    label: '天命已尽',
    tone: 'negative',
    description: '图是好图，可惜踏板今天没看黄历。',
    effectLabel: '最大耐久 ×0.75',
    effects: Object.freeze({ durability: 0.75, damage: 1, brake: 1 }),
  }),
  spirit_brake: Object.freeze({
    id: 'spirit_brake',
    label: '精神制动',
    tone: 'negative',
    description: '主要靠信念减速，机械部分负责配合。',
    effectLabel: '制动力 ×0.85',
    effects: Object.freeze({ durability: 1, damage: 1, brake: 0.85 }),
  }),
  horn_blessing: Object.freeze({
    id: 'horn_blessing',
    label: '喇叭开光',
    tone: 'fun',
    description: '玄学能量全部去了喇叭，踏板数值保持原样。',
    effectLabel: '纯整活 / 数值不变',
    effects: Object.freeze({ durability: 1, damage: 1, brake: 1 }),
  }),
  stubborn_console: Object.freeze({
    id: 'stubborn_console',
    label: '中控嘴硬',
    tone: 'fun',
    description: '无论发生什么，中控都坚持报告状态良好。',
    effectLabel: '纯整活 / 数值不变',
    effects: Object.freeze({ durability: 1, damage: 1, brake: 1 }),
  }),
});

export const ENCHANTMENT_ORDER = Object.freeze(Object.keys(ENCHANTMENTS));
export const DEFAULT_ENCHANTMENT_EFFECTS = Object.freeze({ durability: 1, damage: 1, brake: 1 });

export function getEnchantment(id) {
  return ENCHANTMENTS[id] ?? null;
}

export function getEnchantmentEffects(id) {
  return getEnchantment(id)?.effects ?? DEFAULT_ENCHANTMENT_EFFECTS;
}
