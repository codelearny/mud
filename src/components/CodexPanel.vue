<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player'
import { getAllEnemies, getAllSkills, getAllItems, getAllShops, getSkill } from '../engine/data-loader'
import type { Enemy, Skill, Item } from '../types'

const playerStore = usePlayerStore()

type Tab = 'enemy' | 'skill' | 'manual' | 'equip'
const tab = ref<Tab>('enemy')
const TABS: { key: Tab; label: string }[] = [
  { key: 'enemy', label: '敌人' },
  { key: 'skill', label: '武功' },
  { key: 'manual', label: '秘籍' },
  { key: 'equip', label: '装备' },
]

const RARITY_LABEL: Record<string, string> = {
  common: '寻常',
  rare: '珍品',
  epic: '精妙',
  legendary: '绝世',
}
const RARITY_CLASS: Record<string, string> = {
  common: 'r-common',
  rare: 'r-rare',
  epic: 'r-epic',
  legendary: 'r-legendary',
}
const SKILL_CAT_LABEL: Record<string, string> = {
  sword: '剑法', blade: '刀法', fist: '拳脚', staff: '棍棒', internal: '内功', movement: '轻功',
}
const SKILL_CAT_ORDER = ['sword', 'blade', 'fist', 'staff', 'internal', 'movement']

const discoveredEnemies = computed(() => new Set(playerStore.character?.discoveredEnemies ?? []))
const discoveredItems = computed(() => new Set(playerStore.character?.discoveredItems ?? []))
const learnedSkills = computed(() => new Set((playerStore.character?.learnedSkills ?? []).map(s => s.skillId)))

// —— 敌人（按大类分组，遭遇即录）——
const ENEMY_CAT_LABEL: Record<string, string> = { beast: '异兽', bandit: '匪类', evil: '邪魔', boss: '头目' }
const ENEMY_CAT_ORDER = ['beast', 'bandit', 'evil', 'boss']
const enemyGroups = computed(() => {
  const map = new Map<string, Enemy[]>()
  for (const e of getAllEnemies()) {
    const c = e.category ?? 'other'
    if (!map.has(c)) map.set(c, [])
    map.get(c)!.push(e)
  }
  return Array.from(map.entries())
    .sort((a, b) => (ENEMY_CAT_ORDER.indexOf(a[0]) + 1 || 99) - (ENEMY_CAT_ORDER.indexOf(b[0]) + 1 || 99))
    .map(([cat, list]) => ({
      key: cat,
      label: ENEMY_CAT_LABEL[cat] ?? '其他',
      list: [...list].sort((a, b) => a.level - b.level),
      found: list.filter(e => discoveredEnemies.value.has(e.id)).length,
    }))
})

// —— 武功（按流派分组，习得即录）——
const skillGroups = computed(() => {
  const all = getAllSkills()
  return SKILL_CAT_ORDER
    .map(cat => {
      const list = all.filter(s => s.category === cat).sort((a, b) => a.unlockLevel - b.unlockLevel)
      return { key: cat, label: SKILL_CAT_LABEL[cat] ?? cat, list, found: list.filter(s => learnedSkills.value.has(s.id)).length }
    })
    .filter(g => g.list.length > 0)
})

// —— 秘籍（按稀有度分组，得手即录；参悟消耗后仍记为已得）——
const manualGroups = computed(() => {
  const manuals = getAllItems().filter(i => i.category === 'manual')
  return (['epic', 'legendary'] as const).map(r => {
    const list = manuals.filter(m => m.rarity === r)
    return { key: r, label: RARITY_LABEL[r], list, found: list.filter(m => hasManual(m)).length }
  })
})

function hasManual(m: Item): boolean {
  if (discoveredItems.value.has(m.id)) return true
  return m.skillId ? learnedSkills.value.has(m.skillId) : false
}

// —— 装备（按部位分组，入手即录）——
const EQUIP_LABEL: Record<string, string> = { weapon: '兵刃', armor: '护甲', accessory: '饰品' }
const equipGroups = computed(() => {
  const all = getAllItems().filter(i => ['weapon', 'armor', 'accessory'].includes(i.type))
  return (['weapon', 'armor', 'accessory'] as const).map(t => {
    const list = all.filter(i => i.type === t).sort((a, b) => (a.minLevel ?? 0) - (b.minLevel ?? 0))
    return { key: t, label: EQUIP_LABEL[t], list, found: list.filter(i => discoveredItems.value.has(i.id)).length }
  })
})

// 推导物品来源：哪些敌人掉落 / 哪些店铺有售（引导玩家去哪找）
const sourceMap = computed(() => {
  const map = new Map<string, string[]>()
  const push = (itemId: string, from: string) => {
    if (!map.has(itemId)) map.set(itemId, [])
    const arr = map.get(itemId)!
    if (!arr.includes(from)) arr.push(from)
  }
  for (const e of getAllEnemies()) {
    for (const d of e.drops ?? []) push(d.itemId, e.name)
  }
  for (const s of getAllShops()) {
    for (const st of s.stock ?? []) push(st.itemId, s.name)
  }
  return map
})
function sourceOf(itemId: string): string {
  const from = sourceMap.value.get(itemId)
  if (!from || !from.length) return '来历不明'
  return from.slice(0, 3).join('、') + (from.length > 3 ? ' 等' : '')
}

const totals = computed(() => {
  if (tab.value === 'enemy') {
    const all = getAllEnemies()
    return { found: all.filter(e => discoveredEnemies.value.has(e.id)).length, total: all.length }
  }
  if (tab.value === 'skill') {
    const all = getAllSkills()
    return { found: all.filter(s => learnedSkills.value.has(s.id)).length, total: all.length }
  }
  if (tab.value === 'manual') {
    const all = getAllItems().filter(i => i.category === 'manual')
    return { found: all.filter(m => hasManual(m)).length, total: all.length }
  }
  const all = getAllItems().filter(i => ['weapon', 'armor', 'accessory'].includes(i.type))
  return { found: all.filter(i => discoveredItems.value.has(i.id)).length, total: all.length }
})

const hintText: Record<Tab, string> = {
  enemy: '遭遇即录，所见皆入卷',
  skill: '习得即录，武学源流一目了然',
  manual: '得手即录，参悟之后亦留其名',
  equip: '入手即录，卖出亦不改其载',
}

function skillNames(ids: string[]): string {
  if (!ids.length) return '—'
  return ids.map(id => getSkill(id)?.name ?? id).join('、')
}
function dropText(e: Enemy): string {
  const drops = e.drops ?? []
  if (!drops.length) return '—'
  return drops.map(d => `${getItemName(d.itemId)} ${Math.round(d.rate * 100)}%`).join('、')
}
function getItemName(id: string): string {
  const it = getAllItems().find(i => i.id === id)
  return it?.name ?? id
}
function effectText(it: Item): string {
  if (!it.effects?.length) return '—'
  return it.effects.map(e => `${e.type} +${e.value}`).join('、')
}
function rarityLabel(r?: string): string {
  return RARITY_LABEL[r ?? 'common'] ?? '寻常'
}
function rarityClass(r?: string): string {
  return RARITY_CLASS[r ?? 'common'] ?? 'r-common'
}
function isBoss(e: Enemy): boolean {
  return !!e.boss
}
</script>

<template>
  <div class="codex-wrap">
    <div class="panel">
      <div class="panel-title">江湖图鉴</div>
      <div class="codex-tabs">
        <button
          v-for="t in TABS"
          :key="t.key"
          class="codex-tab"
          :class="{ active: tab === t.key }"
          @click="tab = t.key"
        >{{ t.label }}</button>
      </div>
      <p class="codex-progress">
        已录 <b>{{ totals.found }}</b> / 共 {{ totals.total }} · {{ hintText[tab] }}
      </p>
    </div>

    <!-- 敌人 -->
    <template v-if="tab === 'enemy'">
      <div class="panel" v-for="g in enemyGroups" :key="g.key">
        <div class="panel-title codex-group-title">
          {{ g.label }}<span class="codex-group-count">{{ g.found }} / {{ g.list.length }}</span>
        </div>
        <div class="codex-grid">
          <template v-for="e in g.list" :key="e.id">
            <div class="codex-card" v-if="discoveredEnemies.has(e.id)">
              <div class="codex-card-head">
                <span class="codex-name">{{ e.name }}</span>
                <span v-if="isBoss(e)" class="codex-boss-tag">头目</span>
              </div>
              <div class="codex-meta">等级 {{ e.level }} · {{ g.label }}</div>
              <p class="codex-desc">{{ e.description }}</p>
              <div class="codex-detail"><span class="codex-detail-label">武功</span>{{ skillNames(e.skills) }}</div>
              <div class="codex-detail"><span class="codex-detail-label">掉落</span>{{ dropText(e) }}</div>
              <div class="codex-detail"><span class="codex-detail-label">赏金</span>{{ e.goldReward }} 两</div>
            </div>
            <div class="codex-card locked" v-else>
              <div class="codex-card-head"><span class="codex-name">？？？</span></div>
              <div class="codex-meta">{{ g.label }}</div>
              <p class="codex-desc locked-text">尚未遭遇，江湖险恶，且去历练。</p>
            </div>
          </template>
        </div>
      </div>
    </template>

    <!-- 武功 -->
    <template v-else-if="tab === 'skill'">
      <div class="panel" v-for="g in skillGroups" :key="g.key">
        <div class="panel-title codex-group-title">
          {{ g.label }}<span class="codex-group-count">{{ g.found }} / {{ g.list.length }}</span>
        </div>
        <div class="codex-grid">
          <div
            class="codex-card"
            v-for="s in g.list"
            :key="s.id"
            :class="{ locked: !learnedSkills.has(s.id) }"
          >
            <div class="codex-card-head">
              <span class="codex-name">{{ s.name }}</span>
              <span class="codex-rarity" :class="rarityClass(s.rarity)">{{ rarityLabel(s.rarity) }}</span>
            </div>
            <div class="codex-meta">{{ g.label }} · 需第{{ s.unlockLevel }}重</div>
            <p class="codex-desc">{{ s.description }}</p>
            <div class="codex-detail" v-if="learnedSkills.has(s.id)">
              <span class="codex-detail-label">威力</span>{{ s.power }} · 耗内力 {{ s.mpCost }} · 命中 {{ Math.round(s.hitRate * 100) }}%
            </div>
            <div class="codex-detail" v-else>
              <span class="codex-detail-label">状态</span><span class="locked-text">尚未习得</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 秘籍 -->
    <template v-else-if="tab === 'manual'">
      <div class="panel" v-for="g in manualGroups" :key="g.key">
        <div class="panel-title codex-group-title">
          {{ g.label }}秘籍<span class="codex-group-count">{{ g.found }} / {{ g.list.length }}</span>
        </div>
        <div class="codex-grid">
          <template v-for="m in g.list" :key="m.id">
            <div class="codex-card" v-if="hasManual(m)">
              <div class="codex-card-head">
                <span class="codex-name">{{ m.name }}</span>
                <span class="codex-rarity" :class="rarityClass(m.rarity)">{{ rarityLabel(m.rarity) }}</span>
              </div>
              <div class="codex-meta">所载：{{ m.skillId ? (getSkill(m.skillId)?.name ?? m.skillId) : '—' }}</div>
              <p class="codex-desc">{{ m.description }}</p>
              <div class="codex-detail"><span class="codex-detail-label">来历</span>{{ sourceOf(m.id) }}</div>
            </div>
            <div class="codex-card locked" v-else>
              <div class="codex-card-head">
                <span class="codex-name">？？？</span>
                <span class="codex-rarity" :class="rarityClass(m.rarity)">{{ rarityLabel(m.rarity) }}</span>
              </div>
              <div class="codex-meta">未得秘籍</div>
              <p class="codex-desc locked-text">下落不明，或藏于某位头目之手。</p>
            </div>
          </template>
        </div>
      </div>
    </template>

    <!-- 装备 -->
    <template v-else>
      <div class="panel" v-for="g in equipGroups" :key="g.key">
        <div class="panel-title codex-group-title">
          {{ g.label }}<span class="codex-group-count">{{ g.found }} / {{ g.list.length }}</span>
        </div>
        <div class="codex-grid">
          <template v-for="it in g.list" :key="it.id">
            <div class="codex-card" v-if="discoveredItems.has(it.id)">
              <div class="codex-card-head">
                <span class="codex-name">{{ it.name }}</span>
                <span class="codex-rarity" :class="rarityClass(it.rarity)">{{ rarityLabel(it.rarity) }}</span>
              </div>
              <div class="codex-meta">{{ g.label }} · 需第{{ it.minLevel ?? 0 }}重</div>
              <p class="codex-desc">{{ it.description }}</p>
              <div class="codex-detail"><span class="codex-detail-label">属性</span>{{ effectText(it) }}</div>
              <div class="codex-detail"><span class="codex-detail-label">来历</span>{{ sourceOf(it.id) }}</div>
            </div>
            <div class="codex-card locked" v-else>
              <div class="codex-card-head">
                <span class="codex-name">？？？</span>
                <span class="codex-rarity" :class="rarityClass(it.rarity)">{{ rarityLabel(it.rarity) }}</span>
              </div>
              <div class="codex-meta">{{ g.label }}</div>
              <p class="codex-desc locked-text">尚未入手，不知其详。</p>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.codex-wrap {
  padding: 10px;
  flex: 1;
}
.codex-tabs {
  display: flex;
  gap: 6px;
  margin: 8px 0 4px;
  flex-wrap: wrap;
}
.codex-tab {
  font-family: var(--font-serif);
  font-size: 13px;
  padding: 4px 14px;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  cursor: pointer;
}
.codex-tab.active {
  color: var(--text-accent);
  border-color: var(--text-accent);
  background: rgba(201, 168, 76, 0.1);
}
.codex-progress {
  font-family: var(--font-serif);
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 6px;
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
  flex-wrap: wrap;
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
.codex-rarity {
  font-size: 10px;
  border-radius: 3px;
  padding: 0 4px;
  border: 1px solid;
}
.r-common { color: #d3d1c7; border-color: rgba(211, 209, 199, 0.5); }
.r-rare { color: #9fe1cb; border-color: rgba(29, 158, 117, 0.6); }
.r-epic { color: #c9b6f5; border-color: rgba(127, 119, 221, 0.65); }
.r-legendary { color: #f7cf8a; border-color: rgba(230, 180, 60, 0.7); }
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
