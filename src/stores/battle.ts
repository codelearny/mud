import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Battle } from '../types'
import {
  startBattle as engineStartBattle,
  playerAttack as engineAttack,
  playerUseSkill as engineUseSkill,
  playerUseItem as engineUseItem,
  playerFlee as engineFlee,
  getBattleRewards,
} from '../engine/combat'
import { usePlayerStore } from './player'
import { useStoryStore } from './story'
import { getAllEnemies, getEnemy } from '../engine/data-loader'
import { getTalentEffects } from '../engine/talents'

export const useBattleStore = defineStore('battle', () => {
  const battle = ref<Battle | null>(null)
  const lastResult = ref<{
    exp: number; gold: number; drops: string[];
    fled: boolean; leveledUp: boolean; newLevel: number
  } | null>(null)

  function startBattle(enemyId: string) {
    const playerStore = usePlayerStore()
    if (!playerStore.character) return
    battle.value = engineStartBattle(playerStore.character, enemyId)
    // 图鉴：任何战斗（随机历练 / 支线遭遇）开始时记录该敌人已发现
    playerStore.discoverEnemy(enemyId)
    lastResult.value = null
  }

  // pool 来自 Scene.enemyPool，让不同地点遭遇不同怪物（省略则用全部怪物）
  function startRandomBattle(pool?: string[]) {
    const all = getAllEnemies()
    const playerStore = usePlayerStore()
    const playerLevel = playerStore.character?.level ?? 1
    const candidates = (pool && pool.length > 0)
      ? pool.map(id => all.find(e => e.id === id)).filter((e): e is NonNullable<typeof e> => !!e)
      : all
    const list = candidates.length > 0 ? candidates : all
    const suitable = list.filter(e => Math.abs(e.level - playerLevel) <= 3)
    const finalPool = suitable.length > 0 ? suitable : list
    const enemy = finalPool[Math.floor(Math.random() * finalPool.length)]
    startBattle(enemy.id)
  }

  function attack() {
    if (!battle.value || battle.value.state !== 'ongoing') return
    battle.value = engineAttack(battle.value)
    checkEnd()
  }

  function useSkill(skillId: string) {
    if (!battle.value || battle.value.state !== 'ongoing') return
    battle.value = engineUseSkill(battle.value, skillId)
    checkEnd()
  }

  function useItem(itemId: string) {
    if (!battle.value || battle.value.state !== 'ongoing') return
    if (!battle.value.player) return
    battle.value = engineUseItem(battle.value, itemId)
    const playerStore = usePlayerStore()
    playerStore.useItem(itemId)
    checkEnd()
  }

  function flee() {
    if (!battle.value || battle.value.state !== 'ongoing') return
    battle.value = engineFlee(battle.value)
    checkEnd()
  }

  function checkEnd() {
    if (!battle.value) return
    if (battle.value.state === 'ongoing') return

    const playerStore = usePlayerStore()
    if (!playerStore.character) return

    if (battle.value.state === 'victory') {
      const rewards = getBattleRewards(battle.value)
      // 天赋经济加成：经验/银两按比例提升
      const teff = getTalentEffects(playerStore.character)
      const expMult = 1 + (teff.expPercent ?? 0)
      const goldMult = 1 + (teff.goldPercent ?? 0)
      const expResult = playerStore.addExp(Math.round(rewards.exp * expMult))
      playerStore.addGold(Math.round(rewards.gold * goldMult))
      for (const dropId of rewards.drops) {
        playerStore.addToInventory(dropId, 1)
      }
      const storyStore = useStoryStore()
      storyStore.incrementCounter('duelsWon', 1)
      // 计数器由怪物配置驱动（Enemy.counters），不再硬编码具体 id
      const killed = getEnemy(battle.value.enemyId)
      for (const name of killed?.counters ?? []) {
        storyStore.incrementCounter(name, 1)
      }
      storyStore.checkQuestCompletions()
      lastResult.value = {
        ...rewards, fled: false,
        leveledUp: expResult.leveledUp, newLevel: expResult.newLevel
      }
    } else if (battle.value.state === 'fled') {
      lastResult.value = { exp: 0, gold: 0, drops: [], fled: true, leveledUp: false, newLevel: 0 }
    }

    if (battle.value.state === 'victory' || battle.value.state === 'fled') {
      const p = battle.value.player
      playerStore.setHpMp(p.hp, p.mp)
    }
  }

  function clearBattle() {
    battle.value = null
    lastResult.value = null
  }

  return {
    battle,
    lastResult,
    startBattle,
    startRandomBattle,
    attack,
    useSkill,
    useItem,
    flee,
    clearBattle,
  }
})
