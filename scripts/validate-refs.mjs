import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', 'src', 'data')

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (name.endsWith('.json')) out.push(p)
  }
  return out
}

function loadAll(dir) {
  const map = new Map() // category -> array
  for (const f of walk(join(DATA, dir))) {
    const arr = JSON.parse(readFileSync(f, 'utf8'))
    if (!Array.isArray(arr)) continue
    const key = f.split(/[\\/]/).slice(-2, -1)[0]
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(...arr)
  }
  return map
}

const enemies = loadAll('enemies')
const items = loadAll('items')
const skills = loadAll('skills')
const encounters = loadAll('encounters')
const scenes = loadAll('scenes')
const quests = loadAll('quests')
const npcs = loadAll('npcs')

const errs = []
const warn = []

// flat indexes
const enemyIds = new Set()
for (const list of enemies.values()) for (const e of list) enemyIds.add(e.id)
const itemIds = new Set()
for (const list of items.values()) for (const i of list) itemIds.add(i.id)
const skillIds = new Set()
for (const list of skills.values()) for (const s of list) skillIds.add(s.id)
const encIds = new Set()
for (const list of encounters.values()) for (const e of list) encIds.add(e.id)

// 1. encounter battle refs + effects
for (const [cat, list] of encounters) {
  for (const enc of list) {
    for (const ch of enc.choices ?? []) {
      if (ch.battle && !enemyIds.has(ch.battle)) errs.push(`[enc ${enc.id}] battle 敌人不存在: ${ch.battle}`)
      for (const ef of ch.effects ?? []) {
        if (ef.type === 'item' && ef.target && !itemIds.has(ef.target)) errs.push(`[enc ${enc.id}] effect.item 物品不存在: ${ef.target}`)
        if (ef.type === 'learn_skill' && ef.target && !skillIds.has(ef.target)) errs.push(`[enc ${enc.id}] effect.learn_skill 武学不存在: ${ef.target}`)
      }
    }
  }
}

// 2. enemy skills + drops
for (const [cat, list] of enemies) {
  for (const e of list) {
    for (const sk of e.skills ?? []) if (!skillIds.has(sk)) errs.push(`[enemy ${e.id}] skill 不存在: ${sk}`)
    for (const d of e.drops ?? []) if (!itemIds.has(d.itemId)) errs.push(`[enemy ${e.id}] drop 物品不存在: ${d.itemId}`)
  }
}

// 3. scene encounter refs
for (const [cat, list] of scenes) {
  for (const sc of list) {
    for (const act of sc.actions ?? []) {
      for (const id of act.encounters ?? []) if (!encIds.has(id)) errs.push(`[scene ${sc.id}] action 引用事件不存在: ${id}`)
    }
  }
}

// 4. encounter id uniqueness (cross-file)
const seen = new Map()
for (const [cat, list] of encounters) for (const e of list) {
  if (seen.has(e.id)) errs.push(`重复事件 id: ${e.id} (${seen.get(e.id)} 与 ${cat})`)
  else seen.set(e.id, cat)
}

// 5. quest complete conditions / rewards items
for (const [cat, list] of quests) {
  for (const q of list) {
    const rc = q.completeCondition
    if (rc?.type === 'item' && rc.target && !itemIds.has(rc.target)) errs.push(`[quest ${q.id}] 完成条件物品不存在: ${rc.target}`)
    for (const it of q.rewards?.items ?? []) if (!itemIds.has(it.itemId)) errs.push(`[quest ${q.id}] 奖励物品不存在: ${it.itemId}`)
  }
}

// 6. npc effects
for (const [cat, list] of npcs) {
  for (const n of list) {
    const nodes = n.dialogue && typeof n.dialogue === 'object' ? Object.values(n.dialogue) : []
    for (const d of nodes) for (const ch of d.choices ?? []) {
      for (const ef of ch.effects ?? []) {
        if (ef.type === 'item' && ef.target && !itemIds.has(ef.target)) errs.push(`[npc ${n.id}] effect.item 物品不存在: ${ef.target}`)
        if (ef.type === 'learn_skill' && ef.target && !skillIds.has(ef.target)) errs.push(`[npc ${n.id}] effect.learn_skill 武学不存在: ${ef.target}`)
      }
    }
  }
}

console.log(`敌人 ${enemyIds.size} | 物品 ${itemIds.size} | 武学 ${skillIds.size} | 事件 ${encIds.size}`)
if (errs.length) {
  console.log(`\n❌ 发现 ${errs.length} 个引用错误:`)
  for (const e of errs) console.log('  - ' + e)
  process.exit(1)
} else {
  console.log('\n✅ 全部引用校验通过')
}
