import type { Skill, Item, Enemy, Scene, NPC, Quest, Encounter, Shop, OriginConfig } from '../types'

// 所有数据表均按「大类/地区」拆分到独立文件（见 src/data 下对应目录）。
// 这里用 import.meta.glob 将目录下所有 JSON 合并进 Map，对外接口保持不变。
const skillModules = import.meta.glob('../data/skills/**/*.json', { eager: true }) as unknown as Record<string, { default: Skill[] }>
const itemModules = import.meta.glob('../data/items/**/*.json', { eager: true }) as unknown as Record<string, { default: Item[] }>
const enemyModules = import.meta.glob('../data/enemies/**/*.json', { eager: true }) as unknown as Record<string, { default: Enemy[] }>
const shopModules = import.meta.glob('../data/shops/**/*.json', { eager: true }) as unknown as Record<string, { default: Shop[] }>
const sceneModules = import.meta.glob('../data/scenes/**/*.json', { eager: true }) as unknown as Record<string, { default: Scene[] }>
const npcModules = import.meta.glob('../data/npcs/**/*.json', { eager: true }) as unknown as Record<string, { default: NPC[] }>
const questModules = import.meta.glob('../data/quests/**/*.json', { eager: true }) as unknown as Record<string, { default: Quest[] }>
const encounterModules = import.meta.glob('../data/encounters/**/*.json', { eager: true }) as unknown as Record<string, { default: Encounter[] }>
const originModules = import.meta.glob('../data/origins/**/*.json', { eager: true }) as unknown as Record<string, { default: OriginConfig[] }>

const skills = new Map<string, Skill>()
const items = new Map<string, Item>()
const enemies = new Map<string, Enemy>()
const scenes = new Map<string, Scene>()
const npcs = new Map<string, NPC>()
const quests = new Map<string, Quest>()
const encounters = new Map<string, Encounter>()
const shops = new Map<string, Shop>()
const origins = new Map<string, OriginConfig>()

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

for (const mod of Object.values(enemyModules)) {
  for (const enemy of mod.default) {
    enemies.set(enemy.id, enemy)
  }
}

for (const mod of Object.values(sceneModules)) {
  for (const scene of mod.default) {
    scenes.set(scene.id, scene)
  }
}

for (const mod of Object.values(npcModules)) {
  for (const npc of mod.default) {
    npcs.set(npc.id, npc)
  }
}

for (const mod of Object.values(questModules)) {
  for (const quest of mod.default) {
    quests.set(quest.id, quest)
  }
}

for (const mod of Object.values(encounterModules)) {
  for (const enc of mod.default) {
    encounters.set(enc.id, enc)
  }
}

for (const mod of Object.values(shopModules)) {
  for (const shop of mod.default) {
    shops.set(shop.id, shop)
  }
}

for (const mod of Object.values(originModules)) {
  for (const origin of mod.default) {
    origins.set(origin.id, origin)
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

export function getOrigin(id: string): OriginConfig | undefined {
  return origins.get(id)
}

export function getOrigins(): OriginConfig[] {
  return Array.from(origins.values())
}
