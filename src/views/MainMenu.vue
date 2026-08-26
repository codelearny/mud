<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player'
import { useGameStore } from '../stores/game'

const router = useRouter()
const playerStore = usePlayerStore()
const gameStore = useGameStore()

const showNameInput = ref(false)
const playerName = ref('')
const hasSave = ref(playerStore.hasSave())

function startNewGame() {
  showNameInput.value = true
}

function enterGame() {
  const name = playerName.value.trim() || '无名大侠'
  gameStore.newGame(name)
  router.push('/game')
}

function continueGame() {
  if (gameStore.continueGame()) {
    router.push('/game')
  }
}
</script>

<template>
  <div class="title-screen">
    <h1 class="game-title">江湖群侠传</h1>
    <p class="game-subtitle">刀光剑影 · 快意恩仇 · 仗剑天涯</p>

    <div v-if="!showNameInput" class="title-menu">
      <button class="btn btn-primary" @click="startNewGame">新游戏</button>
      <button
        class="btn"
        v-if="hasSave"
        @click="continueGame"
      >继续游戏</button>
    </div>

    <div v-else class="title-menu">
      <p style="font-family: var(--font-serif); color: var(--text-secondary); margin-bottom: 4px;">
        少侠请留名
      </p>
      <input
        v-model="playerName"
        class="input-field"
        placeholder="输入你的名字"
        maxlength="8"
        @keyup.enter="enterGame"
      />
      <button class="btn btn-primary" @click="enterGame">入江湖</button>
      <button class="btn" @click="showNameInput = false">返回</button>
    </div>
  </div>
</template>
