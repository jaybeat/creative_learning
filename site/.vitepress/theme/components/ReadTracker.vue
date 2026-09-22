<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useData } from 'vitepress'
import { RESTORE_KEY, pagePath, useProgress } from '../progress'

/**
 * 放在 doc-footer-before 插槽：页底导航进入视口即视为本节已读；
 * 同时记录最近阅读的页面与滚动位置。只对节页（frontmatter.section 存在）生效。
 */
const { page, frontmatter } = useData()
const { state, markRead, setLast } = useProgress()
const el = ref<HTMLElement>()
let io: IntersectionObserver | undefined
let scrollTimer: number | undefined

const isSection = () => Boolean(frontmatter.value.section)
const current = () => ({ path: pagePath(page.value.relativePath), title: page.value.title })

function recordLast(scrollY: number): void {
  if (!isSection()) return
  setLast({ ...current(), scrollY, at: Date.now() })
}

function onScroll(): void {
  window.clearTimeout(scrollTimer)
  scrollTimer = window.setTimeout(() => recordLast(window.scrollY), 500)
}

function observe(): void {
  io?.disconnect()
  if (!isSection() || !el.value || typeof IntersectionObserver === 'undefined') return
  io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      markRead(current().path)
      io?.disconnect()
    }
  })
  io.observe(el.value)
}

function restoreScroll(): void {
  try {
    if (sessionStorage.getItem(RESTORE_KEY) !== current().path) return
    sessionStorage.removeItem(RESTORE_KEY)
    const y = state.value.last?.path === current().path ? state.value.last.scrollY : 0
    if (y > 0) requestAnimationFrame(() => window.scrollTo(0, y))
  } catch {
    /* ignore */
  }
}

onMounted(() => {
  recordLast(window.scrollY)
  observe()
  restoreScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})

watch(
  () => page.value.relativePath,
  () => {
    recordLast(0)
    void nextTick(() => {
      observe()
      restoreScroll()
    })
  },
)

onUnmounted(() => {
  io?.disconnect()
  window.removeEventListener('scroll', onScroll)
  window.clearTimeout(scrollTimer)
})
</script>

<template>
  <div ref="el" class="read-tracker" aria-hidden="true"></div>
</template>
