<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, withBase } from 'vitepress'
import book from '../../generated/book.json'
import { titleOf } from '../book-data'
import { RESTORE_KEY, isRead, useProgress, validLast } from '../progress'

/** 章首页：本章目录（带已读 ✓）+ 开始阅读 / 继续阅读。目录列表在 SSR 就有，✓ 与「继续」挂载后才出现。 */
const props = defineProps<{ chapter: string }>()
const ch = book.chapters.find((c) => c.slug === props.chapter)
const { state, ready } = useProgress()
const router = useRouter()

const readLinks = computed(() => {
  if (!ready.value || !ch) return new Set<string>()
  const links = [...ch.sections.map((s) => s.link), ...(ch.problems?.items.map((p) => p.link) ?? [])]
  return new Set(links.filter((l) => isRead(state.value, l, titleOf(l))))
})
const resume = computed(() => {
  if (!ready.value || !ch) return null
  const l = validLast(state.value, titleOf)
  return l && l.path.startsWith(`/${ch.slug}/`) && l.path !== `/${ch.slug}/` ? l : null
})

function go(path: string): void {
  try {
    sessionStorage.setItem(RESTORE_KEY, path)
  } catch {
    /* ignore */
  }
  void router.go(withBase(path))
}
</script>

<template>
  <div v-if="ch" class="chapter-index">
    <p class="ci-actions">
      <a v-if="resume" class="cr-button" :href="withBase(resume.path)" @click.prevent="go(resume.path)">继续阅读：{{ resume.title }}</a>
      <a v-else-if="ch.firstSection" class="cr-button" :href="withBase(ch.firstSection)">开始阅读</a>
    </p>
    <h2>本章目录</h2>
    <ul class="ci-list">
      <li v-for="s in ch.sections" :key="s.link" :class="{ 'is-read': readLinks.has(s.link) }">
        <a :href="withBase(s.link)">{{ s.number }} {{ s.title }}</a>
        <span v-if="readLinks.has(s.link)" class="read-mark" title="已读">✓</span>
      </li>
    </ul>
    <template v-if="ch.problems">
      <h2>本章练习：{{ ch.problems.title }}</h2>
      <ul class="ci-list">
        <li v-for="p in ch.problems.items" :key="p.link">
          <a :href="withBase(p.link)">{{ p.title }}</a>
          <span v-if="readLinks.has(p.link)" class="read-mark" title="已提交">✓</span>
        </li>
      </ul>
    </template>
  </div>
</template>
