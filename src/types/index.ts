export type SkillCategory = 'fist' | 'sword' | 'blade' | 'internal' | 'movement' | 'staff'

export type SkillType = 'active' | 'passive'

export type ItemType = 'weapon' | 'armor' | 'accessory' | 'consumable' | 'material'

export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary'

// 兵器流派：与技能 category 对应（fist/sword/blade/staff）。
// 'none' 表示无流派（如徒手之外的通用兵器），用于兜底。
export type WeaponSchool = 'none' | 'sword' | 'blade' | 'fist' | 'staff'

// 物品/装备效果类型（全部由 JSON 数据驱动，引擎按 type 分发，绝不写死具体物品）
export type EffectType =
  | 'hp'            // 恢复当前气血
  | 'mp'            // 恢复当前内力
  | 'maxHp'         // 永久提升气血上限
  | 'maxMp'         // 永久提升内力上限
  | 'attack'        // 攻击（装备加成 / 丹药永久提升）
  | 'defense'       // 防御
  | 'agility'       // 轻功
  | 'luck'          // 福缘
  | 'comprehension' // 悟性
  | 'cure'          // 解毒（战斗中清除中毒）
  | 'buffAttack'    // 战斗内临时增益：攻击
  | 'buffDefense'   // 战斗内临时增益：防御
  | 'buffAgility'   // 战斗内临时增益：轻功

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

export interface SkillBuff {
  attack?: number
  defense?: number
  agility?: number
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
  // —— 进阶机制（可选）——
  hits?: number            // 多段攻击次数，默认 1
  heal?: number            // 命中后自我治疗（恢复气血）
  restoreMp?: number       // 自我恢复内力
  lifesteal?: number       // 吸血比例 0~1（按造成伤害吸取气血）
  selfBuff?: SkillBuff     // 自身增益（攻击/防御/身法）
  enemyDebuff?: SkillBuff  // 对对手削弱（攻/防/身法，负值为减）
  stun?: boolean           // 点穴：使对手本回合无法行动
  poison?: number          // 施毒：对手每回合受到的中毒伤害
  poisonTurns?: number     // 中毒持续回合，默认 3
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
  turns?: number      // 仅临时增益类（buff*）使用：持续回合数
}

export interface Item {
  id: string
  name: string
  description: string
  type: ItemType
  category: string
  price: number
  slot?: EquipSlot
  minLevel?: number   // 装备/服用所需最低等级（配置驱动，引擎校验）
  rarity?: ItemRarity // 稀有度，仅用于展示与收集感
  school?: WeaponSchool // 兵器流派（仅 type==='weapon' 有意义）；与技能 category 强关联
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

// 战斗内临时增益（由 buff* 类物品/技能施加，回合开始结算）
export interface ActiveBuff {
  stat: 'attack' | 'defense' | 'agility'
  value: number
  turns: number
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
  poison?: number
  poisonTurns?: number
  buffs?: ActiveBuff[]
  weaponSchool?: WeaponSchool // 已装备兵器的流派，用于战斗内「兵刃与功法相性」判定
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
  shop?: string // 选择此项即打开对应 id 的商铺（见 src/data/shops）
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

// ===== 商铺模块类型 =====
// 商铺完全由配置驱动（见 src/data/shops），引擎只按字段分发，绝不写死具体物品。

export interface ShopItemEntry {
  itemId: string
  price?: number      // 覆盖买入价；省略则取 物品.price * shop.buyFactor
  limit?: number      // 现存/单次最大可购数量；省略表示不限量（每日进货重置）
}

export interface Shop {
  id: string
  name: string
  npcId: string       // 对应 npcs.json 中的掌柜
  description: string
  buyFactor: number   // 买入倍率（默认 1）
  sellFactor: number  // 卖出倍率（默认 0.5）
  stock: ShopItemEntry[]
}
