<script setup lang="ts">
import { computed } from 'vue'
import { useStoryStore } from '../stores/story'
import type { DialogueChoice } from '../types'

const storyStore = useStoryStore()

const npc = computed(() => storyStore.currentNpc)
const node = computed(() => storyStore.currentDialogueNode)
const choices = computed(() => storyStore.visibleDialogueChoices)

function choose(choice: DialogueChoice) {
  storyStore.selectDialogueChoice(choice)
}
</script>

<template>
  <div class="result-overlay" @click.self="storyStore.closeDialogue()">
    <div class="result-card dialogue-card">
      <div v-if="npc" class="dialogue-speaker">
        {{ npc.name }}<span class="dialogue-title">{{ npc.title }}</span>
      </div>
      <p class="dialogue-text">{{ node?.text }}</p>
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
          @click="storyStore.closeDialogue()"
        >离开</button>
      </div>
    </div>
  </div>
</template>
