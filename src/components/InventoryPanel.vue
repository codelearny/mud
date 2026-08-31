<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useMessageStore } from '../stores/messages'
import { getItem } from '../engine/data-loader'
import { itemTags, RARITY_LABELS, itemSchoolLabel } from '../engine/item-utils'
import type { EquipSlot, Item, ItemType, ItemRarity } from '../types'

const playerStore = usePlayerStore()
const messageStore = useMessageStore()
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
  material: '材料'
}

function isEquipped(itemId: string): boolean {
  if (!char.value) return false
  return Object.values(char.value.equipment).includes(itemId)
}

function canEquip(item: Item): boolean {
  if (!item.slot || !char.value) return false
  if (item.minLevel && char.value.level < item.minLevel) return false
  return !isEquipped(item.id)
}

function rarityClass(rarity?: ItemRarity): string {
  return rarity ? `rarity-${rarity}` : 'rarity-common'
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

function studyManual(itemId: string) {
  const manualName = getItem(itemId)?.name ?? itemId
  const res = playerStore.studyManual(itemId)
  if (res.ok) {
    messageStore.addMessage(`研习《${manualName}》，习得「${res.skillName ?? ''}」`, 'reward')
  } else {
    messageStore.addMessage(`参悟《${manualName}》未成：${res.reason ?? '未知缘由'}`, 'info')
  }
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
            <span v-if="char.equipment[slot.key]" class="rarity-badge" :class="rarityClass(getItem(char.equipment[slot.key]!)?.rarity)">
              {{ RARITY_LABELS[getItem(char.equipment[slot.key]!)?.rarity ?? 'common'] }}
            </span>
            <span v-if="char.equipment[slot.key] && itemSchoolLabel(getItem(char.equipment[slot.key]!)!)" class="school-badge">
              {{ itemSchoolLabel(getItem(char.equipment[slot.key]!)!) }}
            </span>
          </div>
          <div class="item-tags" v-if="char.equipment[slot.key] && itemTags(getItem(char.equipment[slot.key]!)!).length">
            <span class="skill-tag" v-for="t in itemTags(getItem(char.equipment[slot.key]!)!)" :key="t">{{ t }}</span>
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
            <span class="rarity-badge" :class="rarityClass(item.rarity)">{{ RARITY_LABELS[item.rarity ?? 'common'] }}</span>
            <span class="school-badge" v-if="itemSchoolLabel(item)">{{ itemSchoolLabel(item) }}</span>
          </div>
          <div class="item-desc">{{ item.description }}</div>
          <div class="item-meta" style="color: var(--text-tertiary);">
            {{ typeLabels[item.type] }}<template v-if="item.minLevel"> · 需{{ item.minLevel }}级</template>
          </div>
          <div class="item-tags" v-if="itemTags(item).length">
            <span class="skill-tag" v-for="t in itemTags(item)" :key="t">{{ t }}</span>
          </div>
        </div>
        <div class="item-actions">
          <button
            v-if="item.category === 'manual'"
            class="btn btn-primary"
            @click="studyManual(item.id)"
          >研读</button>
          <button
            v-if="item.type === 'consumable'"
            class="btn btn-primary"
            @click="useItem(item.id)"
          >使用</button>
          <button
            v-if="item.slot"
            class="btn"
            :disabled="!canEquip(item)"
            :title="item.minLevel && char.level < item.minLevel ? `需${item.minLevel}级方可装备` : ''"
            @click="canEquip(item) && equip(item.id)"
          >{{ isEquipped(item.id) ? '已装备' : '装备' }}</button>
        </div>
      </div>
    </div>
    <div v-else class="empty-text">背包空空如也</div>
  </div>
</template>
