<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { onContentUpdated, useData } from 'vitepress'
import { pagePath } from '../progress'
import { api, ApiError } from './api'
import {
  buildTextIndex,
  headingAt,
  locate,
  offsetsToRange,
  quoteAt,
  rangeToOffsets,
  sectionRange,
  type TextIndex,
} from './anchor'
import {
  anchors,
  closePanel,
  loadMe,
  loadThreads,
  me,
  openAll,
  openNew,
  openThread,
  panel,
  requireLogin,
  threads,
  threadsError,
  threadsPage,
} from './store'
import ThreadView from './ThreadView.vue'

/**
 * 划词评论层（挂在 layout-bottom）：
 * - 选中正文 → 选区下方浮出「评论」按钮
 * - 已有评论的原文用 CSS Custom Highlight API 高亮（不改 DOM，不影响 hydration、代码折叠和字符画对齐）
 * - 点高亮打开对应讨论串；URL 带 ?c=<id> 时自动打开
 */
const { page, frontmatter } = useData()
const enabled = computed(() => Boolean(frontmatter.value.chapter))
const MAX_QUOTE = 500

let index: TextIndex | null = null
const selBtn = ref<{ top: number; left: number; tooLong: boolean } | null>(null)
let selOffsets: { start: number; end: number } | null = null
const highlightSupported = typeof CSS !== 'undefined' && 'highlights' in CSS

const docEl = () => document.querySelector<HTMLElement>('.VPDoc .vp-doc')

/* ---------- 定位与高亮 ---------- */

function reanchor(): void {
  const el = docEl()
  index = el ? buildTextIndex(el) : null
  const m = new Map<string, { start: number; end: number } | null>()
  for (const t of threads.value) {
    if (!t.quote.exact) continue
    m.set(t.id, index ? locate(index.text, t.quote, sectionRange(index, t.headingId)) : null)
  }
  anchors.value = m
  paint()
}

function paint(): void {
  if (!highlightSupported) return
  const all: Range[] = []
  const active: Range[] = []
  if (index) {
    for (const [id, pos] of anchors.value) {
      if (!pos) continue
      const r = offsetsToRange(index, pos.start, pos.end)
      if (!r) continue
      all.push(r)
      if (panel.open && panel.threadId === id) active.push(r)
    }
  }
  CSS.highlights.set('cl-comment', new Highlight(...all))
  CSS.highlights.set('cl-comment-active', new Highlight(...active))
}

function clearPaint(): void {
  if (!highlightSupported) return
  CSS.highlights.delete('cl-comment')
  CSS.highlights.delete('cl-comment-active')
}

async function jump(id: string): Promise<void> {
  const pos = anchors.value.get(id)
  if (!pos || !index) return
  openThread(id)
  await nextTick()
  const rect = offsetsToRange(index, pos.start, pos.end)?.getBoundingClientRect()
  if (!rect) return
  // 手机上面板是底部弹层：把原文滚到弹层上方可见区域里；桌面上滚到视口上三分之一处
  const sheet = document.querySelector('.cl-panel')?.getBoundingClientRect()
  const visibleBottom = sheet && sheet.left <= 0 && sheet.top > 0 ? sheet.top : window.innerHeight
  window.scrollTo({ top: window.scrollY + rect.top - visibleBottom * 0.3, behavior: 'smooth' })
}

/* ---------- 加载 ---------- */

/** onMounted 与 onContentUpdated 在首屏都会触发：同一页面正在加载时复用同一次请求 */
let inflight: { path: string; p: Promise<void> } | null = null

function refresh(): Promise<void> {
  const path = enabled.value ? pagePath(page.value.relativePath) : ''
  if (inflight?.path === path) return inflight.p
  const p = doRefresh().finally(() => {
    if (inflight?.p === p) inflight = null
  })
  inflight = { path, p }
  return p
}

async function doRefresh(): Promise<void> {
  selBtn.value = null
  if (!enabled.value) {
    threads.value = []
    threadsPage.value = ''
    anchors.value = new Map()
    clearPaint()
    closePanel()
    return
  }
  const path = pagePath(page.value.relativePath)
  if (threadsPage.value !== path) closePanel()
  await loadThreads(path)
  await nextTick()
  reanchor()
  const c = new URLSearchParams(location.search).get('c')
  if (c && threads.value.some((t) => t.id === c)) {
    if (anchors.value.get(c)) void jump(c)
    else openThread(c)
  }
}

watch(threads, () => reanchor())
watch(() => [panel.open, panel.threadId], paint)

/* ---------- 划词 ---------- */

let selTimer: number | undefined

function updateSelection(): void {
  window.clearTimeout(selTimer)
  selTimer = window.setTimeout(() => {
    const sel = window.getSelection()
    const el = docEl()
    if (!enabled.value || !sel || sel.isCollapsed || sel.rangeCount === 0 || !el) {
      selBtn.value = null
      return
    }
    const range = sel.getRangeAt(0)
    if (!el.contains(range.commonAncestorContainer)) {
      selBtn.value = null
      return
    }
    index ??= buildTextIndex(el)
    const off = rangeToOffsets(index, range)
    if (!off) {
      selBtn.value = null
      return
    }
    selOffsets = off
    const rects = range.getClientRects()
    const last = rects[rects.length - 1] ?? range.getBoundingClientRect()
    const left = Math.min(Math.max(8, last.left + last.width / 2 - 40), document.documentElement.clientWidth - 100)
    selBtn.value = { top: window.scrollY + last.bottom + 8, left: window.scrollX + left, tooLong: off.end - off.start > MAX_QUOTE }
  }, 120)
}

function startComment(): void {
  if (!index || !selOffsets || selBtn.value?.tooLong) return
  const q = quoteAt(index.text, selOffsets.start, selOffsets.end)
  openNew(q, headingAt(index, selOffsets.start))
  selBtn.value = null
  window.getSelection()?.removeAllRanges()
}

/* ---------- 点高亮 ---------- */

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const d = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }
  if (d.caretPositionFromPoint) {
    const p = d.caretPositionFromPoint(x, y)
    return p ? { node: p.offsetNode, offset: p.offset } : null
  }
  const r = document.caretRangeFromPoint?.(x, y)
  return r ? { node: r.startContainer, offset: r.startOffset } : null
}

function onDocClick(e: MouseEvent): void {
  if (!enabled.value || !index || anchors.value.size === 0) return
  const el = docEl()
  if (!el || !el.contains(e.target as Node) || (e.target as Element).closest('a, button, input, textarea')) return
  if (!window.getSelection()?.isCollapsed) return
  const caret = caretAt(e.clientX, e.clientY)
  if (!caret || caret.node.nodeType !== Node.TEXT_NODE) return
  // 光标位置 → 正文偏移：找这个文本节点里最接近的字符
  let pos = -1
  for (let i = 0; i < index.map.length; i++) {
    const m = index.map[i]
    if (m.node === caret.node && m.offset <= caret.offset) pos = i
    else if (pos >= 0 && m.node !== caret.node) break
  }
  if (pos < 0) return
  let best: { id: string; len: number } | null = null
  for (const [id, a] of anchors.value) {
    if (a && pos >= a.start && pos < a.end && (!best || a.end - a.start < best.len)) best = { id, len: a.end - a.start }
  }
  if (best) openThread(best.id)
}

/* ---------- 写新评论 ---------- */

const busy = ref(false)
const error = ref('')

async function submitNew(): Promise<void> {
  const d = panel.draft
  if (!d || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const r = await api.createThread({
      page: pagePath(page.value.relativePath),
      pageTitle: page.value.title,
      headingId: d.headingId,
      quote: d.quote,
      body: d.body,
    })
    panel.draft = null
    await loadThreads(threadsPage.value)
    openThread(r.id)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '发送失败，请重试'
  } finally {
    busy.value = false
  }
}

/* ---------- 面板内容 ---------- */

/** 按正文位置排序；找不到原文的排最后 */
const sorted = computed(() => {
  const pos = (id: string) => anchors.value.get(id)?.start ?? Number.MAX_SAFE_INTEGER
  return [...threads.value].sort((a, b) => pos(a.id) - pos(b.id) || a.createdAt.localeCompare(b.createdAt))
})
const current = computed(() => threads.value.find((t) => t.id === panel.threadId) ?? null)

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && panel.open) closePanel()
}

onMounted(() => {
  void loadMe()
  void refresh()
  document.addEventListener('selectionchange', updateSelection)
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onContentUpdated(() => void refresh())
onUnmounted(() => {
  document.removeEventListener('selectionchange', updateSelection)
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
  window.clearTimeout(selTimer)
  clearPaint()
})
</script>

<template>
  <div v-if="enabled" class="cl-layer">
    <button
      v-if="selBtn"
      type="button"
      class="cl-sel-btn"
      :style="{ top: selBtn.top + 'px', left: selBtn.left + 'px' }"
      :disabled="selBtn.tooLong"
      data-comment-ignore
      @mousedown.prevent
      @click="startComment"
    >
      {{ selBtn.tooLong ? '选中的文字太长了' : '💬 评论' }}
    </button>

    <aside v-if="panel.open" class="cl-panel" aria-label="评论" data-comment-ignore>
      <header class="cl-panel-head">
        <button v-if="panel.mode !== 'all'" type="button" class="cl-link" @click="openAll">← 本页全部评论</button>
        <h2 v-else class="cl-panel-title">本页评论（{{ threads.length }}）</h2>
        <button type="button" class="cl-close" aria-label="关闭" @click="closePanel">×</button>
      </header>

      <div class="cl-panel-body">
        <template v-if="panel.mode === 'new' && panel.draft">
          <blockquote class="cl-quote"><span class="cl-quote-text">{{ panel.draft.quote.exact }}</span></blockquote>
          <form v-if="me?.name" @submit.prevent="submitNew">
            <textarea
              v-model="panel.draft.body"
              rows="5"
              maxlength="2000"
              placeholder="哪里没看懂、哪里写错了、有什么建议？"
              aria-label="评论内容"
            ></textarea>
            <div class="cl-row">
              <button type="button" class="cl-btn" @click="closePanel">取消</button>
              <button type="submit" class="cl-btn cl-btn-primary" :disabled="busy || !panel.draft.body.trim()">
                {{ busy ? '发送中…' : '发表评论' }}
              </button>
            </div>
            <p v-if="error" class="cl-error" role="alert">{{ error }}</p>
          </form>
          <div v-else class="cl-login-prompt">
            <p>登录后才能发表评论。</p>
            <button type="button" class="cl-btn cl-btn-primary" @click="requireLogin()">登录 / 注册</button>
          </div>
        </template>

        <template v-else-if="panel.mode === 'thread' && current">
          <ThreadView :thread="current" @jump="jump" />
        </template>

        <template v-else>
          <p v-if="threadsError" class="cl-empty">评论暂时加载不出来，稍后再试。</p>
          <p v-else-if="threads.length === 0" class="cl-empty">还没有评论。选中正文里的任意文字，就可以发表评论。</p>
          <ThreadView v-for="t in sorted" :key="t.id" :thread="t" @jump="jump" />
        </template>
      </div>
    </aside>
  </div>
</template>
