import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Battle, BattleLogEntry } from '../types'
import {
  startBattle as engineStartBattle,
  runTurn as engineRunTurn,
  playerFlee as engineFlee,
  getBattleRewards,
} from '../engine/combat'
import { usePlayerStore } from './player'
import { useStoryStore } from './story'
import { useMessageStore, MAX_MESSAGES_IN_BATTLE, MAX_MESSAGES, type MessageType } from './messages'
import { getAllEnemies, getEnemy } from '../engine/data-loader'
import { getTalentEffects } from '../engine/talents'

// 自动战斗节奏：每回合之间的间隔（毫秒），玩家可调快慢或暂停观战
export const SPEED_PRESETS = [
  { label: '慢', ms: 1100 },
  { label: '中', ms: 650 },
  { label: '快', ms: 320 },
]

// 战斗日志类型 → 江湖消息类型
function messageTypeOf(entry: BattleLogEntry): MessageType {
  switch (entry.type) {
    case 'victory': return 'reward'
    case 'defeat': return 'info'
    case 'attack':
    case 'crit':
    case 'skill':
    case 'heal':
    case 'dodge': return 'action'
    default: return 'info'
  }
}

export const useBattleStore = defineStore('battle', () => {
  const battle = ref<Battle | null>(null)
  const lastResult = ref<{
    exp: number; gold: number; drops: string[];
    fled: boolean; leveledUp: boolean; newLevel: number
  } | null>(null)

  // 自动推进状态：战斗一经开始便自动交手，玩家只管观战或抽身
  const running = ref(false)
  const speedIndex = ref(1)
  // 已推送到江湖消息列表的日志条数，避免重复播报
  let logCursor = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  function pushNewLogs() {
    const b = battle.value
    if (!b) return
    const fresh = b.log.slice(logCursor)
    if (fresh.length === 0) return
    logCursor = b.log.length
    useMessageStore().addMessages(fresh.map(e => ({ text: e.text, type: messageTypeOf(e) })))
  }

  function stopTimer() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    running.value = false
  }

  function scheduleNext() {
    stopTimer()
    if (!battle.value || battle.value.state !== 'ongoing') return
    running.value = true
    timer = setTimeout(() => {
      timer = null
      step()
    }, SPEED_PRESETS[speedIndex.value].ms)
  }

  // 推进一个回合（手动点「快进」也走这里）
  function step() {
    if (!battle.value || battle.value.state !== 'ongoing') return
    battle.value = engineRunTurn(battle.value)
    pushNewLogs()
    syncHpMp()
    if (battle.value.state === 'ongoing') {
      scheduleNext()
    } else {
      stopTimer()
      checkEnd()
    }
  }

  // 每回合结束后把气血内力同步回角色，避免中途退出导致状态丢失
  function syncHpMp() {
    const b = battle.value
    const playerStore = usePlayerStore()
    if (!b || !playerStore.character) return
    playerStore.syncBattleHpMp(b.player.hp, b.player.mp)
  }

  function startBattle(enemyId: string) {
    const playerStore = usePlayerStore()
    if (!playerStore.character) return
    stopTimer()
    logCursor = 0
    battle.value = engineStartBattle(playerStore.character, enemyId)
    // 图鉴：任何战斗（随机历练 / 支线遭遇）开始时记录该敌人已发现
    playerStore.discoverEnemy(enemyId)
    lastResult.value = null

    const msgStore = useMessageStore()
    msgStore.setLimit(MAX_MESSAGES_IN_BATTLE)
    pushNewLogs()
    scheduleNext()
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

  function flee() {
    if (!battle.value || battle.value.state !== 'ongoing') return
    stopTimer()
    battle.value = engineFlee(battle.value)
    pushNewLogs()
    syncHpMp()
    if (battle.value.state === 'ongoing') {
      scheduleNext()
    } else {
      checkEnd()
    }
  }

  // 观战节奏控制：暂停 / 继续 / 切速度（不干预出招，出招全由引擎自动决定）
  function pause() { stopTimer() }
  function resume() {
    if (!battle.value || battle.value.state !== 'ongoing') return
    scheduleNext()
  }
  function toggle() { running.value ? pause() : resume() }
  function setSpeed(index: number) {
    speedIndex.value = Math.min(SPEED_PRESETS.length - 1, Math.max(0, index))
    if (running.value) scheduleNext()
  }

  function checkEnd() {
    const b = battle.value
    if (!b) return
    const playerStore = usePlayerStore()
    if (!playerStore.character) return

    if (b.state === 'victory') {
      const rewards = getBattleRewards(b)
      // 天赋经济加成 + roguelike 战况倍率，共同决定战利品
      const teff = getTalentEffects(playerStore.character)
      const expMult = (1 + (teff.expPercent ?? 0)) * (b.rewardMult?.exp ?? 1)
      const goldMult = (1 + (teff.goldPercent ?? 0)) * (b.rewardMult?.gold ?? 1)
      const expResult = playerStore.addExp(Math.round(rewards.exp * expMult))
      playerStore.addGold(Math.round(rewards.gold * goldMult))
      for (const dropId of rewards.drops) {
        playerStore.addToInventory(dropId, 1)
      }
      const storyStore = useStoryStore()
      storyStore.incrementCounter('duelsWon', 1)
      // 计数器由怪物配置驱动（Enemy.counters），不再硬编码具体 id
      const killed = getEnemy(b.enemyId)
      for (const name of killed?.counters ?? []) {
        storyStore.incrementCounter(name, 1)
      }
      storyStore.checkQuestCompletions()
      lastResult.value = {
        ...rewards, fled: false,
        leveledUp: expResult.leveledUp, newLevel: expResult.newLevel,
      }
    } else if (b.state === 'fled') {
      lastResult.value = { exp: 0, gold: 0, drops: [], fled: true, leveledUp: false, newLevel: 0 }
    }

    if (b.state === 'victory' || b.state === 'fled') {
      playerStore.setHpMp(b.player.hp, b.player.mp)
    } else if (b.state === 'defeat') {
      // 败北：留一口气，被好心人救回村落
      playerStore.setHpMp(1, 0)
    }
  }

  function clearBattle() {
    stopTimer()
    battle.value = null
    lastResult.value = null
    logCursor = 0
    useMessageStore().setLimit(MAX_MESSAGES)
  }

  return {
    battle,
    lastResult,
    running,
    speedIndex,
    startBattle,
    startRandomBattle,
    step,
    flee,
    pause,
    resume,
    toggle,
    setSpeed,
    clearBattle,
  }
})
