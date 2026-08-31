<script setup lang="ts">
import { computed } from 'vue'
import { useBattleStore, SPEED_PRESETS } from '../stores/battle'
import { usePlayerStore } from '../stores/player'
import { useGameStore } from '../stores/game'
import { useMessageStore } from '../stores/messages'
import { getSkill, getItem } from '../engine/data-loader'
import { triggerLabel, inferTrigger, skillTags, WEAPON_SCHOOL_LABELS } from '../engine/skill-utils'
import type { Skill } from '../types'

const battleStore = useBattleStore()
const playerStore = usePlayerStore()
const gameStore = useGameStore()
const messageStore = useMessageStore()

const battle = computed(() => battleStore.battle)
const result = computed(() => battleStore.lastResult)
const isEnded = computed(() => !!battle.value && battle.value.state !== 'ongoing')

const enemyHpPercent = computed(() => {
  const b = battle.value
  if (!b) return 0
  return Math.max(0, Math.min(100, (b.enemy.hp / b.enemy.maxHp) * 100))
})
const playerHpPercent = computed(() => {
  const b = battle.value
  if (!b) return 0
  return Math.max(0, Math.min(100, (b.player.hp / b.player.maxHp) * 100))
})
const playerMpPercent = computed(() => {
  const b = battle.value
  if (!b) return 0
  return Math.max(0, Math.min(100, (b.player.mp / b.player.maxMp) * 100))
})

// 本场 roguelike 战况
const modifiers = computed(() => battle.value?.modifiers ?? [])

// 已装备战技及其当前冷却 / 触发条件
type EquippedView = Skill & { cooldownLeft: number; triggerText: string; ready: boolean }
const equippedViews = computed<EquippedView[]>(() => {
  const b = battle.value
  if (!b) return []
  return (b.player.equippedSkills ?? [])
    .map(id => getSkill(id))
    .filter((s): s is Skill => !!s)
    .map(s => {
      const cd = b.cooldowns?.[s.id] ?? 0
      return {
        ...s,
        cooldownLeft: cd,
        triggerText: triggerLabel(inferTrigger(s)),
        ready: cd <= 0 && b.player.mp >= s.mpCost,
      }
    })
})

const equippedWeapon = computed(() => {
  const id = playerStore.character?.equipment.weapon
  return id ? getItem(id) : undefined
})
const equippedSchoolLabel = computed(() =>
  equippedWeapon.value?.school ? WEAPON_SCHOOL_LABELS[equippedWeapon.value.school] : '空手'
)

function finishBattle() {
  const b = battle.value
  if (!b) return
  const enemyName = b.enemy.name

  if (b.state === 'defeat') {
    messageStore.addMessage('伤痕累累，昏倒在地……幸得被好心人救回村落。', 'info')
    gameStore.setScene('village')
  } else if (b.state === 'fled') {
    messageStore.addMessage(`于 ${enemyName} 手下遁走`, 'info')
  }

  battleStore.clearBattle()
  gameStore.saveGame()
}
</script>

<template>
  <div v-if="battle" class="battle-panel">
    <!-- 敌方 -->
    <div class="battle-side enemy">
      <div class="combatant-name enemy">{{ battle.enemy.name }}</div>
      <div class="bar-row">
        <span class="bar-label">气血</span>
        <div class="bar-container small">
          <div class="bar-fill hp" :style="{ width: enemyHpPercent + '%' }"></div>
        </div>
        <span class="bar-label bar-num">
          {{ Math.max(0, Math.round(battle.enemy.hp)) }}/{{ battle.enemy.maxHp }}
        </span>
      </div>
      <div class="battle-sub" v-if="(battle.enemy.shield ?? 0) > 0">
        护体真气 {{ Math.round(battle.enemy.shield ?? 0) }}
      </div>
    </div>

    <!-- 战况（roguelike） -->
    <div class="battle-mods" v-if="modifiers.length">
      <span
        v-for="m in modifiers"
        :key="m.id"
        class="mod-chip"
        :class="'mod-' + m.kind"
        :title="m.description"
      >{{ m.name }}</span>
    </div>

    <!-- 久战力竭：明示节奏变化，免得玩家只看到伤害莫名变高 -->
    <div class="battle-exhaust" v-if="battle.exhausted">
      久战力竭 · 第 {{ battle.turn }} 合 — 双方真气渐竭，受创加重、疗伤渐衰，胜负将分
    </div>

    <!-- 我方 -->
    <div class="battle-side self">
      <div class="combatant-name self">
        {{ battle.player.name }}
        <span class="turn-tag">第 {{ battle.turn }} 回合</span>
      </div>
      <div class="bar-row">
        <span class="bar-label">气血</span>
        <div class="bar-container small">
          <div class="bar-fill hp" :style="{ width: playerHpPercent + '%' }"></div>
        </div>
        <span class="bar-label bar-num">
          {{ Math.max(0, Math.round(battle.player.hp)) }}/{{ battle.player.maxHp }}
        </span>
      </div>
      <div class="bar-row">
        <span class="bar-label">内力</span>
        <div class="bar-container small">
          <div class="bar-fill mp" :style="{ width: playerMpPercent + '%' }"></div>
        </div>
        <span class="bar-label bar-num">
          {{ Math.max(0, Math.round(battle.player.mp)) }}/{{ battle.player.maxMp }}
        </span>
      </div>
      <div class="battle-sub" v-if="(battle.player.shield ?? 0) > 0">
        护体真气 {{ Math.round(battle.player.shield ?? 0) }}
      </div>
    </div>

    <!-- 已装备战技 -->
    <div class="panel-title battle-section-title">已装备战技（自动施展）</div>
    <div class="equipped-list" v-if="equippedViews.length">
      <div
        v-for="s in equippedViews"
        :key="s.id"
        class="equipped-card"
        :class="{ 'on-cooldown': s.cooldownLeft > 0 }"
      >
        <div class="equipped-head">
          <span class="equipped-name">{{ s.name }}</span>
          <span class="equipped-cd" v-if="s.cooldownLeft > 0">冷却 {{ s.cooldownLeft }}</span>
          <span class="equipped-cd ready" v-else>就绪</span>
        </div>
        <div class="equipped-meta">{{ s.triggerText }} · 耗内力 {{ s.mpCost }}</div>
        <div class="skill-tags" v-if="skillTags(s).length">
          <span class="skill-tag" v-for="t in skillTags(s)" :key="t">{{ t }}</span>
        </div>
      </div>
    </div>
    <div v-else class="battle-hint">
      尚未装备任何战技，交手时只会普通攻击。可于「武功」页装备。
    </div>

    <!-- 观战控制：不干预出招，只调节奏 -->
    <div class="battle-controls" v-if="!isEnded">
      <button class="btn" @click="battleStore.toggle()">
        {{ battleStore.running ? '暂停' : '继续' }}
      </button>
      <button class="btn" :disabled="battleStore.running" @click="battleStore.step()">快进一合</button>
      <button
        v-for="(sp, i) in SPEED_PRESETS"
        :key="sp.label"
        class="btn btn-speed"
        :class="{ 'btn-primary': battleStore.speedIndex === i }"
        @click="battleStore.setSpeed(i)"
      >{{ sp.label }}</button>
      <button class="btn btn-danger" @click="battleStore.flee()">逃跑</button>
    </div>

    <div class="battle-hint">
      兵器：{{ equippedWeapon ? equippedWeapon.name + '（' + equippedSchoolLabel + '）' : '空手（拳脚）' }}
      — 招法与兵器相合方尽展其威，交手全程自动，战况见右侧「江湖消息」。
    </div>

    <!-- 结算 -->
    <div v-if="isEnded" class="battle-result">
      <div v-if="battle.state === 'victory'" class="result-title victory">大获全胜！</div>
      <div v-else-if="battle.state === 'fled'" class="result-title fled">成功脱身</div>
      <div v-else class="result-title defeat">不敌败北</div>

      <div class="result-lines" v-if="result && battle.state === 'victory'">
        <div>经验 +{{ result.exp }} · 银两 +{{ result.gold }}</div>
        <div v-for="id in result.drops" :key="id">获得 {{ getItem(id)?.name ?? id }}</div>
        <div v-if="result.leveledUp" class="level-up">突破至第 {{ result.newLevel }} 重</div>
      </div>
      <button class="btn btn-primary btn-block" @click="finishBattle">
        {{ battle.state === 'defeat' ? '养伤归来' : '继续行走江湖' }}
      </button>
    </div>
  </div>
</template>
