import enemiesJson from '../data/enemies.json'
import scenesJson from '../data/scenes.json'
import npcsJson from '../data/npcs.json'
import questsJson from '../data/quests.json'
import encountersJson from '../data/encounters.json'
import type { Skill, Item, Enemy, Scene, NPC, Quest, Encounter, Shop } from '../types'

// 技能与物品按「大类/子类」拆分到独立文件（见 src/data/skills、src/data/items）。
// 这里用 import.meta.glob 将目录下所有 JSON 合并进 Map，对外接口保持不变。
const skillModules = import.meta.glob('../data/skills/**/*.json', { eager: true }) as unknown as Record<string, { default: Skill[] }>
const itemModules = import.meta.glob('../data/items/**/*.json', { eager: true }) as unknown as Record<string, { default: Item[] }>
const shopModules = import.meta.glob('../data/shops/**/*.json', { eager: true }) as unknown as Record<string, { default: Shop[] }>

const skills = new Map<string, Skill>()
const items = new Map<string, Item>()
const enemies = new Map<string, Enemy>()
const scenes = new Map<string, Scene>()
const npcs = new Map<string, NPC>()
const quests = new Map<string, Quest>()
const encounters = new Map<string, Encounter>()
const shops = new Map<string, Shop>()

for (const mod of Object.values(skillModules)) {
  for (const skill of mod.default) {
    skills.set(skill.id, skill)
  }
}

for (const mod of Object.values(itemModules)) {
  for (const item of mod.default) {
    items.set(item.id, item)
  }
}

for (const enemy of enemiesJson as Enemy[]) {
  enemies.set(enemy.id, enemy)
}

for (const scene of scenesJson as Scene[]) {
  scenes.set(scene.id, scene)
}

for (const npc of npcsJson as unknown as NPC[]) {
  npcs.set(npc.id, npc)
}

for (const quest of questsJson as Quest[]) {
  quests.set(quest.id, quest)
}

for (const enc of encountersJson as Encounter[]) {
  encounters.set(enc.id, enc)
}

for (const mod of Object.values(shopModules)) {
  for (const shop of mod.default) {
    shops.set(shop.id, shop)
  }
}

export function getSkill(id: string): Skill | undefined {
  return skills.get(id)
}

export function getItem(id: string): Item | undefined {
  return items.get(id)
}

export function getEnemy(id: string): Enemy | undefined {
  return enemies.get(id)
}

export function getScene(id: string): Scene | undefined {
  return scenes.get(id)
}

export function getNPC(id: string): NPC | undefined {
  return npcs.get(id)
}

export function getNPCByScene(sceneId: string): NPC[] {
  return Array.from(npcs.values()).filter(n => n.sceneId === sceneId)
}

export function getQuest(id: string): Quest | undefined {
  return quests.get(id)
}

export function getAllQuests(): Quest[] {
  return Array.from(quests.values())
}

export function getEncounter(id: string): Encounter | undefined {
  return encounters.get(id)
}

export function getAllEncounters(): Encounter[] {
  return Array.from(encounters.values())
}

export function getAllSkills(): Skill[] {
  return Array.from(skills.values())
}

export function getAllItems(): Item[] {
  return Array.from(items.values())
}

export function getAllEnemies(): Enemy[] {
  return Array.from(enemies.values())
}

export function getShop(id: string): Shop | undefined {
  return shops.get(id)
}

export function getAllShops(): Shop[] {
  return Array.from(shops.values())
}

export function getShopByNpc(npcId: string): Shop | undefined {
  return Array.from(shops.values()).find(s => s.npcId === npcId)
}
