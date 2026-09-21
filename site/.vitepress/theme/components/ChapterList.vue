<script setup lang="ts">
import { withBase } from 'vitepress'
import book from '../../generated/book.json'
</script>

<template>
  <ul class="book-chapters">
    <li v-for="ch in book.chapters" :key="ch.slug" :class="{ draft: ch.draft }">
      <template v-if="ch.draft">
        <span>第{{ ch.number }}章 {{ ch.title }}</span>
        <small>即将发布</small>
      </template>
      <a v-else :href="withBase(`/${ch.slug}/`)">第{{ ch.number }}章 {{ ch.title }}</a>
    </li>
  </ul>
</template>
