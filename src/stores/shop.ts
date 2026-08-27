import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Item, Shop, ShopItemEntry } from '../types'
import { getShop, getItem } from '../engine/data-loader'
import { buyItem, sellItem, buyPrice, sellPrice } from '../engine/shop'
import { usePlayerStore } from './player'

export interface BuyRow {
  item: Item
  price: number
  remaining?: number   // 现存数量（无限则为 undefined）
  levelReq?: number
}

export interface SellRow {
  item: Item
  owned: number
  price: number
  equipped: boolean
}

// 商铺 store：只管 UI 状态与买卖动作编排，所有数值规则在 engine/shop.ts。
export const useShopStore = defineStore('shop', () => {
  const currentShopId = ref<string | null>(null)
  const mode = ref<'buy' | 'sell'>('buy')
  const quantity = ref(1)
  const stockLeft = ref<Record<string, number>>({})
  const message = ref('')
  let msgTimer: ReturnType<typeof setTimeout> | undefined

  const currentShop = computed<Shop | null>(() =>
    currentShopId.value ? (getShop(currentShopId.value) ?? null) : null
  )

  const playerGold = computed(() => usePlayerStore().character?.gold ?? 0)

  const buyList = computed<BuyRow[]>(() => {
    const shop = currentShop.value
    if (!shop) return []
    const rows: BuyRow[] = []
    for (const entry of shop.stock) {
      const item = getItem(entry.itemId)
      if (!item) continue
      const remaining = entry.limit !== undefined
        ? (stockLeft.value[entry.itemId] ?? entry.limit)
        : undefined
      rows.push({
        item,
        price: buyPrice(shop, item),
        remaining,
        levelReq: item.minLevel,
      })
    }
    return rows
  })

  const sellList = computed<SellRow[]>(() => {
    const char = usePlayerStore().character
    const shop = currentShop.value
    if (!char) return []
    const equipped = Object.values(char.equipment)
    const rows: SellRow[] = []
    for (const inv of char.inventory) {
      const item = getItem(inv.itemId)
      if (!item) continue
      rows.push({
        item,
        owned: inv.quantity,
        price: shop ? sellPrice(shop, item) : 0,
        equipped: equipped.includes(inv.itemId),
      })
    }
    return rows
  })

  function openShop(id: string) {
    const shop = getShop(id)
    if (!shop) return
    currentShopId.value = id
    mode.value = 'buy'
    quantity.value = 1
    const sl: Record<string, number> = {}
    for (const e of shop.stock) {
      if (e.limit !== undefined) sl[e.itemId] = e.limit
    }
    stockLeft.value = sl
    message.value = ''
  }

  function closeShop() {
    currentShopId.value = null
    message.value = ''
  }

  function setMode(m: 'buy' | 'sell') {
    mode.value = m
  }

  function setQty(q: number) {
    quantity.value = Math.max(1, Math.min(99, Math.floor(q) || 1))
  }

  function incQty() {
    setQty(quantity.value + 1)
  }

  function decQty() {
    setQty(quantity.value - 1)
  }

  function flash(msg: string) {
    message.value = msg
    if (msgTimer) clearTimeout(msgTimer)
    msgTimer = setTimeout(() => { message.value = '' }, 2500)
  }

  function buy(itemId: string) {
    const player = usePlayerStore()
    const shop = currentShop.value
    const char = player.character
    if (!char || !shop) return
    const remaining = stockLeft.value[itemId]
    const res = buyItem(char, shop, itemId, quantity.value, remaining)
    if (!res.ok) {
      flash(res.message)
      return
    }
    if (res.character) player.update(res.character)
    if (res.stockLeft !== undefined) stockLeft.value[itemId] = res.stockLeft
    flash(res.message)
  }

  function sell(itemId: string) {
    const player = usePlayerStore()
    const shop = currentShop.value
    const char = player.character
    if (!char || !shop) return
    const res = sellItem(char, shop, itemId, quantity.value)
    if (!res.ok) {
      flash(res.message)
      return
    }
    if (res.character) player.update(res.character)
    flash(res.message)
  }

  return {
    currentShopId,
    currentShop,
    mode,
    quantity,
    message,
    playerGold,
    buyList,
    sellList,
    openShop,
    closeShop,
    setMode,
    setQty,
    incQty,
    decQty,
    buy,
    sell,
  }
})
