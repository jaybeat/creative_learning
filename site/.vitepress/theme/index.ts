import type { Theme } from 'vitepress'
// theme-without-fonts：不下发 Inter 正文字体（HANDOFF §7：正文用系统中文字体栈），省 66 KB 与一次 preload
import DefaultTheme from 'vitepress/theme-without-fonts'
import Layout from './Layout.vue'
import ChapterList from './components/ChapterList.vue'
import ChapterMap from './components/ChapterMap.vue'
import HomeHero from './components/HomeHero.vue'
import RailYard from './components/RailYard.vue'
import StackFigure from './components/StackFigure.vue'
import LinkStackFigure from './components/LinkStackFigure.vue'
import AdminComments from './comments/AdminComments.vue'
import ProblemLayout from './problem/ProblemLayout.vue'
import SampleCase from './problem/SampleCase.vue'
import Lesson from './lesson/Lesson.vue'
import Quiz from './lesson/Quiz.vue'
import FillQuiz from './lesson/FillQuiz.vue'
import QuizBlank from './lesson/QuizBlank.vue'
import '../generated/font.css'
import '../generated/brand.css'
import './custom.css'
import './chapter-map.css'
import './focus.css'
import './comments/comments.css'
import './ask/ask.css'
import './problem/problem.css'
import './lesson/lesson.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('ChapterList', ChapterList)
    // 章首页：frontmatter.layout: chapter 时由默认主题的 VPContent 渲染课程地图
    app.component('chapter', ChapterMap)
    app.component('HomeHero', HomeHero)
    app.component('AdminComments', AdminComments)
    // 书稿里的图示组件（第3章栈）
    app.component('RailYard', RailYard)
    app.component('StackFigure', StackFigure)
    app.component('LinkStackFigure', LinkStackFigure)
    // 题目页：frontmatter.layout: problem 时由默认主题的 VPContent 渲染这个组件
    app.component('problem', ProblemLayout)
    app.component('SampleCase', SampleCase)
    // 节内分页与练习题：由 lesson-plugin 从 `<!-- 分页 -->`、`::: quiz` 生成
    app.component('Lesson', Lesson)
    app.component('Quiz', Quiz)
    app.component('FillQuiz', FillQuiz)
    app.component('QuizBlank', QuizBlank)
  },
} satisfies Theme
