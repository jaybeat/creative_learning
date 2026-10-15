<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useData, useRoute, withBase } from 'vitepress'
import { useLocalNav } from 'vitepress/theme-without-fonts'
import book from '../../generated/book.json'
import { titleOf } from '../book-data'
import { courseMode, readMode, setMode, type CourseMode } from '../course-mode'
import { pinned, readPins, setPin, type Panel } from '../focus'
import { isRead, pagePath, useProgress } from '../progress'
import { claimRight, releaseRight, rightOpen } from '../right-rail'
import { ask, closeAsk, openAsk } from '../ask/store'

/**
 * 节页顶栏（doc-before 插槽，frontmatter.section 存在时显示）：
 *   左：← 第N章（回课程地图）、"目录 · 3/20"（左抽屉）　中：▶ 看动画 | 读文字（有动画的节）　右：问 AI、本节目录（右抽屉，看动画时隐藏）
 * 本节目录、评论、问 AI 共用右侧一栏，同一时间只开一个（theme/right-rail.ts）。
 * 两个抽屉默认收起，浮出时盖在正文上面，Esc / 点空白处 / 换页关闭；宽屏可"固定"（theme/focus.ts）。
 * 左抽屉的样式和课程地图的节列表一样（chapter-map.css 的 .cmap-path），可切到"全书"。
 */
const { frontmatter, page, theme } = useData()
const route = useRoute()
const { state, ready } = useProgress()
const { headers } = useLocalNav()

const path = computed(() => pagePath(page.value.relativePath))
const ch = computed(() => book.chapters.find((c) => c.number === frontmatter.value.chapter))
const index = computed(() => ch.value?.sections.findIndex((s) => s.link === path.value) ?? -1)
const video = computed(() => Boolean(frontmatter.value.video))

const readSet = computed(() => {
  if (!ready.value) return new Set<string>()
  const links = book.chapters.flatMap((c) => [...c.sections.map((s) => s.link), ...(c.problems?.items.map((p) => p.link) ?? [])])
  return new Set(links.filter((l) => isRead(state.value, l, titleOf(l))))
})

/* ---------- 抽屉 ---------- */
const open = ref<Panel | null>(null)
const scope = ref<'chapter' | 'book'>('chapter')
function toggle(p: Panel): void {
  open.value = open.value === p ? null : p
}
function close(): void {
  open.value = null
}
function togglePin(p: Panel): void {
  setPin(p, !pinned.value[p])
  close()
}
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && open.value) close()
}
watch(() => route.path, close)
watch(open, (p, was) => {
  if (p === 'outline') claimRight('outline')
  else if (was === 'outline') releaseRight('outline')
})
watch(rightOpen, (r) => {
  if (r !== 'outline' && open.value === 'outline') close()
})
function toggleAsk(): void {
  if (ask.open) closeAsk()
  else openAsk()
}
// 打开左抽屉时把当前节滚到中间
watch(open, (p) => {
  if (p !== 'toc') return
  void nextTick(() => {
    // 只滚抽屉自己（scrollIntoView 会连页面一起滚）
    const body = document.querySelector<HTMLElement>('.lb-toc .lb-body')
    const cur = body?.querySelector<HTMLElement>('li.is-current')
    if (body && cur) body.scrollTop = cur.offsetTop - body.clientHeight / 2
  })
})

/* ---------- 看动画 / 读文字 ---------- */
function choose(m: CourseMode): void {
  setMode(m)
  if (m === 'video' && open.value === 'outline') close()
}

/* ---------- 本节目录：当前小节高亮（只算看得见的标题：分页的节里，别的页的标题是隐藏的） ---------- */
const active = ref('')
let ticking = false
function spy(): void {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    ticking = false
    const top = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--vp-nav-height')) || 64
    let cur = ''
    for (const h of document.querySelectorAll<HTMLElement>('.VPDoc .vp-doc :is(h2,h3)[id]')) {
      if (h.offsetParent === null) continue
      // 还没滚过任何标题时，算第一个标题
      if (cur && h.getBoundingClientRect().top - top - 80 > 0) break
      cur = `#${h.id}`
    }
    active.value = cur
  })
}
const outline = computed(() => headers.value.flatMap((h) => [{ ...h, level: 0 }, ...(h.children ?? []).map((c) => ({ ...c, level: 1 }))]))

onMounted(() => {
  courseMode.value = readMode()
  readPins()
  window.addEventListener('keydown', onKey)
  window.addEventListener('scroll', spy, { passive: true })
  spy()
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('scroll', spy)
})
watch(() => route.path, () => requestAnimationFrame(spy))

const outlineLabel = computed(() => {
  const o = theme.value.outline
  return (o && typeof o === 'object' && !Array.isArray(o) && o.label) || '本节目录'
})
</script>

<template>
  <template v-if="frontmatter.section && ch">
    <div class="lesson-bar" data-comment-ignore>
      <div class="lb-left">
        <a class="lb-back" :href="withBase(`/${ch.slug}/`)" :title="`回到第${ch.number}章的课程地图`">
          <span aria-hidden="true">←</span><span class="lb-back-text"> 第{{ ch.number }}章</span>
        </a>
        <button type="button" class="lb-btn lb-toc-btn" :aria-expanded="open === 'toc'" aria-controls="lb-toc" @click="toggle('toc')">
          <span class="lb-icon" aria-hidden="true">☰</span><span class="lb-toc-text"> 目录 ·</span><span class="lb-pos"> {{ index + 1 }}/{{ ch.sections.length }}</span>
        </button>
      </div>
      <div v-if="video" class="cs-tabs" role="tablist" aria-label="这一节怎么学">
        <button type="button" role="tab" class="cs-tab cs-video" :aria-selected="courseMode === 'video'" @click="choose('video')">
          ▶ 看动画<span class="cs-dur">{{ frontmatter.videoDuration }}</span>
        </button>
        <button type="button" role="tab" class="cs-tab cs-text" :aria-selected="courseMode === 'text'" @click="choose('text')">读文字</button>
      </div>
      <div class="lb-right">
        <button type="button" class="lb-btn lb-ask-btn" :aria-expanded="ask.open" title="边读边问：右侧打开问 AI 面板" @click="toggleAsk">
          <span class="lb-icon" aria-hidden="true">✦</span> 问 AI
        </button>
        <button
          v-if="outline.length"
          type="button"
          class="lb-btn lb-outline-btn"
          :aria-expanded="open === 'outline'"
          aria-controls="lb-outline"
          @click="toggle('outline')"
        >
          {{ outlineLabel }} <span class="lb-icon" aria-hidden="true">≡</span>
        </button>
      </div>
    </div>

    <div v-if="open" class="lb-backdrop" aria-hidden="true" @click="close" />

    <aside id="lb-toc" class="lb-drawer lb-toc" :class="{ 'is-open': open === 'toc' }" aria-label="目录">
      <div class="lb-head">
        <div class="lb-scope" role="tablist">
          <button type="button" role="tab" :aria-selected="scope === 'chapter'" @click="scope = 'chapter'">本章</button>
          <button type="button" role="tab" :aria-selected="scope === 'book'" @click="scope = 'book'">全书</button>
        </div>
        <button type="button" class="lb-pin" :aria-pressed="pinned.toc" :title="pinned.toc ? '取消固定' : '固定在左边'" @click="togglePin('toc')">
          {{ pinned.toc ? '取消固定' : '固定' }}
        </button>
        <button type="button" class="lb-close" aria-label="关闭目录" @click="close">×</button>
      </div>
      <div class="lb-body">
        <template v-for="c in scope === 'chapter' ? [ch] : book.chapters" :key="c.slug">
          <a class="lb-ch" :href="withBase(`/${c.slug}/`)">
            <span class="lb-ch-kick">第{{ c.number }}章</span> {{ c.title }}
          </a>
          <ol class="cmap-path lb-path">
            <li
              v-for="s in c.sections"
              :key="s.link"
              :class="{ 'is-read': readSet.has(s.link), 'is-current': s.link === path }"
            >
              <a :href="withBase(s.link)" :aria-current="s.link === path ? 'page' : undefined">
                <span class="cmap-dot">{{ s.number }}</span>{{ ' ' }}<span class="cmap-name">{{ s.title }}</span>
              </a>
              <span v-if="s.video" class="video-mark" title="这一节有课程动画">▶</span>
              <span v-if="readSet.has(s.link)" class="read-mark" title="已学">✓</span>
            </li>
            <li v-for="(p, i) in c.problems?.items ?? []" :key="p.link" class="is-problem" :class="{ 'is-read': readSet.has(p.link) }">
              <a :href="withBase(p.link)">
                <span class="cmap-dot">练{{ i + 1 }}</span>{{ ' ' }}<span class="cmap-name">{{ p.title }}</span>
              </a>
              <span v-if="readSet.has(p.link)" class="read-mark" title="已提交">✓</span>
            </li>
          </ol>
        </template>
      </div>
    </aside>

    <aside v-if="outline.length" id="lb-outline" class="lb-drawer lb-outline" :class="{ 'is-open': open === 'outline' }" :aria-label="outlineLabel">
      <div class="lb-head">
        <span class="lb-title">{{ outlineLabel }}</span>
        <button type="button" class="lb-pin" :aria-pressed="pinned.outline" :title="pinned.outline ? '取消固定' : '固定在右边'" @click="togglePin('outline')">
          {{ pinned.outline ? '取消固定' : '固定' }}
        </button>
        <button type="button" class="lb-close" :aria-label="`关闭${outlineLabel}`" @click="close">×</button>
      </div>
      <nav class="lb-body">
        <a
          v-for="h in outline"
          :key="h.link"
          class="lb-outline-link"
          :class="{ 'is-sub': h.level === 1, 'is-active': h.link === active }"
          :href="h.link"
          @click="open === 'outline' && close()"
        >{{ h.title }}</a>
      </nav>
    </aside>
  </template>
</template>
