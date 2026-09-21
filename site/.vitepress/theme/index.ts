import { h } from 'vue'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import ChapterList from './components/ChapterList.vue'
import Feedback from './components/Feedback.vue'
import '../generated/font.css'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'doc-after': () => h(Feedback),
    }),
  enhanceApp({ app }) {
    app.component('ChapterList', ChapterList)
  },
} satisfies Theme
