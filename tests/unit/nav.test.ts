import { describe, expect, test } from 'vitest'
import { parseChapter } from '../../scripts/lib/splitter'
import { buildSidebar, buildXref, linkPrevNext, listPages } from '../../scripts/lib/nav'
import { fixture } from './helpers'

const ch02 = parseChapter(fixture('ch02-mini.md'), 'ch02.md')
const ch03 = parseChapter(fixture('ch03-mini.md'), 'ch03.md')

describe('prev / next', () => {
  const pages = linkPrevNext(listPages([{ chapter: ch02, draft: false }, { chapter: ch03, draft: false }]))

  test('页面链跨章连续', () => {
    expect(pages.map((p) => p.link)).toEqual(['/ch02/', '/ch02/2-1', '/ch02/2-2', '/ch03/', '/ch03/3-1'])
  })

  test('全书第一页无 prev，最后一页无 next', () => {
    expect(pages[0].prev).toBe(false)
    expect(pages[pages.length - 1].next).toBe(false)
  })

  test('章末一节的 next 是下一章首页', () => {
    expect(pages[2].next).toEqual({ text: '第3章 栈', link: '/ch03/' })
    expect(pages[3].prev).toEqual({ text: '2.2 结构', link: '/ch02/2-2' })
  })

  test('draft 章不进链', () => {
    const p = listPages([{ chapter: ch02, draft: false }, { chapter: ch03, draft: true }])
    expect(p.map((x) => x.link)).toEqual(['/ch02/', '/ch02/2-1', '/ch02/2-2'])
  })
})

describe('buildSidebar', () => {
  const sidebar = buildSidebar([{ chapter: ch02, draft: false }, { chapter: ch03, draft: true }])

  test('章 → 节两级，章可折叠', () => {
    expect(sidebar[0]).toEqual({
      text: '第2章 线性表',
      link: '/ch02/',
      collapsed: true,
      items: [
        { text: '2.1 问题', link: '/ch02/2-1' },
        { text: '2.2 结构', link: '/ch02/2-2' },
      ],
    })
  })

  test('draft 章完全不出现在侧栏', () => {
    expect(sidebar).toHaveLength(1)
  })
})

describe('buildXref', () => {
  const xref = buildXref([{ chapter: ch02, draft: false }, { chapter: ch03, draft: true }])

  test('节、小节、章都有索引', () => {
    expect(xref['2.2']).toBe('/ch02/2-2')
    expect(xref['2.2.1']).toBe('/ch02/2-2#2-2-1')
    expect(xref['ch2']).toBe('/ch02/')
  })

  test('draft 章不进索引', () => {
    expect(xref['ch3']).toBeUndefined()
    expect(xref['3.1']).toBeUndefined()
  })
})
