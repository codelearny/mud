<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player'
import { getAllEnemies, getSkill, getItem } from '../engine/data-loader'
import type { Enemy } from '../types'

const playerStore = usePlayerStore()

// 图鉴按怪物大类分组（与 src/data/enemies 下的拆分配置一一对应）
const CATEGORY_LABELS: Record<string, string> = {
  beast: '异兽',
  bandit: '匪类',
  evil: '邪魔',
  boss: '头目',
}
const CATEGORY_ORDER = ['beast', 'bandit', 'evil', 'boss']

const all = computed(() => getAllEnemies())
const discovered = computed(() => new Set(playerStore.character?.discoveredEnemies ?? []))

const groups = computed(() => {
  const map = new Map<string, Enemy[]>()
  for (const e of all.value) {
    const cat = e.category ?? 'other'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(e)
  }
  const entries = Array.from(map.entries())
  entries.sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a[0])
    const ib = CATEGORY_ORDER.indexOf(b[0])
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
  return entries.map(([cat, list]) => ({
    key: cat,
    label: CATEGORY_LABELS[cat] ?? '其他',
    enemies: [...list].sort((a, b) => a.level - b.level),
    found: list.filter(e => discovered.value.has(e.id)).length,
  }))
})

const total = computed(() => all.value.length)
const discoveredCount = computed(() =>
  all.value.filter(e => discovered.value.has(e.id)).length
)

function isDiscovered(e: Enemy): boolean {
  return discovered.value.has(e.id)
}

function skillNames(ids: string[]): string {
  if (!ids.length) return '—'
  return ids.map(id => getSkill(id)?.name ?? id).join('、')
}

function dropText(e: Enemy): string {
  const drops = e.drops ?? []
  if (!drops.length) return '—'
  return drops
    .map(d => `${getItem(d.itemId)?.name ?? d.itemId} ${Math.round(d.rate * 100)}%`)
    .join('、')
}
</script>

<template>
  <div class="codex-wrap">
    <div class="panel">
      <div class="panel-title">江湖图鉴</div>
      <p class="codex-progress">
        已录 <b>{{ discoveredCount }}</b> / 共 {{ total }} 种 ·
        遭遇即录，所见皆入卷
      </p>
    </div>

    <div class="panel" v-for="g in groups" :key="g.key">
      <div class="panel-title codex-group-title">
        {{ g.label }}
        <span class="codex-group-count">{{ g.found }} / {{ g.enemies.length }}</span>
      </div>

      <div class="codex-grid">
        <template v-for="e in g.enemies" :key="e.id">
          <!-- 已发现：完整展示 -->
          <div class="codex-card" v-if="isDiscovered(e)">
            <div class="codex-card-head">
              <span class="codex-name">{{ e.name }}</span>
              <span v-if="e.boss" class="codex-boss-tag">头目</span>
            </div>
            <div class="codex-meta">等级 {{ e.level }} · {{ g.label }}</div>
            <p class="codex-desc">{{ e.description }}</p>
            <div class="codex-detail"><span class="codex-detail-label">武功</span>{{ skillNames(e.skills) }}</div>
            <div class="codex-detail"><span class="codex-detail-label">掉落</span>{{ dropText(e) }}</div>
            <div class="codex-detail"><span class="codex-detail-label">赏金</span>{{ e.goldReward }} 两</div>
          </div>

          <!-- 未发现：占位 -->
          <div class="codex-card locked" v-else>
            <div class="codex-card-head">
              <span class="codex-name">？？？</span>
            </div>
            <div class="codex-meta">{{ g.label }}</div>
            <p class="codex-desc locked-text">尚未遭遇，江湖险恶，且去历练。</p>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.codex-wrap {
  padding: 10px;
  flex: 1;
}
.codex-progress {
  font-family: var(--font-serif);
  font-size: 13px;
  color: var(--text-secondary);
}
.codex-progress b {
  color: var(--text-accent);
  font-size: 15px;
}
.codex-group-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.codex-group-count {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: var(--font-sans);
}
.codex-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.codex-card {
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  font-family: var(--font-serif);
}
.codex-card.locked {
  opacity: 0.6;
  border-style: dashed;
}
.codex-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.codex-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}
.codex-boss-tag {
  font-size: 10px;
  color: var(--text-danger);
  border: 1px solid var(--text-danger);
  border-radius: 3px;
  padding: 0 4px;
}
.codex-meta {
  font-size: 12px;
  color: var(--text-info);
  margin-bottom: 4px;
}
.codex-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.7;
  margin-bottom: 6px;
}
.codex-desc.locked-text {
  font-style: italic;
  color: var(--text-tertiary);
}
.codex-detail {
  font-size: 12px;
  color: var(--text-primary);
  line-height: 1.6;
  margin-top: 2px;
}
.codex-detail-label {
  display: inline-block;
  width: 32px;
  color: var(--text-secondary);
  margin-right: 6px;
}
@media (max-width: 480px) {
  .codex-grid { grid-template-columns: 1fr; }
}
</style>
