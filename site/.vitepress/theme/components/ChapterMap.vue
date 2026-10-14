<script setup lang="ts">
import { computed, ref } from 'vue'
import { Content, useData, useRouter, withBase } from 'vitepress'
import book from '../../generated/book.json'
import { titleOf } from '../book-data'
import { RESTORE_KEY, isRead, pagePath, useProgress, validLast } from '../progress'

/**
 * 章首页的课程地图（frontmatter.layout: chapter）。质感层的写法：字黑线淡、层级靠字体、颜色只做标签、"正在学的"用浅蓝底。
 * 左栏：各章（章号、章名、本章的问题、已学 n/总数），当前章高亮；窄屏变成顶部横向滑动的章标签。
 * 右栏：本章卡片（宋体标题 + 进度 + 开始/继续）→ 本章引子（页面正文，默认只露开头）→ 节列表（竖线串起，不锁定）→ 本章练习。
 * 目录在 SSR 就有；已学 ✓、进度、"继续"挂载后才出现。
 */
const { page, frontmatter } = useData()
const router = useRouter()
const { state, ready } = useProgress()

type Chapter = (typeof book.chapters)[number]
const path = computed(() => pagePath(page.value.relativePath))
const ch = computed(() => book.chapters.find((c) => `/${c.slug}/` === path.value))

const readSet = computed(() => {
  if (!ready.value) return new Set<string>()
  const links = book.chapters.flatMap((c) => [...c.sections.map((s) => s.link), ...(c.problems?.items.map((p) => p.link) ?? [])])
  return new Set(links.filter((l) => isRead(state.value, l, titleOf(l))))
})
const doneOf = (c: Chapter) => c.sections.filter((s) => readSet.value.has(s.link)).length

const resume = computed(() => {
  if (!ready.value || !ch.value) return null
  const l = validLast(state.value, titleOf)
  return l && l.path.startsWith(`/${ch.value.slug}/`) && l.path !== `/${ch.value.slug}/` ? l : null
})
/** "正在学的"那一节：最近读到的；没有就是第一节没学过的 */
const current = computed(() => {
  if (!ready.value || !ch.value) return null
  return resume.value?.path ?? ch.value.sections.find((s) => !readSet.value.has(s.link))?.link ?? null
})
const hasVideo = (link: string) => !!ch.value?.sections.find((s) => s.link === link)?.video

/** 本章引子默认只露开头几行（渐隐），点"展开"看全文：引子完整展开有七八百像素高，会把节列表挤出首屏 */
const introOpen = ref(false)

function go(p: string): void {
  try {
    sessionStorage.setItem(RESTORE_KEY, p)
  } catch {
    /* ignore */
  }
  void router.go(withBase(p))
}
</script>

<template>
  <div class="cmap">
    <nav class="cmap-chapters" aria-label="各章">
      <a
        v-for="c in book.chapters"
        :key="c.slug"
        :href="withBase(`/${c.slug}/`)"
        class="cmap-ch"
        :class="{ 'is-current': c.slug === ch?.slug }"
        :aria-current="c.slug === ch?.slug ? 'page' : undefined"
      >
        <span class="cmap-ch-kick">第{{ c.number }}章</span>
        <span class="cmap-ch-name">{{ c.title }}</span>
        <span v-if="c.question" class="cmap-pill">{{ c.question }}</span>
        <span class="cmap-ch-meta">{{ doneOf(c) ? `已学 ${doneOf(c)}/${c.sections.length}` : `${c.sections.length} 节` }}</span>
      </a>
    </nav>

    <main v-if="ch" class="cmap-main">
      <header class="cmap-card chapter-index">
        <p class="cmap-kick">第{{ ch.number }}章 · {{ ch.sections.length }} 节</p>
        <h1 class="cmap-title">{{ ch.title }}<template v-if="ch.question">：{{ ch.question }}</template></h1>
        <div class="cmap-progress">
          <span class="cmap-track" aria-hidden="true"><span :style="{ width: `${(doneOf(ch) / ch.sections.length) * 100}%` }" /></span>
          <span class="cmap-progress-text">{{ doneOf(ch) ? `已学 ${doneOf(ch)} / ${ch.sections.length}` : '还没开始' }}</span>
        </div>
        <p class="ci-actions">
          <a v-if="resume" class="cr-button" :href="withBase(resume.path)" @click.prevent="go(resume.path)">
            {{ hasVideo(resume.path) ? '继续学习' : '继续阅读' }}：{{ resume.title }}
          </a>
          <a v-else-if="ch.firstSection" class="cr-button" :href="withBase(ch.firstSection)">{{ ch.sections[0]?.video ? '开始学习' : '开始阅读' }}</a>
        </p>
      </header>

      <section v-if="frontmatter.hasIntro" class="cmap-intro" :class="{ 'is-open': introOpen }" aria-label="本章引子">
        <div id="cmap-intro-body" class="vp-doc"><Content /></div>
        <button type="button" class="cmap-intro-toggle" aria-controls="cmap-intro-body" :aria-expanded="introOpen" @click="introOpen = !introOpen">
          {{ introOpen ? '收起引子' : '展开本章引子' }}
        </button>
      </section>

      <h2 class="cmap-h">本章目录</h2>
      <ol class="ci-list cmap-path">
        <li
          v-for="s in ch.sections"
          :key="s.link"
          :class="{ 'is-read': readSet.has(s.link), 'is-current': s.link === current }"
        >
          <a :href="withBase(s.link)">
            <span class="cmap-dot">{{ s.number }}</span>{{ ' ' }}<span class="cmap-name">{{ s.title }}</span>
          </a>
          <span v-if="s.video" class="video-mark" title="这一节有课程动画">▶ {{ s.video }}</span>
          <span v-if="readSet.has(s.link)" class="read-mark" title="已学">✓</span>
        </li>
      </ol>

      <template v-if="ch.problems">
        <h2 class="cmap-h"><span class="cmap-tag">本章练习</span>{{ ch.problems.title }}</h2>
        <ol class="ci-list cmap-path is-problems">
          <li v-for="(p, i) in ch.problems.items" :key="p.link" :class="{ 'is-read': readSet.has(p.link) }">
            <a :href="withBase(p.link)">
              <span class="cmap-dot">{{ i + 1 }}</span>{{ ' ' }}<span class="cmap-name">{{ p.title }}</span>
            </a>
            <span v-if="readSet.has(p.link)" class="read-mark" title="已提交">✓</span>
          </li>
        </ol>
      </template>
    </main>
  </div>
</template>
