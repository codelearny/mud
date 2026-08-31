import type { Skill, SkillCategory, SkillTrigger, WeaponSchool } from '../types'

// 可装备的主动战技槽位上限（自动战斗只会释放已装备的战技）
export const MAX_EQUIPPED_SKILLS = 3

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
  if (skill.healPercent) {
    tags.push(`疗伤${Math.round(skill.healPercent * 100)}%`)
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

// ===== 自动战斗：触发条件（单一数据源，引擎与 UI 共用）=====
// 未显式声明 trigger 的主动功法，按其字段语义推断一个合理的默认条件，
// 使旧数据无需逐条改写也能在自动战斗中表现得像「会打架」。
export function inferTrigger(skill: Skill): SkillTrigger {
  if (skill.trigger) return skill.trigger
  // 疗伤类：危急时才用
  if ((skill.heal || skill.healPercent) && skill.power <= 0) return { type: 'hpBelow', value: 0.5 }
  // 纯回内类：内力见底时才用
  if (skill.restoreMp && skill.power <= 0) return { type: 'mpAbove', value: 0 }
  // 起手削弱 / 上增益：首回合
  if (skill.power <= 0 && (skill.selfBuff || skill.enemyDebuff)) return { type: 'firstTurn' }
  // 点穴：对手血量尚多时更值钱
  if (skill.stun) return { type: 'enemyHpAbove', value: 0.3 }
  // 施毒：首回合放毒，收益最大化
  if (skill.poison) return { type: 'firstTurn' }
  return { type: 'always' }
}

/**
 * 自动装备推荐：先占一槽给「随时可施展的主输出」，再按威力补足其余槽位。
 * 若三个槽位全是「残血才放」「对手血少才放」这类条件苛刻的大招，
 * 自动战斗会有大半回合只能普攻——这条规则就是为了避免那种空转。
 */
export function recommendEquippedSkills(skills: Skill[]): string[] {
  const byPower = skills
    .filter(s => s.type === 'active')
    .sort((a, b) => b.power - a.power)

  const picked: Skill[] = []
  const mainstay = byPower.find(s => s.power > 0 && inferTrigger(s).type === 'always')
  if (mainstay) picked.push(mainstay)

  for (const s of byPower) {
    if (picked.length >= MAX_EQUIPPED_SKILLS) break
    if (picked.some(p => p.id === s.id)) continue
    picked.push(s)
  }
  return picked.map(s => s.id)
}

export function triggerLabel(trigger: SkillTrigger): string {
  const pct = (v: number | undefined) => `${Math.round((v ?? 0) * 100)}%`
  switch (trigger.type) {
    case 'always': return '随时施展'
    case 'hpBelow': return `自身气血低于${pct(trigger.value)}`
    case 'hpAbove': return `自身气血高于${pct(trigger.value)}`
    case 'mpAbove': return `内力高于${pct(trigger.value)}`
    case 'enemyHpBelow': return `对手气血低于${pct(trigger.value)}`
    case 'enemyHpAbove': return `对手气血高于${pct(trigger.value)}`
    case 'firstTurn': return '开局首回合'
    case 'everyNTurns': return `每${trigger.value ?? 2}回合`
    case 'turnAbove': return `第${trigger.value ?? 3}回合之后`
    default: return '随时施展'
  }
}

// 被动功法（心法）的常驻加成 → 中文标签，用于 UI 展示
export function passiveTags(skill: Skill): string[] {
  const tags: string[] = []
  const e = skill.passiveEffects
  const pct = (v: number) => `${Math.round(v * 100)}%`

  if (e) {
    if (e.maxHp) tags.push(`气血上限+${e.maxHp}`)
    if (e.maxMp) tags.push(`内力上限+${e.maxMp}`)
    if (e.attack) tags.push(`攻击+${e.attack}`)
    if (e.defense) tags.push(`防御+${e.defense}`)
    if (e.agility) tags.push(`轻功+${e.agility}`)
    if (e.comprehension) tags.push(`悟性+${e.comprehension}`)
    if (e.luck) tags.push(`福缘+${e.luck}`)
    if (e.maxHpPercent) tags.push(`气血上限+${pct(e.maxHpPercent)}`)
    if (e.maxMpPercent) tags.push(`内力上限+${pct(e.maxMpPercent)}`)
    if (e.attackPercent) tags.push(`攻击+${pct(e.attackPercent)}`)
    if (e.defensePercent) tags.push(`防御+${pct(e.defensePercent)}`)
    if (e.agilityPercent) tags.push(`轻功+${pct(e.agilityPercent)}`)
  }

  const t = skill.passiveTraits
  if (t) {
    if (t.critRate) tags.push(`暴击率+${pct(t.critRate)}`)
    if (t.critDamage) tags.push(`暴击伤害+${pct(t.critDamage)}`)
    if (t.damageReduction) tags.push(`受伤减免${pct(t.damageReduction)}`)
    if (t.lifesteal) tags.push(`吸血${pct(t.lifesteal)}`)
    if (t.regenPercent) tags.push(`每回合回血${pct(t.regenPercent)}`)
    if (t.mpRegen) tags.push(`每回合回内${t.mpRegen}`)
    if (t.dodgeBonus) tags.push(`闪避+${pct(t.dodgeBonus)}`)
    if (t.thorns) tags.push(`反伤${pct(t.thorns)}`)
    if (t.counterRate) tags.push(`反击率${pct(t.counterRate)}`)
    if (t.firstShield) tags.push(`开局护盾${pct(t.firstShield)}`)
    if (t.executeBonus) tags.push(`残敌斩杀+${pct(t.executeBonus)}`)
    if (t.extraHitRate) tags.push(`连击率${pct(t.extraHitRate)}`)
  }

  return tags
}
