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

  test('代码块里的 **x** 原样', () => {
    expect(page).toContain('/* **也不是标题** */')
  })

  test('小节里的加粗标题也提升，编号按节内顺序', () => {
    expect(page).toContain('### 第二节里的加粗标题 {#2-2-p1 .para-title}')
  })
})

describe('加粗段落标题', () => {
  const page = renderSectionPage(ch02.sections[0], { title: '2.1 问题', chapter: 2, section: '2.1', prev: false, next: false })

  test('独占一行的粗体段落提升为带锚点的三级标题', () => {
    expect(ch02.sections[0].paraTitles).toEqual([{ line: 4, text: '只有一行的加粗' }])
    expect(page).toContain('### 只有一行的加粗 {#2-1-p1 .para-title}')
    expect(page).not.toContain('**只有一行的加粗**')
  })

  test('收尾标点去掉', () => {
    const ch = parseChapter('# 第9章 x\n\n## 9.1 y\n\n**本书的组织。**\n\n正文\n', 'ch09.md')
    expect(ch.sections[0].paraTitles).toEqual([{ line: 2, text: '本书的组织' }])
  })

  test('粗体后面还有内容的段落不动', () => {
    expect(page).toContain('**注意**：这不是标题')
    expect(page).toContain('**加粗** 后面还有字')
  })

  test('引用块里的粗体行不动', () => {
    expect(page).toContain('> **只在引用块里**')
  })

  test('frontmatter 正确', () => {
    expect(page.startsWith('---\ntitle: "2.1 问题"\nchapter: 2\nsection: "2.1"\nprev: false\nnext: false\n---\n')).toBe(true)
  })
})

describe('renderChapterIndex', () => {
  test('无引言时只有章标题与目录组件', () => {
    const html = renderChapterIndex(ch02, { title: '第2章 线性表', chapter: 2, chapterIndex: true, prev: false, next: { text: '2.1 问题', link: '/ch02/2-1' } })
    expect(html).toContain('# 第2章 线性表')
    expect(html).toContain('<ChapterIndex chapter="ch02" />')
    expect(html).not.toContain('- [')
  })

  test('introStartLine 指向 h1 的下一行', () => {
    expect(ch02.introStartLine).toBe(1)
    expect(ch03.introStartLine).toBe(1)
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
