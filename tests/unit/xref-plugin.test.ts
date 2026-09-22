import { beforeEach, describe, expect, test } from 'vitest'
import { createMd } from '../../scripts/lib/md'
import { formatUnresolved, xrefPlugin, type Unresolved } from '../../scripts/lib/xref-plugin'

const xref = { '2.2': '/ch02/2-2', '2.4.3': '/ch02/2-4#2-4-3', '2.6': '/ch02/2-6', ch2: '/ch02/', ch3: '/ch03/' }
const unresolved: Unresolved[] = []
const md = createMd().use(xrefPlugin, { xref, onUnresolved: (u: Unresolved) => unresolved.push(u) })
const env = () => ({ relativePath: 'ch02/2-5.md', frontmatter: { chapter: 2, srcFile: 'ch02.md', srcLine: 374 } })

beforeEach(() => {
  unresolved.length = 0
})

describe('交叉引用链接', () => {
  test('N.M节 与 N.M.K节 被链接，链接文字保持原样', () => {
    const html = md.render('见2.2节和2.4.3节。', env())
    expect(html).toContain('<a href="/ch02/2-2">2.2节</a>')
    expect(html).toContain('<a href="/ch02/2-4#2-4-3">2.4.3节</a>')
    expect(html).toBe('<p>见<a href="/ch02/2-2">2.2节</a>和<a href="/ch02/2-4#2-4-3">2.4.3节</a>。</p>\n')
  })

  test('陷阱 B：版本号「编辑器2.2」「编辑器1.1」不链接', () => {
    const html = md.render('编辑器2.2 和 编辑器1.1 跑起来了；2.2节讲过。', env())
    expect(html.match(/<a /g)).toHaveLength(1)
    expect(html).toContain('编辑器2.2 和 编辑器1.1')
  })

  test('前面紧跟数字或点时不匹配', () => {
    expect(md.render('版本12.2节', env())).not.toContain('<a ')
    expect(md.render('见3.2.2节', env())).not.toContain('<a ')
  })

  test('行内代码、标题、已有链接内不处理', () => {
    expect(md.render('`2.6节`', env())).not.toContain('<a ')
    expect(md.render('## 回顾2.6节', env())).not.toContain('<a ')
    expect(md.render('[看2.6节](/x)', env())).toBe('<p><a href="/x">看2.6节</a></p>\n')
  })

  test('代码块不处理', () => {
    expect(md.render('```c\n// 见2.6节\n```', env())).not.toContain('<a ')
  })

  test('第N章：其他章加链接，当前章不加也不上报', () => {
    const html = md.render('第2章正在讲，第3章会讲。', env())
    expect(html).toContain('<a href="/ch03/">第3章</a>')
    expect(html).toContain('第2章正在讲')
    expect(html).not.toContain('>第2章</a>')
    expect(unresolved).toEqual([])
  })

  test('粗体等其他 inline 结构内的文本也处理', () => {
    expect(md.render('**见2.6节**', env())).toContain('<strong>见<a href="/ch02/2-6">2.6节</a></strong>')
  })
})

describe('未解析引用', () => {
  test('保持纯文本并上报，带源文件行号', () => {
    const html = md.render('a\n\nb\n第1章和2.13节', env()) // 段落 b 从 0 基第 2 行开始
    expect(html).toContain('第1章和2.13节')
    expect(html).not.toContain('<a ')
    expect(unresolved).toEqual([
      { ref: '第1章', file: 'ch02.md', line: 376, page: 'ch02/2-5.md' },
      { ref: '2.13节', file: 'ch02.md', line: 376, page: 'ch02/2-5.md' },
    ])
  })

  test('没有 frontmatter 时不崩，行号为 0', () => {
    md.render('第9章', { relativePath: 'x.md' })
    expect(unresolved).toEqual([{ ref: '第9章', file: 'x.md', line: 0, page: 'x.md' }])
  })

  test('汇总按引用分组并去重', () => {
    const list: Unresolved[] = [
      { ref: '第1章', file: 'ch02.md', line: 5, page: 'ch02/2-1.md' },
      { ref: '第1章', file: 'ch02.md', line: 5, page: 'ch02/2-1.md' },
      { ref: '第1章', file: 'ch02.md', line: 13, page: 'ch02/2-1.md' },
      { ref: '2.13节', file: 'ch02.md', line: 1412, page: 'ch02/2-12.md' },
    ]
    const text = formatUnresolved(list)
    expect(text).toContain('未解析的交叉引用 3 处')
    expect(text).toContain('第1章  ← ch02.md:5, ch02.md:13')
    expect(text).toContain('2.13节  ← ch02.md:1412')
    expect(formatUnresolved([])).toBe('')
  })
})
