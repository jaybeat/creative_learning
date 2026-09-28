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

const link = (t: Thread) => withBase(`${t.pagePath}?c=${t.id}`)

onMounted(async () => {
  await loadMe()
  void load()
})
watch(filter, () => void load())
watch(me, () => void load())
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
