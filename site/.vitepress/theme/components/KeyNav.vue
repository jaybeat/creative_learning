<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useData, useRouter, withBase } from 'vitepress'

/**
 * ← → 翻节。焦点在输入框、搜索框打开、带修饰键、输入法组合中时不触发。
 * VitePress 的 router.go 会先改 URL 再异步加载新页面数据，期间 frontmatter 还是旧页的，
 * 所以导航进行中忽略按键，避免连续快按时用旧页的 prev/next 跳错。
 */
const { frontmatter } = useData()
const router = useRouter()
let navigating = false

function onKey(e: KeyboardEvent): void {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.isComposing) return
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
  if (document.querySelector('.VPLocalSearchBox')) return
  if (navigating) return
  const target = e.key === 'ArrowLeft' ? frontmatter.value.prev : frontmatter.value.next
  const link = target && typeof target === 'object' ? (target as { link?: string }).link : undefined
  if (typeof link !== 'string') return
  e.preventDefault()
  navigating = true
  router.go(withBase(link)).finally(() => {
    navigating = false
  })
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template><span hidden></span></template>
