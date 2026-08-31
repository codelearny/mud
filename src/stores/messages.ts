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

// 平时仅保留最近几条；战斗进行中临时放宽，让回合交手过程看得完整
export const MAX_MESSAGES = 6
export const MAX_MESSAGES_IN_BATTLE = 20

export const useMessageStore = defineStore('messages', () => {
  const messages = ref<GameMessage[]>([])
  // 当前条数上限（战斗开始时放宽，战斗结束后恢复）
  const limit = ref<number>(MAX_MESSAGES)
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
    trim()
  }

  // 战斗日志等多条同批消息：按给定顺序依次置顶，最终最新一条在最上
  function addMessages(entries: Array<{ text: string; type: MessageType }>) {
    for (const e of entries) {
      seq += 1
      messages.value.unshift({ id: seq, text: e.text, type: e.type, time: Date.now() })
    }
    trim()
  }

  function trim() {
    // 超出上限：丢弃最旧（数组末尾）的消息
    while (messages.value.length > limit.value) {
      messages.value.pop()
    }
  }

  // 战斗期间放宽条数上限；战斗结束传 false 恢复
  function setLimit(n: number) {
    limit.value = n
    trim()
  }

  function clear() {
    messages.value = []
  }

  return { messages, limit, addMessage, addMessages, setLimit, clear, MAX_MESSAGES }
})
