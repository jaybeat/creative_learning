import { defineConfig } from 'vitepress'
import sidebar from './generated/sidebar.json'
import book from './generated/book.json'
import font from './generated/font.json'
import { fenceKindPlugin, wideTablePlugin } from '../../scripts/lib/md-plugins'
import { slugify } from '../../scripts/lib/slug'

// GitHub Pages 项目站需要 `/<repo>/`；自定义域名或其他平台用 `/`。由 CI 注入。
const base = process.env.SITE_BASE ?? '/'

export default defineConfig({
  lang: 'zh-CN',
  title: book.title,
  description: book.description,
  base,
  cleanUrls: true,
  lastUpdated: false,

  head: [
    ['link', { rel: 'preload', href: `${base}fonts/${font.file}`, as: 'font', type: 'font/woff2', crossorigin: '' }],
  ],

  markdown: {
    theme: { light: 'github-light', dark: 'github-dark' },
    anchor: { slugify },
    config(md) {
      md.use(fenceKindPlugin).use(wideTablePlugin)
    },
  },

  themeConfig: {
    sidebar,
    outline: { level: [2, 3], label: '本节目录' },
    docFooter: { prev: '上一节', next: '下一节' },
    sidebarMenuLabel: '目录',
    returnToTopLabel: '回到顶部',
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    langMenuLabel: '语言',
    externalLinkIcon: false,
  },
})
