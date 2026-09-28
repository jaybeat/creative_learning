<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { withBase } from 'vitepress'
import { api, ApiError } from './api'
import { login, loadMe, me, meLoaded, requireLogin } from './store'

/** 顶栏右侧：未登录显示「登录」，登录后显示昵称与账号菜单 */
const open = ref(false)
const root = ref<HTMLElement>()
const error = ref('')

function onDocClick(e: MouseEvent): void {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false
}

onMounted(() => {
  void loadMe()
  document.addEventListener('click', onDocClick)
})
onUnmounted(() => document.removeEventListener('click', onDocClick))

async function act(fn: () => Promise<void>): Promise<void> {
  error.value = ''
  try {
    await fn()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '操作失败，请重试'
  }
}

const toggleNotify = () =>
  act(async () => {
    if (!me.value) return
    me.value = (await api.updateMe({ notifyReplies: !me.value.notifyReplies })).user
  })

function rename(): void {
  open.value = false
  login.startAtName = true
  login.open = true
}

const logout = () =>
  act(async () => {
    await api.logout()
    me.value = null
    open.value = false
  })

const deleteAccount = () =>
  act(async () => {
    if (!window.confirm('注销后，你的邮箱和昵称会被删除，你发过的评论都会显示为「已删除」。\n\n确定要注销账号吗？')) return
    if (!window.confirm('这一步不能撤销。再确认一次：注销账号？')) return
    await api.deleteMe()
    me.value = null
    open.value = false
    window.alert('账号已注销。')
  })
</script>

<template>
  <div ref="root" class="cl-nav-user">
    <template v-if="meLoaded">
      <button v-if="!me || !me.name" type="button" class="cl-nav-btn" @click="requireLogin()">登录</button>
      <template v-else>
        <button type="button" class="cl-nav-btn" :aria-expanded="open" aria-haspopup="menu" @click="open = !open">
          <span class="cl-nav-name">{{ me.name }}</span> ▾
        </button>
        <div v-if="open" class="cl-menu" role="menu">
          <p class="cl-menu-email">{{ me.email }}</p>
          <label class="cl-menu-item cl-menu-check">
            <input type="checkbox" :checked="me.notifyReplies" @change="toggleNotify" />
            有人回复我时发邮件
          </label>
          <button type="button" class="cl-menu-item" role="menuitem" @click="rename">修改昵称</button>
          <a v-if="me.isAdmin" class="cl-menu-item" role="menuitem" :href="withBase('/admin')">评论管理</a>
          <button type="button" class="cl-menu-item" role="menuitem" @click="logout">退出登录</button>
          <button type="button" class="cl-menu-item cl-menu-danger" role="menuitem" @click="deleteAccount">注销账号</button>
          <p v-if="error" class="cl-error">{{ error }}</p>
        </div>
      </template>
    </template>
  </div>
</template>
