import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Character, EquipSlot, Skill } from '../types'
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
import { getItem, getSkill, getAllItems } from '../engine/data-loader'
import { rollTalentChoices } from '../engine/talents'

const SAVE_KEY = 'jianghu_player'

export const usePlayerStore = defineStore('player', () => {
  const character = ref<Character | null>(null)
  // 升级「顿悟」待选天赋：升级时生成三选一，玩家择一后清空
  const talentOffer = ref<{ options: string[] } | null>(null)

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
    // 升级触发「顿悟」：三选一天赋（一次升级一次抉择，丰富 build 多样性）
    if (result.leveledUp) {
      const owned = character.value.talents ?? []
      const options = rollTalentChoices(3, owned).map(t => t.id)
      if (options.length > 0) talentOffer.value = { options }
    }
    return result
  }

  // 顿悟：选定一个天赋，写入 character.talents 并清空待选
  function chooseTalent(talentId: string) {
    if (!character.value) return
    const char = JSON.parse(JSON.stringify(character.value)) as Character
    char.talents = [...(char.talents ?? []), talentId]
    character.value = char
    talentOffer.value = null
    save()
  }

  // 参悟武学所需银两：按稀有度递增（common 分文不取）
  function learnGoldCost(skill: Skill): number {
    const rarity = skill.rarity ?? 'common'
    if (rarity === 'common') return 0
    if (rarity === 'rare') return 200 + skill.unlockLevel * 50
    if (rarity === 'epic') return 400 + skill.unlockLevel * 80
    return 800 + skill.unlockLevel * 120
  }

  // 参悟武学：按稀有度校验并收取代价
  //   common 达标即悟 / rare 需银两 / epic 需秘籍 / legendary 需秘籍 + 银两（秘籍参悟后消耗）
  function learnNewSkill(skillId: string): { ok: boolean; reason?: string } {
    const char = character.value
    if (!char) return { ok: false, reason: '尚无角色' }
    const skill = getSkill(skillId)
    if (!skill) return { ok: false, reason: '武学不存在' }
    if (char.level < skill.unlockLevel) {
      return { ok: false, reason: '修为不足，需第' + skill.unlockLevel + '重' }
    }
    const rarity = skill.rarity ?? 'common'
    const goldCost = learnGoldCost(skill)
    if (char.gold < goldCost) {
      return { ok: false, reason: '银两不足，需 ' + goldCost + ' 两' }
    }
    if (rarity === 'epic' || rarity === 'legendary') {
      const manual = getAllItems().find(i => i.skillId === skillId)
      if (!manual) return { ok: false, reason: '世间尚无此武学秘籍' }
      const inv = char.inventory.find(i => i.itemId === manual.id)
      if (!inv || inv.quantity < 1) {
        return { ok: false, reason: '需「' + manual.name + '」' }
      }
      inv.quantity -= 1
      if (inv.quantity <= 0) char.inventory = char.inventory.filter(i => i.itemId !== manual.id)
    }
    char.gold -= goldCost
    character.value = engineLearnSkill(char, skillId)
    save()
    return { ok: true }
  }

  // 剧情/任务/际遇「赠送」武学：无条件习得，跳过等级、稀有度、秘籍、银两等一切门槛。
  // 与 learnNewSkill（玩家手动参悟，需满足门槛并付费）区分，避免「说学会了却没学会」。
  function grantSkill(skillId: string): boolean {
    const char = character.value
    if (!char) return false
    const skill = getSkill(skillId)
    if (!skill) return false
    if (char.learnedSkills.some(s => s.skillId === skillId)) return false
    character.value = {
      ...char,
      learnedSkills: [
        ...char.learnedSkills,
        { skillId, level: 1, proficiency: 0, proficiencyToNext: 100 },
      ],
    }
    save()
    return true
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

  // 背包内研读秘籍：参悟其所载武学并消耗该秘籍（common/rare 的秘籍 learnNewSkill 不会自动消耗，此处补扣）
  function studyManual(itemId: string): { ok: boolean; reason?: string; skillName?: string } {
    const char = character.value
    if (!char) return { ok: false, reason: '尚无角色' }
    const item = getAllItems().find(i => i.id === itemId)
    if (!item || item.category !== 'manual' || !item.skillId) {
      return { ok: false, reason: '此物无法参悟' }
    }
    const skill = getSkill(item.skillId)
    const rarity = skill?.rarity ?? 'common'
    const res = learnNewSkill(item.skillId)
    if (!res.ok) return res
    // learnNewSkill 仅对 epic/legendary 自动消耗秘籍，common/rare 的秘籍在此补扣
    if (rarity === 'common' || rarity === 'rare') {
      const inv = char.inventory.find(i => i.itemId === itemId)
      if (inv) {
        inv.quantity -= 1
        if (inv.quantity <= 0) char.inventory = char.inventory.filter(i => i.itemId !== itemId)
        save()
      }
    }
    return { ok: true, skillName: skill?.name ?? item.skillId }
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
      // 图鉴：保存时统一把当前背包与在穿戴备并入「已获得」。
      // 覆盖掉落/购买/任务/采集/NPC 等全部入口，卖出或消耗后记录依然保留。
      const char = character.value
      const discovered = new Set(char.discoveredItems ?? [])
      for (const it of char.inventory) discovered.add(it.itemId)
      const eq = char.equipment
      for (const id of [eq.weapon, eq.armor, eq.accessory]) if (id) discovered.add(id)
      char.discoveredItems = [...discovered]
      localStorage.setItem(SAVE_KEY, JSON.stringify(char))
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
      // 图鉴：兼容旧存档——加载时即把当前背包与在穿戴备并入「已获得」，与 save() 保持一致
      const discovered = new Set(char.discoveredItems ?? [])
      for (const it of char.inventory) discovered.add(it.itemId)
      const eq = char.equipment
      for (const id of [eq.weapon, eq.armor, eq.accessory]) if (id) discovered.add(id)
      char.discoveredItems = [...discovered]
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
    grantSkill,
    learnGoldCost,
    studyManual,
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
    talentOffer,
    chooseTalent,
    hasSave,
    clear,
    getOwnedItemIds,
    hasItem,
    getItemCount,
    removeItem,
  }
})
