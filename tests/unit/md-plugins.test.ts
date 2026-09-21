import { describe, expect, test } from 'vitest'
import { createMd } from '../../scripts/lib/md'
import { classifyFence, fenceKindPlugin, wideTablePlugin } from '../../scripts/lib/md-plugins'
import { fixture } from './helpers'

const md = createMd().use(fenceKindPlugin).use(wideTablePlugin)
const env = () => ({ relativePath: 'ch02/2-9.md' })

describe('classifyFence', () => {
  test('无语言 + 制表符 → diagram', () => expect(classifyFence('', '┌─┐')).toBe('diagram'))
  test('无语言 + 仅箭头 → 仍按有竖线的图示判断', () => expect(classifyFence('', 'head\n  │\n  ▼')).toBe('diagram'))
  test('无语言无制表符 → session', () => expect(classifyFence('', '$ gcc a.c && ./a.out')).toBe('session'))
  test('有语言 → 不分类', () => expect(classifyFence('c', '┌─┐')).toBeNull())
})

describe('fenceKindPlugin', () => {
  test('diagram 块带 class 与稳定 id，同页按序编号', () => {
    const html = md.render('```\n┌─┐\n│a│\n└─┘\n```\n\n文字\n\n```\n│\n```\n', env())
    expect(html).toMatch(/class="language-text diagram" data-kind="diagram" data-diagram-id="ch02-2-9-d01"/)
    expect(html).toMatch(/data-diagram-id="ch02-2-9-d02"/)
  })

  test('章首页的 id 去掉 index', () => {
    const html = md.render('```\n│\n```\n', { relativePath: 'ch02/index.md' })
    expect(html).toContain('data-diagram-id="ch02-d01"')
  })

  test('session 块带 class，无 id', () => {
    const html = md.render('```\n$ gcc a.c\n```\n', env())
    expect(html).toMatch(/class="language-text session" data-kind="session"/)
    expect(html).not.toContain('data-diagram-id')
  })

  test('```c 不加分类', () => {
    const html = md.render('```c\nint x;\n```\n', env())
    expect(html).toContain('class="language-c"')
    expect(html).not.toMatch(/diagram|session/)
  })

  test('对真实夹具：diagram 与 c 块并存', () => {
    const html = md.render(fixture('ch02-mini.md'), env())
    expect(html).toContain('language-c')
    expect(html).toContain('data-diagram-id="ch02-2-9-d01"')
  })
})

describe('wideTablePlugin', () => {
  test('17 列表格加 wide-table', () => {
    const html = md.render(fixture('ch02-mini.md'), env())
    expect(html).toContain('<table class="wide-table">')
  })

  test('3 列表格不加', () => {
    const html = md.render('| a | b | c |\n|---|---|---|\n| 1 | 2 | 3 |\n', env())
    expect(html).toContain('<table>')
    expect(html).not.toContain('wide-table')
  })
})

describe('HTML 转义回归（HANDOFF §3 / §9）', () => {
  test('行内代码里的 <stdlib.h> 被转义，不会被当成标签', () => {
    const html = md.render('`#include <stdlib.h>`\n', env())
    expect(html).toContain('&lt;stdlib.h&gt;')
    expect(html).not.toContain('<stdlib.h>')
  })
})
