import type {
  Character, CharacterAttributes, EquipSlot, PassiveEffects, PassiveTraits,
} from '../types'
import { getItem, getSkill, getOrigin } from './data-loader'
import {
  expForNextLevel as configExpForNextLevel,
  growthPerLevel,
  freePointsPerLevel,
  titleForLevel,
  MAX_LEVEL,
} from './leveling'
import { getTalentEffects } from './talents'

// 经验曲线改由升级配置驱动（见 src/data/leveling.json），便于整体调参。
export function expForNextLevel(level: number): number {
  return configExpForNextLevel(level)
}

export function createNewCharacter(name: string, originId?: string): Character {
  const char: Character = {
    id: 'player',
    name,
    title: titleForLevel(1),
    level: 1,
    exp: 0,
    expToNext: expForNextLevel(1),
    freePoints: 0,
    attributes: {
      maxHp: 100,
      hp: 100,
      maxMp: 20,
      mp: 20,
      attack: 10,
      defense: 5,
      agility: 10,
      comprehension: 10,
      luck: 5
    },
    learnedSkills: [
      { skillId: 'basic_fist', level: 1, proficiency: 0, proficiencyToNext: 100 },
      { skillId: 'basic_sword', level: 1, proficiency: 0, proficiencyToNext: 100 }
    ],
    equipment: { weapon: 'wooden_sword' },
    inventory: [
      { itemId: 'cloth_robe', quantity: 1 },
      { itemId: 'medicine_herb', quantity: 3 },
      { itemId: 'minor_heal', quantity: 2 },
      { itemId: 'antidote', quantity: 1 }
    ],
    gold: 100
  }

  const origin = originId ? getOrigin(originId) : undefined
  if (origin) {
    // 应用出身属性增减（仅作用于基础属性，hp/mp 随后同步）
    const mods = origin.modifiers ?? {}
    const attrs = char.attributes as unknown as Record<string, number>
    for (const [key, value] of Object.entries(mods)) {
      if (value && key in char.attributes) {
        attrs[key] += value
      }
    }
    char.attributes.hp = char.attributes.maxHp
    char.attributes.mp = char.attributes.maxMp

    // 额外初始武功（去重，不覆盖已有的 basic_fist/basic_sword）
    for (const sid of origin.startSkills ?? []) {
      if (!char.learnedSkills.find(s => s.skillId === sid)) {
        char.learnedSkills.push({ skillId: sid, level: 1, proficiency: 0, proficiencyToNext: 100 })
      }
    }

    // 额外初始物品（叠加到背包）
    for (const it of origin.startItems ?? []) {
      const existing = char.inventory.find(i => i.itemId === it.itemId)
      if (existing) existing.quantity += it.quantity
      else char.inventory.push({ itemId: it.itemId, quantity: it.quantity })
    }

    // 覆盖初始金钱（如「商贾之家」开局富裕）
    if (origin.startGold != null) char.gold = origin.startGold

    char.origin = origin.id
  }

  return char
}

/**
 * 汇总一组功法中「被动功法」的常驻属性加成。
 * 玩家传已习得功法，敌人传其技能表——双方共用同一套被动规则，避免敌人白带心法。
 */
export function aggregatePassiveEffects(skillIds: string[]): Required<PassiveEffects> {
  const total: Required<PassiveEffects> = {
    maxHp: 0, maxMp: 0, attack: 0, defense: 0, agility: 0, comprehension: 0, luck: 0,
    attackPercent: 0, defensePercent: 0, agilityPercent: 0, maxHpPercent: 0, maxMpPercent: 0,
  }
  for (const id of skillIds) {
    const skill = getSkill(id)
    if (!skill || skill.type !== 'passive') continue
    const e = skill.passiveEffects
    if (!e) continue
    total.maxHp += e.maxHp ?? 0
    total.maxMp += e.maxMp ?? 0
    total.attack += e.attack ?? 0
    total.defense += e.defense ?? 0
    total.agility += e.agility ?? 0
    total.comprehension += e.comprehension ?? 0
    total.luck += e.luck ?? 0
    total.attackPercent += e.attackPercent ?? 0
    total.defensePercent += e.defensePercent ?? 0
    total.agilityPercent += e.agilityPercent ?? 0
    total.maxHpPercent += e.maxHpPercent ?? 0
    total.maxMpPercent += e.maxMpPercent ?? 0
  }
  return total
}

/**
 * 汇总一组功法中「被动功法」的战斗特质（暴击/吸血/反伤/反击/护盾/连击……）。
 * 战斗开始时注入 BattleCharacter.traits，由战斗引擎按字段消费。
 */
export function aggregatePassiveTraits(skillIds: string[]): Required<PassiveTraits> {
  const total: Required<PassiveTraits> = {
    critRate: 0, critDamage: 0, damageReduction: 0, lifesteal: 0, regenPercent: 0,
    mpRegen: 0, dodgeBonus: 0, thorns: 0, counterRate: 0, firstShield: 0,
    executeBonus: 0, extraHitRate: 0,
  }
  for (const id of skillIds) {
    const skill = getSkill(id)
    if (!skill || skill.type !== 'passive') continue
    const t = skill.passiveTraits
    if (!t) continue
    total.critRate += t.critRate ?? 0
    total.critDamage += t.critDamage ?? 0
    total.damageReduction += t.damageReduction ?? 0
    total.lifesteal += t.lifesteal ?? 0
    total.regenPercent += t.regenPercent ?? 0
    total.mpRegen += t.mpRegen ?? 0
    total.dodgeBonus += t.dodgeBonus ?? 0
    total.thorns += t.thorns ?? 0
    total.counterRate += t.counterRate ?? 0
    total.firstShield += t.firstShield ?? 0
    total.executeBonus += t.executeBonus ?? 0
    total.extraHitRate += t.extraHitRate ?? 0
  }
  return total
}

// 玩家侧便捷入口（沿用原有调用点）
export function getPassiveEffects(character: Character): Required<PassiveEffects> {
  return aggregatePassiveEffects(character.learnedSkills.map(ls => ls.skillId))
}

export function getPassiveTraits(character: Character): Required<PassiveTraits> {
  return aggregatePassiveTraits(character.learnedSkills.map(ls => ls.skillId))
}

export function getEffectiveAttributes(character: Character): CharacterAttributes {
  const attrs = { ...character.attributes }

  const slots: EquipSlot[] = ['weapon', 'armor', 'accessory']
  for (const slot of slots) {
    const itemId = character.equipment[slot]
    if (!itemId) continue
    const item = getItem(itemId)
    if (!item?.effects) continue
    for (const effect of item.effects) {
      switch (effect.type) {
        case 'attack': attrs.attack += effect.value; break
        case 'defense': attrs.defense += effect.value; break
        case 'agility': attrs.agility += effect.value; break
        case 'hp': attrs.maxHp += effect.value; break
        case 'mp': attrs.maxMp += effect.value; break
        case 'maxHp': attrs.maxHp += effect.value; break
        case 'maxMp': attrs.maxMp += effect.value; break
        case 'luck': attrs.luck += effect.value; break
        case 'comprehension': attrs.comprehension += effect.value; break
      }
    }
  }

  // 被动功法（内功/轻功）常驻加成：定值先加，百分比后乘
  const pe = getPassiveEffects(character)
  attrs.maxHp += pe.maxHp
  attrs.maxMp += pe.maxMp
  attrs.attack += pe.attack
  attrs.defense += pe.defense
  attrs.agility += pe.agility
  attrs.comprehension += pe.comprehension
  attrs.luck += pe.luck

  // 天赋（顿悟）属性加成：百分比乘算在有效属性之上，气血/内力用定值避免钳制问题。
  const te = getTalentEffects(character)
  if (te.attackPercent) attrs.attack = Math.round(attrs.attack * (1 + te.attackPercent))
  if (te.defensePercent) attrs.defense = Math.round(attrs.defense * (1 + te.defensePercent))
  if (te.agilityPercent) attrs.agility = Math.round(attrs.agility * (1 + te.agilityPercent))
  if (te.comprehensionPercent) attrs.comprehension = Math.round(attrs.comprehension * (1 + te.comprehensionPercent))

  // 被动功法百分比加成（与天赋乘算叠加）
  if (pe.attackPercent) attrs.attack = Math.round(attrs.attack * (1 + pe.attackPercent))
  if (pe.defensePercent) attrs.defense = Math.round(attrs.defense * (1 + pe.defensePercent))
  if (pe.agilityPercent) attrs.agility = Math.round(attrs.agility * (1 + pe.agilityPercent))
  if (pe.maxHpPercent) attrs.maxHp = Math.round(attrs.maxHp * (1 + pe.maxHpPercent))
  if (pe.maxMpPercent) attrs.maxMp = Math.round(attrs.maxMp * (1 + pe.maxMpPercent))

  if (te.maxHpFlat) attrs.maxHp += te.maxHpFlat
  if (te.maxMpFlat) attrs.maxMp += te.maxMpFlat
  // 负向 maxHp 天赋（如「凶悍」）可能使当前气血超出上限，需钳制
  if (attrs.hp > attrs.maxHp) attrs.hp = attrs.maxHp
  if (attrs.mp > attrs.maxMp) attrs.mp = attrs.maxMp

  return attrs
}

export function gainExp(character: Character, amount: number): {
  character: Character
  leveledUp: boolean
  newLevel: number
} {
  const char: Character = JSON.parse(JSON.stringify(character))
  char.exp += amount
  let leveledUp = false
  let newLevel = char.level

  const growth = growthPerLevel()
  const fpp = freePointsPerLevel()

  while (char.exp >= char.expToNext && char.level < MAX_LEVEL) {
    char.exp -= char.expToNext
    char.level++
    newLevel = char.level
    leveledUp = true
    char.expToNext = expForNextLevel(char.level)

    // 每级自动成长的属性（配置驱动）
    char.attributes.maxHp += growth.maxHp
    char.attributes.hp = char.attributes.maxHp
    char.attributes.maxMp += growth.maxMp
    char.attributes.mp = char.attributes.maxMp
    char.attributes.attack += growth.attack
    char.attributes.defense += growth.defense
    char.attributes.agility += growth.agility

    // 自由属性点：交给玩家自行分配，增强_build 多样性与黏性
    char.freePoints = (char.freePoints ?? 0) + fpp
    char.title = titleForLevel(char.level)
  }

  // 封顶后清空溢出经验，避免经验条显示异常
  if (char.level >= MAX_LEVEL) char.exp = 0

  return { character: char, leveledUp, newLevel }
}

// 自由属性点分配：玩家把升级所得的点数加到基础属性上（装备加成在其之上叠加）。
export type AllocatableStat = 'attack' | 'defense' | 'agility' | 'comprehension' | 'luck'

export function allocateFreePoint(character: Character, stat: AllocatableStat): Character {
  if ((character.freePoints ?? 0) <= 0) return character
  const char: Character = JSON.parse(JSON.stringify(character))
  char.attributes[stat] += 1
  char.freePoints = (char.freePoints ?? 0) - 1
  return char
}

export function canLearnSkill(character: Character, skillId: string): boolean {
  const skill = getSkill(skillId)
  if (!skill) return false
  if (character.level < skill.unlockLevel) return false
  if (character.learnedSkills.find(s => s.skillId === skillId)) return false
  return true
}

export function learnSkill(character: Character, skillId: string): Character {
  if (!canLearnSkill(character, skillId)) return character
  const char: Character = JSON.parse(JSON.stringify(character))
  char.learnedSkills.push({
    skillId,
    level: 1,
    proficiency: 0,
    proficiencyToNext: 100
  })
  return char
}

export function equipItem(character: Character, itemId: string): Character {
  const item = getItem(itemId)
  if (!item || !item.slot) return character
  if (item.minLevel && character.level < item.minLevel) return character

  const char: Character = JSON.parse(JSON.stringify(character))

  const current = char.equipment[item.slot]
  if (current) {
    char.inventory.push({ itemId: current, quantity: 1 })
  }

  const invItem = char.inventory.find(i => i.itemId === itemId)
  if (invItem) {
    if (invItem.quantity > 1) {
      invItem.quantity--
    } else {
      char.inventory = char.inventory.filter(i => i.itemId !== itemId)
    }
  }

  char.equipment[item.slot] = itemId
  return char
}

export function unequipItem(character: Character, slot: EquipSlot): Character {
  const char: Character = JSON.parse(JSON.stringify(character))
  const current = char.equipment[slot]
  if (current) {
    char.inventory.push({ itemId: current, quantity: 1 })
    delete char.equipment[slot]
  }
  return char
}

export function useConsumable(character: Character, itemId: string): Character {
  const item = getItem(itemId)
  if (!item || item.type !== 'consumable' || !item.effects) return character

  const char: Character = JSON.parse(JSON.stringify(character))

  for (const effect of item.effects) {
    switch (effect.type) {
      case 'hp':
        char.attributes.hp = Math.min(char.attributes.maxHp, char.attributes.hp + effect.value)
        break
      case 'mp':
        char.attributes.mp = Math.min(char.attributes.maxMp, char.attributes.mp + effect.value)
        break
      case 'maxHp':
        char.attributes.maxHp += effect.value
        char.attributes.hp += effect.value
        break
      case 'maxMp':
        char.attributes.maxMp += effect.value
        char.attributes.mp += effect.value
        break
      case 'attack':
      case 'buffAttack':
        char.attributes.attack += effect.value
        break
      case 'defense':
      case 'buffDefense':
        char.attributes.defense += effect.value
        break
      case 'agility':
      case 'buffAgility':
        char.attributes.agility += effect.value
        break
      case 'luck':
        char.attributes.luck += effect.value
        break
      case 'comprehension':
        char.attributes.comprehension += effect.value
        break
      // cure / revive 仅在战斗内生效，此处忽略
      default:
        break
    }
  }

  const invItem = char.inventory.find(i => i.itemId === itemId)
  if (invItem) {
    if (invItem.quantity > 1) {
      invItem.quantity--
    } else {
      char.inventory = char.inventory.filter(i => i.itemId !== itemId)
    }
  }

  return char
}
