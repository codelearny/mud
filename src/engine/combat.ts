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

function enemyTurn(battle: Battle): Battle {
  const b: Battle = JSON.parse(JSON.stringify(battle))
  b.turn++

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

  const { damage, crit, dodged } = calculateDamage(b.enemy, b.player, skill)

  let logText: string
  if (dodged) {
    logText = `${b.enemy.name}出招攻击你，但你闪开了！`
  } else if (crit) {
    logText = `${b.enemy.name}一击命中你的要害，造成${damage}点伤害！`
    b.player.hp -= damage
  } else {
    const action = skill ? `以${skill.name}` : '出拳'
    logText = `${b.enemy.name}${action}攻击你，造成${damage}点伤害。`
    b.player.hp -= damage
  }

  b.log.push({ turn: b.turn, actor: 'enemy', text: logText, type: crit ? 'crit' : 'attack' })

  if (b.player.hp <= 0) {
    b.player.hp = 0
    b.state = 'defeat'
    b.log.push({ turn: b.turn, actor: 'enemy', text: '你倒下了...', type: 'defeat' })
  }

  return b
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

  if (skill.category === 'internal' || skill.category === 'movement') {
    let buffText = `你施展了${skill.name}！`
    if (skill.id === 'basic_internal') {
      const restore = 15
      b.player.mp = Math.min(b.player.maxMp, b.player.mp + restore)
      buffText = `你运功调息，恢复${restore}点内力。`
    } else if (skill.id === 'qingyun_step') {
      b.player.agility += 10
      buffText = `你脚踏青云步，身法大增！`
    } else if (skill.id === 'yijinjing') {
      b.player.attack += 10
      b.player.defense += 5
      buffText = `你运转易筋经，脱胎换骨，攻防大增！`
    }
    b.log.push({ turn: b.turn, actor: 'player', text: buffText, type: 'skill' })
  } else {
    const { damage, crit, dodged } = calculateDamage(b.player, b.enemy, skill)

    let logText: string
    if (dodged) {
      logText = `你施展${skill.name}，但${b.enemy.name}闪开了！`
    } else if (crit) {
      logText = `你以${skill.name}击中${b.enemy.name}，造成${damage}点伤害！暴击！`
      b.enemy.hp -= damage
    } else {
      logText = `你施展${skill.name}，对${b.enemy.name}造成${damage}点伤害。`
      b.enemy.hp -= damage
    }
    b.log.push({ turn: b.turn, actor: 'player', text: logText, type: crit ? 'crit' : 'skill' })
  }

  if (b.enemy.hp <= 0) {
    b.enemy.hp = 0
    b.state = 'victory'
    b.log.push({ turn: b.turn, actor: 'player', text: `${b.enemy.name}倒下了！你赢了！`, type: 'victory' })
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
