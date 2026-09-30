import { describe, expect, test } from 'vitest'
import { parseProblemSet, renderProblemPage } from '../../scripts/lib/problems'
import { buildSidebar, linkPrevNext, listPages } from '../../scripts/lib/nav'
import { parseChapter } from '../../scripts/lib/splitter'
import { fixture } from './helpers'

const set = parseProblemSet(fixture('ch02-problems-mini.md'), 'ch02-poly.md')

describe('parseProblemSet', () => {
  test('一个 ## 一题；组标题、引言、短标题、id', () => {
    expect(set.title).toBe('多项式')
    expect(set.chapter).toBe(2)
    expect(set.intro).toBe('三问共用的说明。')
    expect(set.problems.map((p) => [p.title, p.short, p.slug, p.id])).toEqual([
      ['第一问：输出', '第一问', 'ex-1', 'ch02-ex-1'],
      ['第二问：加减', '第二问', 'ex-2', 'ch02-ex-2'],
    ])
  })

  test('围栏里的 #include 不当标题（陷阱 A）', () => {
    expect(set.problems[0].body).toContain('#include <stdio.h>')
  })

  test('样例成对提取，「**样例 N**」与两个围栏替换为 <SampleCase>，说明文字保留', () => {
    const p = set.problems[0]
    expect(p.samples).toEqual([
      { input: '1 2 3', output: '2x^3' },
      { input: '0', output: '0' },
    ])
    expect(p.body).not.toContain('```输入')
    expect(p.body).not.toContain('**样例 1**')
    expect(p.body).toContain('<SampleCase :n="0" />\n\n基本情形。')
    expect(p.body).toContain('<SampleCase :n="1" />')
    // 末尾的分隔线去掉
    expect(p.body.trimEnd().endsWith('---')).toBe(false)
    expect(set.problems[1].samples).toEqual([])
  })

  test('只有输入没有输出、只有输出：报错并给出行号', () => {
    const noOut = '# t\n## 第一问\n\n```输入\n1\n```\n\n正文\n'
    expect(() => parseProblemSet(noOut, 'ch02-x.md')).toThrow('ch02-x.md:4 「输入」围栏后面要紧跟一个「输出」围栏')
    const gap = '# t\n## 第一问\n\n```输入\n1\n```\n\n说明\n\n```输出\n1\n```\n'
    expect(() => parseProblemSet(gap, 'ch02-x.md')).toThrow('ch02-x.md:4')
    const onlyOut = '# t\n## 第一问\n\n```输出\n1\n```\n'
    expect(() => parseProblemSet(onlyOut, 'ch02-x.md')).toThrow('ch02-x.md:4 「输出」围栏前面缺少「输入」围栏')
  })

  test('文件名须形如 chNN-名字.md', () => {
    expect(() => parseProblemSet('# t\n## a\n', 'poly.md')).toThrow(/chNN-名字/)
  })
})

describe('renderProblemPage', () => {
  const md = renderProblemPage(set, set.problems[0], { title: 't', layout: 'problem', samples: set.problems[0].samples })

  test('标题提升一级，引言进提示框', () => {
    expect(md).toContain('\n# 第一问：输出\n\n::: info 本题说明\n三问共用的说明。\n:::\n\n## 输入格式\n')
    expect(md).toContain('#include <stdio.h>')
  })

  test('样例以 JSON 写进 frontmatter', () => {
    expect(md).toContain('samples: [{"input":"1 2 3","output":"2x^3"},{"input":"0","output":"0"}]')
  })
})

describe('练习页进阅读顺序与侧栏', () => {
  const ch02 = parseChapter(fixture('ch02-mini.md'), 'ch02.md')
  const ch03 = parseChapter(fixture('ch03-mini.md'), 'ch03.md')
  const entries = [
    { chapter: ch02, draft: false, problems: set },
    { chapter: ch03, draft: false },
  ]

  test('章末一节 → 各问 → 下一章', () => {
    const pages = linkPrevNext(listPages(entries))
    expect(pages.map((p) => p.link)).toEqual(['/ch02/', '/ch02/2-1', '/ch02/2-2', '/ch02/ex-1', '/ch02/ex-2', '/ch03/', '/ch03/3-1'])
    const ex1 = pages[3]
    expect(ex1.kind).toBe('problem')
    expect(ex1.text).toBe('多项式 · 第一问')
    expect(ex1.prev).toEqual({ text: '2.2 结构', link: '/ch02/2-2' })
    expect(pages[4].next).toEqual({ text: '第3章 栈', link: '/ch03/' })
  })

  test('侧栏：章下追加练习分组', () => {
    const items = buildSidebar(entries)[0].items!
    expect(items[items.length - 1]).toEqual({
      text: '练习：多项式',
      items: [
        { text: '第一问：输出', link: '/ch02/ex-1' },
        { text: '第二问：加减', link: '/ch02/ex-2' },
      ],
    })
  })
})
