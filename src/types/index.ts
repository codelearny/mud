export type SkillCategory = 'fist' | 'sword' | 'blade' | 'internal' | 'movement' | 'staff'

export type SkillType = 'active' | 'passive'

export type ItemType = 'weapon' | 'armor' | 'accessory' | 'consumable' | 'material'

export type EffectType = 'hp' | 'mp' | 'attack' | 'defense' | 'agility' | 'cure'

export type EquipSlot = 'weapon' | 'armor' | 'accessory'

export type BattleActionType =
  | 'attack'
  | 'damage'
  | 'dodge'
  | 'crit'
  | 'skill'
  | 'heal'
  | 'info'
  | 'victory'
  | 'defeat'

export type BattleState = 'ongoing' | 'victory' | 'defeat' | 'fled'

export type BattleActor = 'player' | 'enemy'

export interface CharacterAttributes {
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  attack: number
  defense: number
  agility: number
  comprehension: number
  luck: number
}

export interface Skill {
  id: string
  name: string
  description: string
  type: SkillType
  category: SkillCategory
  power: number
  mpCost: number
  hitRate: number
  critRate: number
  unlockLevel: number
}

export interface LearnedSkill {
  skillId: string
  level: number
  proficiency: number
  proficiencyToNext: number
}

export interface ItemEffect {
  type: EffectType
  value: number
}

export interface Item {
  id: string
  name: string
  description: string
  type: ItemType
  category: string
  price: number
  slot?: EquipSlot
  effects?: ItemEffect[]
}

export interface Equipment {
  weapon?: string
  armor?: string
  accessory?: string
}

export interface InventoryItem {
  itemId: string
  quantity: number
}

export interface Drop {
  itemId: string
  rate: number
}

export interface Enemy {
  id: string
  name: string
  description: string
  level: number
  attributes: CharacterAttributes
  skills: string[]
  expReward: number
  goldReward: number
  drops: Drop[]
}

export interface Character {
  id: string
  name: string
  title: string
  level: number
  exp: number
  expToNext: number
  attributes: CharacterAttributes
  learnedSkills: LearnedSkill[]
  equipment: Equipment
  inventory: InventoryItem[]
  gold: number
}

export interface BattleCharacter {
  name: string
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  attack: number
  defense: number
  agility: number
  skills: string[]
  isPlayer: boolean
}

export interface BattleLogEntry {
  turn: number
  actor: BattleActor
  text: string
  type: BattleActionType
}

export interface Battle {
  player: BattleCharacter
  enemy: BattleCharacter
  turn: number
  log: BattleLogEntry[]
  state: BattleState
  enemyId: string
}

export interface SaveData {
  player: Character
  currentScene: string
  flags: Record<string, boolean>
  timestamp: number
}

// ===== 剧情引擎类型 =====

export type DialogueConditionType = 'affinity' | 'flag' | 'level' | 'item' | 'gold' | 'quest' | 'counter'

export interface DialogueCondition {
  type: DialogueConditionType
  target: string
  op: '>=' | '<=' | '==' | '!=' | '>'
  value: number | string | boolean
}

export type DialogueEffectType =
  | 'affinity' | 'flag' | 'item' | 'exp' | 'gold' | 'learn_skill' | 'quest' | 'heal' | 'counter'

export interface DialogueEffect {
  type: DialogueEffectType
  target?: string
  value?: number | string | boolean
}

export interface DialogueChoice {
  text: string
  next: string
  condition?: DialogueCondition
  effects?: DialogueEffect[]
  battle?: string
}

export interface DialogueNode {
  id: string
  speaker?: string
  text: string
  choices?: DialogueChoice[]
  next?: string
  effects?: DialogueEffect[]
}

export interface NPC {
  id: string
  name: string
  title: string
  description: string
  sceneId: string
  startNode: string
  dialogue: Record<string, DialogueNode>
}

export type SceneActionType = 'explore' | 'rest' | 'encounter' | 'train'

export interface SceneAction {
  id: string
  label: string
  type: SceneActionType
  text?: string
}

export interface Scene {
  id: string
  name: string
  description: string
  connections: string[]
  npcs: string[]
  actions: SceneAction[]
}

export interface QuestReward {
  exp: number
  gold: number
  items?: { itemId: string; quantity: number }[]
  skills?: string[]
}

export type QuestStatus = 'available' | 'active' | 'completed'

export interface Quest {
  id: string
  name: string
  description: string
  giver: string
  acceptText: string
  completeCondition: DialogueCondition
  completeFlag?: string
  rewards: QuestReward
}

export interface Encounter {
  id: string
  title: string
  text: string
  condition?: DialogueCondition
  choices: DialogueChoice[]
}
