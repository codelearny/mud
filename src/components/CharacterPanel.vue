<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player'
import { getEffectiveAttributes } from '../engine/character'
import { getItem, getTalent } from '../engine/data-loader'
import type { EquipSlot, Talent } from '../types'

const playerStore = usePlayerStore()
const char = computed(() => playerStore.character)

const eff = computed(() => {
  if (!char.value) return null
  return getEffectiveAttributes(char.value)
})

// 已顿悟的天赋（升级三选一获得），构成玩家当前 build
const ownedTalents = computed<Talent[]>(() =>
  (char.value?.talents ?? []).map(id => getTalent(id)).filter((t): t is Talent => !!t)
)

const freePoints = computed(() => char.value?.freePoints ?? 0)

// 可由玩家自行分配的自由属性点（基础属性，装备加成叠加其上）
const allocatable = computed(() => [
  { key: 'attack' as const, label: '攻击', value: char.value?.attributes.attack ?? 0 },
  { key: 'defense' as const, label: '防御', value: char.value?.attributes.defense ?? 0 },
  { key: 'agility' as const, label: '轻功', value: char.value?.attributes.agility ?? 0 },
  { key: 'comprehension' as const, label: '悟性', value: char.value?.attributes.comprehension ?? 0 },
  { key: 'luck' as const, label: '运气', value: char.value?.attributes.luck ?? 0 },
])

const slots: { key: EquipSlot; label: string }[] = [
  { key: 'weapon', label: '武器' },
  { key: 'armor', label: '防具' },
  { key: 'accessory', label: '饰品' },
]

function equippedItemName(slot: EquipSlot): string {
  if (!char.value) return '无'
  const id = char.value.equipment[slot]
  if (!id) return '无'
  const item = getItem(id)
  return item ? item.name : '无'
}

function attrDiff(base: number, effective: number): number {
  return effective - base
}

function alloc(stat: 'attack' | 'defense' | 'agility' | 'comprehension' | 'luck') {
  playerStore.allocatePoint(stat)
}
</script>

<template>
  <div class="panel" v-if="char && eff">
    <div class="panel-title">角色信息</div>

    <div style="margin-bottom: 12px;">
      <div class="attr-row">
        <span class="attr-name">姓名</span>
        <span class="attr-value">{{ char.name }}</span>
      </div>
      <div class="attr-row">
        <span class="attr-name">称号</span>
        <span class="attr-value">{{ char.title }}</span>
      </div>
      <div class="attr-row">
        <span class="attr-name">等级</span>
        <span class="attr-value">第 {{ char.level }} 重</span>
      </div>
      <div class="attr-row">
        <span class="attr-name">经验</span>
        <span class="attr-value">{{ char.exp }} / {{ char.expToNext }}</span>
      </div>
    </div>

    <div class="panel-title">属性</div>
    <div class="attr-row">
      <span class="attr-name">气血</span>
      <span class="attr-value">{{ Math.round(eff.hp) }} / {{ eff.maxHp }}</span>
    </div>
    <div class="attr-row">
      <span class="attr-name">内力</span>
      <span class="attr-value">{{ Math.round(eff.mp) }} / {{ eff.maxMp }}</span>
    </div>

    <div class="alloc-block" v-if="freePoints > 0">
      <div class="alloc-tip">尚余 <b>{{ freePoints }}</b> 点自由属性，点击「+」分配：</div>
      <div class="alloc-grid">
        <div class="alloc-row" v-for="a in allocatable" :key="a.key">
          <span class="alloc-label">{{ a.label }}</span>
          <span class="alloc-value">{{ a.value }}</span>
          <button class="btn alloc-btn" :disabled="freePoints <= 0" @click="alloc(a.key)">+</button>
        </div>
      </div>
    </div>
    <div v-else class="alloc-done">（自由属性点已分配完毕）</div>

    <div class="attr-row">
      <span class="attr-name">攻击</span>
      <span class="attr-value">
        {{ eff.attack }}
        <span class="attr-bonus" v-if="attrDiff(char.attributes.attack, eff.attack) > 0">
          +{{ attrDiff(char.attributes.attack, eff.attack) }}
        </span>
      </span>
    </div>
    <div class="attr-row">
      <span class="attr-name">防御</span>
      <span class="attr-value">
        {{ eff.defense }}
        <span class="attr-bonus" v-if="attrDiff(char.attributes.defense, eff.defense) > 0">
          +{{ attrDiff(char.attributes.defense, eff.defense) }}
        </span>
      </span>
    </div>
    <div class="attr-row">
      <span class="attr-name">轻功</span>
      <span class="attr-value">
        {{ eff.agility }}
        <span class="attr-bonus" v-if="attrDiff(char.attributes.agility, eff.agility) > 0">
          +{{ attrDiff(char.attributes.agility, eff.agility) }}
        </span>
      </span>
    </div>
    <div class="attr-row">
      <span class="attr-name">悟性</span>
      <span class="attr-value">{{ char.attributes.comprehension }}</span>
    </div>
    <div class="attr-row">
      <span class="attr-name">运气</span>
      <span class="attr-value">{{ char.attributes.luck }}</span>
    </div>

    <div class="panel-title" style="margin-top: 12px;">装备</div>
    <div class="attr-row" v-for="slot in slots" :key="slot.key">
      <span class="attr-name">{{ slot.label }}</span>
      <span class="attr-value">{{ equippedItemName(slot.key) }}</span>
    </div>

    <div class="panel-title" style="margin-top: 12px;">天赋（顿悟）</div>
    <div v-if="ownedTalents.length === 0" class="alloc-done">（尚未顿悟任何天赋，升级时可三选一）</div>
      <div class="talent-chips" v-else>
        <div class="talent-chip" v-for="t in ownedTalents" :key="t.id" :class="'rar-' + t.rarity">
          <span class="tc-name">{{ t.name }}</span>
          <span class="tc-desc">{{ t.description }}</span>
        </div>
      </div>
  </div>
</template>

<style scoped>
.talent-chips {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.talent-chip {
  border: 1px solid #5a4a2f;
  border-left: 3px solid #8a6a35;
  border-radius: 6px;
  padding: 5px 9px;
  background: #15100b;
}
.tc-name {
  font-weight: 700;
  color: #f0e2c0;
  margin-right: 8px;
}
.tc-desc {
  font-size: 12px;
  color: #c2b08a;
}
.rar-rare { border-left-color: #4a90d9; }
.rar-epic { border-left-color: #a85ad9; }
.rar-legendary { border-left-color: #e0a72e; }
.rar-rare .tc-name { color: #9cc6ef; }
.rar-epic .tc-name { color: #cf9ce8; }
.rar-legendary .tc-name { color: #f3c75a; }
</style>
