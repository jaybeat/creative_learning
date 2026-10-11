<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData, withBase } from 'vitepress'
import book from '../../generated/book.json'
import { titleOf } from '../book-data'
import { isRead, pagePath, useProgress } from '../progress'
import { api, ApiError, formatTime, type Submission } from '../comments/api'
import { loadMe, me, requireLogin } from '../comments/store'
import CodeEditor from './CodeEditor.vue'
import RunPanel from './RunPanel.vue'
import type { RunCase, RunRecord } from './run-types'
import VerdictView from './VerdictView.vue'
import { TEMPLATE, clampSplit, readDraft, readSplit, writeDraft, writeSplit } from './draft'
import { verdictText, verdictTone } from './verdict'

/**
 * 题目页（frontmatter.layout: problem）：左边题面，右边代码编辑器；
 * 底部面板三个 Tab：测试用例（可改、可加自定义输入）、运行结果（逐组对比）、提交记录（评测结论）。
 * 「运行」只跑这些输入、不留记录；「提交」用全部测试点异步评测，前端轮询结果。
 */
const { page, frontmatter } = useData()
const { state, ready: progressReady, markRead } = useProgress()

const path = computed(() => pagePath(page.value.relativePath))
const problemId = computed(() => String(frontmatter.value.problemId ?? ''))
const chapter = computed(() => book.chapters.find((c) => c.problems?.items.some((p) => p.link === path.value)))
const items = computed(() => chapter.value?.problems?.items ?? [])
const index = computed(() => items.value.findIndex((p) => p.link === path.value))
const prevItem = computed(() => (index.value > 0 ? items.value[index.value - 1] : null))
/** 通过过的题（本机记录，提交通过时写入） */
const solved = computed(() => {
  if (!progressReady.value) return new Set<string>()
  return new Set(items.value.filter((p) => isRead(state.value, p.link, titleOf(p.link))).map((p) => p.link))
})
const markSolved = () => markRead(path.value, titleOf(path.value) ?? page.value.title)

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

/* ---------- 底部面板 ---------- */

const tab = ref<'cases' | 'result' | 'submissions'>('cases')

/* ---------- 测试用例与运行 ---------- */

const samples = computed(() => (frontmatter.value.samples as { input: string; output: string }[] | undefined) ?? [])
const cases = ref<RunCase[]>([])

function resetCases(): void {
  cases.value = samples.value.map((s, i) => ({ label: `样例 ${i + 1}`, input: s.input, expected: s.output, sample: i, sampleInput: s.input }))
}
function addCase(): void {
  const n = cases.value.filter((c) => c.sample === null).length + 1
  cases.value.push({ label: `自定义 ${n}`, input: '', expected: null, sample: null })
}
function removeCase(i: number): void {
  cases.value.splice(i, 1)
}
function setInput(i: number, v: string): void {
  cases.value[i].input = v
}
function resetSample(i: number): void {
  const c = cases.value[i]
  if (c.sampleInput !== undefined) c.input = c.sampleInput
}

const running = ref(false)
const runError = ref('')
const record = ref<RunRecord | null>(null)
const withNewline = (s: string) => (s.endsWith('\n') ? s : s + '\n')

function run(): void {
  requireLogin(async () => {
    if (running.value || cases.value.length === 0) return
    // 快照：改过输入的样例不再比对期望输出
    const snapshot = cases.value.map((c) => ({ ...c, expected: c.sample !== null && c.input !== c.sampleInput ? null : c.expected }))
    const id = problemId.value
    running.value = true
    runError.value = ''
    tab.value = 'result'
    try {
      const response = await api.run(id, code.value, snapshot.map((c) => withNewline(c.input)))
      if (id === problemId.value) record.value = { cases: snapshot, response }
    } catch (e) {
      runError.value = e instanceof ApiError ? e.message : '运行失败，请重试'
    } finally {
      running.value = false
    }
  })
}

/* ---------- 提交与评测结果 ---------- */

const submissions = ref<Submission[]>([])
const listError = ref('')
const message = ref('')
const busy = ref(false)
/** 正在查看详情的提交 */
const selected = ref<Submission | null>(null)

/** 同一用户、同一题的加载进行中时不重复请求（挂载与登录状态变化可能同时触发） */
let inflight = ''
/** 换题时递增，旧的轮询自动停止 */
let generation = 0

function upsert(s: Submission): void {
  const i = submissions.value.findIndex((x) => x.id === s.id)
  if (i >= 0) submissions.value.splice(i, 1, { ...submissions.value[i], ...s })
  else submissions.value.unshift(s)
  if (selected.value?.id === s.id) selected.value = { ...selected.value, ...s }
  if (s.status === 'accepted') markSolved()
}

/** 评测是异步的：每 1.5 秒查一次，最多 60 秒 */
async function poll(id: string): Promise<void> {
  const gen = generation
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1500))
    if (gen !== generation) return
    try {
      const s = await api.submission(id)
      if (gen !== generation) return
      upsert(s)
      if (s.status !== 'judging') return
    } catch {
      /* 网络抖动：下一轮再查 */
    }
  }
}

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
    if (r.submissions.some((s) => s.status === 'accepted')) markSolved()
    // 离开页面时还在评测的，回来继续等结果
    for (const s of r.submissions) if (s.status === 'judging') void poll(s.id)
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
    // 提交在请求里评测，通常一两秒返回结论
    tab.value = 'submissions'
    selected.value = null
    message.value = '评测中…（编译并运行全部测试点，通常几秒内完成）'
    try {
      const s = await api.submit(problemId.value, code.value)
      message.value = ''
      upsert(s)
      selected.value = s
      // 请求中途断开等情况下仍是 judging：继续查询，服务端会兜底重评
      if (s.status === 'judging') void poll(s.id)
      else if (s.status === 'pending') message.value = '已提交。评测机还没有配置，暂时只保存代码。'
    } catch (e) {
      message.value = e instanceof ApiError ? e.message : '提交失败，请重试'
      // 请求失败时提交可能已经入库并在评测：刷新列表看看
      void loadSubmissions()
    } finally {
      busy.value = false
    }
  })
}

async function open(s: Submission): Promise<void> {
  selected.value = s
  try {
    const full = await api.submission(s.id)
    if (selected.value?.id === s.id) upsert(full)
    if (full.status === 'judging') void poll(full.id)
  } catch (e) {
    message.value = e instanceof ApiError ? e.message : '读取失败，请重试'
  }
}

async function loadCode(s: Submission): Promise<void> {
  try {
    const full = s.code === undefined ? await api.submission(s.id) : s
    if (full.code === undefined || full.code === code.value) return
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

resetCases()

onMounted(() => {
  split.value = readSplit()
  loadDraft()
  void loadMe().then(loadSubmissions)
})
onBeforeUnmount(() => {
  generation++
  // 离开页面前把还没来得及保存的草稿写掉
  window.clearTimeout(saveTimer)
  writeDraft(problemId.value, code.value)
})

// 站内在各问之间切换：同一个组件实例，换题时先存旧草稿再读新草稿，面板状态清空
watch(problemId, (id, old) => {
  if (old) {
    window.clearTimeout(saveTimer)
    writeDraft(old, code.value)
  }
  generation++
  loadDraft()
  resetCases()
  record.value = null
  runError.value = ''
  message.value = ''
  selected.value = null
  submissions.value = []
  tab.value = 'cases'
  void loadSubmissions()
})
watch(() => me.value?.id, () => void loadSubmissions())

const TABS = [
  { key: 'cases', label: '测试用例' },
  { key: 'result', label: '运行结果' },
  { key: 'submissions', label: '提交记录' },
] as const
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
          >{{ p.short }}<span v-if="solved.has(p.link)" class="read-mark" title="已通过">✓</span></a
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
            <div class="pw-tabs" role="tablist" aria-label="面板">
              <button
                v-for="t in TABS"
                :key="t.key"
                type="button"
                role="tab"
                class="pw-tab"
                :class="{ active: tab === t.key }"
                :aria-selected="tab === t.key"
                @click="tab = t.key"
              >
                {{ t.label }}
              </button>
            </div>
            <span class="pw-spacer"></span>
            <button type="button" class="pw-run" :disabled="running" @click="run">{{ running ? '运行中…' : '运行' }}</button>
            <button type="button" class="pw-submit" :disabled="busy" @click="submit">{{ busy ? '提交中…' : '提交' }}</button>
          </div>

          <div class="pw-body">
            <RunPanel
              v-if="tab !== 'submissions'"
              :mode="tab === 'cases' ? 'cases' : 'result'"
              :cases="cases"
              :record="record"
              :running="running"
              :error="runError"
              @add="addCase"
              @remove="removeCase"
              @input="setInput"
              @reset="resetSample"
            />
            <template v-else>
              <p v-if="message" class="pw-message" role="status">{{ message }}</p>
              <p v-if="!me" class="pw-empty">登录后可以运行和提交代码，提交记录会保存在你的账号里。代码草稿会自动保存在本机。</p>
              <template v-else-if="selected">
                <div class="pw-detail-bar">
                  <button type="button" class="pw-link" @click="selected = null">← 全部提交</button>
                  <span class="pw-time">{{ formatTime(selected.createdAt) }}</span>
                  <span class="pw-spacer"></span>
                  <button type="button" class="pw-link" @click="loadCode(selected)">载入这次的代码</button>
                </div>
                <p v-if="selected.status === 'judging'" class="rp-note" role="status">评测中…（编译并运行全部测试点，通常几秒内完成）</p>
                <VerdictView v-else :s="selected" />
              </template>
              <p v-else-if="listError" class="pw-empty">{{ listError }}</p>
              <p v-else-if="submissions.length === 0" class="pw-empty">还没有提交过。</p>
              <ul v-else class="pw-list">
                <li v-for="s in submissions" :key="s.id">
                  <button type="button" class="pw-item" @click="open(s)">
                    <span class="pw-status" :class="`tone-${verdictTone(s.status)}`">{{ verdictText(s.status) }}</span>
                    <span v-if="s.total" class="pw-count">{{ s.passed }}/{{ s.total }}</span>
                    <span class="pw-time">{{ formatTime(s.createdAt) }}</span>
                  </button>
                </li>
              </ul>
            </template>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
