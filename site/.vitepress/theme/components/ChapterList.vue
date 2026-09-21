<script setup lang="ts">
import { withBase } from 'vitepress'
import book from '../../generated/book.json'
</script>

<template>
  <ul class="book-chapters">
    <li v-for="ch in book.chapters" :key="ch.slug">
      <a :href="withBase(`/${ch.slug}/`)">第{{ ch.number }}章 {{ ch.title }}</a>
    </li>
  </ul>
</template>
