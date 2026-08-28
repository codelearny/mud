import type { LevelingConfig } from '../types'
import levelingJson from '../data/leveling.json'

// 升级系统全部由 src/data/leveling.json 驱动。
// 设计要点：怪物等级即经验节奏的杠杆——你探索到哪片江湖，遇到的敌人等级就决定了你升级的快慢，
// 因此「升级节奏按照地图推进」天然成立，无需任何硬编码。
const config: LevelingConfig = levelingJson as LevelingConfig

export function getLeveling(): LevelingConfig {
  return config
}

export const MAX_LEVEL = config.maxLevel

/** 升到下一级所需的经验值（按指数曲线增长，越往后越需历练）。 */
export function expForNextLevel(level: number): number {
  const l = Math.max(1, level)
  const { base, growth } = config.expCurve
  return Math.round(base * Math.pow(growth, l - 1))
}

/** 击败某等级的敌人获得的经验；头目额外加成。省略静态值时由战场按此推导。 */
export function enemyExpFromLevel(level: number, boss = false): number {
  const l = Math.max(1, level)
  const { base, growth, bossFactor } = config.enemyExp
  const raw = base * Math.pow(growth, l - 1)
  return Math.round(raw * (boss ? bossFactor : 1))
}

/** 练功一次获得的经验 = 本级所需经验 * trainingFraction（再乘以场景 trainFactor）。 */
export function trainingExpFromLevel(level: number): number {
  return Math.round(expForNextLevel(level) * config.trainingFraction)
}

export function growthPerLevel() {
  return config.growthPerLevel
}

export function freePointsPerLevel(): number {
  return config.freePointsPerLevel
}

/** 取不超过当前等级的最高称号阈值。 */
export function titleForLevel(level: number): string {
  let title = config.titles[0]?.title ?? '江湖小虾米'
  for (const t of config.titles) {
    if (level >= t.level) title = t.title
  }
  return title
}
