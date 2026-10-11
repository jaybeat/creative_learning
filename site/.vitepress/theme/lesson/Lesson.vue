<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

/**
 * 一节分成几页，在同一个网址里翻页（构建期由 lesson-plugin 把 `<!-- 分页 -->` 切成 #p1、#p2… 插槽）。
 *
 * - 所有页都在 DOM 里，只是不显示：划词评论的定位、站内搜索都照常用全文。
 * - 地址栏 `#p2` 记住当前页；地址指向某页里的标题（右栏目录、交叉引用）时自动翻到那一页。
 * - 不是最后一页时隐藏页底的上一节 / 下一节：读完最后一页才算读完本节（ReadTracker 在页底）。
 * - ← → 先翻页，翻到头再交给 KeyNav 翻节。
 */
const props = defineProps<{ pages: number }>()
const cur = ref(1)
const root = ref<HTMLElement>()

const MORE_ATTR = 'data-lesson-more'

function pageEls(): HTMLElement[] {
  return root.value ? [...root.value.querySelectorAll<HTMLElement>(':scope > .lesson-page')] : []
}

/** 地址里的 hash 对应第几页；不认识返回 null */
function pageOfHash(hash: string): number | null {
  const m = /^#p(\d+)$/.exec(hash)
  if (m) return Math.min(Math.max(1, Number(m[1])), props.pages)
  if (!hash || !root.value) return null
  let target: HTMLElement | null = null
  try {
    target = document.getElementById(decodeURIComponent(hash.slice(1)))
  } catch {
    return null
  }
  const page = target?.closest<HTMLElement>('.lesson-page')
  return page && root.value.contains(page) ? Number(page.dataset.page) : null
}

/**
 * 切到第 n 页。这里同步改 DOM 而不只靠 v-show：VitePress 在 hashchange 之后立刻量目标标题的位置，
 * 等 Vue 下一轮更新再显示就量错了。
 */
function show(n: number): void {
  cur.value = n
  for (const el of pageEls()) el.style.display = Number(el.dataset.page) === n ? '' : 'none'
  document.documentElement.toggleAttribute(MORE_ATTR, n < props.pages)
}

function go(n: number): void {
  if (n < 1 || n > props.pages || n === cur.value) return
  show(n)
  const url = location.pathname + location.search + (n === 1 ? '' : `#p${n}`)
  history.replaceState(history.state, '', url)
  // 回到本节标题处（标题在 Lesson 外面，紧挨着它）
  const heading = root.value?.previousElementSibling as HTMLElement | null
  const top = (heading ?? root.value)?.getBoundingClientRect().top ?? 0
  // 顶部固定的导航栏（窄屏还有一条「本节目录」栏）会盖住页面顶端
  const covered = Math.max(0, ...['.VPNav', '.VPLocalNav'].map((s) => document.querySelector(s)?.getBoundingClientRect().bottom ?? 0))
  window.scrollTo({ top: Math.max(0, window.scrollY + top - covered - 16) })
}

function onHash(): void {
  const n = pageOfHash(location.hash)
  if (n !== null && n !== cur.value) show(n)
}

function onKey(e: KeyboardEvent): void {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.isComposing) return
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
  if (document.querySelector('.VPLocalSearchBox')) return
  const n = cur.value + (e.key === 'ArrowRight' ? 1 : -1)
  if (n < 1 || n > props.pages) return
  e.preventDefault()
  go(n)
}

onMounted(() => {
  show(pageOfHash(location.hash) ?? 1)
  window.addEventListener('hashchange', onHash)
  // 捕获阶段：先于 KeyNav（冒泡阶段）处理，翻页时它看到 defaultPrevented 就不翻节
  window.addEventListener('keydown', onKey, true)
})

onUnmounted(() => {
  window.removeEventListener('hashchange', onHash)
  window.removeEventListener('keydown', onKey, true)
  document.documentElement.removeAttribute(MORE_ATTR)
})
</script>

<template>
  <div ref="root" class="lesson">
    <div class="lesson-steps" data-comment-ignore aria-hidden="true">
      <span v-for="n in pages" :key="n" class="lesson-step" :class="{ done: n < cur, current: n === cur }" />
    </div>
    <div v-for="n in pages" :key="n" v-show="n === cur" class="lesson-page" :data-page="n">
      <slot :name="`p${n}`" />
    </div>
    <nav class="lesson-nav" data-comment-ignore aria-label="本节翻页">
      <button v-if="cur > 1" type="button" class="lesson-btn" @click="go(cur - 1)">上一页</button>
      <span class="lesson-count">{{ cur }} / {{ pages }}</span>
      <button v-if="cur < pages" type="button" class="lesson-btn primary" @click="go(cur + 1)">继续</button>
    </nav>
  </div>
</template>
