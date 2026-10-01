<script setup lang="ts">
import { computed, ref } from 'vue'
import { api, ApiError, formatTime, type Comment, type Thread } from './api'
import { anchors, loadThreads, me, requireLogin, threadsPage } from './store'

/** 一条讨论串：引文、顶层评论、回复列表、回复框 */
const props = defineProps<{ thread: Thread }>()
const emit = defineEmits<{ (e: 'jump', id: string): void }>()

const replying = ref(false)
const text = ref('')
const busy = ref(false)
const error = ref('')
/** 管理员回复时可以先不发邮件，之后在 /admin 合并成一封；选择记在本机 */
const SILENT_KEY = 'cl-silent-reply'
const silent = ref(typeof localStorage !== 'undefined' && localStorage.getItem(SILENT_KEY) === '1')
function toggleSilent(e: Event): void {
  silent.value = (e.target as HTMLInputElement).checked
  localStorage.setItem(SILENT_KEY, silent.value ? '1' : '0')
}

const orphan = computed(() => anchors.value.has(props.thread.id) && anchors.value.get(props.thread.id) === null)

async function act(fn: () => Promise<unknown>): Promise<void> {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await fn()
    await loadThreads(threadsPage.value)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '操作失败，请重试'
  } finally {
    busy.value = false
  }
}

function startReply(): void {
  requireLogin(() => {
    replying.value = true
  })
}

const send = () =>
  act(async () => {
    await api.reply(props.thread.id, text.value, !!me.value?.isAdmin && silent.value)
    text.value = ''
    replying.value = false
  })

function remove(c: Comment): void {
  if (window.confirm('删除这条评论？')) void act(() => api.remove(c.id))
}

const hide = (c: Comment) => act(() => api.hide(c.id, !c.hidden))

const canRemove = (c: Comment) => !c.deleted && (c.mine || !!me.value?.isAdmin)
</script>

<template>
  <article class="cl-thread" :class="{ 'is-hidden': thread.hidden }">
    <blockquote v-if="thread.quote.exact" class="cl-quote">
      <button v-if="!orphan" type="button" class="cl-quote-text" title="定位到正文" @click="emit('jump', thread.id)">
        {{ thread.quote.exact }}
      </button>
      <span v-else class="cl-quote-text">{{ thread.quote.exact }}</span>
      <span v-if="orphan" class="cl-tag">原文已修改</span>
    </blockquote>

    <div v-for="c in [thread, ...thread.replies]" :key="c.id" class="cl-comment" :class="{ 'is-reply': c !== thread, 'is-hidden': c.hidden }">
      <template v-if="c.deleted">
        <p class="cl-deleted">该评论已删除</p>
      </template>
      <template v-else>
        <header class="cl-meta">
          <span class="cl-author">{{ c.author.name }}</span>
          <span v-if="c.author.isAdmin" class="cl-badge">作者</span>
          <time :datetime="c.createdAt">{{ formatTime(c.createdAt) }}</time>
          <span v-if="c.hidden" class="cl-tag">已隐藏</span>
        </header>
        <p class="cl-body">{{ c.body }}</p>
        <footer class="cl-actions">
          <button v-if="canRemove(c)" type="button" class="cl-link" :disabled="busy" @click="remove(c)">删除</button>
          <button v-if="me?.isAdmin" type="button" class="cl-link" :disabled="busy" @click="hide(c)">{{ c.hidden ? '取消隐藏' : '隐藏' }}</button>
        </footer>
      </template>
    </div>

    <div v-if="!thread.deleted || thread.replies.length" class="cl-reply">
      <form v-if="replying" @submit.prevent="send">
        <textarea v-model="text" rows="3" maxlength="2000" placeholder="写下你的回复" aria-label="回复内容"></textarea>
        <label v-if="me?.isAdmin" class="cl-check">
          <input type="checkbox" :checked="silent" @change="toggleSilent" />
          先不发邮件，稍后在管理页合并通知
        </label>
        <div class="cl-row">
          <button type="button" class="cl-btn" @click="replying = false">取消</button>
          <button type="submit" class="cl-btn cl-btn-primary" :disabled="busy || !text.trim()">{{ busy ? '发送中…' : '回复' }}</button>
        </div>
      </form>
      <button v-else-if="!thread.deleted" type="button" class="cl-link" @click="startReply">回复</button>
    </div>
    <p v-if="error" class="cl-error" role="alert">{{ error }}</p>
  </article>
</template>
