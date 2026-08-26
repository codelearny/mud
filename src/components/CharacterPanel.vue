<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player'
import { getEffectiveAttributes } from '../engine/character'
import { getItem } from '../engine/data-loader'
import type { EquipSlot } from '../types'

const playerStore = usePlayerStore()
const char = computed(() => playerStore.character)

const eff = computed(() => {
  if (!char.value) return null
  return getEffectiveAttributes(char.value)
})

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
  </div>
</template>
