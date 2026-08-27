import type { Item, ItemEffect, ItemRarity, EffectType } from '../types'

export const RARITY_LABELS: Record<ItemRarity, string> = {
  common: '凡品',
  rare: '精良',
  epic: '上品',
  legendary: '神兵'
}

// 单条效果 -> 展示文案（完全由 type 决定，新增效果类型只需在此扩展）
function effectToText(e: ItemEffect): string {
  const turns = e.turns ? `(持续${e.turns}回合)` : ''
  switch (e.type as EffectType) {
    case 'hp': return `回气血${e.value}`
    case 'mp': return `回内力${e.value}`
    case 'maxHp': return `气血上限+${e.value}`
    case 'maxMp': return `内力上限+${e.value}`
    case 'attack': return `攻击+${e.value}`
    case 'defense': return `防御+${e.value}`
    case 'agility': return `轻功+${e.value}`
    case 'luck': return `福缘+${e.value}`
    case 'comprehension': return `悟性+${e.value}`
    case 'cure': return '解毒'
    case 'buffAttack': return `攻击↑${e.value}${turns}`
    case 'buffDefense': return `防御↑${e.value}${turns}`
    case 'buffAgility': return `轻功↑${e.value}${turns}`
    default: return e.type
  }
}

// 物品全部效果 -> 标签数组，供角色面板 / 战斗用药菜单复用
export function itemTags(item: Item): string[] {
  if (!item.effects) return []
  return item.effects.map(effectToText)
}

// 效果类型 -> 简短中文（用于 UI 分组/排序等，可选）
export const EFFECT_LABELS: Record<EffectType, string> = {
  hp: '气血',
  mp: '内力',
  maxHp: '气血上限',
  maxMp: '内力上限',
  attack: '攻击',
  defense: '防御',
  agility: '轻功',
  luck: '福缘',
  comprehension: '悟性',
  cure: '解毒',
  buffAttack: '攻击增益',
  buffDefense: '防御增益',
  buffAgility: '轻功增益'
}
