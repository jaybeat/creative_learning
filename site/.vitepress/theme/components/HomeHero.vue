<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, withBase } from 'vitepress'
import book from '../../generated/book.json'
import home from '../../generated/home.json'
import { firstSectionLink, titleOf } from '../book-data'
import { RESTORE_KEY, useProgress, validLast } from '../progress'
import CoverFigure from './CoverFigure.vue'

/** 首页封面：书名 + 副标题 + 封面图 + 唯一的「开始 / 继续阅读」按钮。挂载前渲染「开始阅读」，与 SSR 一致。 */
const { state, ready } = useProgress()
const router = useRouter()
const last = computed(() => (ready.value ? validLast(state.value, titleOf) : null))

function go(path: string): void {
  try {
    sessionStorage.setItem(RESTORE_KEY, path)
  } catch {
    /* ignore */
  }
  void router.go(withBase(path))
}
</script>

<template>
  <section class="home-hero">
    <div class="home-cover">
      <div class="home-cover-text">
        <h1 id="top">
          <span class="home-title">{{ book.title }}</span>
          <span v-if="book.subtitle" class="home-subtitle">{{ book.subtitle }}</span>
        </h1>
        <p v-if="book.titleEn" class="home-title-en" lang="en">{{ book.titleEn }}</p>
        <p v-if="home.tagline" class="home-tagline">{{ home.tagline }}</p>
        <div class="continue-reading">
          <a v-if="last" class="cr-button" :href="withBase(last.path)" @click.prevent="go(last.path)">继续阅读：{{ last.title }}</a>
          <a v-else-if="firstSectionLink" class="cr-button" :href="withBase(firstSectionLink)">开始阅读</a>
        </div>
      </div>
      <div class="home-cover-figure">
        <CoverFigure />
      </div>
    </div>
  </section>
</template>
