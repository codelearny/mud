<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player'
import { getItem } from '../engine/data-loader'
import type { EquipSlot, Item, ItemType } from '../types'

const playerStore = usePlayerStore()
const char = computed(() => playerStore.character)

const slots: { key: EquipSlot; label: string }[] = [
  { key: 'weapon', label: '武器' },
  { key: 'armor', label: '防具' },
  { key: 'accessory', label: '饰品' },
]

const inventoryItems = computed(() => {
  if (!char.value) return []
  return char.value.inventory.map(inv => {
    const item = getItem(inv.itemId)
    return item ? { ...item, quantity: inv.quantity } : null
  }).filter((x): x is Item & { quantity: number } => x !== null)
})

const typeLabels: Record<ItemType, string> = {
  weapon: '武器',
  armor: '防具',
  accessory: '饰品',
  consumable: '消耗品',
  material: '材料',
}

function effectText(item: Item): string {
  if (!item.effects) return ''
  return item.effects.map(e => {
    const labels: Record<string, string> = {
      hp: '气血', mp: '内力', attack: '攻击',
      defense: '防御', agility: '轻功', cure: '治疗'
    }
    return `${labels[e.type] ?? e.type}+${e.value}`
  }).join(' / ')
}

function isEquipped(itemId: string): boolean {
  if (!char.value) return false
  return Object.values(char.value.equipment).includes(itemId)
}

function equip(itemId: string) {
  playerStore.equip(itemId)
}

function unequip(slot: EquipSlot) {
  playerStore.unequip(slot)
}

function useItem(itemId: string) {
  playerStore.useItem(itemId)
}
</script>

<template>
  <div class="panel" v-if="char">
    <div class="panel-title">已装备</div>
    <div class="item-list">
      <div class="item-card" v-for="slot in slots" :key="slot.key">
        <div class="item-info">
          <div class="item-name">
            {{ slot.label }}：{{ char.equipment[slot.key] ? getItem(char.equipment[slot.key]!)?.name : '空' }}
          </div>
          <div class="item-desc" v-if="char.equipment[slot.key]">
            {{ effectText(getItem(char.equipment[slot.key]!)!) }}
          </div>
        </div>
        <div class="item-actions" v-if="char.equipment[slot.key]">
          <button class="btn btn-danger" @click="unequip(slot.key)">卸下</button>
        </div>
      </div>
    </div>

    <div class="panel-title" style="margin-top: 12px;">背包</div>
    <div class="item-list" v-if="inventoryItems.length > 0">
      <div class="item-card" v-for="item in inventoryItems" :key="item.id">
        <div class="item-info">
          <div class="item-name">
            {{ item.name }}
            <span class="equipped-badge">x{{ item.quantity }}</span>
            <span class="equipped-badge" v-if="isEquipped(item.id)">已装备</span>
          </div>
          <div class="item-desc">{{ item.description }}</div>
          <div class="item-desc" style="color: var(--text-tertiary);">
            {{ typeLabels[item.type] }} · {{ effectText(item) }}
          </div>
        </div>
        <div class="item-actions">
          <button
            v-if="item.type === 'consumable'"
            class="btn btn-primary"
            @click="useItem(item.id)"
          >使用</button>
          <button
            v-if="item.slot && !isEquipped(item.id)"
            class="btn"
            @click="equip(item.id)"
          >装备</button>
        </div>
      </div>
    </div>
    <div v-else class="empty-text">背包空空如也</div>
  </div>
</template>
