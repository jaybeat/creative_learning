<script setup lang="ts">
import DefaultTheme from 'vitepress/theme-without-fonts'
import { onContentUpdated } from 'vitepress'
import Feedback from './components/Feedback.vue'
import ReadTracker from './components/ReadTracker.vue'
import SidebarReadMarks from './components/SidebarReadMarks.vue'
import KeyNav from './components/KeyNav.vue'
import FontSizeSwitch from './components/FontSizeSwitch.vue'
import { setupFolding } from './fold'

// 每次正文更新（首屏与站内跳转）后做一次 DOM 增强：长代码折叠
onContentUpdated(() => setupFolding())
</script>

<template>
  <DefaultTheme.Layout>
    <template #nav-bar-content-after><FontSizeSwitch /></template>
    <template #doc-footer-before><ReadTracker /></template>
    <template #doc-after><Feedback /></template>
    <template #layout-bottom>
      <SidebarReadMarks />
      <KeyNav />
    </template>
  </DefaultTheme.Layout>
</template>
