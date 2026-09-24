import { describe, expect, test } from 'vitest'
import { parseHome, renderHome, splitIdeas } from '../../scripts/lib/home'

const src = ['---', 'tagline: 先弄清问题，再动手做。', '---', '', '## 什么值得学', '', '一段正文。', '', '> 逻辑结构 → 抽象数据类型', '', '## 怎么学', '', '```c', '## 代码里的井号不是标题', '```', '', '另一段。', ''].join('\n')

describe('parseHome', () => {
  test('frontmatter 里的 tagline 与正文分离', () => {
    const h = parseHome(src)
    expect(h.tagline).toBe('先弄清问题，再动手做。')
    expect(h.body.startsWith('\n## 什么值得学')).toBe(true)
  })

  test('没有 frontmatter 时 tagline 为空，正文原样', () => {
    expect(parseHome('## a\n\nb\n')).toEqual({ tagline: '', body: '## a\n\nb\n' })
  })
})

describe('splitIdeas', () => {
  test('按 ## 切成卡片，代码块里的 ## 不算', () => {
    const ideas = splitIdeas(parseHome(src).body)
    expect(ideas.map((i) => i.title)).toEqual(['什么值得学', '怎么学'])
    expect(ideas[0].markdown).toContain('> 逻辑结构 → 抽象数据类型')
    expect(ideas[1].markdown).toContain('## 代码里的井号不是标题')
    expect(ideas[1].markdown).toContain('另一段。')
  })
})

describe('renderHome', () => {
  test('有文案：两张编号卡片 + 章节区', () => {
    const md = renderHome(parseHome(src))
    expect(md).toMatch(/^---\nlayout: page\ntitle: 首页\nsidebar: false\naside: false\n---\n/)
    expect(md).toContain('<HomeHero />')
    expect(md.match(/<article class="home-idea">/g)).toHaveLength(2)
    expect(md).toContain('<span class="home-idea-no" aria-hidden="true">01</span>\n\n## 什么值得学')
    expect(md).toContain('<span class="home-idea-no" aria-hidden="true">02</span>\n\n## 怎么学')
    expect(md).toContain('<ChapterList />')
  })

  test('没有文案：只有 HomeHero 与章节区', () => {
    const md = renderHome(null)
    expect(md).toContain('<HomeHero />')
    expect(md).not.toContain('home-ideas')
    expect(md).toContain('<ChapterList />')
  })
})
