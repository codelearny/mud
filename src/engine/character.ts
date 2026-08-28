import type { Character, CharacterAttributes, EquipSlot } from '../types'
import { getItem, getSkill } from './data-loader'
import {
  expForNextLevel as configExpForNextLevel,
  growthPerLevel,
  freePointsPerLevel,
  titleForLevel,
  MAX_LEVEL,
} from './leveling'

// 经验曲线改由升级配置驱动（见 src/data/leveling.json），便于整体调参。
export function expForNextLevel(level: number): number {
  return configExpForNextLevel(level)
}

export function createNewCharacter(name: string): Character {
  return {
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
