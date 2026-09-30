<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData, withBase } from 'vitepress'
import book from '../../generated/book.json'
import { titleOf } from '../book-data'
import { isRead, pagePath, useProgress } from '../progress'
import { api, ApiError, formatTime, type Submission } from '../comments/api'
import { loadMe, me, requireLogin } from '../comments/store'
import CodeEditor from './CodeEditor.vue'
import { TEMPLATE, clampSplit, readDraft, readSplit, writeDraft, writeSplit } from './draft'

/**
 * 题目页（frontmatter.layout: problem）：左边题面，右边代码编辑器与提交记录。
 * 桌面左右分栏、分隔条可拖动；窄屏上下排。本期提交只保存代码，不评测。
 */
const { page, frontmatter } = useData()
const { state, ready: progressReady, markRead } = useProgress()

const path = computed(() => pagePath(page.value.relativePath))
const problemId = computed(() => String(frontmatter.value.problemId ?? ''))
const chapter = computed(() => book.chapters.find((c) => c.problems?.items.some((p) => p.link === path.value)))
const items = computed(() => chapter.value?.problems?.items ?? [])
const index = computed(() => items.value.findIndex((p) => p.link === path.value))
const prevItem = computed(() => (index.value > 0 ? items.value[index.value - 1] : null))
const submitted = computed(() => {
  if (!progressReady.value) return new Set<string>()
  return new Set(items.value.filter((p) => isRead(state.value, p.link, titleOf(p.link))).map((p) => p.link))
})

/* ---------- 代码与草稿 ---------- */

const code = ref(TEMPLATE)
let saveTimer: number | undefined

function loadDraft(): void {
  code.value = readDraft(problemId.value) ?? TEMPLATE
}

watch(code, (c) => {
  window.clearTimeout(saveTimer)
  const id = problemId.value
  saveTimer = window.setTimeout(() => writeDraft(id, c), 500)
})

function reset(): void {
  if (code.value !== TEMPLATE && !window.confirm('清空编辑器，恢复成初始模板？当前代码会丢失。')) return
  code.value = TEMPLATE
}

function importPrev(): void {
  const prev = prevItem.value
  if (!prev) return
  const c = readDraft(prev.id)
  if (!c) {
    window.alert(`本机没有${prev.short}的代码草稿。`)
    return
  }
  if (code.value !== TEMPLATE && !window.confirm(`用${prev.short}的代码替换当前编辑器里的内容？`)) return
  code.value = c
}

/* ---------- 提交 ---------- */

const submissions = ref<Submission[]>([])
const listError = ref('')
const message = ref('')
const busy = ref(false)

const STATUS: Record<string, string> = {
  pending: '已提交 · 等待评测',
  judging: '评测中',
  accepted: '通过',
  wrong_answer: '答案错误',
  compile_error: '编译错误',
  runtime_error: '运行错误',
  time_limit: '超时',
}
const statusText = (s: string) => STATUS[s] ?? s

/** 同一用户、同一题的加载进行中时不重复请求（挂载与登录状态变化可能同时触发） */
let inflight = ''

async function loadSubmissions(): Promise<void> {
  if (!me.value) {
    submissions.value = []
    return
  }
  const id = problemId.value
  const key = `${me.value.id}|${id}`
  if (inflight === key) return
  inflight = key
  try {
    const r = await api.submissions(id)
    if (id !== problemId.value) return
    submissions.value = r.submissions
    listError.value = ''
  } catch (e) {
    listError.value = e instanceof ApiError ? e.message : '提交记录加载失败'
  } finally {
    if (inflight === key) inflight = ''
  }
}

function submit(): void {
  message.value = ''
  requireLogin(async () => {
    if (busy.value) return
    busy.value = true
    try {
      const s = await api.submit(problemId.value, code.value)
      submissions.value = [s, ...submissions.value]
      message.value = '已提交。评测功能还在准备中，上线后这里会显示结果。'
      markRead(path.value, titleOf(path.value) ?? page.value.title)
    } catch (e) {
      message.value = e instanceof ApiError ? e.message : '提交失败，请重试'
    } finally {
      busy.value = false
    }
  })
}

async function view(s: Submission): Promise<void> {
  try {
    const full = await api.submission(s.id)
    if (full.code === undefined) return
    if (full.code === code.value) return
    if (!window.confirm(`把 ${formatTime(s.createdAt)} 提交的代码载入编辑器？当前编辑器里的内容会被替换。`)) return
    code.value = full.code
  } catch (e) {
    message.value = e instanceof ApiError ? e.message : '读取失败，请重试'
  }
}

/* ---------- 分栏拖动 ---------- */

const split = ref(0.5)
const root = ref<HTMLElement>()
let dragging = false

function onDown(e: PointerEvent): void {
  dragging = true
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}
function onMove(e: PointerEvent): void {
  if (!dragging || !root.value) return
  const r = root.value.getBoundingClientRect()
  split.value = clampSplit((e.clientX - r.left) / r.width)
}
function onUp(): void {
  if (!dragging) return
  dragging = false
  writeSplit(split.value)
}
function onKey(e: KeyboardEvent): void {
  const d = e.key === 'ArrowLeft' ? -0.05 : e.key === 'ArrowRight' ? 0.05 : 0
  if (!d) return
  e.preventDefault()
  split.value = clampSplit(split.value + d)
  writeSplit(split.value)
}

/* ---------- 生命周期 ---------- */

onMounted(() => {
  split.value = readSplit()
  loadDraft()
  void loadMe().then(loadSubmissions)
})
onBeforeUnmount(() => {
  // 离开页面前把还没来得及保存的草稿写掉
  window.clearTimeout(saveTimer)
  writeDraft(problemId.value, code.value)
})

// 站内在各问之间切换：同一个组件实例，换题时先存旧草稿再读新草稿
watch(problemId, (id, old) => {
  if (old) {
    window.clearTimeout(saveTimer)
    writeDraft(old, code.value)
  }
  loadDraft()
  message.value = ''
  submissions.value = []
  void loadSubmissions()
})
watch(() => me.value?.id, () => void loadSubmissions())
</script>

<template>
  <div class="problem-page">
    <div class="problem-bar">
      <a v-if="chapter" class="problem-back" :href="withBase(`/${chapter.slug}/`)">← 第{{ chapter.number }}章</a>
      <span class="problem-set">练习：{{ frontmatter.problemSet }}</span>
      <nav class="problem-tabs" aria-label="本组题目">
        <a
          v-for="p in items"
          :key="p.link"
          :href="withBase(p.link)"
          :class="{ active: p.link === path }"
          :aria-current="p.link === path ? 'page' : undefined"
          :title="p.title"
          >{{ p.short }}<span v-if="submitted.has(p.link)" class="read-mark" title="已提交">✓</span></a
        >
      </nav>
    </div>

    <div ref="root" class="problem-split" :style="{ '--split': `${split * 100}%` }" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp">
      <section class="problem-statement" aria-label="题目">
        <Content class="vp-doc problem-doc" />
      </section>

      <div
        class="problem-divider"
        role="separator"
        aria-orientation="vertical"
        aria-label="拖动调整题面与代码区的宽度"
        :aria-valuenow="Math.round(split * 100)"
        tabindex="0"
        @pointerdown="onDown"
        @keydown="onKey"
      ></div>

      <section class="problem-workspace" aria-label="代码">
        <div class="pw-toolbar">
          <span class="pw-lang">C</span>
          <span class="pw-spacer"></span>
          <button v-if="prevItem" type="button" class="pw-btn" @click="importPrev">载入{{ prevItem.short }}的代码</button>
          <button type="button" class="pw-btn" @click="reset">重置</button>
        </div>
        <CodeEditor v-model="code" class="pw-editor" />
        <div class="pw-panel">
          <div class="pw-actions">
            <span class="pw-tab">提交记录</span>
            <span class="pw-spacer"></span>
            <button type="button" class="pw-submit" :disabled="busy" @click="submit">{{ busy ? '提交中…' : '提交' }}</button>
          </div>
          <p v-if="message" class="pw-message" role="status">{{ message }}</p>
          <p v-if="!me" class="pw-empty">登录后可以提交代码，提交记录会保存在你的账号里。代码草稿会自动保存在本机。</p>
          <p v-else-if="listError" class="pw-empty">{{ listError }}</p>
          <p v-else-if="submissions.length === 0" class="pw-empty">还没有提交过。</p>
          <ul v-else class="pw-list">
            <li v-for="s in submissions" :key="s.id">
              <span class="pw-status" :class="`is-${s.status}`">{{ statusText(s.status) }}</span>
              <span class="pw-time">{{ formatTime(s.createdAt) }}</span>
              <button type="button" class="pw-link" @click="view(s)">载入代码</button>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </div>
</template>
