import { reactive, ref, shallowRef } from 'vue'
import { api, type Me, type Thread } from './api'
import type { Quote } from './anchor'

/**
 * 评论功能的全局状态（模块级单例，只在浏览器里、onMounted 之后读写，不参与 SSR 输出）。
 */

/* ---------- 登录 ---------- */

export const me = ref<Me | null>(null)
export const meLoaded = ref(false)
let mePromise: Promise<void> | null = null

export function loadMe(): Promise<void> {
  mePromise ??= api
    .me()
    .then((r) => {
      me.value = r.user
    })
    .catch(() => {
      /* 接口不可用：当作未登录，阅读不受影响 */
    })
    .finally(() => {
      meLoaded.value = true
    })
  return mePromise
}

/** 登录框：step 由框自己推进；打开时可指定从「设置昵称」开始 */
export const login = reactive({ open: false, startAtName: false })
let afterLogin: (() => void) | null = null

/** 需要登录（且有昵称）才能做的事：已满足就直接做，否则弹登录框，完成后再做 */
export function requireLogin(then?: () => void): void {
  if (me.value?.name) {
    then?.()
    return
  }
  afterLogin = then ?? null
  login.startAtName = !!me.value && !me.value.name
  login.open = true
}

export function loginFinished(user: Me): void {
  me.value = user
  login.open = false
  const f = afterLogin
  afterLogin = null
  f?.()
}

export function loginCancelled(): void {
  login.open = false
  afterLogin = null
}

/* ---------- 本页评论 ---------- */

export const threads = ref<Thread[]>([])
export const threadsPage = ref('')
export const threadsError = ref(false)

/** 每条讨论串在正文里的位置；null = 原文已修改（找不到引文） */
export const anchors = shallowRef(new Map<string, { start: number; end: number } | null>())

export async function loadThreads(page: string): Promise<void> {
  threadsPage.value = page
  try {
    const r = await api.comments(page)
    if (threadsPage.value !== page) return
    threads.value = r.threads
    threadsError.value = false
  } catch {
    if (threadsPage.value !== page) return
    threads.value = []
    threadsError.value = true
  }
}

/* ---------- 评论面板 ---------- */

export interface Draft {
  quote: Quote
  headingId: string | null
  body: string
}

export const panel = reactive<{
  open: boolean
  /** all：本页全部；thread：某一串；new：写新评论 */
  mode: 'all' | 'thread' | 'new'
  threadId: string | null
  draft: Draft | null
}>({ open: false, mode: 'all', threadId: null, draft: null })

export function openAll(): void {
  Object.assign(panel, { open: true, mode: 'all', threadId: null })
}

export function openThread(id: string): void {
  Object.assign(panel, { open: true, mode: 'thread', threadId: id })
}

export function openNew(quote: Quote, headingId: string | null): void {
  const body = panel.draft && panel.draft.quote.exact === quote.exact ? panel.draft.body : ''
  Object.assign(panel, { open: true, mode: 'new', threadId: null, draft: { quote, headingId, body } })
}

export function closePanel(): void {
  panel.open = false
}
