import type { Skill, SkillCategory, WeaponSchool } from '../types'

// 兵器流派中文名（与 Item.school / Skill.category 对应）
export const WEAPON_SCHOOL_LABELS: Record<WeaponSchool, string> = {
  none: '通用',
  sword: '剑',
  blade: '刀',
  fist: '拳',
  staff: '棍'
}

export const WEAPON_SKILL_CATS: SkillCategory[] = ['sword', 'blade', 'fist', 'staff']

// 该技能是否属于「需兵器配合」的功法（剑/刀/拳/棍）。内功、轻功无需兵器。
export function skillSchool(skill: Skill): WeaponSchool | null {
  return WEAPON_SKILL_CATS.includes(skill.category) ? (skill.category as WeaponSchool) : null
}

// ===== 兵刃与功法相性（单一数据源：引擎 combat.ts 与 UI 共用，避免魔法数字漂移）=====
// 兵刃流派与功法 category 同源 → 威力略增（相合）；
// 兵刃与功法不合（相克）→ 威力大打折扣（折扣而非禁用）。
export const WEAPON_AFFINITY_MATCH = 1.1       // 相合：威力 ×1.1（+10%）
export const WEAPON_AFFINITY_MISMATCH = 0.6    // 相克：威力 ×0.6（−40%，折扣）

// 判断「兵器流派 vs 功法」是否相合：徒手时拳脚功法视为相合（空手亦可施展拳法）。
export function weaponSchoolMatches(
  weaponSchool: WeaponSchool | undefined,
  skill: Skill
): boolean {
  if (!WEAPON_SKILL_CATS.includes(skill.category)) return false
  const effectiveSchool: WeaponSchool = weaponSchool ?? 'fist'
  return effectiveSchool === skill.category
}

// 用于 UI 显示「适配: 刀」这类标签
export function skillSchoolLabel(skill: Skill): string | null {
  const s = skillSchool(skill)
  return s ? WEAPON_SCHOOL_LABELS[s] : null
}

// 将技能的进阶机制转为可展示的中文标签（连击/吸血/疗伤/回内/增益/削敌/点穴/中毒）
export function skillTags(skill: Skill): string[] {
  const tags: string[] = []

  if (skill.hits && skill.hits > 1) {
    tags.push(`连击×${skill.hits}`)
  }
  if (skill.lifesteal) {
    tags.push(`吸血${Math.round(skill.lifesteal * 100)}%`)
  }
  if (skill.heal) {
    tags.push(`疗伤${skill.heal}`)
  }
  if (skill.restoreMp) {
    tags.push(`回内${skill.restoreMp}`)
  }
  if (skill.selfBuff) {
    const b: string[] = []
    if (skill.selfBuff.attack) b.push(`攻+${skill.selfBuff.attack}`)
    if (skill.selfBuff.defense) b.push(`防+${skill.selfBuff.defense}`)
    if (skill.selfBuff.agility) b.push(`身法+${skill.selfBuff.agility}`)
    if (b.length) tags.push(`增益(${b.join('')})`)
  }
  if (skill.enemyDebuff) {
    const b: string[] = []
    if (skill.enemyDebuff.attack) b.push(`攻${skill.enemyDebuff.attack}`)
    if (skill.enemyDebuff.defense) b.push(`防${skill.enemyDebuff.defense}`)
    if (skill.enemyDebuff.agility) b.push(`身法${skill.enemyDebuff.agility}`)
    if (b.length) tags.push(`削敌(${b.join('')})`)
  }
  if (skill.stun) {
    tags.push('点穴眩晕')
  }
  if (skill.poison) {
    tags.push(`中毒(${skill.poison}×${skill.poisonTurns ?? 3})`)
  }

  return tags
}
