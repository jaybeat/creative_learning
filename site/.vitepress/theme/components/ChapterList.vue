<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, withBase } from 'vitepress'
import book from '../../generated/book.json'
import { titleOf } from '../book-data'
import { RESTORE_KEY, isRead, useProgress, validLast } from '../progress'

/** 首页目录：章号、章名、本章的问题、节数；挂载后已读过的章显示进度条，有记录时可清除。 */
const { state, ready, clear } = useProgress()

type Chapter = (typeof book.chapters)[number]

function done(ch: Chapter): number {
  if (!ready.value) return 0
  return ch.sections.filter((s) => isRead(state.value, s.link, `${s.number} ${s.title}`)).length
}

function meta(ch: Chapter): string {
  const total = ch.sections.length
  const n = done(ch)
  return n ? `已读 ${n}/${total} 节` : `${total} 节`
}

/** 目录上方的"继续学习"卡：最近学到的那一节、它所在的章和本章进度。只在有记录时出现（挂载后） */
const resume = computed(() => {
  if (!ready.value) return null
  const l = validLast(state.value, titleOf)
  const ch = l && book.chapters.find((c) => l.path.startsWith(`/${c.slug}/`))
  if (!l || !ch) return null
  const video = !!ch.sections.find((s) => s.link === l.path)?.video
  return { path: l.path, title: l.title, ch, video }
})
const router = useRouter()
function go(path: string): void {
  try {
    sessionStorage.setItem(RESTORE_KEY, path)
  } catch {
    /* ignore */
  }
  void router.go(withBase(path))
}

const hasProgress = computed(() => ready.value && (state.value.read.length > 0 || state.value.last !== null))

function onClear(): void {
  if (window.confirm('清除已读标记和阅读位置？')) clear()
}
</script>

<template>
  <a v-if="resume" class="cl-resume" :href="withBase(resume.path)" @click.prevent="go(resume.path)">
    <span class="cl-resume-main">
      <span class="cl-resume-kick">继续学习 · 第{{ resume.ch.number }}章 {{ resume.ch.title }}</span>
      <span class="cl-resume-title">{{ resume.title }}</span>
      <span class="cl-resume-progress">
        <span class="cl-resume-track" aria-hidden="true"><span :style="{ width: `${(done(resume.ch) / resume.ch.sections.length) * 100}%` }" /></span>
        已学 {{ done(resume.ch) }}/{{ resume.ch.sections.length }}
      </span>
    </span>
    <span class="cl-resume-btn">{{ resume.video ? '继续学习' : '继续阅读' }} →</span>
  </a>
  <p class="cl-summary">已发布 {{ book.chapters.length }} 章 · 持续更新</p>
  <ul class="book-chapters">
    <li v-for="ch in book.chapters" :key="ch.slug">
      <span class="cl-no" aria-hidden="true">{{ String(ch.number).padStart(2, '0') }}</span>
      <div class="cl-main">
        <a :href="withBase(`/${ch.slug}/`)">第{{ ch.number }}章 {{ ch.title }}</a>
        <span v-if="ch.question" class="cl-question">{{ ch.question }}</span>
      </div>
      <div class="cl-side">
        <span class="cl-meta">{{ meta(ch) }}</span>
        <span v-if="done(ch)" class="cl-bar" aria-hidden="true">
          <span :style="{ width: `${(done(ch) / ch.sections.length) * 100}%` }" />
        </span>
      </div>
    </li>
  </ul>
  <p v-if="hasProgress" class="cl-actions">
    <button type="button" class="cr-clear" @click="onClear">清除阅读记录</button>
  </p>
</template>
