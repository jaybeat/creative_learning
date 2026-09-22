import { onMounted, onUnmounted, ref } from 'vue'

/* ---------- 纯函数部分：不碰 window，可单测 ---------- */

export interface LastRead {
  /** 站内路径（不带 base），如 /ch02/2-9 */
  path: string
  title: string
  scrollY: number
  /** 时间戳 */
  at: number
}

export interface Progress {
  last: LastRead | null
  /** 已读节的站内路径 */
  read: string[]
}

export const KEY = 'ds-book:progress'
/** sessionStorage 标记：进入该路径后恢复滚动位置 */
export const RESTORE_KEY = 'ds-book:restore'

export const empty = (): Progress => ({ last: null, read: [] })

/** 解析 localStorage 里的内容；任何坏数据都回退为空记录 */
export function parse(raw: string | null): Progress {
  if (!raw) return empty()
  try {
    const o = JSON.parse(raw) as { last?: Partial<LastRead> | null; read?: unknown }
    if (!o || typeof o !== 'object') return empty()
    const read = Array.isArray(o.read) ? o.read.filter((x): x is string => typeof x === 'string') : []
    const l = o.last
    const last: LastRead | null =
      l && typeof l.path === 'string'
        ? { path: l.path, title: String(l.title ?? ''), scrollY: Number(l.scrollY) || 0, at: Number(l.at) || 0 }
        : null
    return { last, read }
  } catch {
    return empty()
  }
}

export function markRead(p: Progress, path: string): Progress {
  return p.read.includes(path) ? p : { ...p, read: [...p.read, path] }
}

export function setLast(p: Progress, last: LastRead | null): Progress {
  return { ...p, last }
}

export function isRead(p: Progress, path: string): boolean {
  return p.read.includes(path)
}

/** VitePress 的 page.relativePath（ch02/2-8.md、ch02/index.md）→ 站内路径（/ch02/2-8、/ch02/） */
export function pagePath(relativePath: string): string {
  return '/' + relativePath.replace(/\.md$/, '').replace(/(^|\/)index$/, '$1')
}

/* ---------- 组合式函数：所有 localStorage 访问都在 onMounted 之后并 try/catch ---------- */

const state = ref<Progress>(empty())
const ready = ref(false)
let listeners = 0

function load(): void {
  try {
    state.value = parse(localStorage.getItem(KEY))
  } catch {
    state.value = empty()
  }
}

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state.value))
  } catch {
    /* 隐私模式或配额不足：静默失败，功能退化为本次会话内有效 */
  }
}

function onStorage(e: StorageEvent): void {
  if (e.key === KEY) load()
}

export function useProgress() {
  onMounted(() => {
    if (!ready.value) {
      load()
      ready.value = true
    }
    if (listeners++ === 0) window.addEventListener('storage', onStorage)
  })
  onUnmounted(() => {
    if (--listeners === 0) window.removeEventListener('storage', onStorage)
  })

  return {
    state,
    ready,
    markRead(path: string) {
      const next = markRead(state.value, path)
      if (next !== state.value) {
        state.value = next
        save()
      }
    },
    setLast(last: LastRead | null) {
      state.value = setLast(state.value, last)
      save()
    },
    clear() {
      state.value = empty()
      try {
        localStorage.removeItem(KEY)
      } catch {
        /* ignore */
      }
    },
  }
}
