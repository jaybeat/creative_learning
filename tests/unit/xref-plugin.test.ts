import { beforeEach, describe, expect, test } from 'vitest'
import { createMd } from '../../scripts/lib/md'
import { formatUnresolved, xrefPlugin, type Unresolved } from '../../scripts/lib/xref-plugin'

const xref = {
  '2.1': '/ch02/2-1',
  '2.1.4': '/ch02/2-1#2-1-4',
  '2.2': '/ch02/2-2',
  '2.3.3': '/ch02/2-3#2-3-3',
  '2.4.3': '/ch02/2-4#2-4-3',
  '2.6': '/ch02/2-6',
  '2.7': '/ch02/2-7',
  '2.8': '/ch02/2-8',
  '2.9': '/ch02/2-9',
  '2.10': '/ch02/2-10',
  '2.10.4': '/ch02/2-10#2-10-4',
  '2.12': '/ch02/2-12',
  ch2: '/ch02/',
  ch3: '/ch03/',
}
const versionNumbers = ['1.0', '1.1', '2.0', '2.1', '2.2']
const unresolved: Unresolved[] = []
const md = createMd().use(xrefPlugin, { xref, versionNumbers, onUnresolved: (u: Unresolved) => unresolved.push(u) })
const env = () => ({ relativePath: 'ch02/2-5.md', frontmatter: { chapter: 2, srcFile: 'ch02.md', srcLine: 374 } })
const links = (html: string) => [...html.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map((m) => [m[1], m[2]])

beforeEach(() => {
  unresolved.length = 0
})

describe('会链接的写法（修订版真实句子）', () => {
  test('N.M节：文字含「节」', () => {
    expect(md.render('见2.2节和2.4.3节。', env())).toBe('<p>见<a href="/ch02/2-2">2.2节</a>和<a href="/ch02/2-4#2-4-3">2.4.3节</a>。</p>\n')
  })

  test('三段号不带「节」也链接，文字只含数字', () => {
    expect(links(md.render('用2.3.3的程序运行，按2.1.4的表格式', env()))).toEqual([
      ['/ch02/2-3#2-3-3', '2.3.3'],
      ['/ch02/2-1#2-1-4', '2.1.4'],
    ])
  })

  test('两段号 + 的 / 汉字 / 括号', () => {
    expect(links(md.render('把2.2的程序敲出来；2.8用过的malloc；代价（2.7）。', env()))).toEqual([
      ['/ch02/2-2', '2.2'],
      ['/ch02/2-8', '2.8'],
      ['/ch02/2-7', '2.7'],
    ])
  })

  test('练一练：定位到该节练习', () => {
    expect(links(md.render('和2.9练一练第（3）题的结果对照；由此回答2.12练一练（3）。', env()))).toEqual([
      ['/ch02/2-9#practice', '2.9练一练'],
      ['/ch02/2-12#practice', '2.12练一练'],
    ])
  })

  test('第N章：其他章加链接，当前章不加也不上报', () => {
    const html = md.render('第2章正在讲，第3章会讲。', env())
    expect(links(html)).toEqual([['/ch03/', '第3章']])
    expect(html).toContain('第2章正在讲')
    expect(unresolved).toEqual([])
  })

  test('粗体等其他 inline 结构内的文本也处理', () => {
    expect(md.render('**见2.6节**', env())).toContain('<strong>见<a href="/ch02/2-6">2.6节</a></strong>')
  })
})

describe('不链接的写法（陷阱 B 与版本号）', () => {
  const noLink = (src: string) => {
    const html = md.render(src, env())
    expect(html, src).not.toContain('<a ')
  }

  test('「编辑器」后面的版本号', () => {
    noLink('编辑器2.2 和 编辑器1.1 跑起来了')
    noLink('编辑器2.2的main只改了两个类型名')
    noLink('编辑器1.1和2.0哪个快')
  })

  test('「版」前面的版本号', () => {
    noLink('同样是第5个字符，1.0版失败')
  })

  test('版本号表里的数字在模糊语境下不链接', () => {
    noLink('没有让编辑器变快（2.0），让它变快的是接口（2.1）；改成了双向（2.2）')
    noLink('1.1成功了')
    noLink('| 动作 | 2.0 整数光标 | 2.1 结点光标 |\n|---|---|---|\n| a | b | c |')
  })

  test('后面是空格、标点、ASCII、行尾的裸数字', () => {
    noLink('2.7 是一个数字')
    noLink('版本号2.7.')
    noLink('值是2.7')
  })

  test('前面紧跟数字或点', () => {
    noLink('版本12.2节')
    noLink('π约等于3.1415926')
  })

  test('行内代码、标题、已有链接、代码块内不处理', () => {
    noLink('`2.6节`')
    noLink('## 回顾2.6节')
    expect(md.render('[看2.6节](/x)', env())).toBe('<p><a href="/x">看2.6节</a></p>\n')
    noLink('```c\n// 见2.6节\n```')
  })

  test('这些静默跳过的写法不上报', () => {
    md.render('编辑器2.2 与（2.1）与 2.7 与1.0版', env())
    expect(unresolved).toEqual([])
  })

  test('版本号表为空时「（2.1）」会链接（配置生效的反向验证）', () => {
    const md2 = createMd().use(xrefPlugin, { xref })
    expect(links(md2.render('接口（2.1）', env()))).toEqual([['/ch02/2-1', '2.1']])
  })
})

describe('未解析引用', () => {
  test('通过语法判定但目标不存在：保持纯文本并上报，带源文件行号', () => {
    const html = md.render('a\n\nb\n第1章和2.13节，2.16会回头讨论', env()) // 段落 b 从 0 基第 2 行开始
    expect(html).not.toContain('<a ')
    expect(unresolved).toEqual([
      { ref: '第1章', file: 'ch02.md', line: 376, page: 'ch02/2-5.md' },
      { ref: '2.13节', file: 'ch02.md', line: 376, page: 'ch02/2-5.md' },
      { ref: '2.16', file: 'ch02.md', line: 376, page: 'ch02/2-5.md' },
    ])
  })

  test('三段号目标不存在也上报', () => {
    expect(md.render('见3.2.2的图', env())).not.toContain('<a ')
    expect(unresolved.map((u) => u.ref)).toEqual(['3.2.2'])
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
      { ref: '2.16', file: 'ch02.md', line: 1618, page: 'ch02/2-14.md' },
    ]
    const text = formatUnresolved(list)
    expect(text).toContain('未解析的交叉引用 3 处')
    expect(text).toContain('第1章  ← ch02.md:5, ch02.md:13')
    expect(text).toContain('2.16  ← ch02.md:1618')
    expect(formatUnresolved([])).toBe('')
  })
})
