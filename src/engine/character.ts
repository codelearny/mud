import type { Character, CharacterAttributes, EquipSlot } from '../types'
import { getItem, getSkill } from './data-loader'

export function expForNextLevel(level: number): number {
  return level * 50 + (level - 1) * (level - 1) * 10
}

export function createNewCharacter(name: string): Character {
  return {
    id: 'player',
    name,
    title: '江湖小虾米',
    level: 1,
    exp: 0,
    expToNext: expForNextLevel(1),
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
    equipment: {},
    inventory: [
      { itemId: 'wooden_sword', quantity: 1 },
      { itemId: 'cloth_robe', quantity: 1 },
      { itemId: 'medicine_herb', quantity: 3 }
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

  while (char.exp >= char.expToNext) {
    char.exp -= char.expToNext
    char.level++
    newLevel = char.level
    leveledUp = true
    char.expToNext = expForNextLevel(char.level)

    char.attributes.maxHp += 20
    char.attributes.hp = char.attributes.maxHp
    char.attributes.maxMp += 8
    char.attributes.mp = char.attributes.maxMp
    char.attributes.attack += 3
    char.attributes.defense += 2
    char.attributes.agility += 1
  }

  return { character: char, leveledUp, newLevel }
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
      case 'attack':
        char.attributes.attack += effect.value
        break
      case 'defense':
        char.attributes.defense += effect.value
        break
      case 'agility':
        char.attributes.agility += effect.value
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
