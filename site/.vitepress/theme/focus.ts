import { ref } from 'vue'

/**
 * 节页专注模式：左边"目录"、右边"本节目录"默认收起，点顶栏按钮浮出（盖在正文上面，不挤动正文）。
 * 宽屏（≥1280px）上可以"固定"：固定后一直展开、正文让出位置。固定状态记在 localStorage，
 * config.ts 的 head 脚本在首屏前把它恢复到 <html data-pin-toc / data-pin-outline> 上，CSS 据此布局，不闪。
 */
export type Panel = 'toc' | 'outline'
export const PIN_KEYS: Record<Panel, string> = { toc: 'ds-book:pin-toc', outline: 'ds-book:pin-outline' }
const ATTR: Record<Panel, string> = { toc: 'data-pin-toc', outline: 'data-pin-outline' }

export const pinned = ref<Record<Panel, boolean>>({ toc: false, outline: false })

export function readPins(): void {
  if (typeof document === 'undefined') return
  const h = document.documentElement
  pinned.value = { toc: h.hasAttribute(ATTR.toc), outline: h.hasAttribute(ATTR.outline) }
}

export function setPin(p: Panel, on: boolean): void {
  pinned.value = { ...pinned.value, [p]: on }
  if (on) document.documentElement.setAttribute(ATTR[p], '')
  else document.documentElement.removeAttribute(ATTR[p])
  try {
    if (on) localStorage.setItem(PIN_KEYS[p], '1')
    else localStorage.removeItem(PIN_KEYS[p])
  } catch {
    /* ignore */
  }
}
