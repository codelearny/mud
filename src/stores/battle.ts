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
import { getAllEnemies } from '../engine/data-loader'

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
    lastResult.value = null
  }

  function startRandomBattle() {
    const enemies = getAllEnemies()
    const playerStore = usePlayerStore()
    const playerLevel = playerStore.character?.level ?? 1
    const suitable = enemies.filter(e => Math.abs(e.level - playerLevel) <= 3)
    const pool = suitable.length > 0 ? suitable : enemies
    const enemy = pool[Math.floor(Math.random() * pool.length)]
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
      const expResult = playerStore.addExp(rewards.exp)
      playerStore.addGold(rewards.gold)
      for (const dropId of rewards.drops) {
        playerStore.addToInventory(dropId, 1)
      }
      const storyStore = useStoryStore()
      storyStore.incrementCounter('duelsWon', 1)
      if (battle.value.enemyId === 'bandit' || battle.value.enemyId === 'bandit_chief') {
        storyStore.incrementCounter('banditsDefeated', 1)
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
