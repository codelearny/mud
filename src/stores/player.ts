import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Character, EquipSlot } from '../types'
import {
  createNewCharacter,
  getEffectiveAttributes,
  gainExp,
  allocateFreePoint,
  learnSkill as engineLearnSkill,
  equipItem as engineEquip,
  unequipItem as engineUnequip,
  useConsumable as engineUseConsumable,
  type AllocatableStat,
} from '../engine/character'
import { expForNextLevel } from '../engine/leveling'
import { getItem } from '../engine/data-loader'

const SAVE_KEY = 'jianghu_player'

export const usePlayerStore = defineStore('player', () => {
  const character = ref<Character | null>(null)

  const effectiveAttrs = computed(() => {
    if (!character.value) return null
    return getEffectiveAttributes(character.value)
  })

  function init(name: string, originId?: string) {
    character.value = createNewCharacter(name, originId)
    save()
  }

  function update(newChar: Character) {
    character.value = newChar
    save()
  }

  function addExp(amount: number) {
    if (!character.value) return { leveledUp: false, newLevel: 0 }
    const result = gainExp(character.value, amount)
    character.value = result.character
    save()
    return result
  }

  function learnNewSkill(skillId: string) {
    if (!character.value) return
    character.value = engineLearnSkill(character.value, skillId)
    save()
  }

  function equip(itemId: string) {
    if (!character.value) return
    character.value = engineEquip(character.value, itemId)
    save()
  }

  function unequip(slot: EquipSlot) {
    if (!character.value) return
    character.value = engineUnequip(character.value, slot)
    save()
  }

  function useItem(itemId: string) {
    if (!character.value) return
    character.value = engineUseConsumable(character.value, itemId)
    save()
  }

  function addToInventory(itemId: string, quantity: number = 1) {
    if (!character.value) return
    const char = JSON.parse(JSON.stringify(character.value)) as Character
    const existing = char.inventory.find(i => i.itemId === itemId)
    if (existing) {
      existing.quantity += quantity
    } else {
      char.inventory.push({ itemId, quantity })
    }
    character.value = char
    save()
  }

  function addGold(amount: number) {
    if (!character.value) return
    const char = JSON.parse(JSON.stringify(character.value)) as Character
    char.gold += amount
    character.value = char
    save()
  }

  function spendGold(amount: number): boolean {
    if (!character.value || character.value.gold < amount) return false
    const char = JSON.parse(JSON.stringify(character.value)) as Character
    char.gold -= amount
    character.value = char
    save()
    return true
  }

  function setHpMp(hp: number, mp: number) {
    if (!character.value) return
    const char = JSON.parse(JSON.stringify(character.value)) as Character
    char.attributes.hp = Math.max(0, Math.min(char.attributes.maxHp, hp))
    char.attributes.mp = Math.max(0, Math.min(char.attributes.maxMp, mp))
    character.value = char
    save()
  }

  function save() {
    if (character.value) {
      localStorage.setItem(SAVE_KEY, JSON.stringify(character.value))
    }
  }

  function load(): boolean {
    const data = localStorage.getItem(SAVE_KEY)
    if (data) {
      const char = JSON.parse(data) as Character
      // 兼容旧存档：补齐自由属性点，并按当前升级配置重算本级所需经验，避免经验条错乱。
      char.freePoints = char.freePoints ?? 0
      char.expToNext = expForNextLevel(char.level)
      char.discoveredEnemies = char.discoveredEnemies ?? []
      character.value = char
      return true
    }
    return false
  }

  // 图鉴：记录已遭遇/已击败的敌人；仅在首次发现时写入并持久化。
  function discoverEnemy(id: string) {
    if (!character.value) return
    const list = character.value.discoveredEnemies ?? []
    if (list.includes(id)) return
    const char = JSON.parse(JSON.stringify(character.value)) as Character
    char.discoveredEnemies = [...list, id]
    character.value = char
    save()
  }

  function allocatePoint(stat: AllocatableStat) {
    if (!character.value) return
    character.value = allocateFreePoint(character.value, stat)
    save()
  }

  function hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null
  }

  function clear() {
    character.value = null
    localStorage.removeItem(SAVE_KEY)
  }

  function getOwnedItemIds(): string[] {
    if (!character.value) return []
    return character.value.inventory.map(i => i.itemId)
  }

  function hasItem(itemId: string, qty: number = 1): boolean {
    if (!character.value) return false
    const inv = character.value.inventory.find(i => i.itemId === itemId)
    return !!inv && inv.quantity >= qty
  }

  function getItemCount(itemId: string): number {
    if (!character.value) return 0
    const inv = character.value.inventory.find(i => i.itemId === itemId)
    return inv ? inv.quantity : 0
  }

  function removeItem(itemId: string, quantity: number) {
    if (!character.value) return
    const char = JSON.parse(JSON.stringify(character.value)) as Character
    const inv = char.inventory.find(i => i.itemId === itemId)
    if (!inv) return
    inv.quantity -= quantity
    if (inv.quantity <= 0) {
      char.inventory = char.inventory.filter(i => i.itemId !== itemId)
    }
    character.value = char
    save()
  }

  return {
    character,
    effectiveAttrs,
    init,
    update,
    discoverEnemy,
    addExp,
    learnNewSkill,
    equip,
    unequip,
    useItem,
    addToInventory,
    addGold,
    spendGold,
    setHpMp,
    save,
    load,
    allocatePoint,
    hasSave,
    clear,
    getOwnedItemIds,
    hasItem,
    getItemCount,
    removeItem,
  }
})
