<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBattleStore } from '../stores/battle'
import { usePlayerStore } from '../stores/player'
import { useMessageStore } from '../stores/messages'
import { getSkill, getItem } from '../engine/data-loader'
import { skillTags, skillSchoolLabel, WEAPON_SCHOOL_LABELS, WEAPON_AFFINITY_MATCH, WEAPON_AFFINITY_MISMATCH } from '../engine/skill-utils'
import { itemTags } from '../engine/item-utils'
import GameLog from '../components/GameLog.vue'
import type { Skill, Item } from '../types'

const router = useRouter()
const battleStore = useBattleStore()
const playerStore = usePlayerStore()
const messageStore = useMessageStore()

const showSkillMenu = ref(false)
const showItemMenu = ref(false)

const battle = computed(() => battleStore.battle)
const result = computed(() => battleStore.lastResult)
const isEnded = computed(() => {
  if (!battle.value) return false
  return battle.value.state !== 'ongoing'
})

const enemyHpPercent = computed(() => {
  if (!battle.value) return 0
  return (battle.value.enemy.hp / battle.value.enemy.maxHp) * 100
})

const playerHpPercent = computed(() => {
  if (!battle.value) return 0
  return (battle.value.player.hp / battle.value.player.maxHp) * 100
})

const playerMpPercent = computed(() => {
  if (!battle.value) return 0
  return (battle.value.player.mp / battle.value.player.maxMp) * 100
})

const availableSkills = computed<(Skill & { canUse: boolean; discounted: boolean; matched: boolean })[]>(() => {
  if (!battle.value) return []
  const ws = battle.value.player.weaponSchool
  const WEAPON_CATS = ['sword', 'blade', 'fist', 'staff']
  return battle.value.player.skills
    .map(id => getSkill(id))
    .filter((s): s is Skill => s !== undefined && s.type === 'active')
    .map(s => {
      const isWeaponSkill = WEAPON_CATS.includes(s.category)
      const effectiveSchool = ws ?? 'fist'
      const matched = isWeaponSkill && effectiveSchool === s.category
      return {
        ...s,
        canUse: battle.value!.player.mp >= s.mpCost,
        discounted: isWeaponSkill && !matched,
        matched
      }
    })
})

const consumableItems = computed<(Item & { quantity: number })[]>(() => {
  if (!playerStore.character) return []
  return playerStore.character.inventory
    .map(inv => {
      const item = getItem(inv.itemId)
      return item ? { ...item, quantity: inv.quantity } : null
    })
    .filter((x): x is Item & { quantity: number } => x !== null && x.type === 'consumable' && x.category !== 'manual')
})

// 当前所持兵器及其流派（用于战斗中提示「兵刃与功法相性」）
const equippedWeapon = computed(() => {
  const id = playerStore.character?.equipment.weapon
  return id ? getItem(id) : undefined
})
const equippedSchoolLabel = computed(() => {
  if (!equippedWeapon.value?.school) return '空手（拳脚）'
  return WEAPON_SCHOOL_LABELS[equippedWeapon.value.school]
})
const affinityMatchPct = Math.round((WEAPON_AFFINITY_MATCH - 1) * 100)
const affinityMismatchMult = WEAPON_AFFINITY_MISMATCH

function doAttack() {
  battleStore.attack()
}

function doUseSkill(skillId: string) {
  showSkillMenu.value = false
  battleStore.useSkill(skillId)
}

function doUseItem(itemId: string) {
  showItemMenu.value = false
  battleStore.useItem(itemId)
}

function doFlee() {
  battleStore.flee()
}

function recordBattleResult() {
  const b = battle.value
  const r = result.value
  if (!b || !r) return
  const enemyName = b.enemy.name
  if (b.state === 'victory') {
    const parts: string[] = [`经验 +${r.exp}`, `银两 +${r.gold}`]
    for (const id of r.drops) parts.push(`获得 ${getItem(id)?.name ?? id}`)
    if (r.leveledUp) parts.push(`突破至第 ${r.newLevel} 重`)
    messageStore.addMessage(`力克 ${enemyName}：${parts.join('，')}`, 'reward')
  } else if (b.state === 'fled') {
    messageStore.addMessage(`于 ${enemyName} 手下遁走`, 'info')
  } else if (b.state === 'defeat') {
    messageStore.addMessage('伤痕累累，昏倒在地……幸得被好心人救回村落。', 'info')
  }
}

function returnToGame() {
  recordBattleResult()
  if (battle.value?.state === 'defeat') {
    playerStore.setHpMp(1, 0)
  }
  battleStore.clearBattle()
  router.push('/game')
}

function returnToMenu() {
  recordBattleResult()
  battleStore.clearBattle()
  playerStore.clear()
  router.push('/')
}
</script>

<template>
  <div v-if="battle" style="display: flex; flex-direction: column; flex: 1; min-height: 100vh;">
    <div class="enemy-info">
      <div class="combatant-name enemy">{{ battle.enemy.name }}</div>
      <div class="combatant-bars">
        <div class="bar-row">
          <span class="bar-label">气血</span>
          <div class="bar-container small">
            <div class="bar-fill hp" :style="{ width: enemyHpPercent + '%' }"></div>
          </div>
          <span class="bar-label" style="width: auto;">{{ Math.max(0, Math.round(battle.enemy.hp)) }}/{{ battle.enemy.maxHp }}</span>
        </div>
      </div>
    </div>

    <GameLog :entries="battle.log" style="flex: 1; margin: 0;" />

    <div class="battle-self-info">
      <div class="combatant-name self">{{ battle.player.name }}</div>
      <div class="weapon-line" v-if="equippedWeapon">兵器：{{ equippedWeapon.name }}（{{ equippedSchoolLabel }}）</div>
      <div class="combatant-bars">
        <div class="bar-row">
          <span class="bar-label">气血</span>
          <div class="bar-container small">
            <div class="bar-fill hp" :style="{ width: playerHpPercent + '%' }"></div>
          </div>
          <span class="bar-label" style="width: auto;">{{ Math.max(0, Math.round(battle.player.hp)) }}/{{ battle.player.maxHp }}</span>
        </div>
        <div class="bar-row">
          <span class="bar-label">内力</span>
          <div class="bar-container small">
            <div class="bar-fill mp" :style="{ width: playerMpPercent + '%' }"></div>
          </div>
          <span class="bar-label" style="width: auto;">{{ Math.max(0, Math.round(battle.player.mp)) }}/{{ battle.player.maxMp }}</span>
        </div>
      </div>
    </div>

    <div class="btn-grid-4" style="padding: 10px;">
      <button class="btn btn-primary" :disabled="isEnded" @click="doAttack">出招</button>
      <button class="btn" :disabled="isEnded" @click="showSkillMenu = true">武功</button>
      <button class="btn" :disabled="isEnded" @click="showItemMenu = true">用药</button>
      <button class="btn btn-danger" :disabled="isEnded" @click="doFlee">逃跑</button>
    </div>

    <div v-if="showSkillMenu && !isEnded" class="result-overlay" @click.self="showSkillMenu = false">
      <div class="result-card" style="max-width: 500px;">
        <div class="result-title" style="color: var(--text-accent); font-size: 18px;">选择武功</div>
        <div class="weapon-line" style="margin-top: 4px; font-size: 12px; color: var(--text-tertiary);">
          当前兵器：{{ equippedWeapon ? equippedWeapon.name + '（' + equippedSchoolLabel + '）' : '空手（拳脚）' }}
          — 功法与兵器相合方展威
        </div>
        <div class="skill-list" style="margin-top: 12px;">
          <button
            v-for="skill in availableSkills"
            :key="skill.id"
            class="skill-card"
            :disabled="!skill.canUse"
            :style="{ opacity: skill.canUse ? 1 : 0.4, cursor: skill.canUse ? 'pointer' : 'not-allowed', width: '100%', background: 'transparent' }"
            @click="skill.canUse && doUseSkill(skill.id)"
          >
              <div class="skill-info" style="text-align: left;">
              <div class="skill-name">
                {{ skill.name }}
                <span class="school-badge" v-if="skillSchoolLabel(skill)">适配{{ skillSchoolLabel(skill) }}</span>
              </div>
              <div class="skill-desc">威力 {{ skill.power }} · 耗内力 {{ skill.mpCost }}</div>
              <div class="skill-tags" v-if="skillTags(skill).length" style="margin-top: 4px;">
                <span class="skill-tag" v-for="t in skillTags(skill)" :key="t">{{ t }}</span>
              </div>
              <div class="skill-tags" style="margin-top: 4px;" v-if="skill.matched">
                <span class="skill-tag good">✓ 兵刃相合·威力+{{ affinityMatchPct }}%</span>
              </div>
              <div class="skill-tags" style="margin-top: 4px;" v-if="skill.discounted">
                <span class="skill-tag warn">⚠ 兵器不合·威力×{{ affinityMismatchMult }}</span>
              </div>
            </div>
          </button>
        </div>
        <button class="btn" style="margin-top: 12px; width: 100%;" @click="showSkillMenu = false">取消</button>
      </div>
    </div>

    <div v-if="showItemMenu && !isEnded" class="result-overlay" @click.self="showItemMenu = false">
      <div class="result-card" style="max-width: 500px;">
        <div class="result-title" style="color: var(--text-accent); font-size: 18px;">选择物品</div>
        <div class="item-list" style="margin-top: 12px;">
          <button
            v-for="item in consumableItems"
            :key="item.id"
            class="item-card"
            style="width: 100%; background: transparent; cursor: pointer;"
            @click="doUseItem(item.id)"
          >
            <div class="item-info" style="text-align: left;">
              <div class="item-name">{{ item.name }} x{{ item.quantity }}</div>
              <div class="skill-desc">{{ item.description }}</div>
              <div class="item-tags skill-tags" v-if="itemTags(item).length">
                <span class="skill-tag" v-for="t in itemTags(item)" :key="t">{{ t }}</span>
              </div>
            </div>
          </button>
          <div v-if="consumableItems.length === 0" class="empty-text">
            没有可用物品
          </div>
        </div>
        <button class="btn" style="margin-top: 12px; width: 100%;" @click="showItemMenu = false">取消</button>
      </div>
    </div>

    <div v-if="isEnded" class="result-overlay">
      <div class="result-card">
        <div v-if="battle.state === 'victory'" class="result-title victory">大获全胜！</div>
        <div v-else-if="battle.state === 'fled'" class="result-title fled">成功脱身</div>
        <div v-else class="result-title defeat">不敌败北</div>

        <button
          v-if="battle.state === 'defeat'"
          class="btn btn-primary"
          style="width: 100%; margin-top: 8px;"
          @click="returnToGame"
        >返回村落</button>
        <button
          v-else
          class="btn btn-primary"
          style="width: 100%; margin-top: 8px;"
          @click="returnToGame"
        >继续行走江湖</button>
        <button
          class="btn"
          style="width: 100%; margin-top: 8px;"
          @click="returnToMenu"
        >返回主菜单</button>
      </div>
    </div>
  </div>

  <div v-else class="empty-text" style="flex: 1; display: flex; align-items: center; justify-content: center;">
    <button class="btn btn-primary" @click="router.push('/game')">返回</button>
  </div>
</template>
