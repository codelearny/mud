<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBattleStore } from '../stores/battle'
import { usePlayerStore } from '../stores/player'
import { getSkill, getItem } from '../engine/data-loader'
import { skillTags, skillSchoolLabel } from '../engine/skill-utils'
import { itemTags } from '../engine/item-utils'
import GameLog from '../components/GameLog.vue'
import type { Skill, Item } from '../types'

const router = useRouter()
const battleStore = useBattleStore()
const playerStore = usePlayerStore()

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
    .filter((x): x is Item & { quantity: number } => x !== null && x.type === 'consumable')
})

const dropNames = computed(() => {
  if (!result.value || result.value.drops.length === 0) return []
  return result.value.drops.map(id => getItem(id)?.name ?? id)
})

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

function returnToGame() {
  if (battle.value?.state === 'defeat') {
    playerStore.setHpMp(1, 0)
  }
  battleStore.clearBattle()
  router.push('/game')
}

function returnToMenu() {
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
              <div class="skill-tags" style="margin-top: 4px;" v-if="skill.discounted">
                <span class="skill-tag warn">⚠ 兵器不合·威力折扣</span>
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

        <div class="result-details" v-if="result && !result.fled">
          <p class="reward-line">获得经验 {{ result.exp }} 点</p>
          <p class="reward-line">获得银两 {{ result.gold }} 两</p>
          <p v-for="name in dropNames" :key="name" class="reward-line">
            获得物品 {{ name }}
          </p>
          <p v-if="result.leveledUp" class="level-up-text">
            功力精进！突破至第 {{ result.newLevel }} 重！
          </p>
        </div>

        <div class="result-details" v-else-if="battle.state === 'defeat'">
          <p>你伤痕累累，昏倒在地......</p>
          <p>醒来时发现自己被好心人救回村落。</p>
        </div>

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
