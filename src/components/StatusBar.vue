<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player'
import { useGameStore } from '../stores/game'
import { useMessageStore } from '../stores/messages'

const router = useRouter()
const playerStore = usePlayerStore()
const gameStore = useGameStore()
const messageStore = useMessageStore()

const char = computed(() => playerStore.character)
const eff = computed(() => playerStore.effectiveAttrs)

const hpPercent = computed(() => {
  if (!eff.value) return 0
  return (eff.value.hp / eff.value.maxHp) * 100
})

const mpPercent = computed(() => {
  if (!eff.value) return 0
  return (eff.value.mp / eff.value.maxMp) * 100
})

const expPercent = computed(() => {
  if (!char.value) return 0
  return (char.value.exp / char.value.expToNext) * 100
})

function saveGame() {
  gameStore.saveGame()
  messageStore.addMessage('存档成功！', 'info')
}

function exitGame() {
  gameStore.saveGame()
  gameStore.exitToMenu()
  playerStore.clear()
  router.push('/')
}
</script>

<template>
  <div class="status-bar" v-if="char && eff">
    <div class="status-info">
      <span class="name">{{ char.name }}</span>
      <span class="level">{{ char.title }} · 第{{ char.level }}重</span>
    </div>
    <div class="status-bars">
      <div class="bar-row">
        <span class="bar-label">气血</span>
        <div class="bar-container small">
          <div class="bar-fill hp" :style="{ width: hpPercent + '%' }"></div>
        </div>
        <span class="bar-label" style="width: auto;">{{ Math.round(eff.hp) }}/{{ eff.maxHp }}</span>
      </div>
      <div class="bar-row">
        <span class="bar-label">内力</span>
        <div class="bar-container small">
          <div class="bar-fill mp" :style="{ width: mpPercent + '%' }"></div>
        </div>
        <span class="bar-label" style="width: auto;">{{ Math.round(eff.mp) }}/{{ eff.maxMp }}</span>
      </div>
    </div>
    <div class="gold-display">
      <span>{{ char.gold }} 两</span>
    </div>
    <div class="status-actions">
      <button class="btn btn-slim" @click="saveGame">存档</button>
      <button class="btn btn-slim btn-danger" @click="exitGame">退出</button>
    </div>
  </div>
</template>
