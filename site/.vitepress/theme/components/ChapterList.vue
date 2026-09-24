<script setup lang="ts">
import { withBase } from 'vitepress'
import book from '../../generated/book.json'
import { isRead, useProgress } from '../progress'

/** 章节列表：章名 + 节数；挂载后已读过的章显示进度（3/6 节）。 */
const { state, ready } = useProgress()

function meta(ch: (typeof book.chapters)[number]): string {
  const total = ch.sections.length
  if (!ready.value) return `${total} 节`
  const done = ch.sections.filter((s) => isRead(state.value, s.link, `${s.number} ${s.title}`)).length
  return done ? `已读 ${done}/${total} 节` : `${total} 节`
}
</script>

<template>
  <ul class="book-chapters">
    <li v-for="ch in book.chapters" :key="ch.slug">
      <a :href="withBase(`/${ch.slug}/`)">第{{ ch.number }}章 {{ ch.title }}</a>
      <span class="cl-meta">{{ meta(ch) }}</span>
    </li>
  </ul>
</template>
