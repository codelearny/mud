import type { Character, Item, Shop, ShopItemEntry } from '../types'
import { getItem } from './data-loader'

// 商铺引擎：纯函数，输入角色与商铺，输出新的角色（深拷贝）与交易结果。
// 不直接依赖任何 store，便于复用与测试。

// 买入单价：优先用 stock 中覆盖价，否则按 物品.price * buyFactor 取整。
export function buyPrice(shop: Shop, item: Item): number {
  const entry = shop.stock.find(s => s.itemId === item.id)
  if (entry?.price !== undefined) return entry.price
  return Math.round((item.price || 0) * shop.buyFactor)
}

// 卖出单价：物品.price * sellFactor 向下取整，至少 1 两。
export function sellPrice(shop: Shop, item: Item): number {
  return Math.max(1, Math.floor((item.price || 0) * shop.sellFactor))
}

export interface TradeResult {
  ok: boolean
  message: string
  character?: Character
  stockLeft?: number // 购入后剩余存货（仅当该货物设了 limit）
}

// 购入：校验 货物存在 / 等级 / 存货 / 银两，成功后扣银两、入背包。
export function buyItem(
  character: Character,
  shop: Shop,
  itemId: string,
  qty: number,
  remaining?: number
): TradeResult {
  const item = getItem(itemId)
  if (!item) return { ok: false, message: '本店无此货物。' }

  const entry: ShopItemEntry | undefined = shop.stock.find(s => s.itemId === itemId)
  if (!entry) return { ok: false, message: '本店不售此物。' }

  const price = buyPrice(shop, item)
  if (price <= 0) return { ok: false, message: '此物无价，不可购。' }

  if (item.minLevel && character.level < item.minLevel) {
    return { ok: false, message: `需 ${item.minLevel} 级方可购入。` }
  }
  if (remaining !== undefined && qty > remaining) {
    return { ok: false, message: '存货不足。' }
  }

  const total = price * qty
  if (character.gold < total) return { ok: false, message: '银两不足。' }

  const char: Character = JSON.parse(JSON.stringify(character))
  char.gold -= total
  const inv = char.inventory.find(i => i.itemId === itemId)
  if (inv) inv.quantity += qty
  else char.inventory.push({ itemId, quantity: qty })

  const stockLeft = remaining !== undefined ? remaining - qty : undefined
  return {
    ok: true,
    character: char,
    stockLeft,
    message: `购入「${item.name}」×${qty}，耗银 ${total} 两。`
  }
}

// 售出：校验 拥有数量 / 未装备，成功后扣物品、加银两。
export function sellItem(
  character: Character,
  shop: Shop,
  itemId: string,
  qty: number
): TradeResult {
  const item = getItem(itemId)
  if (!item) return { ok: false, message: '无此物品。' }

  const inv = character.inventory.find(i => i.itemId === itemId)
  if (!inv || inv.quantity < qty) return { ok: false, message: '数量不足。' }

  const equipped = Object.values(character.equipment).includes(itemId)
  if (equipped) return { ok: false, message: '已装备，请先卸下再卖。' }

  const price = sellPrice(shop, item)
  const total = price * qty

  const char: Character = JSON.parse(JSON.stringify(character))
  inv.quantity -= qty
  if (inv.quantity <= 0) char.inventory = char.inventory.filter(i => i.itemId !== itemId)
  char.gold += total

  return {
    ok: true,
    character: char,
    message: `售出「${item.name}」×${qty}，得银 ${total} 两。`
  }
}
