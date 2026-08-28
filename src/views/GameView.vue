<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player'
import { useGameStore } from '../stores/game'
import { useBattleStore } from '../stores/battle'
import { useStoryStore } from '../stores/story'
import { useShopStore } from '../stores/shop'
import { getScene, getNPC, getItem } from '../engine/data-loader'
import StatusBar from '../components/StatusBar.vue'
import CharacterPanel from '../components/CharacterPanel.vue'
import SkillPanel from '../components/SkillPanel.vue'
import InventoryPanel from '../components/InventoryPanel.vue'
import DialoguePanel from '../components/DialoguePanel.vue'
import EncounterPanel from '../components/EncounterPanel.vue'
import QuestPanel from '../components/QuestPanel.vue'
import ShopPanel from '../components/ShopPanel.vue'
import type { SceneAction, SceneGain } from '../types'

const router = useRouter()
const playerStore = usePlayerStore()
const gameStore = useGameStore()
const battleStore = useBattleStore()
const storyStore = useStoryStore()
const shopStore = useShopStore()

type Tab = 'map' | 'quests' | 'character' | 'skills' | 'inventory'
const activeTab = ref<Tab>('map')
const toastMsg = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

const scene = computed(() => getScene(gameStore.currentScene))
const sceneNpcs = computed(() =>
  (scene.value?.npcs ?? [])
    .map(id => getNPC(id))
    .filter((n): n is NonNullable<typeof n> => !!n)
)
const connectedScenes = computed(() =>
  (scene.value?.connections ?? [])
    .map(id => getScene(id))
    .filter((s): s is NonNullable<typeof s> => !!s)
    .map(s => ({
      id: s.id,
      name: s.name,
      locked: !storyStore.meetsCondition(s.requirement),
      hint: s.requireHint ?? '前路未通',
    }))
)

// 按 weight 随机抽取一项采集产出
function rollGain(gains: SceneGain[]): SceneGain | undefined {
  if (gains.length === 0) return undefined
  const total = gains.reduce((sum, g) => sum + (g.weight ?? 1), 0)
  let roll = Math.random() * total
  for (const g of gains) {
    roll -= (g.weight ?? 1)
    if (roll <= 0) return g
  }
  return gains[gains.length - 1]
}

function travel(sceneId: string) {
  const target = connectedScenes.value.find(s => s.id === sceneId)
  if (target?.locked) {
    showToast(target.hint)
    return
  }
  gameStore.setScene(sceneId)
  storyStore.saveStoryState()
}

function talkNpc(npcId: string) {
  storyStore.talkToNpc(npcId)
}

function doAction(action: SceneAction) {
  if (!storyStore.meetsCondition(action.requirement)) {
    showToast(action.requireHint ?? '时机未到，此事尚不可为。')
    return
  }
  const eff = playerStore.effectiveAttrs
  switch (action.type) {
    case 'rest':
      if (eff) playerStore.setHpMp(eff.maxHp, eff.maxMp)
      showToast(action.text ?? '你歇息片刻，气血内力尽复。')
      break
    case 'train':
      playerStore.addExp(15)
      showToast((action.text ?? '你勤练不辍') + '（功力 +15）')
      break
    case 'gather': {
      const gain = rollGain(action.gains ?? [])
      const qty = gain ? gain.min + Math.floor(Math.random() * (gain.max - gain.min + 1)) : 0
      if (gain && qty > 0) {
        playerStore.addToInventory(gain.itemId, qty)
        const name = getItem(gain.itemId)?.name ?? gain.itemId
        showToast(`${action.text ?? '你搜寻一番'}：得【${name}】×${qty}`)
      } else {
        showToast(`${action.text ?? '你搜寻一番'}：一无所获。`)
      }
      break
    }
    case 'encounter':
    case 'explore':
      storyStore.triggerEncounter(action.encounters)
      break
  }
  gameStore.saveGame()
}

function randomBattle() {
  battleStore.startRandomBattle(scene.value?.enemyPool)
  router.push('/battle')
}

function saveGame() {
  gameStore.saveGame()
  showToast('存档成功！')
}

function exitGame() {
  gameStore.saveGame()
  gameStore.exitToMenu()
  playerStore.clear()
  router.push('/')
}

function showToast(msg: string) {
  toastMsg.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 3000)
}

watch(
  () => storyStore.toast?.id,
  (id) => {
    if (id) showToast(storyStore.toast!.msg)
  }
)

onMounted(() => {
  if (storyStore.toast) showToast(storyStore.toast.msg)
})
</script>

<template>
  <template v-if="playerStore.character">
    <StatusBar />

    <div v-show="activeTab === 'map'" class="map-view">
      <div class="panel">
        <div class="panel-title">{{ scene?.name }}</div>
        <p class="scene-desc">{{ scene?.description }}</p>
        <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
      </div>

      <div class="panel" v-if="sceneNpcs.length">
        <div class="panel-title">此间人物</div>
        <div class="npc-list">
          <button
            v-for="npc in sceneNpcs"
            :key="npc.id"
            class="btn npc-btn"
            @click="talkNpc(npc.id)"
          >
            <span class="npc-name">{{ npc.name }}</span>
            <span class="npc-title">{{ npc.title }}</span>
          </button>
        </div>
      </div>

      <div class="panel" v-if="scene?.actions?.length">
        <div class="panel-title">就地行事</div>
        <div class="btn-grid">
          <button
            v-for="a in scene.actions"
            :key="a.id"
            class="btn"
            @click="doAction(a)"
          >{{ a.label }}</button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">前往</div>
        <div class="btn-grid">
          <button
            v-for="s in connectedScenes"
            :key="s.id"
            class="btn"
            :class="{ 'btn-locked': s.locked }"
            @click="travel(s.id)"
          >
            {{ s.name }}
            <span v-if="s.locked" class="lock-hint">（{{ s.hint }}）</span>
          </button>
          <button class="btn btn-primary" @click="randomBattle">游走历练</button>
        </div>
      </div>

      <div class="btn-grid" style="padding: 0 10px 12px;">
        <button class="btn" @click="saveGame">存档</button>
        <button class="btn btn-danger" @click="exitGame">退出</button>
      </div>
    </div>

    <div v-show="activeTab === 'quests'">
      <QuestPanel />
    </div>

    <div v-show="activeTab === 'character'">
      <CharacterPanel />
    </div>

    <div v-show="activeTab === 'skills'">
      <SkillPanel />
    </div>

    <div v-show="activeTab === 'inventory'">
      <InventoryPanel />
    </div>

    <div class="action-menu">
      <button class="btn" :class="{ 'btn-primary': activeTab === 'map' }" @click="activeTab = 'map'">江湖</button>
      <button class="btn" :class="{ 'btn-primary': activeTab === 'quests' }" @click="activeTab = 'quests'">任务</button>
      <button class="btn" :class="{ 'btn-primary': activeTab === 'character' }" @click="activeTab = 'character'">角色</button>
      <button class="btn" :class="{ 'btn-primary': activeTab === 'skills' }" @click="activeTab = 'skills'">武功</button>
      <button class="btn" :class="{ 'btn-primary': activeTab === 'inventory' }" @click="activeTab = 'inventory'">物品</button>
    </div>

    <DialoguePanel v-if="storyStore.currentDialogue" />
    <EncounterPanel v-if="storyStore.currentEncounter" />
    <ShopPanel v-if="shopStore.currentShopId" />
  </template>
</template>
