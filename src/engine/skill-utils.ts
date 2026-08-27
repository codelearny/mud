import type { Skill } from '../types'

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
