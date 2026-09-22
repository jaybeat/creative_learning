import { defineConfig } from 'vitepress'
import sidebar from './generated/sidebar.json'
import book from './generated/book.json'
import font from './generated/font.json'
import xref from './generated/xref.json'
import { fenceKindPlugin, foldPlugin, wideTablePlugin } from '../../scripts/lib/md-plugins'
import { milestonePlugin } from '../../scripts/lib/milestone-plugin'
import { formatUnresolved, xrefPlugin, type Unresolved } from '../../scripts/lib/xref-plugin'
import { slugify } from '../../scripts/lib/slug'
import { tokenize } from '../../scripts/lib/search-tokenize'

// 站点部署在域名根时为 `/`；放到子路径时由环境变量注入，如 `/ds/`。
const base = process.env.SITE_BASE ?? '/'

// 未解析的交叉引用：渲染时收集，dev 下即时警告，构建结束时汇总打印（构建不失败）
const unresolved: Unresolved[] = []
const warned = new Set<string>()

export default defineConfig({
  lang: 'zh-CN',
  title: book.title,
  description: book.description,
  base,
  cleanUrls: true,
  lastUpdated: false,

  head: [
    ['link', { rel: 'preload', href: `${base}fonts/${font.file}`, as: 'font', type: 'font/woff2', crossorigin: '' }],
    // 首屏前恢复字号档位（改的是 <html> 属性，Vue 不管理它，不会造成 hydration 不一致）
    ['script', {}, "try{var s=localStorage.getItem('ds-book:font-size');if(s)document.documentElement.setAttribute('data-font-size',s)}catch(e){}"],
  ],

  markdown: {
    theme: { light: 'github-light', dark: 'github-dark' },
    anchor: { slugify },
    config(md) {
      md.use(fenceKindPlugin).use(foldPlugin).use(wideTablePlugin).use(milestonePlugin)
      md.use(xrefPlugin, {
        xref,
        onUnresolved(u: Unresolved) {
          unresolved.push(u)
          const key = `${u.page}|${u.line}|${u.ref}`
          if (!warned.has(key)) {
            warned.add(key)
            console.warn(`[xref] ${u.file}:${u.line} 「${u.ref}」目标不存在，保持为纯文本`)
          }
        },
      })
    },
  },

  buildEnd() {
    const text = formatUnresolved(unresolved)
    if (text) console.log('\n' + text + '\n')
  },

  themeConfig: {
    sidebar,
    search: {
      provider: 'local',
      options: {
        detailedView: true,
        miniSearch: {
          // tokenize 会被序列化下发到浏览器，索引与查询两侧用同一规则（见 search-tokenize.ts）
          options: { tokenize },
          searchOptions: { combineWith: 'AND', fuzzy: false, prefix: true, boost: { title: 4, text: 2, titles: 1 } },
        },
        translations: {
          button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
          modal: {
            displayDetails: '显示详情',
            resetButtonTitle: '清除',
            backButtonTitle: '关闭',
            noResultsText: '没有找到',
            footer: { selectText: '打开', selectKeyAriaLabel: '回车', navigateText: '切换', navigateUpKeyAriaLabel: '上', navigateDownKeyAriaLabel: '下', closeText: '关闭', closeKeyAriaLabel: 'esc' },
          },
        },
      },
    },
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
