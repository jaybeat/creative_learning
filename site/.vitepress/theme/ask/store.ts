import { reactive } from 'vue'

/**
 * 问 AI 面板的开关；prefill：打开时预填进输入框的文字（划词提问）；
 * auto：这次是网站自动打开的（宽屏看动画时默认常驻），不抢焦点、不暂停动画
 */
export const ask = reactive({ open: false, prefill: '', auto: false })

export function openAsk(prefill = '', opts: { auto?: boolean } = {}): void {
  ask.prefill = prefill
  ask.auto = Boolean(opts.auto)
  ask.open = true
}

export function closeAsk(): void {
  ask.open = false
}
