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
  rarity?: ItemRarity  // 稀有度决定获取难度：common 达标即悟 / rare 需银两 / epic 需秘籍 / legendary 需秘籍+银两
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
  skillId?: string      // 秘籍所载武学（仅 category==='manual' 有意义）：持有该秘籍方可参悟
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

// 怪物大类：与 src/data/enemies 下的拆分配置一一对应（beast/bandit/evil/boss）。
export type EnemyCategory = 'beast' | 'bandit' | 'evil' | 'boss'

export interface Enemy {
  id: string
  name: string
  description: string
  level: number
  attributes: CharacterAttributes
  skills: string[]
  goldReward: number
  drops: Drop[]
  category?: EnemyCategory // 大类，用于图鉴归类与随机遭遇分组
  boss?: boolean            // 是否头目（剧情/强敌，可选）
  counters?: string[]       // 击败后自增的计数器名（配置驱动，取代硬编码判定）
  expReward?: number        // 经验奖励；省略则由升级配置按等级推导（地图推进即经验节奏）
}

export interface Character {
  id: string
  name: string
  title: string
  level: number
  exp: number
  expToNext: number
  freePoints?: number      // 升级获得的自由属性点，可在角色面板自行分配（增强可玩性）
  origin?: string          // 开局出身（见 src/data/origins.json），影响初始属性与资源
  discoveredEnemies?: string[] // 图鉴：已遭遇/已击败的敌人 id 集合（配置不写死，战斗开始时写入）
  attributes: CharacterAttributes
  learnedSkills: LearnedSkill[]
  equipment: Equipment
  inventory: InventoryItem[]
  gold: number
}

// ===== 开局出身配置（见 src/data/origins.json，纯配置驱动）=====
// 出身只影响「起跑线」：初始属性增减、额外初始技能/物品/金钱；
// 后续成长仍由升级系统的自由属性点决定，保证 build 多样性。

export interface OriginConfig {
  id: string
  name: string
  description: string
  // 仅作用于基础属性（maxHp/maxMp/attack/defense/agility/comprehension/luck），
  // 应用后自动把 hp=maxHp、mp=maxMp 同步，避免气血/内力显示异常。
  modifiers: Partial<Record<keyof CharacterAttributes, number>>
  startSkills?: string[]
  startItems?: { itemId: string; quantity: number }[]
  startGold?: number       // 覆盖初始金钱（默认 100），用于「商贾之家」之类开局富裕的出身
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

// ===== 升级系统配置（见 src/data/leveling.json，纯配置驱动）=====
// 升级节奏完全由地图推进决定：怪物等级即经验节奏的杠杆，enemyExp 按等级推导。

export interface LevelingTitle {
  level: number
  title: string
}

export interface LevelingConfig {
  maxLevel: number
  expCurve: { base: number; growth: number }       // 升到下一级所需经验：base * growth^(level-1)
  enemyExp: { base: number; growth: number; bossFactor: number } // 怪物经验：base * growth^(level-1) * (boss?bossFactor:1)
  trainingFraction: number                          // 练功所得 = 本级所需经验 * 此比例
  growthPerLevel: {                                  // 每升一级自动增长的属性
    maxHp: number
    maxMp: number
    attack: number
    defense: number
    agility: number
  }
  freePointsPerLevel: number                         // 每升一级获得的自由属性点（玩家自行分配）
  titles: LevelingTitle[]                            // 按等级授予的称号阈值
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

export type SceneActionType = 'explore' | 'rest' | 'encounter' | 'train' | 'gather'

// 采集类行动的产出项（配置驱动：按 weight 随机取一项，数量在 min~max 间）
export interface SceneGain {
  itemId: string
  min: number
  max: number
  weight?: number
}

export interface SceneAction {
  id: string
  label: string
  type: SceneActionType
  text?: string
  encounters?: string[]          // 限定该行动的遭遇池（省略则用全局池）
  gains?: SceneGain[]            // gather 类行动的产出
  requirement?: DialogueCondition // 行事前置（等级/flag/任务等）
  requireHint?: string            // 未满足前置时的提示文案
}

export interface Scene {
  id: string
  name: string
  description: string
  connections: string[]
  npcs: string[]
  actions: SceneAction[]
  enemyPool?: string[]           // 该地「游走历练」的怪物池（省略则用全部怪物）
  requirement?: DialogueCondition // 进入该地的前置（等级/flag/任务等）
  requireHint?: string            // 未满足前置时的提示文案
  trainFactor?: number           // 该地练功经验倍率（省略为 1）；高等级名胜练功更高效，绑定地图推进
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
