<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, withBase } from 'vitepress'
import book from '../../generated/book.json'
import { RESTORE_KEY, useProgress } from '../progress'

/** 章首页：本章目录（带已读 ✓）+ 开始阅读 / 继续阅读。目录列表在 SSR 就有，✓ 与「继续」挂载后才出现。 */
const props = defineProps<{ chapter: string }>()
const ch = book.chapters.find((c) => c.slug === props.chapter)
const { state, ready } = useProgress()
const router = useRouter()

const readSet = computed(() => new Set(ready.value ? state.value.read : []))
const resume = computed(() => {
  if (!ready.value || !ch) return null
  const l = state.value.last
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
      <li v-for="s in ch.sections" :key="s.link" :class="{ 'is-read': readSet.has(s.link) }">
        <a :href="withBase(s.link)">{{ s.number }} {{ s.title }}</a>
        <span v-if="readSet.has(s.link)" class="read-mark" title="已读">✓</span>
      </li>
    </ul>
  </div>
</template>
