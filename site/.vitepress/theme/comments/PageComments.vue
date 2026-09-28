<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import { openAll, threads } from './store'

/** 页底入口（doc-after 插槽）：本页评论数 + 划词评论的提示 */
const { frontmatter } = useData()
const enabled = computed(() => Boolean(frontmatter.value.chapter))
</script>

<template>
  <div v-if="enabled" class="cl-page-comments">
    <button type="button" class="cl-btn" @click="openAll">💬 本页评论（{{ threads.length }}）</button>
    <span class="cl-page-hint">选中正文里的任意文字，就可以针对它发表评论</span>
  </div>
</template>
