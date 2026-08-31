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
  | 'trait'     // 被动特质触发（反伤/反击/护盾等）
  | 'modifier'  // roguelike 战况播报

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

// ===== 自动战斗：主动功法的触发条件 =====
// 玩家不再手动出招；引擎每回合按「已装备战技」的顺序逐一检查 trigger，
// 取第一个满足条件且冷却已好、内力足够的战技释放，全部不满足则普通攻击。
export type SkillTriggerType =
  | 'always'        // 无条件（冷却与内力允许即放）
  | 'hpBelow'       // 自身气血比例低于 value（0~1）
  | 'hpAbove'       // 自身气血比例高于 value
  | 'mpAbove'       // 自身内力比例高于 value
  | 'enemyHpBelow'  // 对手气血比例低于 value（斩杀线）
  | 'enemyHpAbove'  // 对手气血比例高于 value（开局爆发）
  | 'firstTurn'     // 仅第一回合（起手削弱/上buff）
  | 'everyNTurns'   // 每 value 回合一次
  | 'turnAbove'     // 回合数大于 value（久战不下的底牌）

export interface SkillTrigger {
  type: SkillTriggerType
  value?: number
}

// 被动功法带来的常驻属性加成（并入 getEffectiveAttributes）
export interface PassiveEffects {
  maxHp?: number
  maxMp?: number
  attack?: number
  defense?: number
  agility?: number
  comprehension?: number
  luck?: number
  attackPercent?: number
  defensePercent?: number
  agilityPercent?: number
  maxHpPercent?: number
  maxMpPercent?: number
}

// 被动功法带来的战斗内「特质」（常驻生效，不占回合、不耗内力）
export interface PassiveTraits {
  critRate?: number          // 附加暴击率
  critDamage?: number        // 暴击伤害加成
  damageReduction?: number   // 受伤减免 0~1
  lifesteal?: number         // 吸血比例 0~1
  regenPercent?: number      // 每回合回血比例（基于最大气血）
  mpRegen?: number           // 每回合回内力（定值）
  dodgeBonus?: number        // 附加闪避率
  thorns?: number            // 反伤：受击时按受到伤害比例反弹
  counterRate?: number       // 反击率：受击后有几率立刻还手一次
  firstShield?: number       // 开局护盾（按最大气血比例吸收伤害）
  executeBonus?: number      // 对残血（<30%）对手的额外伤害比例
  extraHitRate?: number      // 连击率：普攻/战技有几率多打一段
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
  heal?: number            // 命中后自我治疗（恢复气血，定值）
  healPercent?: number     // 自我治疗（按最大气血比例，与 heal 叠加；后期疗伤不至于脱节）
  restoreMp?: number       // 自我恢复内力
  lifesteal?: number       // 吸血比例 0~1（按造成伤害吸取气血）
  selfBuff?: SkillBuff     // 自身增益（攻击/防御/身法）
  enemyDebuff?: SkillBuff  // 对对手削弱（攻/防/身法，负值为减）
  stun?: boolean           // 点穴：使对手本回合无法行动
  poison?: number          // 施毒：对手每回合受到的中毒伤害
  poisonTurns?: number     // 中毒持续回合，默认 3
  // —— 自动战斗字段 ——
  trigger?: SkillTrigger      // 自动释放条件（仅 type==='active'）；省略则由引擎按字段推断
  cooldown?: number           // 冷却回合数（仅 active）；省略默认 0（无冷却）
  passiveEffects?: PassiveEffects // 常驻属性加成（仅 type==='passive'）
  passiveTraits?: PassiveTraits   // 常驻战斗特质（仅 type==='passive'）
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
  origin?: string          // 开局出身（见 src/data/origins/origins.json），影响初始属性与资源
  discoveredEnemies?: string[] // 图鉴：已遭遇/已击败的敌人 id 集合（配置不写死，战斗开始时写入）
  discoveredItems?: string[]   // 图鉴：已获得过的物品 id 集合（卖出或消耗后仍保留，由 player.save 统一记录）
  talents?: string[]           // 已顿悟的天赋 id 集合（升级时三选一），塑造 build 多样性（roguelike 要素）
  equippedSkills?: string[]    // 已装备的主动战技 id（最多 MAX_EQUIPPED_SKILLS 个）；自动战斗只会释放已装备的战技
  attributes: CharacterAttributes
  learnedSkills: LearnedSkill[]
  equipment: Equipment
  inventory: InventoryItem[]
  gold: number
}

// ===== 开局出身配置（见 src/data/origins/origins.json，纯配置驱动）=====
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

// ===== 天赋（顿悟）系统（roguelike 要素，纯配置驱动）=====
// 升级时弹出「三选一」，玩家择一永久写入 character.talents，塑造每局 build 差异。
// 效果分两类：属性百分比（融入 getEffectiveAttributes）/ 战斗内修正（注入 BattleCharacter）。
export interface TalentEffect {
  attackPercent?: number           // 攻击 +X%（乘算在有效属性之上）
  defensePercent?: number
  agilityPercent?: number
  comprehensionPercent?: number
  maxHpFlat?: number               // 气血上限 +X（定值，避开百分比带来的血量钳制问题）
  maxMpFlat?: number
  lifesteal?: number               // 吸血比例 0~1（按造成伤害吸取气血）
  critRate?: number                // 暴击率 +X（叠加在技能 critRate 上）
  critDamage?: number              // 暴击伤害加成（基础 1.5 → 1.5 + 此值）
  damageReduction?: number         // 受伤减免 0~1
  regenPercent?: number            // 每回合开始回血比例（基于最大气血）
  schoolDamage?: Partial<Record<SkillCategory, number>> // 指定流派技能伤害 +X
  goldPercent?: number             // 战斗/机缘所得银两 +X
  expPercent?: number              // 战斗所得经验 +X
}

export interface Talent {
  id: string
  name: string
  category: 'attack' | 'defense' | 'agility' | 'wisdom' | 'economy' | 'school' | 'special'
  rarity: ItemRarity               // common/rare/epic/legendary：越稀有权重越低，越难抽到
  description: string
  weight: number                   // 抽取权重（与 rarity 配合：common 权重大、legendary 极小）
  effects: TalentEffect
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
  // 入场时的基础三维快照：增益/削弱一律以此为基准钳制，
  // 防止「化功大法」这类削弱被反复叠加，把属性压到地板导致战斗永远打不完。
  baseAttack?: number
  baseDefense?: number
  baseAgility?: number
  poison?: number
  poisonTurns?: number
  buffs?: ActiveBuff[]
  weaponSchool?: WeaponSchool // 已装备兵器的流派，用于战斗内「兵刃与功法相性」判定
  // —— 天赋（顿悟）带来的战斗内修正（由 getEffectiveTalents 聚合后注入）——
  lifesteal?: number            // 已造成伤害的吸血比例 0~1
  critRateBonus?: number       // 附加暴击率（叠加在技能 critRate 上）
  critDamageBonus?: number     // 暴击伤害加成（基础 1.5 → 1.5 + 此值）
  damageReduction?: number     // 受到伤害减免比例 0~1
  regenPercent?: number        // 每回合开始回复气血比例（基于最大气血）
  schoolDamage?: Partial<Record<SkillCategory, number>> // 各流派技能伤害加成（比例）
  // —— 被动功法特质聚合（passiveTraits 累加后注入）——
  traits?: PassiveTraits
  shield?: number              // 剩余护盾值，优先吸收伤害（由 firstShield / 战况修饰赋予）
  stunned?: boolean            // 被点穴：本回合跳过行动
  // 自动战斗只从「已装备战技」中选招（玩家侧为 character.equippedSkills 的快照）
  equippedSkills?: string[]
  // —— roguelike 战况修饰的最终乘算系数（由 BattleModifier 聚合）——
  damageDealtMult?: number     // 造成伤害倍率，默认 1
  damageTakenMult?: number     // 受到伤害倍率，默认 1
  hitMult?: number             // 命中率倍率，默认 1
  healMult?: number            // 治疗效果倍率，默认 1
  // —— 久战力竭（每回合重算，不累乘）——
  exhaustMult?: number         // 力竭状态下受到伤害的放大倍率，默认 1
  exhaustHealMult?: number     // 力竭状态下疗伤/回复的衰减倍率，默认 1
}

export interface BattleLogEntry {
  turn: number
  actor: BattleActor
  text: string
  type: BattleActionType
}

// ===== roguelike 战况修饰（见 src/data/battleModifiers.json，纯配置驱动）=====
// 每场战斗开局随机抽若干条「战况」，把倍率/护盾/毒等效果分别施加给我方或敌方，
// 使同一只怪的每次交手都不一样（roguelike 要素）。引擎只按字段分发，不写死具体条目。
export interface BattleModifierEffect {
  playerDamageDealtMult?: number
  playerDamageTakenMult?: number
  playerHitMult?: number
  playerHealMult?: number
  playerShieldPercent?: number   // 我方开局护盾（最大气血比例）
  playerRegenPercent?: number
  playerCritRate?: number
  playerLifesteal?: number
  enemyDamageDealtMult?: number
  enemyDamageTakenMult?: number
  enemyHitMult?: number
  enemyShieldPercent?: number
  enemyRegenPercent?: number
  enemyCritRate?: number
  expMult?: number               // 战后经验倍率
  goldMult?: number              // 战后银两倍率
  dropRateMult?: number          // 战后掉落率倍率
}

export interface BattleModifier {
  id: string
  name: string
  description: string
  // 'boon' 有利 / 'bane' 不利 / 'chaos' 双刃（既有利又有弊）
  kind: 'boon' | 'bane' | 'chaos'
  rarity: ItemRarity
  weight: number                 // 抽取权重
  effects: BattleModifierEffect
}

export interface Battle {
  player: BattleCharacter
  enemy: BattleCharacter
  turn: number
  log: BattleLogEntry[]
  state: BattleState
  enemyId: string
  // —— 自动战斗运行时状态 ——
  modifiers?: BattleModifier[]              // 本场战斗抽到的 roguelike 战况
  cooldowns?: Record<string, number>        // 玩家战技剩余冷却（skillId -> 回合）
  enemyCooldowns?: Record<string, number>   // 敌方战技剩余冷却
  rewardMult?: { exp: number; gold: number; drop: number } // 战况带来的战利品倍率
  exhausted?: boolean                       // 是否已播报「久战力竭」（避免每回合重复刷屏）
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
  once?: boolean        // 一次性际遇：触发过一次后从随机池中剔除（用于送绝学/独门武学等不可刷取的机缘）
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
