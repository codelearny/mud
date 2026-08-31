import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DialogueChoice, DialogueCondition, DialogueEffect, Encounter, QuestStatus } from '../types'
import {
  evaluateCondition,
  getDialogueNode,
  getNPCById,
  getQuestById,
  isChoiceVisible,
  rollRandomEncounter,
} from '../engine/story'
import { getAllQuests, getSkill, getItem } from '../engine/data-loader'
import { usePlayerStore } from './player'
import { useShopStore } from './shop'
import { useMessageStore } from './messages'

const STORY_KEY = 'jianghu_story'

export const useStoryStore = defineStore('story', () => {
  const flags = ref<Record<string, boolean>>({})
  const npcAffinity = ref<Record<string, number>>({})
  const questStatus = ref<Record<string, QuestStatus>>({})
  const counters = ref<Record<string, number>>({})
  const usedEncounters = ref<string[]>([]) // 已触发过的一次性际遇 id
  const currentDialogue = ref<{ npcId: string; nodeId: string } | null>(null)
  const currentEncounter = ref<Encounter | null>(null)

  function initStory() {
    const status: Record<string, QuestStatus> = {}
    for (const q of getAllQuests()) status[q.id] = 'available'
    questStatus.value = status
    counters.value = {
      banditsDefeated: 0,
      duelsWon: 0,
      undeadSlain: 0,
      demonSlain: 0,
    }
    flags.value = {}
    npcAffinity.value = {}
    usedEncounters.value = []
    currentDialogue.value = null
    currentEncounter.value = null
  }

  function buildContext() {
    const playerStore = usePlayerStore()
    const char = playerStore.character
    return {
      flags: flags.value,
      counters: counters.value,
      questStatus: questStatus.value,
      npcAffinity: npcAffinity.value,
      level: char?.level ?? 1,
      gold: char?.gold ?? 0,
      hasItem: (id: string, qty: number) => playerStore.hasItem(id, qty),
    }
  }

  const currentNpc = computed(() => {
    if (!currentDialogue.value) return null
    return getNPCById(currentDialogue.value.npcId) ?? null
  })

  const currentDialogueNode = computed(() => {
    if (!currentDialogue.value || !currentNpc.value) return null
    return getDialogueNode(currentNpc.value, currentDialogue.value.nodeId) ?? null
  })

  const visibleDialogueChoices = computed<DialogueChoice[]>(() => {
    if (!currentDialogueNode.value) return []
    return currentDialogueNode.value.choices?.filter(c => isChoiceVisible(c, buildContext())) ?? []
  })

  const visibleEncounterChoices = computed<DialogueChoice[]>(() => {
    if (!currentEncounter.value) return []
    return currentEncounter.value.choices.filter(c => isChoiceVisible(c, buildContext()))
  })

  const activeQuests = computed(() =>
    getAllQuests().filter(q => questStatus.value[q.id] === 'active')
  )
  const completedQuests = computed(() =>
    getAllQuests().filter(q => questStatus.value[q.id] === 'completed')
  )

  function applyEffects(effects?: DialogueEffect[]) {
    if (!effects) return
    const playerStore = usePlayerStore()
    for (const eff of effects) {
      switch (eff.type) {
        case 'affinity':
          npcAffinity.value[eff.target!] = (npcAffinity.value[eff.target!] ?? 0) + Number(eff.value)
          break
        case 'flag':
          flags.value[eff.target!] = Boolean(eff.value)
          break
        case 'item':
          if (Number(eff.value) >= 0) playerStore.addToInventory(eff.target!, Number(eff.value))
          else playerStore.removeItem(eff.target!, -Number(eff.value))
          break
        case 'exp':
          playerStore.addExp(Number(eff.value))
          break
        case 'gold':
          if (Number(eff.value) >= 0) playerStore.addGold(Number(eff.value))
          else playerStore.spendGold(-Number(eff.value))
          break
        case 'learn_skill': {
          const ok = playerStore.grantSkill(eff.target!)
          if (ok) {
            const sk = getSkill(eff.target!)
            useMessageStore().addMessage(`习得武学：${sk?.name ?? eff.target!}`, 'reward')
          }
          break
        }
        case 'quest':
          questStatus.value[eff.target!] = eff.value as QuestStatus
          break
        case 'heal':
          if (eff.value === 'full' && playerStore.effectiveAttrs) {
            playerStore.setHpMp(playerStore.effectiveAttrs.maxHp, playerStore.effectiveAttrs.maxMp)
          }
          break
        case 'counter':
          incrementCounter(eff.target!, Number(eff.value))
          break
      }
    }
  }

  function talkToNpc(npcId: string) {
    const npc = getNPCById(npcId)
    if (!npc) return
    checkQuestCompletions()
    currentDialogue.value = { npcId, nodeId: npc.startNode }
  }

  function selectDialogueChoice(choice: DialogueChoice) {
    applyEffects(choice.effects)
    checkQuestCompletions()
    if (choice.shop) {
      const shopStore = useShopStore()
      shopStore.openShop(choice.shop)
      closeDialogue()
      return 'shop'
    }
    if (choice.next === 'END') {
      closeDialogue()
      return 'END'
    }
    if (currentDialogue.value) {
      const npc = getNPCById(currentDialogue.value.npcId)
      if (npc && getDialogueNode(npc, choice.next)) {
        currentDialogue.value = { npcId: npc.id, nodeId: choice.next }
        return choice.next
      }
    }
    closeDialogue()
    return 'END'
  }

  function closeDialogue() {
    currentDialogue.value = null
  }

  // pool 来自 SceneAction.encounters，用于让不同地点/行动触发不同遭遇
  function triggerEncounter(pool?: string[]) {
    const enc = rollRandomEncounter(pool, usedEncounters.value)
    // 一次性际遇：触发即消耗，从池子剔除（即便玩家选择拒绝也不再复现，杜绝刷取）
    if (enc && enc.once && !usedEncounters.value.includes(enc.id)) {
      usedEncounters.value = [...usedEncounters.value, enc.id]
      saveStoryState()
    }
    currentEncounter.value = enc ?? null
  }

  // 将际遇选项的效果汇总成可读结果，供选中后展示（避免"选了没反应"）
  function summarizeEffects(effects?: DialogueEffect[]): string[] {
    const lines: string[] = []
    if (!effects) return lines
    for (const eff of effects) {
      switch (eff.type) {
        case 'learn_skill': {
          const sk = getSkill(eff.target!)
          lines.push(`习得武学：${sk?.name ?? eff.target!}`)
          break
        }
        case 'exp':
          lines.push(`经验 +${eff.value}`)
          break
        case 'gold': {
          const v = Number(eff.value)
          lines.push(v >= 0 ? `银两 +${v}` : `银两 ${v}`)
          break
        }
        case 'item': {
          const it = getItem(eff.target!)
          const v = Number(eff.value)
          lines.push(`${it?.name ?? eff.target!} ×${v}`)
          break
        }
        case 'affinity': {
          const npc = getNPCById(eff.target!)
          lines.push(`与${npc?.name ?? '某位江湖人'} 好感 +${eff.value}`)
          break
        }
        case 'heal':
          lines.push('气血内力尽复')
          break
        case 'flag':
          lines.push('（心中记下此事）')
          break
        case 'counter':
          lines.push('（江湖记录已更新）')
          break
        case 'quest':
          lines.push('（任务进展更新）')
          break
      }
    }
    return lines
  }

  // 供场景进入条件、行动前置等外部判定复用（Scene.requirement / SceneAction.requirement）
  function meetsCondition(cond?: DialogueCondition): boolean {
    if (!cond) return true
    return evaluateCondition(cond, buildContext())
  }

  // 选中际遇选项后，将结果写入全局消息列表（取代原结果弹窗），并关闭面板
  function selectEncounterChoice(choice: DialogueChoice): string {
    const lines = summarizeEffects(choice.effects)
    applyEffects(choice.effects)
    checkQuestCompletions()
    const msgStore = useMessageStore()
    if (choice.battle) {
      // 战斗类交由 BattleView 呈现，不写消息列表
      closeEncounter()
    } else {
      const summary = lines.length ? lines.join('，') : '（你淡然离去。）'
      msgStore.addMessage(summary, 'event')
      closeEncounter()
    }
    return choice.next
  }

  function closeEncounter() {
    currentEncounter.value = null
  }

  function incrementCounter(name: string, amount: number = 1) {
    counters.value[name] = (counters.value[name] ?? 0) + amount
  }

  function checkQuestCompletions() {
    const playerStore = usePlayerStore()
    const ctx = buildContext()
    for (const quest of getAllQuests()) {
      if (questStatus.value[quest.id] !== 'active') continue
      const cond = quest.completeCondition
      const met = evaluateCondition(cond, ctx)
      if (met) {
        // consume items for item-type completion
        if (cond.type === 'item') {
          const need = Number(cond.value)
          if (playerStore.getItemCount(cond.target) >= need) {
            playerStore.removeItem(cond.target, need)
          } else {
            continue
          }
        }
        questStatus.value[quest.id] = 'completed'
        if (quest.completeFlag) flags.value[quest.completeFlag] = true
        const r = quest.rewards
        const skillNames = (r.skills ?? []).map(id => getSkill(id)?.name ?? id)
        const parts: string[] = []
        if (r.exp) parts.push(`经验 ${r.exp}`)
        if (r.gold) parts.push(`银两 ${r.gold}`)
        if (skillNames.length) parts.push(`武学 ${skillNames.join('、')}`)
        useMessageStore().addMessage(`任务【${quest.name}】完成${parts.length ? '：' + parts.join('，') : ''}`, 'reward')
        if (r.exp) playerStore.addExp(r.exp)
        if (r.gold) playerStore.addGold(r.gold)
        if (r.items) for (const it of r.items) playerStore.addToInventory(it.itemId, it.quantity)
        if (r.skills) for (const sk of r.skills) playerStore.grantSkill(sk)
      }
    }
  }

  function saveStoryState() {
    const data = {
      flags: flags.value,
      npcAffinity: npcAffinity.value,
      questStatus: questStatus.value,
      counters: counters.value,
      usedEncounters: usedEncounters.value,
    }
    localStorage.setItem(STORY_KEY, JSON.stringify(data))
  }

  function loadStoryState(): boolean {
    const data = localStorage.getItem(STORY_KEY)
    if (!data) {
      initStory()
      return false
    }
    try {
      const parsed = JSON.parse(data)
      flags.value = parsed.flags ?? {}
      npcAffinity.value = parsed.npcAffinity ?? {}
      questStatus.value = parsed.questStatus ?? {}
      usedEncounters.value = parsed.usedEncounters ?? []
      counters.value = {
        banditsDefeated: 0,
        duelsWon: 0,
        undeadSlain: 0,
        demonSlain: 0,
        ...(parsed.counters ?? {}),
      }
      return true
    } catch {
      initStory()
      return false
    }
  }

  function clearStory() {
    initStory()
    localStorage.removeItem(STORY_KEY)
  }

  return {
    flags,
    npcAffinity,
    questStatus,
    counters,
    currentDialogue,
    currentEncounter,
    currentNpc,
    currentDialogueNode,
    visibleDialogueChoices,
    visibleEncounterChoices,
    activeQuests,
    completedQuests,
    initStory,
    talkToNpc,
    selectDialogueChoice,
    closeDialogue,
    triggerEncounter,
    meetsCondition,
    selectEncounterChoice,
    closeEncounter,
    incrementCounter,
    checkQuestCompletions,
    saveStoryState,
    loadStoryState,
    clearStory,
  }
})
