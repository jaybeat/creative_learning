<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useData, useRoute } from 'vitepress'
import { ApiError, api, askStream, type AskTurn } from '../comments/api'
import { login, me, requireLogin } from '../comments/store'
import { courseMode } from '../course-mode'
import { pagePath } from '../progress'
import { claimRight, releaseRight, rightOpen } from '../right-rail'
import { ask, closeAsk } from './store'
import { renderAnswer } from './render'

/**
 * 问 AI：节页右侧的提问面板（手机上是底部弹层）。看动画时在全屏学习层里占右边一栏，播放器让出宽度、暂停（CourseSwitch.vue）。
 * 回答由 /api/ask 流式返回（server/ask.ts），模型能看到本节原文。对话按页存在 sessionStorage，换节就是新的对话。
 */
const { frontmatter, page } = useData()
const route = useRoute()

interface Msg {
  role: 'user' | 'assistant'
  content: string
  /** 出错的回答：显示错误，不带进后续对话 */
  error?: string
}

const path = computed(() => pagePath(page.value.relativePath))
/** 服务端认的页面 id：`ch02/2-1` */
const pageId = computed(() => path.value.replace(/^\//, '').replace(/\/$/, '/index'))
const enabled = computed(() => Boolean(frontmatter.value.section))
const inVideo = computed(() => Boolean(frontmatter.value.video) && courseMode.value === 'video')
const shortTitle = computed(() => String(page.value.title ?? '').replace(/^\d+(\.\d+)*\s*/, ''))

const messages = ref<Msg[]>([])
const input = ref('')
const busy = ref(false)
const left = ref<number | null>(null)
const unconfigured = ref(false)
const list = ref<HTMLElement>()
const box = ref<HTMLTextAreaElement>()
let abort: AbortController | null = null

const suggestions = computed(() => [
  '这一节要解决什么问题？',
  `用生活里的例子讲讲「${shortTitle.value}」`,
  '这一节最容易弄错的地方是什么？',
])

/* ---------- 对话存取 ---------- */
const storeKey = (id: string) => `ds-book:ask:${id}`
function load(id: string): void {
  try {
    messages.value = JSON.parse(sessionStorage.getItem(storeKey(id)) ?? '[]')
  } catch {
    messages.value = []
  }
}
function save(): void {
  try {
    sessionStorage.setItem(storeKey(pageId.value), JSON.stringify(messages.value))
  } catch {
    /* ignore */
  }
}

/* ---------- 开关 ---------- */
watch(
  () => ask.open,
  (open) => {
    if (open) {
      claimRight('ask')
      if (ask.prefill) input.value = ask.prefill
      ask.prefill = ''
      void refreshQuota()
      void nextTick(() => {
        // 自动打开（宽屏看动画默认常驻）时焦点留在播放器，空格、←/→ 照常控制播放
        if (!ask.auto) box.value?.focus()
        scrollDown()
      })
    } else {
      releaseRight('ask')
    }
    document.documentElement.toggleAttribute('data-ask-open', open)
  },
)
// 面板是自动打开的，学生再点"问 AI"：这时才把光标放进输入框
watch(
  () => ask.auto,
  (auto) => {
    if (!auto && ask.open) void nextTick(() => box.value?.focus())
  },
)
watch(rightOpen, (r) => {
  if (r !== 'ask' && ask.open) closeAsk()
})
watch(
  () => route.path,
  () => {
    abort?.abort()
    busy.value = false
    load(pageId.value)
    if (!enabled.value) closeAsk()
  },
)

async function refreshQuota(): Promise<void> {
  if (!me.value) return
  try {
    const q = await api.askQuota()
    left.value = q.left
    unconfigured.value = !q.enabled
  } catch {
    /* 额度显示不了不影响提问 */
  }
}
watch(me, () => ask.open && void refreshQuota())

/* ---------- 提问 ---------- */
function scrollDown(): void {
  const el = list.value
  if (el) el.scrollTop = el.scrollHeight
}

function send(text = input.value): void {
  const q = text.trim()
  if (!me.value) {
    requireLogin(q ? () => send(q) : undefined)
    return
  }
  if (!q || busy.value || unconfigured.value) return
  void run(q)
}

async function run(q: string): Promise<void> {
  // 带上最近 6 轮（出错的回答和它的问题不带）
  const history: AskTurn[] = []
  for (let i = 0; i < messages.value.length; i += 2) {
    const [u, a] = [messages.value[i], messages.value[i + 1]]
    if (u?.role === 'user' && a?.role === 'assistant' && !a.error && a.content) history.push({ role: 'user', content: u.content }, { role: 'assistant', content: a.content })
  }
  messages.value.push({ role: 'user', content: q }, { role: 'assistant', content: '' })
  const reply = messages.value[messages.value.length - 1]
  input.value = ''
  busy.value = true
  abort = new AbortController()
  const mine = abort
  await nextTick(scrollDown)
  try {
    const r = await askStream({ page: pageId.value, question: q, history: history.slice(-12) }, (d) => {
      reply.content += d
      // 读者往上翻看时不抢滚动
      const el = list.value
      if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 80) void nextTick(scrollDown)
    }, mine.signal)
    left.value = r.left
  } catch (e) {
    if (mine.signal.aborted) return
    // 服务端没配 key：只在输入框上方提示一次（unconfigured），撤掉这一问，问题放回输入框
    if (e instanceof ApiError && e.code === 'ask_unconfigured') {
      unconfigured.value = true
      messages.value.splice(-2)
      input.value = q
      return
    }
    reply.error = e instanceof ApiError ? e.message : '出错了，请稍后再试'
    if (e instanceof ApiError && e.code === 'login_required') me.value = null
    if (e instanceof ApiError && e.code === 'ask_daily_limit') left.value = 0
  } finally {
    if (abort === mine) {
      busy.value = false
      abort = null
    }
    save()
  }
}

function stop(): void {
  abort?.abort()
  busy.value = false
  save()
}

function clear(): void {
  stop()
  messages.value = []
  save()
}

function onKeydown(e: KeyboardEvent): void {
  // Enter 发送，Shift+Enter 换行；输入法选字时的 Enter 不算
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    send()
  }
}
/** Esc 先关面板：捕获阶段拦下，免得全屏层把 Esc 当成"退出动画" */
function onEsc(e: KeyboardEvent): void {
  // 登录框开着时 Esc 归登录框
  if (e.key === 'Escape' && ask.open && !login.open) {
    e.stopPropagation()
    closeAsk()
  }
}

onMounted(() => {
  load(pageId.value)
  window.addEventListener('keydown', onEsc, true)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onEsc, true)
  abort?.abort()
})
</script>

<template>
  <Teleport to="body">
    <aside
      v-if="enabled && ask.open"
      class="ask-panel"
      :class="{ 'ask-in-video': inVideo, 'cl-light': inVideo }"
      aria-label="问 AI"
      data-comment-ignore
    >
      <header class="ask-head">
        <h2 class="ask-title">问 AI</h2>
        <span v-if="left !== null" class="ask-left">今天还能问 {{ left }} 次</span>
        <span class="ask-spacer" />
        <button v-if="messages.length" type="button" class="ask-link" @click="clear">清空</button>
        <button type="button" class="ask-close" aria-label="关闭问 AI" @click="closeAsk">×</button>
      </header>

      <div ref="list" class="ask-body" aria-live="polite">
        <div v-if="!messages.length" class="ask-empty">
          <p class="ask-hello">看到哪里不明白，就在这里问。AI 读过这一节的原文，会按书里的讲法回答。</p>
          <p class="ask-try">试试问：</p>
          <button v-for="s in suggestions" :key="s" type="button" class="ask-chip" @click="send(s)">{{ s }}</button>
        </div>
        <template v-for="(m, i) in messages" :key="i">
          <div v-if="m.role === 'user'" class="ask-q">{{ m.content }}</div>
          <div v-else class="ask-a">
            <!-- eslint-disable-next-line vue/no-v-html -- renderAnswer 先整体转义再加标签 -->
            <div v-if="m.content" class="ask-md" v-html="renderAnswer(m.content)" />
            <span v-else-if="!m.error && busy && i === messages.length - 1" class="ask-typing" aria-label="正在想">
              <i /><i /><i />
            </span>
            <p v-if="m.error" class="ask-err">{{ m.error }}</p>
          </div>
        </template>
      </div>

      <form class="ask-form" @submit.prevent="send()">
        <p v-if="unconfigured" class="ask-err">问 AI 还没有配置好</p>
        <textarea
          ref="box"
          v-model="input"
          class="ask-input"
          rows="2"
          maxlength="1000"
          :placeholder="me ? '输入问题，Enter 发送，Shift+Enter 换行' : '登录后就能提问'"
          @keydown="onKeydown"
        />
        <div class="ask-actions">
          <span class="ask-note">AI 回答仅供参考，以书为准</span>
          <button v-if="busy" type="button" class="ask-btn" @click="stop">停止</button>
          <button v-else type="submit" class="ask-btn ask-btn-primary" :disabled="!!me && (unconfigured || !input.trim())">{{ me ? '发送' : '登录后提问' }}</button>
        </div>
      </form>
    </aside>
  </Teleport>
</template>
