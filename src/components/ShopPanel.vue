<script setup lang="ts">
import { computed } from 'vue'
import { useShopStore } from '../stores/shop'
import { usePlayerStore } from '../stores/player'
import { getNPC } from '../engine/data-loader'
import { itemTags, RARITY_LABELS, itemSchoolLabel } from '../engine/item-utils'
import type { Item, ItemRarity } from '../types'

const shopStore = useShopStore()
const playerStore = usePlayerStore()

const shop = computed(() => shopStore.currentShop)
const gold = computed(() => playerStore.character?.gold ?? 0)
const qty = computed(() => shopStore.quantity)
const mode = computed(() => shopStore.mode)
const buyList = computed(() => shopStore.buyList)
const sellList = computed(() => shopStore.sellList)

const keeperName = computed(() =>
  shop.value?.npcId ? (getNPC(shop.value.npcId)?.name ?? '') : ''
)

function rarityClass(rarity?: ItemRarity): string {
  return rarity ? `rarity-${rarity}` : 'rarity-common'
}

function canBuy(row: { item: Item; price: number; remaining?: number; levelReq?: number }): boolean {
  if (row.levelReq && playerStore.character && playerStore.character.level < row.levelReq) return false
  if (row.remaining !== undefined && qty.value > row.remaining) return false
  return gold.value >= row.price * qty.value
}

function canSell(row: { item: Item; owned: number; equipped: boolean }): boolean {
  if (row.equipped) return false
  return row.owned >= qty.value
}
</script>

<template>
  <div class="result-overlay" @click.self="shopStore.closeShop()">
    <div class="result-card shop-card">
      <div class="shop-header">
        <div>
          <div class="shop-name">{{ shop?.name }}</div>
          <div class="shop-keeper">掌柜：{{ keeperName }}</div>
        </div>
        <div class="gold-display">💰 {{ gold }} 两</div>
      </div>
      <p class="shop-desc">{{ shop?.description }}</p>

      <div class="shop-tabs">
        <button class="btn" :class="{ 'btn-primary': mode === 'buy' }" @click="shopStore.setMode('buy')">收购</button>
        <button class="btn" :class="{ 'btn-primary': mode === 'sell' }" @click="shopStore.setMode('sell')">摆摊</button>
      </div>

      <div class="qty-bar">
        <span class="qty-label">数量</span>
        <button class="btn qty-btn" @click="shopStore.decQty()">−</button>
        <span class="qty-num">{{ qty }}</span>
        <button class="btn qty-btn" @click="shopStore.incQty()">＋</button>
      </div>

      <div v-if="shopStore.message" class="shop-toast">{{ shopStore.message }}</div>

      <div class="shop-list">
        <template v-if="mode === 'buy'">
          <div class="item-card" v-for="row in buyList" :key="row.item.id">
            <div class="item-info">
              <div class="item-name">
                {{ row.item.name }}
                <span class="rarity-badge" :class="rarityClass(row.item.rarity)">{{ RARITY_LABELS[row.item.rarity ?? 'common'] }}</span>
                <span class="school-badge" v-if="itemSchoolLabel(row.item)">{{ itemSchoolLabel(row.item) }}</span>
              </div>
              <div class="item-desc">{{ row.item.description }}</div>
              <div class="item-tags" v-if="itemTags(row.item).length">
                <span class="skill-tag" v-for="t in itemTags(row.item)" :key="t">{{ t }}</span>
              </div>
              <div class="shop-price">
                售价 <span class="price-gold">{{ row.price }}</span> 两
                <template v-if="row.remaining !== undefined"> · 余 {{ row.remaining }}</template>
                <template v-if="row.levelReq"> · 需{{ row.levelReq }}级</template>
              </div>
            </div>
            <div class="item-actions">
              <button class="btn btn-primary" :disabled="!canBuy(row)" @click="shopStore.buy(row.item.id)">购入</button>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="item-card" v-for="row in sellList" :key="row.item.id">
            <div class="item-info">
              <div class="item-name">
                {{ row.item.name }}
                <span class="equipped-badge">x{{ row.owned }}</span>
                <span class="rarity-badge" :class="rarityClass(row.item.rarity)">{{ RARITY_LABELS[row.item.rarity ?? 'common'] }}</span>
                <span class="school-badge" v-if="itemSchoolLabel(row.item)">{{ itemSchoolLabel(row.item) }}</span>
              </div>
              <div class="item-desc">{{ row.item.description }}</div>
              <div class="item-tags" v-if="itemTags(row.item).length">
                <span class="skill-tag" v-for="t in itemTags(row.item)" :key="t">{{ t }}</span>
              </div>
              <div class="shop-price">
                回收 <span class="price-gold">{{ row.price }}</span> 两
                <template v-if="row.equipped"> · <span class="warn-text">已装备</span></template>
              </div>
            </div>
            <div class="item-actions">
              <button class="btn" :disabled="!canSell(row)" @click="shopStore.sell(row.item.id)">售出</button>
            </div>
          </div>
          <div v-if="sellList.length === 0" class="empty-text">行囊空空，无物可卖。</div>
        </template>
      </div>

      <button class="btn" style="width: 100%; margin-top: 12px;" @click="shopStore.closeShop()">离开商铺</button>
    </div>
  </div>
</template>
