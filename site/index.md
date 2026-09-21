---
layout: doc
title: 首页
aside: false
prev: false
next: false
---

<script setup>
import book from './.vitepress/generated/book.json'
</script>

# {{ book.title }} {#top}

<p class="book-subtitle">{{ book.subtitle }}</p>

## 章节

<ChapterList />
