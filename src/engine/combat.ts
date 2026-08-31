import type {
  Battle, BattleCharacter, Character, Skill, ActiveBuff, WeaponSchool,
  BattleModifier, PassiveTraits, SkillTrigger,
} from '../types'
import { getEnemy, getSkill, getItem, getAllBattleModifiers } from './data-loader'
import {
  getEffectiveAttributes, getPassiveTraits,
  aggregatePassiveEffects, aggregatePassiveTraits,
} from './character'
import { getTalentEffects } from './talents'
import { chance, randomInt } from './random'
import {
  WEAPON_SCHOOL_LABELS,
  WEAPON_SKILL_CATS,
  WEAPON_AFFINITY_MATCH,
  WEAPON_AFFINITY_MISMATCH,
  weaponSchoolMatches,
  inferTrigger,
} from './skill-utils'
import { enemyExpFromLevel } from './leveling'

// 兵刃与功法相性倍率改由 skill-utils 统一导出（WEAPON_AFFINITY_*），此处不再硬编码。

// ===== roguelike：战况抽取 =====
// 每场战斗开局随机抽 1~2 条战况，先定「有利/不利/双刃」再在该类中按权重取具体条目，
// 避免连抽到同类导致的极端局面；头目战多一些「有利」以对冲其本身强度。
const KIND_WEIGHTS_NORMAL: Record<BattleModifier['kind'], number> = { boon: 40, bane: 40, chaos: 20 }
const KIND_WEIGHTS_BOSS: Record<BattleModifier['kind'], number> = { boon: 45, bane: 30, chaos: 25 }

// ===== 头目战的耐久基线 =====
// 只在引擎层集中调，新增头目只需标 boss:true 即可自动享有，无需逐条配数值。
const BOSS_HP_MULT = 1.7
const BOSS_DAMAGE_REDUCTION = 0.08
const BOSS_ATTACK_MULT = 1.12     // 头目不只是「肉」，还得打得疼，否则拉锯变成安全的磨血

function weightedPick<T>(list: T[], weightOf: (t: T) => number): T | undefined {
  if (list.length === 0) return undefined
  const total = list.reduce((s, t) => s + Math.max(0, weightOf(t)), 0)
  if (total <= 0) return list[randomInt(0, list.length - 1)]
  let r = Math.random() * total
  for (const t of list) {
    r -= Math.max(0, weightOf(t))
    if (r <= 0) return t
  }
  return list[list.length - 1]
}

export function rollBattleModifiers(isBoss: boolean): BattleModifier[] {
  const all = getAllBattleModifiers()
  if (all.length === 0) return []
  const kinds = Object.keys(isBoss ? KIND_WEIGHTS_BOSS : KIND_WEIGHTS_NORMAL) as BattleModifier['kind'][]
  const kindWeights = isBoss ? KIND_WEIGHTS_BOSS : KIND_WEIGHTS_NORMAL
  const count = isBoss ? 2 : (chance(0.5) ? 2 : 1)

  const picks: BattleModifier[] = []
  for (let i = 0; i < count; i++) {
    const kind = weightedPick(kinds, k => kindWeights[k])
    if (!kind) break
    const pool = all.filter(m => m.kind === kind && !picks.some(p => p.id === m.id))
    const fallback = all.filter(m => !picks.some(p => p.id === m.id))
    const picked = weightedPick(pool.length > 0 ? pool : fallback, m => m.weight ?? 1)
    if (picked) picks.push(picked)
  }
  return picks
}

// 把战况效果分发到双方 BattleCharacter 与战利品倍率上（引擎只认字段，不认具体条目）
function applyModifiers(b: Battle, mods: BattleModifier[]) {
  const reward = { exp: 1, gold: 1, drop: 1 }
  const addTrait = (bc: BattleCharacter, patch: Partial<PassiveTraits>) => {
    bc.traits = { ...(bc.traits ?? {}), ...patch } as PassiveTraits
  }
  const mul = (cur: number | undefined, v: number) => (cur ?? 1) * v

  for (const m of mods) {
    const e = m.effects
    if (e.playerDamageDealtMult) b.player.damageDealtMult = mul(b.player.damageDealtMult, e.playerDamageDealtMult)
    if (e.playerDamageTakenMult) b.player.damageTakenMult = mul(b.player.damageTakenMult, e.playerDamageTakenMult)
    if (e.playerHitMult) b.player.hitMult = mul(b.player.hitMult, e.playerHitMult)
    if (e.playerHealMult) b.player.healMult = mul(b.player.healMult, e.playerHealMult)
    if (e.playerShieldPercent) b.player.shield = (b.player.shield ?? 0) + Math.round(b.player.maxHp * e.playerShieldPercent)
    if (e.playerRegenPercent) addTrait(b.player, { regenPercent: (b.player.traits?.regenPercent ?? 0) + e.playerRegenPercent })
    if (e.playerCritRate) addTrait(b.player, { critRate: (b.player.traits?.critRate ?? 0) + e.playerCritRate })
    if (e.playerLifesteal) addTrait(b.player, { lifesteal: (b.player.traits?.lifesteal ?? 0) + e.playerLifesteal })

    if (e.enemyDamageDealtMult) b.enemy.damageDealtMult = mul(b.enemy.damageDealtMult, e.enemyDamageDealtMult)
    if (e.enemyDamageTakenMult) b.enemy.damageTakenMult = mul(b.enemy.damageTakenMult, e.enemyDamageTakenMult)
    if (e.enemyHitMult) b.enemy.hitMult = mul(b.enemy.hitMult, e.enemyHitMult)
    if (e.enemyShieldPercent) b.enemy.shield = (b.enemy.shield ?? 0) + Math.round(b.enemy.maxHp * e.enemyShieldPercent)
    if (e.enemyRegenPercent) addTrait(b.enemy, { regenPercent: (b.enemy.traits?.regenPercent ?? 0) + e.enemyRegenPercent })
    if (e.enemyCritRate) addTrait(b.enemy, { critRate: (b.enemy.traits?.critRate ?? 0) + e.enemyCritRate })

    if (e.expMult) reward.exp *= e.expMult
    if (e.goldMult) reward.gold *= e.goldMult
    if (e.dropRateMult) reward.drop *= e.dropRateMult
  }
  b.rewardMult = reward
}

export function startBattle(player: Character, enemyId: string): Battle {
  const enemy = getEnemy(enemyId)
  if (!enemy) throw new Error(`Enemy ${enemyId} not found`)

  const eff = getEffectiveAttributes(player)

  // 已装备兵器的流派，用于战斗内「兵刃与功法相性」判定
  const equippedWeapon = player.equipment.weapon ? getItem(player.equipment.weapon) : undefined
  const weaponSchool: WeaponSchool | undefined = equippedWeapon?.school

  // 天赋（顿悟）与被动功法的战斗内特质：合并后注入 BattleCharacter.traits
  const teff = getTalentEffects(player)
  const ptr = getPassiveTraits(player)
  const traits: PassiveTraits = {
    critRate: (teff.critRate ?? 0) + ptr.critRate,
    critDamage: (teff.critDamage ?? 0) + ptr.critDamage,
    damageReduction: (teff.damageReduction ?? 0) + ptr.damageReduction,
    lifesteal: (teff.lifesteal ?? 0) + ptr.lifesteal,
    regenPercent: (teff.regenPercent ?? 0) + ptr.regenPercent,
    mpRegen: ptr.mpRegen,
    dodgeBonus: ptr.dodgeBonus,
    thorns: ptr.thorns,
    counterRate: ptr.counterRate,
    firstShield: ptr.firstShield,
    executeBonus: ptr.executeBonus,
    extraHitRate: ptr.extraHitRate,
  }

  // 自动战斗只会释放「已装备」的主动战技；未装备任何战技时退化为全程普通攻击
  const equipped = (player.equippedSkills ?? [])
    .filter(id => getSkill(id)?.type === 'active')
    .slice(0, 3)

  const playerBC: BattleCharacter = {
    name: player.name,
    hp: eff.hp,
    maxHp: eff.maxHp,
    mp: eff.mp,
    maxMp: eff.maxMp,
    attack: eff.attack,
    defense: eff.defense,
    agility: eff.agility,
    baseAttack: eff.attack,
    baseDefense: eff.defense,
    baseAgility: eff.agility,
    skills: player.learnedSkills.map(s => s.skillId),
    equippedSkills: equipped,
    isPlayer: true,
    buffs: [],
    weaponSchool,
    traits,
    shield: Math.round(eff.maxHp * (traits.firstShield ?? 0)),
    schoolDamage: teff.schoolDamage,
    // 兼容旧字段（供 UI / 存档读取，引擎一律读 traits）
    lifesteal: traits.lifesteal,
    critRateBonus: traits.critRate,
    critDamageBonus: traits.critDamage,
    damageReduction: traits.damageReduction,
    regenPercent: traits.regenPercent,
  }

  // 头目（boss）统一的「耐久与压迫」：数据层只需标 boss:true，
  // 头目战便自然拉成一场拉锯——否则头目血量虽高，也架不住成长后的玩家三两招打完，
  // 回合制的来回博弈与战况变数都体现不出来。
  const bossHpMult = enemy.boss ? BOSS_HP_MULT : 1
  const bossReduction = enemy.boss ? BOSS_DAMAGE_REDUCTION : 0

  // 敌人技能表里也可能配着被动心法（如血魔的九阴真经、青云步）。
  // 这些心法本不该被「施展」，而应常驻生效——聚合为属性加成与战斗特质。
  const enemyPassiveEff = aggregatePassiveEffects(enemy.skills)
  const enemyTraits = aggregatePassiveTraits(enemy.skills)
  if (bossReduction > 0) {
    enemyTraits.damageReduction = (enemyTraits.damageReduction ?? 0) + bossReduction
  }
  const enemyMaxHp = Math.round(
    (enemy.attributes.maxHp + enemyPassiveEff.maxHp) * (1 + enemyPassiveEff.maxHpPercent) * bossHpMult
  )
  const enemyMaxMp = Math.round(
    (enemy.attributes.maxMp + enemyPassiveEff.maxMp) * (1 + enemyPassiveEff.maxMpPercent)
  )
  const enemyAtk = Math.round(
    (enemy.attributes.attack + enemyPassiveEff.attack) * (1 + enemyPassiveEff.attackPercent)
    * (enemy.boss ? BOSS_ATTACK_MULT : 1)
  )
  const enemyDef = Math.round(
    (enemy.attributes.defense + enemyPassiveEff.defense) * (1 + enemyPassiveEff.defensePercent)
  )
  const enemyAgi = Math.round(
    (enemy.attributes.agility + enemyPassiveEff.agility) * (1 + enemyPassiveEff.agilityPercent)
  )

  const enemyBC: BattleCharacter = {
    name: enemy.name,
    hp: enemyMaxHp,
    maxHp: enemyMaxHp,
    mp: enemyMaxMp,
    maxMp: enemyMaxMp,
    attack: enemyAtk,
    defense: enemyDef,
    agility: enemyAgi,
    baseAttack: enemyAtk,
    baseDefense: enemyDef,
    baseAgility: enemyAgi,
    skills: enemy.skills,
    isPlayer: false,
    traits: enemyTraits,
    shield: Math.round(enemyMaxHp * (enemyTraits.firstShield ?? 0)),
  }

  const log: Battle['log'] = [{
    turn: 0,
    actor: 'player',
    text: `${enemy.name}出现了！${enemy.description}`,
    type: 'info' as const,
  }]

  const battle: Battle = {
    player: playerBC,
    enemy: enemyBC,
    turn: 1,
    log,
    state: 'ongoing' as const,
    enemyId,
    cooldowns: {},
    enemyCooldowns: {},
  }

  // roguelike 战况：开局抽取并立即生效，同时播报给玩家
  const mods = rollBattleModifiers(!!enemy.boss)
  battle.modifiers = mods
  applyModifiers(battle, mods)
  for (const m of mods) {
    log.push({ turn: 0, actor: 'player', text: `【${m.name}】${m.description}`, type: 'modifier' as const })
  }
  if (playerBC.shield && playerBC.shield > 0) {
    log.push({ turn: 0, actor: 'player', text: `护体真气流转，可挡${playerBC.shield}点伤害。`, type: 'trait' as const })
  }

  return battle
}

// ===== 伤害结算 =====
// 伤害曲线参数：baseDamage = attack × (BASE_DAMAGE_RATIO + power / POWER_DIVISOR)
// 调大 BASE_DAMAGE_RATIO → 普攻更强、战斗更快；调大 POWER_DIVISOR → 技能与普攻差距收窄。
const BASE_DAMAGE_RATIO = 0.6
const POWER_DIVISOR = 50

function calculateDamage(
  attacker: BattleCharacter,
  defender: BattleCharacter,
  skill: Skill | undefined
): { damage: number; crit: boolean; dodged: boolean } {
  const at = attacker.traits ?? {}
  const dt = defender.traits ?? {}

  const dodgeBase = Math.max(
    0,
    (defender.agility - attacker.agility) / (defender.agility + attacker.agility) * 0.4
  )
  const dodgeChance = dodgeBase + (dt.dodgeBonus ?? 0)
  const hitRate = ((skill?.hitRate ?? 0.9) - dodgeChance) * (attacker.hitMult ?? 1)

  if (!chance(hitRate)) {
    return { damage: 0, crit: false, dodged: true }
  }

  // ===== 伤害曲线 =====
  // 旧式 attack × power / 10 让技能伤害是普攻的 6~10 倍，一招即可秒杀，
  // 战斗平均一两合就结束——回合制的来回博弈与 roguelike 战况全都来不及体现。
  // 改为「基准 + 威力增幅」的平缓曲线：普攻约 attack×0.7，绝学约 attack×1.7，
  // 技能仍明显强于普攻（约 1.7~2.4 倍），但不再是一击定胜负。
  const skillPower = skill?.power ?? 5
  let baseDamage = attacker.attack * (BASE_DAMAGE_RATIO + skillPower / POWER_DIVISOR) + randomInt(1, 5)
  baseDamage *= attacker.damageDealtMult ?? 1

  // 残血斩杀：对手气血不足三成时追加伤害
  if (at.executeBonus && defender.hp / defender.maxHp < 0.3) {
    baseDamage *= 1 + at.executeBonus
  }

  const reduction = dt.damageReduction ?? 0
  let damage = Math.max(1, Math.round(
    (baseDamage - defender.defense * 0.3) * (1 - reduction)
    * (defender.damageTakenMult ?? 1) * (defender.exhaustMult ?? 1)
  ))

  const critRate = (skill?.critRate ?? 0.05) + (at.critRate ?? 0)
  const crit = chance(critRate)
  const critMult = 1.5 + (at.critDamage ?? 0)
  damage = crit ? Math.round(damage * critMult) : damage

  return { damage, crit, dodged: false }
}

// 落地伤害：先扣护盾，再扣气血；反伤特质在受击时立刻反弹（不递归触发反击）
function applyDamage(
  attacker: BattleCharacter,
  defender: BattleCharacter,
  raw: number
): { dealt: number; killed: boolean; parts: string[] } {
  const parts: string[] = []
  let dmg = Math.max(0, Math.round(raw))

  if (defender.shield && defender.shield > 0) {
    const absorbed = Math.min(defender.shield, dmg)
    defender.shield -= absorbed
    dmg -= absorbed
    parts.push(`护体真气化解${absorbed}`)
  }
  if (dmg > 0) {
    defender.hp = Math.max(0, defender.hp - dmg)
  }

  // 反伤：受击方按受到伤害比例反弹，可致死
  const thorns = defender.traits?.thorns ?? 0
  if (thorns > 0 && raw > 0 && attacker.hp > 0) {
    const back = Math.max(1, Math.round(raw * thorns))
    attacker.hp = Math.max(0, attacker.hp - back)
    parts.push(`反震${back}`)
  }

  return { dealt: dmg, killed: defender.hp <= 0, parts }
}

// 连击：普攻/战技命中后，按 extraHitRate 追加一段（不再次触发连击）
function strike(
  attacker: BattleCharacter,
  defender: BattleCharacter,
  skill: Skill | undefined
): { total: number; dead: boolean; parts: string[] } {
  const hits = Math.max(1, skill?.hits ?? 1)
  const at = attacker.traits ?? {}
  let total = 0
  let dead = false
  const parts: string[] = []

  for (let i = 0; i < hits; i++) {
    const { damage, crit, dodged } = calculateDamage(attacker, defender, skill)
    if (dodged) {
      parts.push(hits > 1 ? `第${i + 1}击被闪开` : '被闪开')
      continue
    }
    const res = applyDamage(attacker, defender, damage)
    total += res.dealt
    parts.push(hits > 1 ? `第${i + 1}击${res.dealt}伤害${crit ? '（暴击）' : ''}` : `造成${res.dealt}伤害${crit ? '（暴击）' : ''}`)
    if (res.killed) { dead = true; break }
  }

  // 连击（被动特质）
  if (!dead && at.extraHitRate && chance(at.extraHitRate)) {
    const { damage, crit, dodged } = calculateDamage(attacker, defender, skill)
    if (!dodged) {
      const res = applyDamage(attacker, defender, damage)
      total += res.dealt
      parts.push(`顺势再补一记${res.dealt}伤害${crit ? '（暴击）' : ''}`)
      if (res.killed) dead = true
    }
  }

  // 吸血：技能吸血与特质吸血叠加，按总伤害比例回复
  if (total > 0) {
    const lifesteal = (skill?.lifesteal ?? 0) + (at.lifesteal ?? 0)
    if (lifesteal > 0) {
      const healed = Math.floor(
        total * lifesteal * (attacker.healMult ?? 1) * (attacker.exhaustHealMult ?? 1)
      )
      if (healed > 0 && attacker.hp > 0) {
        const before = attacker.hp
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + healed)
        parts.push(`吸取${attacker.hp - before}点气血`)
      }
    }
  }

  return { total, dead, parts }
}

// 受击后的反击（被动特质 counterRate）：立即还手一段，不再触发反伤/连击，避免连锁
function tryCounter(
  b: Battle,
  attacker: BattleCharacter,
  defender: BattleCharacter,
  turn: number
): boolean {
  const rate = defender.traits?.counterRate ?? 0
  if (rate <= 0 || defender.hp <= 0 || attacker.hp <= 0) return false
  if (!chance(rate)) return false

  const { damage, crit, dodged } = calculateDamage(defender, attacker, undefined)
  if (dodged) {
    b.log.push({
      turn, actor: defender.isPlayer ? 'player' : 'enemy',
      text: `${defender.name}觑准破绽还手，却被${attacker.name}闪了开去。`,
      type: 'dodge' as const,
    })
    return true
  }
  const res = applyDamage(defender, attacker, damage)
  b.log.push({
    turn, actor: defender.isPlayer ? 'player' : 'enemy',
    text: `${defender.name}借势反击，命中${attacker.name}，造成${res.dealt}伤害${crit ? '（暴击）' : ''}！`,
    type: crit ? 'crit' as const : 'attack' as const,
  })
  if (res.killed) settleDeath(b, defender, attacker, turn)
  return true
}

// 单段攻击（含反击的封装），返回是否致死
function attackOnce(
  b: Battle,
  attacker: BattleCharacter,
  defender: BattleCharacter,
  skill: Skill | undefined,
  turn: number,
  label: string
): boolean {
  const res = strike(attacker, defender, skill)
  b.log.push({
    turn,
    actor: attacker.isPlayer ? 'player' : 'enemy',
    text: `${attacker.name}${label}：${res.parts.join('；')}。`,
    type: res.parts.some(p => p.includes('暴击')) ? 'crit' as const : 'attack' as const,
  })
  if (res.dead) {
    settleDeath(b, attacker, defender, turn)
    return true
  }
  if (res.total > 0) tryCounter(b, attacker, defender, turn)
  return b.state !== 'ongoing'
}

// 分出胜负：写阵亡日志并置状态
function settleDeath(b: Battle, winner: BattleCharacter, loser: BattleCharacter, turn: number) {
  loser.hp = 0
  if (loser.isPlayer) {
    b.state = 'defeat'
    b.log.push({ turn, actor: 'enemy', text: `${winner.name}得势不饶人，你眼前一黑，倒下了……`, type: 'defeat' as const })
  } else {
    b.state = 'victory'
    b.log.push({ turn, actor: 'player', text: `${loser.name}气绝倒地！你赢了！`, type: 'victory' as const })
  }
}

// ===== 属性增减的钳制 =====
// 削弱/增益一律以「入场基础值」为基准夹在 [40%, 250%] 之间。
// 若不设下限，敌人反复施展化功大法这类削弱就能把玩家攻击压到最低值，
// 双方谁也打不死谁 → 全自动战斗陷入死循环（玩家无法手动干预，等同卡关）。
const STAT_FLOOR_RATIO = 0.4
const STAT_CEIL_RATIO = 2.5

type AdjustableStat = 'attack' | 'defense' | 'agility'

function baseOf(bc: BattleCharacter, stat: AdjustableStat): number {
  const snapshot =
    stat === 'attack' ? bc.baseAttack : stat === 'defense' ? bc.baseDefense : bc.baseAgility
  return snapshot ?? bc[stat]
}

// 返回「实际生效的增减量」，便于日志如实反映（被钳制时不再谎报数字）
function adjustStat(bc: BattleCharacter, stat: AdjustableStat, delta: number): number {
  const base = baseOf(bc, stat)
  const hardMin = stat === 'defense' ? 0 : 1
  const floor = Math.max(hardMin, Math.round(base * STAT_FLOOR_RATIO))
  const ceil = Math.max(floor, Math.round(base * STAT_CEIL_RATIO))
  const before = bc[stat]
  bc[stat] = Math.min(ceil, Math.max(floor, before + delta))
  return bc[stat] - before
}

// ===== 支持类效果 =====
function applySupportEffects(
  b: Battle,
  self: BattleCharacter,
  opponent: BattleCharacter,
  skill: Skill,
  turn: number,
  logParts: string[]
) {
  if (skill.restoreMp) {
    const before = self.mp
    self.mp = Math.min(self.maxMp, self.mp + skill.restoreMp)
    logParts.push(`恢复${self.mp - before}内力`)
  }
  if (skill.heal || skill.healPercent) {
    const flat = skill.heal ?? 0
    const pct = Math.round(self.maxHp * (skill.healPercent ?? 0))
    const raw = flat + pct
    const healed = Math.round(raw * (self.healMult ?? 1) * (self.exhaustHealMult ?? 1))
    const before = self.hp
    self.hp = Math.min(self.maxHp, self.hp + healed)
    if (self.hp - before > 0) logParts.push(`恢复${self.hp - before}气血`)
  }
  if (skill.selfBuff) {
    const sb = skill.selfBuff
    const bits: string[] = []
    for (const stat of ['attack', 'defense', 'agility'] as AdjustableStat[]) {
      const want = sb[stat]
      if (!want) continue
      const got = adjustStat(self, stat, want)
      if (got !== 0) {
        const label = stat === 'attack' ? '攻' : stat === 'defense' ? '防' : '身法'
        bits.push(`${label}+${got}`)
      }
    }
    if (bits.length) logParts.push(`自身${bits.join('')}`)
    else logParts.push('增益已至极限')
  }
  if (skill.enemyDebuff) {
    const ed = skill.enemyDebuff
    const bits: string[] = []
    for (const stat of ['attack', 'defense', 'agility'] as AdjustableStat[]) {
      const want = ed[stat]
      if (!want) continue
      const got = adjustStat(opponent, stat, want)
      if (got !== 0) {
        const label = stat === 'attack' ? '攻' : stat === 'defense' ? '防' : '身法'
        bits.push(`${label}${got}`)
      }
    }
    if (bits.length) logParts.push(`对手${bits.join('')}`)
    else logParts.push('对手功体已衰至极，无从再削')
  }
  if (skill.poison) {
    const turns = skill.poisonTurns ?? 3
    opponent.poison = (opponent.poison ?? 0) + skill.poison
    opponent.poisonTurns = (opponent.poisonTurns ?? 0) + turns
    logParts.push(`施毒（每回合${skill.poison}伤，持续${turns}回合）`)
  }
  if (skill.stun) {
    opponent.stunned = true
    logParts.push('封住穴道')
  }
}

// ===== 自动选招 =====
export function triggerMet(trigger: SkillTrigger, self: BattleCharacter, foe: BattleCharacter, turn: number): boolean {
  const selfHp = self.maxHp > 0 ? self.hp / self.maxHp : 0
  const selfMp = self.maxMp > 0 ? self.mp / self.maxMp : 0
  const foeHp = foe.maxHp > 0 ? foe.hp / foe.maxHp : 0
  switch (trigger.type) {
    case 'hpBelow': return selfHp < (trigger.value ?? 1)
    case 'hpAbove': return selfHp > (trigger.value ?? 0)
    case 'mpAbove': return selfMp > (trigger.value ?? 0)
    case 'enemyHpBelow': return foeHp < (trigger.value ?? 1)
    case 'enemyHpAbove': return foeHp > (trigger.value ?? 0)
    case 'firstTurn': return turn <= 1
    case 'everyNTurns': {
      const n = Math.max(1, Math.round(trigger.value ?? 2))
      return turn % n === 1
    }
    case 'turnAbove': return turn > (trigger.value ?? 0)
    case 'always':
    default: return true
  }
}

// 玩家侧：按已装备战技的顺序，取第一个「条件满足 + 冷却已好 + 内力足够」的招式；全不满足则普通攻击
export function pickPlayerSkill(b: Battle): Skill | undefined {
  const ids = b.player.equippedSkills ?? []
  for (const id of ids) {
    const sk = getSkill(id)
    if (!sk || sk.type !== 'active') continue
    if ((b.cooldowns?.[id] ?? 0) > 0) continue
    if (b.player.mp < sk.mpCost) continue
    if (!triggerMet(inferTrigger(sk), b.player, b.enemy, b.turn)) continue
    return sk
  }
  return undefined
}

// 敌方侧：只从「主动」功法里挑（被动心法已在入场时算作常驻加成，不该被施展），
// 且同样受触发条件约束——否则像化功大法这种「开局削弱」会被每冷却好一次就重复施放。
function pickEnemySkill(b: Battle): Skill | undefined {
  const usable = b.enemy.skills
    .map(id => getSkill(id))
    .filter((sk): sk is Skill =>
      !!sk &&
      sk.type === 'active' &&
      sk.mpCost <= b.enemy.mp &&
      (b.enemyCooldowns?.[sk.id] ?? 0) <= 0 &&
      triggerMet(inferTrigger(sk), b.enemy, b.player, b.turn)
    )
  if (usable.length === 0 || !chance(0.6)) return undefined
  return usable[randomInt(0, usable.length - 1)]
}

// 施展一招（攻防 + 支持效果 + 冷却）
function castSkill(
  b: Battle,
  self: BattleCharacter,
  foe: BattleCharacter,
  skill: Skill,
  turn: number
) {
  self.mp = Math.max(0, self.mp - skill.mpCost)
  const cd = Math.max(0, Math.round(skill.cooldown ?? 0))
  if (cd > 0) {
    const map = self.isPlayer ? (b.cooldowns ??= {}) : (b.enemyCooldowns ??= {})
    map[skill.id] = cd + 1 // +1 抵消本回合结束时的统一递减
  }

  const logParts: string[] = []
  let effSkill = skill

  // —— 兵刃与功法相性（玩家侧，敌人无兵器概念）——
  if (self.isPlayer && WEAPON_SKILL_CATS.includes(skill.category)) {
    const matched = weaponSchoolMatches(self.weaponSchool, skill)
    let schoolMult = 1
    if (matched) {
      schoolMult = WEAPON_AFFINITY_MATCH
    } else {
      schoolMult = WEAPON_AFFINITY_MISMATCH
      const need = WEAPON_SCHOOL_LABELS[skill.category as WeaponSchool]
      const have = self.weaponSchool ? WEAPON_SCHOOL_LABELS[self.weaponSchool] : '空手'
      b.log.push({
        turn, actor: 'player',
        text: `手中${have}难展${need}法，招法威力大减！`,
        type: 'info' as const,
      })
    }
    const talentMult = 1 + (self.schoolDamage?.[skill.category] ?? 0)
    effSkill = { ...skill, power: Math.max(0, Math.round(skill.power * schoolMult * talentMult)) }
  }

  if (effSkill.power > 0) {
    const label = `施展${skill.name}`
    const res = strike(self, foe, effSkill)
    logParts.push(...res.parts)
    if (res.dead) {
      b.log.push({
        turn, actor: self.isPlayer ? 'player' : 'enemy',
        text: `${self.name}施展${skill.name}：${logParts.join('；')}。`,
        type: logParts.some(p => p.includes('暴击')) ? 'crit' as const : 'skill' as const,
      })
      settleDeath(b, self, foe, turn)
      return
    }
    // 支持效果（部分招式既有伤害又带削弱/吸血）
    applySupportEffects(b, self, foe, skill, turn, logParts)
    b.log.push({
      turn, actor: self.isPlayer ? 'player' : 'enemy',
      text: `${self.name}施展${skill.name}：${logParts.join('；')}。`,
      type: logParts.some(p => p.includes('暴击')) ? 'crit' as const : 'skill' as const,
    })
    if (res.total > 0) tryCounter(b, self, foe, turn)
    return
  }

  // 纯支持类（疗伤 / 回内 / 削敌 / 施毒 / 点穴）
  applySupportEffects(b, self, foe, skill, turn, logParts)
  b.log.push({
    turn, actor: self.isPlayer ? 'player' : 'enemy',
    text: `${self.name}施展${skill.name}${logParts.length ? '：' + logParts.join('；') : ''}。`,
    type: skill.heal || skill.healPercent || skill.restoreMp ? 'heal' as const : 'skill' as const,
  })
}

// ===== 久战力竭：保证全自动战斗必然收敛 =====
// 玩家已无法手动干预出招，所以「一定会结束」必须由引擎自己兜住：
// 从第 EXHAUST_START 合起双方内息渐衰——受创逐合放大、疗伤逐合衰减，
// 再耗下去必有一方先倒；HARD_TURN_CAP 是最后一道保险，按残余气血比例定胜负。
// 门槛设在 18 合：正常的头目拉锯（8~15 合）不该被力竭干扰，
// 只有真正僵持不下时才由力竭推向终局。
const EXHAUST_START = 18
const EXHAUST_DAMAGE_STEP = 0.15   // 每多打一合，双方受创 +15%
const EXHAUST_HEAL_STEP = 0.18     // 每多打一合，疗伤效力 −18%（保底 15%）
const HARD_TURN_CAP = 60

function applyExhaustion(b: Battle, turn: number) {
  if (turn < EXHAUST_START) return
  const over = turn - EXHAUST_START + 1
  const dmgAmp = 1 + over * EXHAUST_DAMAGE_STEP
  const healDecay = Math.max(0.15, 1 - over * EXHAUST_HEAL_STEP)
  for (const bc of [b.player, b.enemy]) {
    bc.exhaustMult = dmgAmp
    bc.exhaustHealMult = healDecay
  }
  if (!b.exhausted) {
    b.exhausted = true
    b.log.push({
      turn, actor: 'player',
      text: '缠斗过久，双方真气渐竭、招式散乱，伤上加伤，疗伤也难续——胜负该分了。',
      type: 'info' as const,
    })
  }
}

// 力竭兜底：到达硬上限仍未分胜负，按残余气血比例判定，绝不放任无限循环
function settleByAttrition(b: Battle, turn: number) {
  const pRatio = b.player.maxHp > 0 ? b.player.hp / b.player.maxHp : 0
  const eRatio = b.enemy.maxHp > 0 ? b.enemy.hp / b.enemy.maxHp : 0
  if (pRatio >= eRatio) {
    b.log.push({
      turn, actor: 'player',
      text: `久战之下${b.enemy.name}先力竭脱力，你勉力撑住了最后一合——算你赢了。`,
      type: 'victory' as const,
    })
    b.enemy.hp = 0
    b.state = 'victory'
  } else {
    b.log.push({
      turn, actor: 'enemy',
      text: `久战之下你先真气耗尽，眼前发黑，再也提不起劲来……`,
      type: 'defeat' as const,
    })
    b.player.hp = 0
    b.state = 'defeat'
  }
}

// ===== 回合维护 =====
function tickCooldowns(b: Battle) {
  const dec = (map: Record<string, number> | undefined) => {
    if (!map) return
    for (const k of Object.keys(map)) {
      map[k] = Math.max(0, map[k] - 1)
      if (map[k] <= 0) delete map[k]
    }
  }
  dec(b.cooldowns)
  dec(b.enemyCooldowns)
}

function tickBuffs(bc: BattleCharacter, turn: number, log: Battle['log']) {
  if (!bc.buffs || bc.buffs.length === 0) return
  const remaining: ActiveBuff[] = []
  const expired: string[] = []
  for (const buff of bc.buffs) {
    buff.turns -= 1
    if (buff.turns > 0) {
      remaining.push(buff)
    } else {
      adjustStat(bc, buff.stat, -buff.value)
      const label = buff.stat === 'attack' ? '攻击' : buff.stat === 'defense' ? '防御' : '轻功'
      expired.push(label)
    }
  }
  bc.buffs = remaining
  if (expired.length > 0) {
    log.push({
      turn,
      actor: bc.isPlayer ? 'player' : 'enemy',
      text: `${bc.name}的增益（${expired.join('、')}）消退了。`,
      type: 'info' as const,
    })
  }
}

function tickPoison(b: Battle, bc: BattleCharacter, turn: number): boolean {
  if (!bc.poisonTurns || bc.poisonTurns <= 0 || !bc.poison) return false
  const dmg = bc.poison
  bc.hp -= dmg
  bc.poisonTurns -= 1
  b.log.push({
    turn,
    actor: bc.isPlayer ? 'player' : 'enemy',
    text: `${bc.name}身中剧毒，受到${dmg}点毒性伤害。`,
    type: 'attack' as const,
  })
  if (bc.poisonTurns <= 0) bc.poison = 0
  if (bc.hp <= 0) {
    const winner = bc.isPlayer ? b.enemy : b.player
    settleDeath(b, winner, bc, turn)
    return true
  }
  return false
}

function applyRegen(bc: BattleCharacter, turn: number, log: Battle['log']) {
  const regen = bc.traits?.regenPercent ?? 0
  if (regen > 0 && bc.hp > 0) {
    const heal = Math.round(bc.maxHp * regen * (bc.healMult ?? 1) * (bc.exhaustHealMult ?? 1))
    if (heal > 0) {
      const before = bc.hp
      bc.hp = Math.min(bc.maxHp, bc.hp + heal)
      if (bc.hp - before > 0) {
        log.push({
          turn, actor: bc.isPlayer ? 'player' : 'enemy',
          text: `${bc.name}运转功法，回复${bc.hp - before}点气血。`,
          type: 'heal' as const,
        })
      }
    }
  }
  const mpRegen = bc.traits?.mpRegen ?? 0
  if (mpRegen > 0 && bc.hp > 0) {
    const before = bc.mp
    bc.mp = Math.min(bc.maxMp, bc.mp + mpRegen)
    if (bc.mp - before > 0) {
      log.push({
        turn, actor: bc.isPlayer ? 'player' : 'enemy',
        text: `${bc.name}真气自转，回复${bc.mp - before}点内力。`,
        type: 'heal' as const,
      })
    }
  }
}

// 回合开始维护：毒 → 增益 → 回复。任一方倒下即结束本回合
function upkeep(b: Battle, bc: BattleCharacter, turn: number): boolean {
  if (tickPoison(b, bc, turn)) return true
  tickBuffs(bc, turn, b.log)
  applyRegen(bc, turn, b.log)
  return b.state !== 'ongoing'
}

/**
 * 推进一个完整回合（双方各行动一次）。玩家不再手动出招：
 * 引擎自动从「已装备战技」中挑一招，条件不满足则普通攻击。
 * 身法高的一方先出手。
 */
export function runTurn(battle: Battle): Battle {
  const b: Battle = JSON.parse(JSON.stringify(battle))
  if (b.state !== 'ongoing') return b

  const turn = b.turn
  tickCooldowns(b)

  // 久战力竭：先算本回合的衰减系数，再进入结算
  applyExhaustion(b, turn)
  if (turn >= HARD_TURN_CAP) {
    settleByAttrition(b, turn)
    return b
  }

  // 回合start：毒 / 增益 / 回复（玩家优先，避免同归于尽时判定含糊）
  if (upkeep(b, b.player, turn)) return b
  if (upkeep(b, b.enemy, turn)) return b

  exchangeBlows(b, turn)
  return b
}

// 一个回合内的「你来我往」：身法高者先出手，双方各行动一次
function exchangeBlows(b: Battle, turn: number) {
  const playerFirst = b.player.agility >= b.enemy.agility
  const order: Array<'player' | 'enemy'> = playerFirst ? ['player', 'enemy'] : ['enemy', 'player']

  for (const side of order) {
    if (b.state !== 'ongoing') break
    if (side === 'player') {
      if (b.player.stunned) {
        b.player.stunned = false
        b.log.push({ turn, actor: 'player', text: '你穴道被封，这一合动弹不得！', type: 'info' as const })
        continue
      }
      const skill = pickPlayerSkill(b)
      if (skill) castSkill(b, b.player, b.enemy, skill, turn)
      else attackOnce(b, b.player, b.enemy, undefined, turn, '出手抢攻')
    } else {
      if (b.enemy.stunned) {
        b.enemy.stunned = false
        b.log.push({ turn, actor: 'enemy', text: `${b.enemy.name}穴道受制，错失这一合！`, type: 'info' as const })
        continue
      }
      const skill = pickEnemySkill(b)
      if (skill) castSkill(b, b.enemy, b.player, skill, turn)
      else attackOnce(b, b.enemy, b.player, undefined, turn, '扑上前来')
    }
  }

  if (b.state === 'ongoing') b.turn = turn + 1
}

export function playerFlee(battle: Battle): Battle {
  const b: Battle = JSON.parse(JSON.stringify(battle))
  const fleeChance = Math.min(0.8, 0.3 + (b.player.agility - b.enemy.agility) / 100)

  if (chance(fleeChance)) {
    b.state = 'fled'
    b.log.push({ turn: b.turn, actor: 'player', text: '你转身便逃，成功脱身！', type: 'info' })
    return b
  }

  // 逃跑失败：挨完这一合（回合维护已结算过，不再重复触发中毒/回复）
  b.log.push({ turn: b.turn, actor: 'player', text: '你想逃走，但被拦住了！', type: 'info' })
  tickCooldowns(b)
  exchangeBlows(b, b.turn)
  return b
}

export function getBattleRewards(battle: Battle): { exp: number; gold: number; drops: string[] } {
  const enemy = getEnemy(battle.enemyId)
  if (!enemy) return { exp: 0, gold: 0, drops: [] }

  const dropMult = battle.rewardMult?.drop ?? 1
  const drops: string[] = []
  for (const drop of enemy.drops) {
    if (chance(Math.min(1, drop.rate * dropMult))) {
      drops.push(drop.itemId)
    }
  }

  return {
    // 经验由升级配置按怪物等级推导（地图推进即经验节奏）；保留静态值作为覆盖。
    exp: enemy.expReward ?? enemyExpFromLevel(enemy.level, !!enemy.boss),
    gold: enemy.goldReward,
    drops,
  }
}
