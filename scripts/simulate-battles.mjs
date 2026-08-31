// 无头对战模拟：用真实的战斗引擎跑大量自动战斗，验证
//   1) 每场都能在有限回合内分出胜负（不存在卡死的自动战斗）
//   2) 已装备战技的触发条件确实会被满足并释放
//   3) roguelike 战况正常抽取并影响结果
// 用法：npm run simulate [每档模拟次数]
import { createServer } from 'vite'

const ROUNDS = Number(process.argv[2] ?? 40)

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

const errs = []
try {
  const combat = await server.ssrLoadModule('/src/engine/combat.ts')
  const character = await server.ssrLoadModule('/src/engine/character.ts')
  const data = await server.ssrLoadModule('/src/engine/data-loader.ts')
  const skillUtils = await server.ssrLoadModule('/src/engine/skill-utils.ts')
  const skills = data.getAllSkills()
  const enemies = data.getAllEnemies()

  const activeSkills = skills.filter(s => s.type === 'active')
  const passiveSkills = skills.filter(s => s.type === 'passive')
  if (activeSkills.length === 0) errs.push('没有任何主动战技，自动战斗将退化为纯普攻')

  // 造一个指定等级的角色，配装与所学功法尽量贴近真实玩家的推进节奏：
  //   - 低稀有度功法随等级自然习得，epic/legendary 视作「打到秘籍才学」，控制数量
  //   - 穿上该等级能拿到的最好兵器/护甲/饰品
  //   - 自由属性点按 攻:防:轻功 = 2:1:1 分配
  function makeChar(level, _seedSkills, realistic = true) {
    const c = character.createNewCharacter('测试侠')
    const all = skills.filter(s => s.unlockLevel <= level)
    // common/rare 随等级自然习得；epic/legendary 需秘籍，数量受限。
    const kept = new Set(
      all.filter(s => s.rarity !== 'epic' && s.rarity !== 'legendary').map(s => s.id)
    )
    // 玩家攒到秘籍后必然优先修习「当前能学的最强功法」，
    // 所以按 unlockLevel 降序取，而非从最低级开始——否则 Lv30 会被模拟成还在用 Lv10 的功法。
    const byNewest = (a, b) => b.unlockLevel - a.unlockLevel
    const epics = all.filter(s => s.rarity === 'epic').sort(byNewest)
    const legends = all.filter(s => s.rarity === 'legendary').sort(byNewest)
    for (let i = 0; i < Math.floor(level / 5); i++) if (epics[i]) kept.add(epics[i].id)
    // 绝学仅终极头目掉落：realistic 下按等级给 0~2 本，模拟「打过大 boss」的进度
    const legendCount = realistic ? (level >= 28 ? 2 : level >= 22 ? 1 : 0) : legends.length
    for (let i = 0; i < legendCount; i++) if (legends[i]) kept.add(legends[i].id)

    c.learnedSkills = []
    for (const id of kept) c.learnedSkills.push({ skillId: id, level: 1, proficiency: 0, proficiencyToNext: 100 })

    // 每级成长（与 leveling.json 的 growthPerLevel 一致），让属性随等级推进
    const growth = { maxHp: 22, maxMp: 10, attack: 3, defense: 2, agility: 1 }
    for (let i = 1; i < level; i++) {
      c.attributes.maxHp += growth.maxHp
      c.attributes.maxMp += growth.maxMp
      c.attributes.attack += growth.attack
      c.attributes.defense += growth.defense
      c.attributes.agility += growth.agility
    }
    // 自由属性点：2/4 攻、1/4 防、1/4 轻功
    const pts = (level - 1) * 3
    c.attributes.attack += Math.floor(pts * 0.5)
    c.attributes.defense += Math.floor(pts * 0.25)
    c.attributes.agility += Math.floor(pts * 0.25)

    // 穿戴该等级可用的最好装备
    const gear = { weapon: null, armor: null, accessory: null }
    for (const it of data.getAllItems()) {
      if (!it.slot || !gear.hasOwnProperty(it.slot)) continue
      if ((it.minLevel ?? 1) > level) continue
      const cur = gear[it.slot]
      const power = (x) => (x?.effects ?? []).reduce((s, e) => s + (typeof e.value === 'number' ? e.value : 0), 0)
      if (!cur || power(it) > power(cur)) gear[it.slot] = it
    }
    if (gear.weapon) c.equipment.weapon = gear.weapon.id
    if (gear.armor) c.equipment.armor = gear.armor.id
    if (gear.accessory) c.equipment.accessory = gear.accessory.id

    const eff = character.getEffectiveAttributes(c)
    c.attributes.hp = eff.maxHp
    c.attributes.mp = eff.maxMp
    // 装备战技：只装「已习得」的功法，并复用游戏内的自动选装规则（单一数据源），
    // 否则会把没学会的大招也算进槽位，模拟出的出招率虚高、内力消耗失真。
    c.equippedSkills = skillUtils.recommendEquippedSkills(
      c.learnedSkills.map(ls => data.getSkill(ls.skillId)).filter(Boolean)
    )
    return c
  }

  const LEVELS = [1, 5, 10, 15, 20, 25, 30]
  const perLevel = []
  let stuck = 0
  let skillCasts = 0
  let totalTurns = 0
  let battles = 0
  const stateCount = { victory: 0, defeat: 0 }
  const modifierUse = new Map()

  // 杂兵战与头目战的体验目标完全不同，混在一起统计会把两者的失衡互相掩盖，
  // 因此分开跑：杂兵求「稳赢但要打几个回合」，头目求「有输有赢的拉锯」。
  function runGroup(level, list) {
    let turns = 0, casts = 0, win = 0, maxTurns = 0, count = 0
    for (let i = 0; i < ROUNDS; i++) {
      const char = makeChar(level, null)
      const enemy = list[Math.floor(Math.random() * list.length)]
      let b = combat.startBattle(char, enemy.id)
      for (const m of b.modifiers ?? []) {
        modifierUse.set(m.name, (modifierUse.get(m.name) ?? 0) + 1)
      }
      const MAX_TURNS = 100
      let guard = 0
      while (b.state === 'ongoing' && guard < MAX_TURNS) {
        b = combat.runTurn(b)
        guard++
      }
      count++; battles++
      turns += guard; totalTurns += guard
      maxTurns = Math.max(maxTurns, guard)
      const c = b.log.filter(l => l.text.includes('施展') && l.actor === 'player').length
      casts += c; skillCasts += c
      if (b.state === 'victory') win++
      if (b.state === 'ongoing') {
        stuck++
        errs.push(`战斗未能在 ${MAX_TURNS} 回合内结束：Lv${level} vs ${enemy.name}(${enemy.id})`)
      } else {
        stateCount[b.state] = (stateCount[b.state] ?? 0) + 1
      }
    }
    return {
      avgTurns: +(turns / count).toFixed(1),
      maxTurns,
      casts: +(casts / count).toFixed(1),
      winRate: Math.round((win / count) * 100),
    }
  }

  for (const level of LEVELS) {
    // 战技装备交由 makeChar 用游戏内选装规则决定（只装已习得的），这里仅取一份用于展示
    const seed = makeChar(level, null).equippedSkills

    const near = enemies.filter(e => Math.abs(e.level - level) <= 3)
    const mobs = near.filter(e => !e.boss)
    const bosses = enemies.filter(e => e.boss && e.level >= level - 2 && e.level <= level + 4)

    const mobStat = runGroup(level, mobs.length > 0 ? mobs : enemies.filter(e => !e.boss))
    const bossStat = bosses.length > 0 ? runGroup(level, bosses) : null

    perLevel.push({
      level, mob: mobStat, boss: bossStat,
      equipped: seed.map(id => data.getSkill(id)?.name ?? id).join(' / '),
    })
  }

  console.log(`模拟战斗 ${battles} 场（每级 ${ROUNDS} 场）`)
  console.log(`  平均回合数：${(totalTurns / battles).toFixed(1)}`)
  console.log(`  玩家战技释放次数：${skillCasts}（场均 ${(skillCasts / battles).toFixed(1)} 次）`)
  console.log(`  胜 ${stateCount.victory ?? 0} / 负 ${stateCount.defeat ?? 0}`)
  console.log(`  卡死战斗：${stuck}`)
  console.log('\n  分等级明细（杂兵战 | 头目战）：')
  console.log('  等级   杂兵:回合/战技/胜率      头目:回合(最长)/战技/胜率     装备战技')
  for (const r of perLevel) {
    const m = `${r.mob.avgTurns}合 ${r.mob.casts}招 ${r.mob.winRate}%`
    const b = r.boss
      ? `${r.boss.avgTurns}合(最长${r.boss.maxTurns}) ${r.boss.casts}招 ${r.boss.winRate}%`
      : '—'
    console.log(`  Lv${String(r.level).padEnd(3)}  ${m.padEnd(24)} ${b.padEnd(29)} ${r.equipped}`)
  }
  console.log(`  战况出现次数 Top8：`)
  ;[...modifierUse.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .forEach(([n, c]) => console.log(`    ${n} ×${c}`))
  console.log(`  被动功法 ${passiveSkills.length} 个 / 主动战技 ${activeSkills.length} 个`)
  if (modifierUse.size === 0) errs.push('roguelike 战况一条都没抽到')
} finally {
  await server.close()
}

if (errs.length) {
  console.log(`\n❌ 模拟发现 ${errs.length} 个问题:`)
  for (const e of errs.slice(0, 20)) console.log('  - ' + e)
  process.exit(1)
}
console.log('\n✅ 自动战斗模拟通过')
