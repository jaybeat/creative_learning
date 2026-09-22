import type { Theme } from 'vitepress'
// theme-without-fonts：不下发 Inter 正文字体（HANDOFF §7：正文用系统中文字体栈），省 66 KB 与一次 preload
import DefaultTheme from 'vitepress/theme-without-fonts'
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
