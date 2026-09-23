import { describe, expect, test } from 'vitest'
import { createMd } from '../../scripts/lib/md'
import { kindOf, milestonePlugin } from '../../scripts/lib/milestone-plugin'

const md = createMd().use(milestonePlugin)

const card = [
  '> **到这里你有了**：顺序表的六个操作和一个验证程序，能在`I love bananas`上插入、删除、查找。',
  '> **下一步**：把全局变量L变成函数参数，为搭编辑器做准备。',
  '> **还没解决的**：在行首打字是O(n)。',
  '> **学到的**：换存储结构本身不一定变快。',
  '> **验证了**：只通过操作访问数据。',
  '> **用到的操作**：Init、Length、Get。',
  '> **接口**：和顺序表的六个函数完全相同。',
  '> **新发明的标签**：未知标签也要能渲染。',
  '',
].join('\n')

describe('里程碑卡片', () => {
  const html = md.render(card)

  test('引用块带 milestone class', () => {
    expect(html).toMatch(/^<blockquote class="milestone">/)
  })

  test('7 种已知标签映射到对应类别', () => {
    expect(html).toContain('<div class="ms-row ms-done"><span class="ms-icon" aria-hidden="true"></span><span class="ms-label">到这里你有了</span><div class="ms-body">顺序表的六个操作')
    expect(html).toContain('ms-row ms-next"')
    expect(html).toContain('ms-row ms-open"')
    expect(html.match(/ms-row ms-note"/g)).toHaveLength(5) // 学到的、验证了、用到的操作、接口、未知标签
  })

  test('未知标签走默认类别，不报错', () => {
    expect(kindOf('新发明的标签')).toBe('note')
    expect(html).toContain('<span class="ms-label">新发明的标签</span><div class="ms-body">未知标签也要能渲染。')
  })

  test('冒号被去掉，行内代码仍渲染', () => {
    expect(html).not.toContain('<div class="ms-body">：')
    expect(html).toContain('<code>I love bananas</code>')
  })

  test('每行一个 ms-row，共 8 行，没有残留的 <p>', () => {
    expect(html.match(/<div class="ms-row/g)).toHaveLength(8)
    expect(html).not.toContain('<p>')
  })
})

describe('节首问题卡片与练一练', () => {
  const question = '> **本节问题**：删掉中间一个元素，它留下的空格子怎么办？\n'
  const ending = [
    '> **到这里你有了**：五个操作全部实现。',
    '> **练一练**：（1）实现Delete，用2.4.2的程序运行，确认输出`cat`。（2）把`Delete(2)`改成`Delete(0)`，输出是什么？',
    '> **下一步**：把全局变量L变成参数。',
    '',
  ].join('\n')

  test('本节问题 → 问题卡片', () => {
    const html = md.render(question)
    expect(html).toMatch(/^<blockquote class="milestone milestone-question">/)
    expect(html).toContain('<div class="ms-row ms-question"><span class="ms-icon" aria-hidden="true"></span><span class="ms-label">本节问题</span><div class="ms-body">删掉中间一个元素')
  })

  test('练一练行带 practice 类别与固定 id，行内代码保留', () => {
    const html = md.render(ending)
    expect(html).toContain('<div class="ms-row ms-practice" id="practice"><span class="ms-icon" aria-hidden="true"></span><span class="ms-label">练一练</span><div class="ms-body">（1）实现Delete')
    expect(html).toContain('<code>Delete(0)</code>')
    expect(html.match(/<div class="ms-row/g)).toHaveLength(3)
  })

  test('同一页两种卡片互不影响', () => {
    const html = md.render(question + '\n正文。\n\n' + ending)
    expect(html.match(/<blockquote class="milestone milestone-question">/g)).toHaveLength(1)
    expect(html.match(/<blockquote class="milestone">/g)).toHaveLength(1)
    expect(html).toContain('<p>正文。</p>')
  })
})

describe('不受影响的引用块', () => {
  test('普通引用块原样', () => {
    expect(md.render('> 只是引用\n')).toBe('<blockquote>\n<p>只是引用</p>\n</blockquote>\n')
  })

  test('含粗体但不以「到这里你有了」开头的引用块原样', () => {
    const html = md.render('> **注意**：这不是里程碑。\n> **下一步**：也不是。\n')
    expect(html).not.toContain('milestone')
    expect(html).toContain('<p><strong>注意</strong>：这不是里程碑。')
  })

  test('卡片之后的普通引用块不受影响', () => {
    const html = md.render(card + '\n> 普通\n')
    expect(html.match(/<blockquote class="milestone">/g)).toHaveLength(1)
    expect(html).toContain('<blockquote>\n<p>普通</p>\n</blockquote>')
  })
})
