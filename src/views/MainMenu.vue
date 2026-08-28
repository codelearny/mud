<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player'
import { useGameStore } from '../stores/game'
import { getOrigins } from '../engine/data-loader'
import type { OriginConfig } from '../types'

const router = useRouter()
const playerStore = usePlayerStore()
const gameStore = useGameStore()

type Step = 'menu' | 'name' | 'origin'
const step = ref<Step>('menu')
const playerName = ref('')
const hasSave = ref(playerStore.hasSave())

const origins = computed(() => getOrigins())

const MOD_LABELS: Record<string, string> = {
  attack: '攻击',
  defense: '防御',
  agility: '轻功',
  comprehension: '悟性',
  luck: '运气',
  maxHp: '气血',
  maxMp: '内力',
}

// 将出身的属性增减整理成展示用的列表（正为增益、负为减益）
function modifierList(origin: OriginConfig) {
  return Object.entries(origin.modifiers ?? {}).map(([key, value]) => ({
    label: MOD_LABELS[key] ?? key,
    value: value ?? 0,
    positive: (value ?? 0) >= 0,
  }))
}

function startNewGame() {
  step.value = 'name'
}

function goOrigin() {
  if (playerName.value.trim().length > 0) step.value = 'origin'
}

function selectOrigin(originId: string) {
  const name = playerName.value.trim() || '无名大侠'
  gameStore.newGame(name, originId)
  router.push('/game')
}

function continueGame() {
  if (gameStore.continueGame()) {
    router.push('/game')
  }
}

function backToMenu() {
  step.value = 'menu'
}

function backToName() {
  step.value = 'name'
}
</script>

<template>
  <div class="title-screen">
    <h1 class="game-title">江湖群侠传</h1>
    <p class="game-subtitle">刀光剑影 · 快意恩仇 · 仗剑天涯</p>

    <!-- 第一步：主菜单 -->
    <div v-if="step === 'menu'" class="title-menu">
      <button class="btn btn-primary" @click="startNewGame">新游戏</button>
      <button
        class="btn"
        v-if="hasSave"
        @click="continueGame"
      >继续游戏</button>
    </div>

    <!-- 第二步：留名 -->
    <div v-else-if="step === 'name'" class="title-menu">
      <p style="font-family: var(--font-serif); color: var(--text-secondary); margin-bottom: 4px;">
        少侠请留名
      </p>
      <input
        v-model="playerName"
        class="input-field"
        placeholder="输入你的名字"
        maxlength="8"
        @keyup.enter="goOrigin"
      />
      <button class="btn btn-primary" @click="goOrigin">下一步</button>
      <button class="btn" @click="backToMenu">返回</button>
    </div>

    <!-- 第三步：择出身 -->
    <div v-else class="title-menu origin-menu">
      <p style="font-family: var(--font-serif); color: var(--text-secondary); margin-bottom: 4px;">
        择一出身，定你江湖路数
      </p>
      <div class="origin-grid">
        <button
          v-for="o in origins"
          :key="o.id"
          class="btn origin-card"
          @click="selectOrigin(o.id)"
        >
          <span class="origin-name">{{ o.name }}</span>
          <span class="origin-desc">{{ o.description }}</span>
          <span class="origin-mods">
            <span
              v-for="m in modifierList(o)"
              :key="m.label"
              class="mod-chip"
              :class="m.positive ? 'mod-up' : 'mod-down'"
            >{{ m.label }} {{ m.positive ? '+' : '' }}{{ m.value }}</span>
          </span>
        </button>
      </div>
      <button class="btn" @click="backToName">返回</button>
    </div>
  </div>
</template>

<style scoped>
.origin-menu {
  width: 100%;
  max-width: 520px;
}
.origin-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  width: 100%;
  margin-bottom: 12px;
}
.origin-card {
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 12px 14px;
  text-align: left;
}
.origin-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-accent);
}
.origin-desc {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
}
.origin-mods {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}
.mod-chip {
  font-size: 11px;
  line-height: 1.5;
  border-radius: 3px;
  padding: 0 6px;
  border: 1px solid currentColor;
}
.mod-up { color: var(--text-success); }
.mod-down { color: var(--text-danger); }
@media (max-width: 480px) {
  .origin-grid { grid-template-columns: 1fr; }
}
</style>
