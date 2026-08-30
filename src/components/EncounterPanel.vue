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
const result = computed(() => storyStore.encounterResult)

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
      <!-- 结果展示：选中动作后停留，明确告知发生了什么 -->
      <template v-if="result">
        <div class="dialogue-speaker encounter-title">结果</div>
        <p class="dialogue-text">{{ result.title }}</p>
        <ul class="encounter-result-lines">
          <li v-for="(line, i) in result.lines" :key="i">{{ line }}</li>
        </ul>
        <div class="dialogue-choices">
          <button class="btn dialogue-choice" @click="storyStore.closeEncounter()">继续</button>
        </div>
      </template>
      <!-- 选择阶段 -->
      <template v-else>
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
      </template>
    </div>
  </div>
</template>

<style scoped>
.encounter-result-lines {
  list-style: none;
  margin: 8px 0 4px;
  padding: 0;
}
.encounter-result-lines li {
  padding: 4px 10px;
  margin: 4px 0;
  background: rgba(255, 215, 140, 0.12);
  border-left: 3px solid #d9a441;
  border-radius: 4px;
  color: #f3e6c4;
  font-size: 14px;
}
</style>
