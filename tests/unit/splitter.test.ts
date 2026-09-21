import { describe, expect, test } from 'vitest'
import { parseChapter, renderChapterIndex, renderFrontmatter, renderSectionPage } from '../../scripts/lib/splitter'
import { slugify } from '../../scripts/lib/slug'
import { fixture } from './helpers'

const ch02 = parseChapter(fixture('ch02-mini.md'), 'ch02.md')
const ch03 = parseChapter(fixture('ch03-mini.md'), 'ch03.md')

describe('parseChapter', () => {
  test('章号、标题、slug', () => {
    expect(ch02.number).toBe(2)
    expect(ch02.title).toBe('线性表')
    expect(ch02.slug).toBe('ch02')
  })

  test('陷阱 A：代码围栏里的 #define 与 # 行不切页', () => {
    expect(ch02.sections.map((s) => s.number)).toEqual(['2.1', '2.2'])
    expect(ch02.sections.map((s) => s.slug)).toEqual(['2-1', '2-2'])
  })

  test('节内小节被记录，且标题行号相对于节', () => {
    const s = ch02.sections[1]
    expect(s.headings.map((h) => [h.level, h.text])).toEqual([
      [2, '2.2 结构'],
      [3, '2.2.1 定义'],
      [3, '2.2.2 说明'],
    ])
    expect(s.body.split('\n')[s.headings[1].line]).toBe('### 2.2.1 定义')
  })

  test('文件名与章号不一致报错', () => {
    expect(() => parseChapter(fixture('ch02-mini.md'), 'ch05.md')).toThrow(/ch05\.md.*第2章.*ch02\.md/)
  })

  test('无引言 → intro 为空；有引言 → intro 保留', () => {
    expect(ch02.intro.trim()).toBe('')
    expect(ch03.intro).toContain('这是第3章的引言')
  })

  test('缺少一级标题报错', () => {
    expect(() => parseChapter('## 2.1 没有章标题\n', 'ch02.md')).toThrow(/一级标题/)
  })
})

describe('renderSectionPage', () => {
  const page = renderSectionPage(ch02.sections[1], { title: '2.2 结构', chapter: 2, section: '2.2', prev: false, next: { text: 'x', link: '/x' } })

  test('## 提升为 #，### 提升为 ##', () => {
    expect(page).toMatch(/^# 2\.2 结构$/m)
    expect(page).toMatch(/^## 2\.2\.1 定义$/m)
    expect(page).toMatch(/^## 2\.2\.2 说明$/m)
  })

  test('代码块内容原样保留', () => {
    expect(page).toContain('#define MAXSIZE 100')
    expect(page).toContain('# 这一行在代码块里，不是标题')
  })

  test('小节锚点为 2-2-1 形式', () => {
    expect(slugify('2.2.1 定义')).toBe('2-2-1')
  })

  test('frontmatter 正确', () => {
    expect(page.startsWith('---\ntitle: "2.2 结构"\nchapter: 2\nsection: "2.2"\nprev: false\nnext:\n  text: "x"\n  link: "/x"\n---\n')).toBe(true)
  })
})

describe('renderChapterIndex', () => {
  test('无引言时自动生成目录列表与开始阅读', () => {
    const html = renderChapterIndex(ch02, { title: '第2章 线性表', chapter: 2, chapterIndex: true, prev: false, next: { text: '2.1 问题', link: '/ch02/2-1' } })
    expect(html).toContain('# 第2章 线性表')
    expect(html).toContain('- [2.1 问题](/ch02/2-1)')
    expect(html).toContain('- [2.2 结构](/ch02/2-2)')
    expect(html).toContain('[开始阅读 →](/ch02/2-1)')
  })

  test('有引言时保留引言', () => {
    const html = renderChapterIndex(ch03, { title: '第3章 栈', chapter: 3, chapterIndex: true, prev: false, next: false })
    expect(html).toContain('这是第3章的引言')
  })
})

describe('renderFrontmatter', () => {
  test('字符串里的冒号和引号被安全编码', () => {
    expect(renderFrontmatter({ title: '2.1 问题：单行"编辑器"' })).toBe('---\ntitle: "2.1 问题：单行\\"编辑器\\""\n---\n')
  })
})
