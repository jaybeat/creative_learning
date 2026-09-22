<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, withBase } from 'vitepress'
import book from '../../generated/book.json'
import { RESTORE_KEY, useProgress } from '../progress'

/** 首页：继续阅读 / 开始阅读 + 清除阅读记录。挂载前渲染「开始阅读」，与 SSR 一致。 */
const { state, ready, clear } = useProgress()
const router = useRouter()
const first: string | null = book.chapters[0]?.firstSection ?? null
const last = computed(() => (ready.value ? state.value.last : null))

function go(path: string): void {
  try {
    sessionStorage.setItem(RESTORE_KEY, path)
  } catch {
    /* ignore */
  }
  void router.go(withBase(path))
}

function onClear(): void {
  if (window.confirm('清除已读标记和阅读位置？')) clear()
}
</script>

<template>
  <div class="continue-reading">
    <template v-if="last">
      <a class="cr-button" :href="withBase(last.path)" @click.prevent="go(last.path)">继续阅读：{{ last.title }}</a>
      <button type="button" class="cr-clear" @click="onClear">清除阅读记录</button>
    </template>
    <a v-else-if="first" class="cr-button" :href="withBase(first)">开始阅读</a>
  </div>
</template>
