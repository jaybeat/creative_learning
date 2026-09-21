<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import book from '../../generated/book.json'

const { page } = useData()

const href = computed(() => {
  if (!book.repo) return ''
  const path = '/' + page.value.relativePath.replace(/\.md$/, '').replace(/(^|\/)index$/, '$1')
  const title = encodeURIComponent(`[反馈] ${page.value.title}（${path}）`)
  return `${book.repo}/issues/new?title=${title}`
})
</script>

<template>
  <p v-if="href" class="book-feedback">
    本页有错？<a :href="href" target="_blank" rel="noopener">反馈</a>
  </p>
</template>
