import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import ChapterList from './components/ChapterList.vue'
import ChapterIndex from './components/ChapterIndex.vue'
import ContinueReading from './components/ContinueReading.vue'
import '../generated/font.css'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('ChapterList', ChapterList)
    app.component('ChapterIndex', ChapterIndex)
    app.component('ContinueReading', ContinueReading)
  },
} satisfies Theme
