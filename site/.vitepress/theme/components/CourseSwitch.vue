<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useData, useRouter, withBase } from 'vitepress'
import book from '../../generated/book.json'
import { courseMode, readMode, setMode } from '../course-mode'
import { pagePath, useProgress } from '../progress'

/**
 * 有课程动画的节（frontmatter.video）看动画时的全屏学习层：盖住整页（网站导航、顶栏、页脚、评论都在下面），
 * 里面只有播放器 iframe（site/public/course/<节>/index.html?embed），播放器自己的控制条就是唯一的顶栏。
 * 正文仍在页面 HTML 里（搜索、已读记录不变）；选"读文字"就去掉这一层，回到专注阅读页（LessonBar.vue）。
 * 播放器发来的消息：ended（记已读、弹结束卡片）、exit（回本章课程地图）、text（改读文字）。
 * 全屏层在 SSR 就有（只是没有 iframe），由 <html data-course-mode> 决定显示与否，首屏不闪出下面的页面。
 */
const { frontmatter, page } = useData()
const router = useRouter()
const { markRead } = useProgress()
const video = computed(() => frontmatter.value.video as string | undefined)
const src = computed(() => (video.value ? withBase(`${video.value}index.html?embed`) : ''))
const ch = computed(() => book.chapters.find((c) => c.number === frontmatter.value.chapter))
const next = computed(() => {
  const n = frontmatter.value.next as { text?: string; link?: string } | false | undefined
  return n && n.link ? { text: n.text ?? '', link: n.link } : null
})
const mounted = ref(false)
const ended = ref(false)
const frame = ref<HTMLIFrameElement>()

function exit(): void {
  if (ch.value) void router.go(withBase(`/${ch.value.slug}/`))
}
function toText(): void {
  ended.value = false
  setMode('text')
}
function replay(): void {
  ended.value = false
  frame.value?.contentWindow?.postMessage({ source: 'ds-site', type: 'replay' }, '*')
  frame.value?.focus()
}

function onMessage(e: MessageEvent): void {
  const d = e.data as { source?: string; type?: string } | null
  if (!d || d.source !== 'ds-course' || e.source !== frame.value?.contentWindow) return
  if (d.type === 'ended') {
    markRead(pagePath(page.value.relativePath), page.value.title)
    ended.value = true
  } else if (d.type === 'exit') exit()
  else if (d.type === 'text') toText()
}
/** 焦点不在 iframe 里时（比如刚打开、点了结束卡片），Esc 同样退出 */
function onKey(e: KeyboardEvent): void {
  if (e.key !== 'Escape' || !video.value || courseMode.value !== 'video') return
  if (ended.value) ended.value = false
  else exit()
}
/** iframe 加载完把焦点给它，空格、←/→ 直接控制播放器 */
function onLoad(): void {
  frame.value?.focus()
}

onMounted(() => {
  courseMode.value = readMode()
  mounted.value = true
  window.addEventListener('message', onMessage)
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  window.removeEventListener('message', onMessage)
  window.removeEventListener('keydown', onKey)
})
watch(src, () => {
  ended.value = false
})
</script>

<template>
  <div v-if="video" class="cs-player cs-full cl-light" role="dialog" aria-label="课程动画" data-comment-ignore>
    <iframe
      v-if="mounted && courseMode === 'video'"
      ref="frame"
      :key="src"
      :src="src"
      title="课程动画"
      allow="autoplay; fullscreen"
      @load="onLoad"
    />
    <div v-if="ended" class="cs-end" role="dialog" aria-label="这一节学完了">
      <div class="cs-end-card">
        <p class="cs-end-kick"><span class="cs-end-ok" aria-hidden="true">✓</span> 这一节学完了</p>
        <h2 class="cs-end-title">{{ page.title }}</h2>
        <a v-if="next" class="cs-end-next" :href="withBase(next.link)">下一节：{{ next.text }} →</a>
        <div class="cs-end-more">
          <button type="button" @click="toText">读文字详细版</button>
          <a v-if="ch" :href="withBase(`/${ch.slug}/`)">回到第{{ ch.number }}章</a>
          <button type="button" @click="replay">重新播放</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* 全屏学习层：只在看动画时显示（<html> 没有 data-course-mode="text"），盖住整页并锁住页面滚动 */
.cs-full {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: var(--cl-page);
}
html[data-course-mode='text'] .cs-full {
  display: none;
}
html:not([data-course-mode='text']):has(.has-video) {
  overflow: hidden;
}
.cs-full iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}
/* 看动画时下面的正文本来就看不见，再隐藏掉，免得被键盘焦点、页内查找碰到（仍在 HTML 里，搜索照样能用） */
html:not([data-course-mode='text']) .has-video .vp-doc {
  display: none;
}

/* 结束卡片：盖在播放器上，居中 */
.cs-end {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: color-mix(in srgb, var(--cl-page) 70%, transparent);
}
.cs-end-card {
  width: min(440px, 100%);
  padding: 28px 32px;
  border: 1px solid var(--cl-line);
  border-radius: 20px;
  background: var(--cl-paper);
  box-shadow: 0 16px 48px -16px rgb(0 0 0 / 0.18);
  text-align: center;
}
.cs-end-kick {
  margin: 0;
  font-size: 14px;
  color: var(--cl-mute);
}
.cs-end-ok {
  color: var(--cl-ok);
  font-weight: 700;
}
.cs-end-title {
  margin: 6px 0 22px;
  font-family: var(--cl-serif);
  font-size: 24px;
  font-weight: 650;
  line-height: 1.4;
  color: var(--cl-ink-strong);
}
.cs-end-next {
  display: block;
  padding: 12px 20px;
  border-radius: 999px;
  background: var(--cl-ink-strong);
  color: var(--cl-paper);
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
}
.cs-end-next:hover {
  opacity: 0.86;
}
.cs-end-more {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 14px;
}
.cs-end-more > * {
  padding: 6px 14px;
  border: 1px solid var(--cl-line);
  border-radius: 999px;
  background: var(--cl-paper);
  font-size: 13px;
  color: var(--cl-ink);
  text-decoration: none;
  cursor: pointer;
}
.cs-end-more > *:hover {
  border-color: var(--cl-line-cell);
}
</style>
