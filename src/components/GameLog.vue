<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { BattleLogEntry } from '../types'

const props = defineProps<{
  entries: BattleLogEntry[]
}>()

const logContainer = ref<HTMLElement | null>(null)

watch(
  () => props.entries.length,
  () => {
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight
      }
    })
  }
)
</script>

<template>
  <div class="game-log" ref="logContainer">
    <div
      v-for="(entry, idx) in entries"
      :key="idx"
      class="log-entry"
      :class="entry.actor"
    >
      <span class="turn-tag" v-if="entry.turn > 0">[第{{ entry.turn }}回合]</span>
      <span :class="entry.type">{{ entry.text }}</span>
    </div>
  </div>
</template>
