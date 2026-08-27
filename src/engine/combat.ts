import type { Battle, BattleCharacter, Character, Skill } from '../types'
import { getEnemy, getSkill, getItem } from './data-loader'
import { getEffectiveAttributes } from './character'
import { chance, randomInt } from './random'

export function startBattle(player: Character, enemyId: string): Battle {
  const enemy = getEnemy(enemyId)
  if (!enemy) throw new Error(`Enemy ${enemyId} not found`)

  const eff = getEffectiveAttributes(player)

  const playerBC: BattleCharacter = {
    name: player.name,
    hp: eff.hp,
    maxHp: eff.maxHp,
    mp: eff.mp,
    maxMp: eff.maxMp,
    attack: eff.attack,
    defense: eff.defense,
    agility: eff.agility,
    skills: player.learnedSkills.map(s => s.skillId),
    isPlayer: true
  }

  const enemyBC: BattleCharacter = {
    name: enemy.name,
    hp: enemy.attributes.hp,
    maxHp: enemy.attributes.maxHp,
    mp: enemy.attributes.mp,
    maxMp: enemy.attributes.maxMp,
    attack: enemy.attributes.attack,
    defense: enemy.attributes.defense,
    agility: enemy.attributes.agility,
    skills: enemy.skills,
    isPlayer: false
  }

  return {
    player: playerBC,
    enemy: enemyBC,
    turn: 1,
    log: [{
      turn: 0,
      actor: 'player',
      text: `${enemy.name}出现了！${enemy.description}`,
      type: 'info' as const
    }],
    state: 'ongoing' as const,
    enemyId
  }
}

function calculateDamage(
  attacker: BattleCharacter,
  defender: BattleCharacter,
  skill: Skill | undefined
): { damage: number; crit: boolean; dodged: boolean } {
  const dodgeChance = Math.max(
    0,
    (defender.agility - attacker.agility) / (defender.agility + attacker.agility) * 0.4
  )
  const hitRate = (skill?.hitRate ?? 0.9) - dodgeChance

  if (!chance(hitRate)) {
    return { damage: 0, crit: false, dodged: true }
  }

  const skillPower = skill?.power ?? 5
  const baseDamage = (attacker.attack * skillPower) / 10 + randomInt(1, 5)
  const damage = Math.max(1, baseDamage - defender.defense * 0.3)

  const critRate = skill?.critRate ?? 0.05
  const crit = chance(critRate)
  const finalDamage = crit ? Math.round(damage * 1.5) : Math.round(damage)

  return { damage: finalDamage, crit, dodged: false }
}

// 对 opponent 施加一次进攻型技能（多段、吸血），返回总伤害
function performOffensive(
  attacker: BattleCharacter,
  defender: BattleCharacter,
  skill: Skill
): { total: number; dead: boolean; logParts: string[] } {
  const hits = Math.max(1, skill.hits ?? 1)
  let total = 0
  const logParts: string[] = []
  let dead = false

  for (let i = 0; i < hits; i++) {
    const { damage, crit, dodged } = calculateDamage(attacker, defender, skill)
    if (dodged) {
      logParts.push(`第${i + 1}击被闪开`)
      continue
    }
    defender.hp -= damage
    total += damage
    logParts.push(`第${i + 1}击造成${damage}伤害${crit ? '（暴击）' : ''}`)
    if (defender.hp <= 0) {
      defender.hp = 0
      dead = true
      break
    }
  }

  // 吸血：按总伤害比例恢复自身气血
  if (total > 0 && skill.lifesteal && skill.lifesteal > 0) {
    const healed = Math.floor(total * skill.lifesteal)
    if (healed > 0) {
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + healed)
      logParts.push(`吸取${healed}点气血`)
    }
  }

  return { total, dead, logParts }
}

// 对 self / opponent 施加技能的支持类效果（增益、削敌、回内、疗伤、施毒）
function applySupportEffects(
  self: BattleCharacter,
  opponent: BattleCharacter,
  skill: Skill,
  logParts: string[]
) {
  if (skill.restoreMp) {
    self.mp = Math.min(self.maxMp, self.mp + skill.restoreMp)
    logParts.push(`恢复${skill.restoreMp}内力`)
  }
  if (skill.heal) {
    self.hp = Math.min(self.maxHp, self.hp + skill.heal)
    logParts.push(`恢复${skill.heal}气血`)
  }
  if (skill.selfBuff) {
    const sb = skill.selfBuff
    const bits: string[] = []
    if (sb.attack) { self.attack += sb.attack; bits.push(`攻+${sb.attack}`) }
    if (sb.defense) { self.defense += sb.defense; bits.push(`防+${sb.defense}`) }
    if (sb.agility) { self.agility += sb.agility; bits.push(`身法+${sb.agility}`) }
    if (bits.length) logParts.push(`自身${bits.join('')}`)
  }
  if (skill.enemyDebuff) {
    const ed = skill.enemyDebuff
    const bits: string[] = []
    if (ed.attack) { opponent.attack = Math.max(1, opponent.attack + ed.attack); bits.push(`攻${ed.attack}`) }
    if (ed.defense) { opponent.defense = Math.max(0, opponent.defense + ed.defense); bits.push(`防${ed.defense}`) }
    if (ed.agility) { opponent.agility = Math.max(1, opponent.agility + ed.agility); bits.push(`身法${ed.agility}`) }
    if (bits.length) logParts.push(`对手${bits.join('')}`)
  }
  if (skill.poison) {
    const turns = skill.poisonTurns ?? 3
    opponent.poison = (opponent.poison ?? 0) + skill.poison
    opponent.poisonTurns = (opponent.poisonTurns ?? 0) + turns
    logParts.push(`施毒（每回合${skill.poison}伤，持续${turns}回合）`)
  }
}

// 回合开始结算中毒伤害（作用于 targer），返回是否致死
function tickPoison(target: BattleCharacter, turn: number, log: Battle['log']): boolean {
  if (!target.poisonTurns || target.poisonTurns <= 0 || !target.poison) return false
  const dmg = target.poison
  target.hp -= dmg
  target.poisonTurns -= 1
  log.push({
    turn,
    actor: target.isPlayer ? 'player' : 'enemy',
    text: `${target.name}身中剧毒，受到${dmg}点毒性伤害。`,
    type: 'attack' as const
  })
  if (target.poisonTurns <= 0) target.poison = 0
  if (target.hp <= 0) {
    target.hp = 0
    return true
  }
  return false
}

function enemyTurn(battle: Battle): Battle {
  const b: Battle = JSON.parse(JSON.stringify(battle))
  b.turn++

  // 敌方中毒结算
  if (tickPoison(b.enemy, b.turn, b.log)) {
    b.state = 'victory'
    b.log.push({ turn: b.turn, actor: 'enemy', text: `${b.enemy.name}毒发身亡！你赢了！`, type: 'victory' })
    return b
  }

  const usableSkills = b.enemy.skills.filter(sid => {
    const sk = getSkill(sid)
    return sk && sk.mpCost <= b.enemy.mp && sk.power > 0
  })

  let skill: Skill | undefined
  if (usableSkills.length > 0 && chance(0.5)) {
    const sid = usableSkills[randomInt(0, usableSkills.length - 1)]
    skill = getSkill(sid)
    if (skill) {
      b.enemy.mp -= skill.mpCost
    }
  }

  const logParts: string[] = []
  if (skill && skill.power > 0) {
    const res = performOffensive(b.enemy, b.player, skill)
    logParts.push(...res.logParts)
  } else {
    const { damage, crit, dodged } = calculateDamage(b.enemy, b.player, undefined)
    if (dodged) {
      logParts.push('出招被你闪开')
    } else {
      b.player.hp -= damage
      logParts.push(`造成${damage}伤害${crit ? '（暴击）' : ''}`)
    }
  }

  const action = skill ? `以${skill.name}` : '出拳'
  b.log.push({ turn: b.turn, actor: 'enemy', text: `${b.enemy.name}${action}攻击你：${logParts.join('；')}。`, type: critType(logParts) })

  if (b.player.hp <= 0) {
    b.player.hp = 0
    b.state = 'defeat'
    b.log.push({ turn: b.turn, actor: 'enemy', text: '你倒下了...', type: 'defeat' })
  }

  return b
}

function critType(logParts: string[]): 'crit' | 'attack' {
  return logParts.some(p => p.includes('暴击')) ? 'crit' : 'attack'
}

export function playerAttack(battle: Battle): Battle {
  const b: Battle = JSON.parse(JSON.stringify(battle))
  const { damage, crit, dodged } = calculateDamage(b.player, b.enemy, undefined)

  let logText: string
  if (dodged) {
    logText = `你出拳攻击${b.enemy.name}，但被闪开了！`
  } else if (crit) {
    logText = `你一拳击中${b.enemy.name}要害，造成${damage}点伤害！暴击！`
    b.enemy.hp -= damage
  } else {
    logText = `你出拳攻击${b.enemy.name}，造成${damage}点伤害。`
    b.enemy.hp -= damage
  }

  b.log.push({ turn: b.turn, actor: 'player', text: logText, type: dodged ? 'dodge' : crit ? 'crit' : 'attack' })

  if (b.enemy.hp <= 0) {
    b.enemy.hp = 0
    b.state = 'victory'
    b.log.push({ turn: b.turn, actor: 'player', text: `${b.enemy.name}倒下了！你赢了！`, type: 'victory' })
    return b
  }

  return enemyTurn(b)
}

export function playerUseSkill(battle: Battle, skillId: string): Battle {
  const skill = getSkill(skillId)
  if (!skill) return battle

  const b: Battle = JSON.parse(JSON.stringify(battle))

  if (b.player.mp < skill.mpCost) {
    b.log.push({ turn: b.turn, actor: 'player', text: `内力不足，无法施展${skill.name}！`, type: 'info' })
    return b
  }

  b.player.mp -= skill.mpCost

  const logParts: string[] = []

  // 进攻部分
  if (skill.power > 0) {
    const res = performOffensive(b.player, b.enemy, skill)
    logParts.push(...res.logParts)
    if (res.dead) {
      b.enemy.hp = 0
    }
  }

  // 支持类效果（增益/削敌/回内/疗伤/施毒）
  applySupportEffects(b.player, b.enemy, skill, logParts)

  b.log.push({ turn: b.turn, actor: 'player', text: `你施展${skill.name}：${logParts.join('；')}！`, type: 'skill' })

  if (b.enemy.hp <= 0) {
    b.enemy.hp = 0
    b.state = 'victory'
    b.log.push({ turn: b.turn, actor: 'player', text: `${b.enemy.name}倒下了！你赢了！`, type: 'victory' })
    return b
  }

  // 点穴：对手本回合无法行动
  if (skill.stun) {
    b.log.push({ turn: b.turn, actor: 'player', text: `${b.enemy.name}被点中穴道，动弹不得！`, type: 'info' })
    return b
  }

  return enemyTurn(b)
}

export function playerUseItem(battle: Battle, itemId: string): Battle {
  const item = getItem(itemId)
  if (!item || !item.effects) return battle

  const b: Battle = JSON.parse(JSON.stringify(battle))

  let logText = `你使用了${item.name}。`
  for (const effect of item.effects) {
    switch (effect.type) {
      case 'hp':
        b.player.hp = Math.min(b.player.maxHp, b.player.hp + effect.value)
        logText = `你使用${item.name}，恢复${effect.value}点气血。`
        break
      case 'mp':
        b.player.mp = Math.min(b.player.maxMp, b.player.mp + effect.value)
        logText = `你使用${item.name}，恢复${effect.value}点内力。`
        break
      case 'attack':
        b.player.attack += effect.value
        logText = `你使用${item.name}，攻击力提升${effect.value}点。`
        break
      case 'defense':
        b.player.defense += effect.value
        break
      case 'agility':
        b.player.agility += effect.value
        break
    }
  }

  b.log.push({ turn: b.turn, actor: 'player', text: logText, type: 'heal' })

  return enemyTurn(b)
}

export function playerFlee(battle: Battle): Battle {
  const b: Battle = JSON.parse(JSON.stringify(battle))
  const fleeChance = Math.min(0.8, 0.3 + (b.player.agility - b.enemy.agility) / 100)

  if (chance(fleeChance)) {
    b.state = 'fled'
    b.log.push({ turn: b.turn, actor: 'player', text: '你转身便逃，成功脱身！', type: 'info' })
  } else {
    b.log.push({ turn: b.turn, actor: 'player', text: '你想逃走，但被拦住了！', type: 'info' })
    return enemyTurn(b)
  }

  return b
}

export function getBattleRewards(battle: Battle): { exp: number; gold: number; drops: string[] } {
  const enemy = getEnemy(battle.enemyId)
  if (!enemy) return { exp: 0, gold: 0, drops: [] }

  const drops: string[] = []
  for (const drop of enemy.drops) {
    if (chance(drop.rate)) {
      drops.push(drop.itemId)
    }
  }

  return {
    exp: enemy.expReward,
    gold: enemy.goldReward,
    drops
  }
}
