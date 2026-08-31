import type { Character, SkillCategory, Talent, TalentEffect } from '../types'
import { getAllTalents, getTalent } from './data-loader'

// 加权随机抽取 n 个不重复天赋（排除已拥有的），用于升级「顿悟」三选一。
// 稀有度越高权重越低，越难抽到——保证 build 多样性又保留惊喜。
export function rollTalentChoices(count = 3, ownedIds: string[] = []): Talent[] {
  const pool = getAllTalents().filter(t => !ownedIds.includes(t.id))
  if (pool.length === 0) return []
  const picks: Talent[] = []
  const available = [...pool]
  while (picks.length < count && available.length > 0) {
    const total = available.reduce((s, t) => s + (t.weight || 1), 0)
    let r = Math.random() * total
    let idx = available.length - 1
    for (let i = 0; i < available.length; i++) {
      r -= (available[i].weight || 1)
      if (r <= 0) { idx = i; break }
    }
    picks.push(available[idx])
    available.splice(idx, 1)
  }
  return picks
}

// 聚合角色已得天赋的全部效果：数值项加性合并，schoolDamage 按流派合并。
export function getTalentEffects(char: Character): TalentEffect {
  const eff: TalentEffect = {}
  const schoolDamage: Partial<Record<SkillCategory, number>> = {}
  for (const id of char.talents ?? []) {
    const t = getTalent(id)
    if (!t) continue
    const e = t.effects
    eff.attackPercent = (eff.attackPercent ?? 0) + (e.attackPercent ?? 0)
    eff.defensePercent = (eff.defensePercent ?? 0) + (e.defensePercent ?? 0)
    eff.agilityPercent = (eff.agilityPercent ?? 0) + (e.agilityPercent ?? 0)
    eff.comprehensionPercent = (eff.comprehensionPercent ?? 0) + (e.comprehensionPercent ?? 0)
    eff.maxHpFlat = (eff.maxHpFlat ?? 0) + (e.maxHpFlat ?? 0)
    eff.maxMpFlat = (eff.maxMpFlat ?? 0) + (e.maxMpFlat ?? 0)
    eff.lifesteal = (eff.lifesteal ?? 0) + (e.lifesteal ?? 0)
    eff.critRate = (eff.critRate ?? 0) + (e.critRate ?? 0)
    eff.critDamage = (eff.critDamage ?? 0) + (e.critDamage ?? 0)
    eff.damageReduction = (eff.damageReduction ?? 0) + (e.damageReduction ?? 0)
    eff.regenPercent = (eff.regenPercent ?? 0) + (e.regenPercent ?? 0)
    eff.goldPercent = (eff.goldPercent ?? 0) + (e.goldPercent ?? 0)
    eff.expPercent = (eff.expPercent ?? 0) + (e.expPercent ?? 0)
    if (e.schoolDamage) {
      for (const [cat, val] of Object.entries(e.schoolDamage)) {
        const c = cat as SkillCategory
        schoolDamage[c] = (schoolDamage[c] ?? 0) + (val ?? 0)
      }
    }
  }
  if (Object.keys(schoolDamage).length > 0) eff.schoolDamage = schoolDamage
  return eff
}
