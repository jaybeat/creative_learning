<script setup lang="ts">
import { nextTick, onMounted, watch } from 'vue'
import { useData, useRoute } from 'vitepress'
import { useProgress } from '../progress'

/**
 * 给侧栏里已读的节链接加 is-read class（CSS 显示 ✓）。
 * 这是对默认主题 DOM 的增强，不改主题源码；若将来 VitePress 改了 class 名，最坏情况是 ✓ 不显示。
 */
const { state, ready } = useProgress()
const route = useRoute()
const { site } = useData()

function toSitePath(href: string): string {
  let p = href
  try {
    p = new URL(href, window.location.origin).pathname
  } catch {
    /* keep as is */
  }
  const base = site.value.base.replace(/\/$/, '')
  if (base && p.startsWith(base)) p = p.slice(base.length)
  p = p.replace(/\.html$/, '')
  return p || '/'
}

function apply(): void {
  if (!ready.value) return
  const read = new Set(state.value.read)
  for (const a of document.querySelectorAll<HTMLAnchorElement>('.VPSidebar a.link[href]')) {
    a.classList.toggle('is-read', read.has(toSitePath(a.getAttribute('href') ?? '')))
  }
}

onMounted(apply)
watch([() => state.value.read.length, () => route.path, ready], () => void nextTick(apply), { flush: 'post' })
</script>

<template><span hidden></span></template>
