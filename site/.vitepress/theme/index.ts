import type { Theme } from 'vitepress'
// theme-without-fonts：不下发 Inter 正文字体（HANDOFF §7：正文用系统中文字体栈），省 66 KB 与一次 preload
import DefaultTheme from 'vitepress/theme-without-fonts'
import Layout from './Layout.vue'
import ChapterList from './components/ChapterList.vue'
import ChapterIndex from './components/ChapterIndex.vue'
import HomeHero from './components/HomeHero.vue'
import AdminComments from './comments/AdminComments.vue'
import ProblemLayout from './problem/ProblemLayout.vue'
import SampleCase from './problem/SampleCase.vue'
import '../generated/font.css'
import './custom.css'
import './comments/comments.css'
import './problem/problem.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('ChapterList', ChapterList)
    app.component('ChapterIndex', ChapterIndex)
    app.component('HomeHero', HomeHero)
    app.component('AdminComments', AdminComments)
    // 题目页：frontmatter.layout: problem 时由默认主题的 VPContent 渲染这个组件
    app.component('problem', ProblemLayout)
    app.component('SampleCase', SampleCase)
  },
} satisfies Theme
