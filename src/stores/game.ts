import { defineStore } from 'pinia'
import { ref } from 'vue'
import { usePlayerStore } from './player'
import { useStoryStore } from './story'

const SCENE_KEY = 'jianghu_scene'

export const useGameStore = defineStore('game', () => {
  const currentScene = ref<string>('village')
  const gameStarted = ref(false)

  function newGame(name: string, originId?: string) {
    const playerStore = usePlayerStore()
    playerStore.init(name, originId)
    const storyStore = useStoryStore()
    storyStore.initStory()
    currentScene.value = 'village'
    gameStarted.value = true
    saveScene()
    storyStore.saveStoryState()
  }

  function continueGame(): boolean {
    const playerStore = usePlayerStore()
    if (!playerStore.load()) return false
    const scene = localStorage.getItem(SCENE_KEY)
    if (scene) currentScene.value = scene
    const storyStore = useStoryStore()
    storyStore.loadStoryState()
    gameStarted.value = true
    return true
  }

  function saveGame() {
    const playerStore = usePlayerStore()
    playerStore.save()
    saveScene()
    const storyStore = useStoryStore()
    storyStore.saveStoryState()
  }

  function setScene(sceneId: string) {
    currentScene.value = sceneId
    saveScene()
  }

  function saveScene() {
    localStorage.setItem(SCENE_KEY, currentScene.value)
  }

  function exitToMenu() {
    gameStarted.value = false
  }

  return {
    currentScene,
    gameStarted,
    newGame,
    continueGame,
    saveGame,
    setScene,
    exitToMenu,
  }
})
