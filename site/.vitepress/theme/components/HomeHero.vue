<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, withBase } from 'vitepress'
import book from '../../generated/book.json'
import home from '../../generated/home.json'
import { firstSectionLink, titleOf } from '../book-data'
import { RESTORE_KEY, useProgress, validLast } from '../progress'

/** 首页首屏：书名、副标题、一句话定位、开始 / 继续阅读、已发布章数。挂载前渲染「开始阅读」，与 SSR 一致。 */
const { state, ready, clear } = useProgress()
const router = useRouter()
const last = computed(() => (ready.value ? validLast(state.value, titleOf) : null))
const published = book.chapters.length

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
  <section class="home-hero">
    <p v-if="book.subtitle" class="home-kicker">{{ book.subtitle }}</p>
    <h1 id="top">{{ book.title }}</h1>
    <p v-if="home.tagline" class="home-tagline">{{ home.tagline }}</p>
    <div class="continue-reading">
      <template v-if="last">
        <a class="cr-button" :href="withBase(last.path)" @click.prevent="go(last.path)">继续阅读：{{ last.title }}</a>
        <button type="button" class="cr-clear" @click="onClear">清除阅读记录</button>
      </template>
      <a v-else-if="firstSectionLink" class="cr-button" :href="withBase(firstSectionLink)">开始阅读</a>
      <a class="cr-link" href="#chapters">看看目录</a>
    </div>
    <p class="home-meta">已发布 {{ published }} 章 · 持续更新</p>
  </section>
</template>
