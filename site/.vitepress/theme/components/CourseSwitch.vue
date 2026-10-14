<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useData, withBase } from 'vitepress'
import { courseMode, readMode } from '../course-mode'
import { pagePath, useProgress } from '../progress'

/**
 * 放在 doc-before 插槽、顶栏（LessonBar.vue，"▶ 看动画 | 读文字"切换在那里）下面：有课程动画的节（frontmatter.video）的播放器。
 * 看动画时用 iframe 嵌入播放器（site/public/course/<节>/index.html?embed），正文仍在页面 HTML 里，只是隐藏；
 * 播放器报上来高度就调 iframe 高度，报"播完"就把这一节记为已读。
 * 选读文字的人不加载播放器（iframe 只在看动画时创建）。
 */
const { frontmatter, page } = useData()
const { markRead } = useProgress()
const video = computed(() => frontmatter.value.video as string | undefined)
const src = computed(() => (video.value ? withBase(`${video.value}index.html?embed`) : ''))
const mounted = ref(false)
const height = ref(0)
const frame = ref<HTMLIFrameElement>()

function onMessage(e: MessageEvent): void {
  const d = e.data as { source?: string; type?: string; h?: number } | null
  if (!d || d.source !== 'ds-course' || e.source !== frame.value?.contentWindow) return
  if (d.type === 'height' && d.h) height.value = d.h
  else if (d.type === 'ended') markRead(pagePath(page.value.relativePath), page.value.title)
}

onMounted(() => {
  courseMode.value = readMode()
  mounted.value = true
  window.addEventListener('message', onMessage)
})
onUnmounted(() => window.removeEventListener('message', onMessage))
watch(video, () => {
  height.value = 0
})
</script>

<template>
  <div v-if="video" class="course-switch" data-comment-ignore>
    <div class="cs-player">
      <iframe
        v-if="mounted && courseMode === 'video'"
        ref="frame"
        :key="src"
        :src="src"
        title="课程动画"
        allow="autoplay; fullscreen"
        :style="height ? { height: height + 'px', maxHeight: 'none', minHeight: '0' } : undefined"
      />
    </div>
  </div>
</template>

<style>
.course-switch {
  margin: 0 0 24px;
}
.cs-player {
  margin-top: 4px;
}
/* 播放器报上高度之前先占住位置，避免页面跳动 */
.cs-player iframe {
  display: block;
  width: 100%;
  height: calc((100vw - 64px) * 0.5625 + 120px);
  max-height: 640px;
  min-height: 320px;
  border: 0;
}
html:not([data-course-mode='text']) .cs-player {
  min-height: 320px;
}
html[data-course-mode='text'] .cs-player {
  display: none;
}
/* 看动画时隐藏正文（仍在 HTML 里，搜索引擎和站内搜索照样能用） */
html:not([data-course-mode='text']) .has-video .vp-doc,
html:not([data-course-mode='text']) .has-video .VPDoc .aside {
  display: none;
}
/* 正文分页时只在最后一页显示页底的上一节/下一节（lesson.css）；看动画时正文不显示，页底导航照常出现 */
html[data-lesson-more]:not([data-course-mode='text']) .has-video .VPDocFooter {
  display: block;
}
</style>
