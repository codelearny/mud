<script setup lang="ts">
import { computed } from 'vue'
import { useStoryStore } from '../stores/story'
import { usePlayerStore } from '../stores/player'
import { getAllQuests, getItem } from '../engine/data-loader'

const storyStore = useStoryStore()
const playerStore = usePlayerStore()

const activeQuests = computed(() => storyStore.activeQuests)
const completedQuests = computed(() => storyStore.completedQuests)

function progressText(questId: string): string {
  const q = getAllQuests().find(x => x.id === questId)
  if (!q) return ''
  const c = q.completeCondition
  if (c.type === 'counter') {
    const cur = storyStore.counters[c.target] ?? 0
    return `进度：${cur} / ${c.value}`
  }
  if (c.type === 'item') {
    const name = getItem(c.target)?.name ?? '道具'
    const cur = playerStore.getItemCount(c.target)
    return `进度：${name} ${cur} / ${c.value}`
  }
  return '进行中'
}
</script>

<template>
  <div class="quest-wrap">
    <div class="panel" v-if="activeQuests.length">
      <div class="panel-title">进行中</div>
      <div v-for="q in activeQuests" :key="q.id" class="quest-item">
        <div class="quest-name">{{ q.name }}</div>
        <div class="quest-desc">{{ q.description }}</div>
        <div class="quest-progress">{{ progressText(q.id) }}</div>
      </div>
    </div>

    <div class="panel" v-if="completedQuests.length">
      <div class="panel-title">已完成</div>
      <div v-for="q in completedQuests" :key="q.id" class="quest-item completed">
        <div class="quest-name">✔ {{ q.name }}</div>
        <div class="quest-desc">{{ q.description }}</div>
      </div>
    </div>

    <div
      v-if="!activeQuests.length && !completedQuests.length"
      class="empty-text"
    >暂无任务，去江湖中闯荡吧。</div>
  </div>
</template>
