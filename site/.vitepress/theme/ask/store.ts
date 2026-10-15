import { reactive } from 'vue'

/** 问 AI 面板的开关；prefill：打开时预填进输入框的文字（划词提问） */
export const ask = reactive({ open: false, prefill: '' })

export function openAsk(prefill = ''): void {
  ask.prefill = prefill
  ask.open = true
}

export function closeAsk(): void {
  ask.open = false
}
