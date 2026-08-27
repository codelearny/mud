import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DialogueChoice, DialogueEffect, Encounter, QuestStatus } from '../types'
import {
  evaluateCondition,
  getDialogueNode,
  getNPCById,
  getQuestById,
  isChoiceVisible,
  rollRandomEncounter,
} from '../engine/story'
import { getAllQuests } from '../engine/data-loader'
import { usePlayerStore } from './player'
import { useShopStore } from './shop'

const STORY_KEY = 'jianghu_story'

export const useStoryStore = defineStore('story', () => {
  const flags = ref<Record<string, boolean>>({})
  const npcAffinity = ref<Record<string, number>>({})
  const questStatus = ref<Record<string, QuestStatus>>({})
  const counters = ref<Record<string, number>>({})
  const currentDialogue = ref<{ npcId: string; nodeId: string } | null>(null)
  const currentEncounter = ref<Encounter | null>(null)
  const toast = ref<{ msg: string; id: number } | null>(null)
  let toastSeq = 0
  function pushToast(msg: string) {
    toastSeq += 1
    toast.value = { msg, id: toastSeq }
  }

  function initStory() {
    const status: Record<string, QuestStatus> = {}
    for (const q of getAllQuests()) status[q.id] = 'available'
    questStatus.value = status
    counters.value = { banditsDefeated: 0, duelsWon: 0 }
    flags.value = {}
    npcAffinity.value = {}
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
        case 'learn_skill':
          playerStore.learnNewSkill(eff.target!)
          break
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

  function triggerEncounter() {
    const enc = rollRandomEncounter()
    currentEncounter.value = enc ?? null
  }

  function selectEncounterChoice(choice: DialogueChoice): string {
    applyEffects(choice.effects)
    checkQuestCompletions()
    closeEncounter()
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
        pushToast(`任务【${quest.name}】完成！获得经验 ${r.exp} · 银两 ${r.gold}`)
        if (r.exp) playerStore.addExp(r.exp)
        if (r.gold) playerStore.addGold(r.gold)
        if (r.items) for (const it of r.items) playerStore.addToInventory(it.itemId, it.quantity)
        if (r.skills) for (const sk of r.skills) playerStore.learnNewSkill(sk)
      }
    }
  }

  function saveStoryState() {
    const data = {
      flags: flags.value,
      npcAffinity: npcAffinity.value,
      questStatus: questStatus.value,
      counters: counters.value,
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
      counters.value = parsed.counters ?? { banditsDefeated: 0, duelsWon: 0 }
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
    toast,
    pushToast,
    activeQuests,
    completedQuests,
    initStory,
    talkToNpc,
    selectDialogueChoice,
    closeDialogue,
    triggerEncounter,
    selectEncounterChoice,
    closeEncounter,
    incrementCounter,
    checkQuestCompletions,
    saveStoryState,
    loadStoryState,
    clearStory,
  }
})
