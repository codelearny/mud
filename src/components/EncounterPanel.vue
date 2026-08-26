<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useStoryStore } from '../stores/story'
import { useBattleStore } from '../stores/battle'
import type { DialogueChoice } from '../types'

const router = useRouter()
const storyStore = useStoryStore()
const battleStore = useBattleStore()

const encounter = computed(() => storyStore.currentEncounter)
const choices = computed(() => storyStore.visibleEncounterChoices)

function choose(choice: DialogueChoice) {
  storyStore.selectEncounterChoice(choice)
  if (choice.battle) {
    battleStore.startBattle(choice.battle)
    router.push('/battle')
  }
}
</script>

<template>
  <div v-if="encounter" class="result-overlay" @click.self="storyStore.closeEncounter()">
    <div class="result-card dialogue-card">
      <div class="dialogue-speaker encounter-title">{{ encounter.title }}</div>
      <p class="dialogue-text">{{ encounter.text }}</p>
      <div class="dialogue-choices">
        <button
          v-for="(c, i) in choices"
          :key="i"
          class="btn dialogue-choice"
          @click="choose(c)"
        >{{ c.text }}</button>
        <button
          v-if="choices.length === 0"
          class="btn dialogue-choice"
          @click="storyStore.closeEncounter()"
        >离去</button>
      </div>
    </div>
  </div>
</template>
