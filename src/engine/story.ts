import type {
  DialogueCondition,
  DialogueChoice,
  DialogueNode,
  Encounter,
  NPC,
  Quest,
  QuestStatus,
  Scene,
} from '../types'
import {
  getAllEncounters,
  getEncounter,
  getNPC,
  getQuest,
  getScene,
} from './data-loader'
import { chance } from './random'

export interface ConditionContext {
  flags: Record<string, boolean>
  counters: Record<string, number>
  questStatus: Record<string, QuestStatus>
  npcAffinity: Record<string, number>
  level: number
  gold: number
  hasItem: (itemId: string, qty: number) => boolean
}

export function getSceneById(id: string): Scene | undefined {
  return getScene(id)
}

export function getNPCById(id: string): NPC | undefined {
  return getNPC(id)
}

export function getQuestById(id: string): Quest | undefined {
  return getQuest(id)
}

export function getDialogueNode(npc: NPC, nodeId: string): DialogueNode | undefined {
  if (nodeId === 'END') return undefined
  return npc.dialogue[nodeId]
}

export function evaluateCondition(cond: DialogueCondition, ctx: ConditionContext): boolean {
  let actual: number | string | boolean
  switch (cond.type) {
    case 'affinity':
      actual = ctx.npcAffinity[cond.target] ?? 0
      break
    case 'flag':
      actual = ctx.flags[cond.target] ?? false
      break
    case 'level':
      actual = ctx.level
      break
    case 'item':
      actual = ctx.hasItem(cond.target, typeof cond.value === 'number' ? cond.value : 1) ? 1 : 0
      break
    case 'gold':
      actual = ctx.gold
      break
    case 'quest':
      actual = ctx.questStatus[cond.target] ?? 'available'
      break
    case 'counter':
      actual = ctx.counters[cond.target] ?? 0
      break
    default:
      return true
  }

  const expected = cond.value
  switch (cond.op) {
    case '>=':
      return Number(actual) >= Number(expected)
    case '<=':
      return Number(actual) <= Number(expected)
    case '>':
      return Number(actual) > Number(expected)
    case '==':
      return actual === expected
    case '!=':
      return actual !== expected
    default:
      return true
  }
}

export function isChoiceVisible(choice: DialogueChoice, ctx: ConditionContext): boolean {
  if (!choice.condition) return true
  return evaluateCondition(choice.condition, ctx)
}

export function getVisibleChoices(node: DialogueNode, ctx: ConditionContext): DialogueChoice[] {
  if (!node.choices) return []
  return node.choices.filter(c => isChoiceVisible(c, ctx))
}

export function rollRandomEncounter(): Encounter | undefined {
  const list = getAllEncounters()
  if (list.length === 0) return undefined
  const enc = list[Math.floor(Math.random() * list.length)]
  return enc
}

export function getEncounterById(id: string): Encounter | undefined {
  return getEncounter(id)
}
