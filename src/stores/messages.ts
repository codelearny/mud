import { defineStore } from 'pinia'
import { ref } from 'vue'

// 江湖消息类型，用于消息列表左侧色条/样式区分
export type MessageType = 'event' | 'action' | 'reward' | 'info'

export interface GameMessage {
  id: number
  text: string
  type: MessageType
  time: number
}

// 仅保留最近几条，超出部分从最旧端丢弃
export const MAX_MESSAGES = 6

export const useMessageStore = defineStore('messages', () => {
  const messages = ref<GameMessage[]>([])
  let seq = 0

  // 单段文字（一段话），新消息置顶（最新在最前）
  function addMessage(text: string, type: MessageType = 'info') {
    seq += 1
    messages.value.unshift({
      id: seq,
      text,
      type,
      time: Date.now(),
    })
    // 超出上限：丢弃最旧（数组末尾）的消息
    while (messages.value.length > MAX_MESSAGES) {
      messages.value.pop()
    }
  }

  function clear() {
    messages.value = []
  }

  return { messages, addMessage, clear, MAX_MESSAGES }
})
