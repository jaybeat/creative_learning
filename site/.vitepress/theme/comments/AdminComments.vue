<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { withBase } from 'vitepress'
import { api, ApiError, formatTime, type Thread } from './api'
import { loadMe, me, meLoaded, requireLogin } from './store'

/** /admin：全站评论流，默认只看「作者还没回复」的 */
const filter = ref<'unreplied' | 'all'>('unreplied')
const list = ref<Thread[]>([])
const next = ref<string | null>(null)
const loading = ref(false)
const error = ref('')

async function load(more = false): Promise<void> {
  if (!me.value?.isAdmin) return
  loading.value = true
  error.value = ''
  try {
    const r = await api.adminComments(filter.value, more ? (next.value ?? undefined) : undefined)
    list.value = more ? [...list.value, ...r.threads] : r.threads
    next.value = r.next
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

/** 静默回复后待合并通知的读者 */
type Pending = { userId: string; name: string; count: number; notifyReplies: boolean }
const pending = ref<Pending[]>([])
const sending = ref('')
const notice = ref('')

async function loadPending(): Promise<void> {
  if (!me.value?.isAdmin) return
  try {
    pending.value = (await api.pendingNotify()).users
  } catch {
    pending.value = []
  }
}

async function sendPending(p: Pending): Promise<void> {
  if (!window.confirm(`把给 ${p.name} 的 ${p.count} 条回复合并成一封邮件发出？`)) return
  sending.value = p.userId
  error.value = ''
  try {
    const r = await api.sendPendingNotify(p.userId)
    notice.value = r.sent ? `已给 ${p.name} 发出一封合并通知` : `${p.name} 关闭了回复通知，没有发信，已清除待通知标记`
    await loadPending()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '发送失败'
  } finally {
    sending.value = ''
  }
}

const link = (t: Thread) => withBase(`${t.pagePath}?c=${t.id}`)

onMounted(async () => {
  await loadMe()
  void load()
  void loadPending()
})
watch(filter, () => void load())
watch(me, () => {
  void load()
  void loadPending()
})
</script>

<template>
  <div class="cl-admin">
    <h1>评论管理</h1>
    <p v-if="!meLoaded">加载中…</p>
    <p v-else-if="!me">
      请先 <button type="button" class="cl-link" @click="requireLogin()">登录</button>。
    </p>
    <p v-else-if="!me.isAdmin">只有作者可以查看这个页面。</p>
    <template v-else>
      <section v-if="pending.length" class="cl-admin-pending">
        <h2>待合并通知</h2>
        <ul>
          <li v-for="p in pending" :key="p.userId">
            <span>{{ p.name }}：{{ p.count }} 条回复还没发邮件<template v-if="!p.notifyReplies">（对方关闭了通知）</template></span>
            <button type="button" class="cl-btn cl-btn-primary" :disabled="!!sending" @click="sendPending(p)">
              {{ sending === p.userId ? '发送中…' : p.notifyReplies ? '合并成一封发出' : '清除标记' }}
            </button>
          </li>
        </ul>
      </section>
      <p v-if="notice" class="cl-notice">{{ notice }}</p>
      <div class="cl-admin-tabs" role="tablist">
        <button type="button" role="tab" :aria-selected="filter === 'unreplied'" :class="{ active: filter === 'unreplied' }" @click="filter = 'unreplied'">
          未回复
        </button>
        <button type="button" role="tab" :aria-selected="filter === 'all'" :class="{ active: filter === 'all' }" @click="filter = 'all'">全部</button>
      </div>
      <p v-if="error" class="cl-error">{{ error }}</p>
      <p v-if="!loading && list.length === 0" class="cl-empty">{{ filter === 'unreplied' ? '所有评论都回复过了 🎉' : '还没有评论' }}</p>
      <ul class="cl-admin-list">
        <li v-for="t in list" :key="t.id">
          <a :href="link(t)" class="cl-admin-page">{{ t.pageTitle || t.pagePath }}</a>
          <blockquote class="cl-quote"><span class="cl-quote-text">{{ t.quote.exact }}</span></blockquote>
          <p class="cl-meta">
            <span class="cl-author">{{ t.author.name }}</span>
            <time :datetime="t.createdAt">{{ formatTime(t.createdAt) }}</time>
            <span v-if="t.hidden" class="cl-tag">已隐藏</span>
            <span v-if="t.replies.length">· {{ t.replies.length }} 条回复</span>
          </p>
          <p class="cl-body">{{ t.body }}</p>
        </li>
      </ul>
      <button v-if="next" type="button" class="cl-btn" :disabled="loading" @click="load(true)">加载更多</button>
    </template>
  </div>
</template>
