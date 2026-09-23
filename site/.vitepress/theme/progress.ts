import { onMounted, onUnmounted, ref } from 'vue'

/* ---------- 纯函数部分：不碰 window，可单测 ---------- */

export interface LastRead {
  /** 站内路径（不带 base），如 /ch02/2-9 */
  path: string
  /** 记录时的节标题；与当前标题不一致说明章节已重排，记录作废 */
  title: string
  scrollY: number
  /** 时间戳 */
  at: number
}

export interface ReadEntry {
  path: string
  title: string
}

export interface Progress {
  last: LastRead | null
  /** 已读节：路径 + 记录时的标题。节的 URL 只含编号，书稿重排后同一路径可能换了内容，所以要连标题一起校验。 */
  read: ReadEntry[]
}

export const KEY = 'ds-book:progress'
/** sessionStorage 标记：进入该路径后恢复滚动位置 */
export const RESTORE_KEY = 'ds-book:restore'

export const empty = (): Progress => ({ last: null, read: [] })

/** 解析 localStorage 里的内容；任何坏数据都回退为空记录。旧格式（read 为字符串数组）的项直接丢弃。 */
export function parse(raw: string | null): Progress {
  if (!raw) return empty()
  try {
    const o = JSON.parse(raw) as { last?: Partial<LastRead> | null; read?: unknown }
    if (!o || typeof o !== 'object') return empty()
    const read: ReadEntry[] = Array.isArray(o.read)
      ? o.read
          .filter((e): e is ReadEntry => !!e && typeof e === 'object' && typeof (e as ReadEntry).path === 'string' && typeof (e as ReadEntry).title === 'string')
          .map((e) => ({ path: e.path, title: e.title }))
      : []
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

export function markRead(p: Progress, path: string, title: string): Progress {
  const i = p.read.findIndex((e) => e.path === path)
  if (i >= 0) {
    if (p.read[i].title === title) return p
    const read = p.read.slice()
    read[i] = { path, title }
    return { ...p, read }
  }
  return { ...p, read: [...p.read, { path, title }] }
}

export function setLast(p: Progress, last: LastRead | null): Progress {
  return { ...p, last }
}

/** 已读且标题仍与当前书稿一致 */
export function isRead(p: Progress, path: string, title: string | null): boolean {
  return title !== null && p.read.some((e) => e.path === path && e.title === title)
}

/** 「最近阅读」仍有效（路径对应的节标题没变） */
export function validLast(p: Progress, titleOf: (path: string) => string | null): LastRead | null {
  return p.last && titleOf(p.last.path) === p.last.title ? p.last : null
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
    markRead(path: string, title: string) {
      const next = markRead(state.value, path, title)
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
