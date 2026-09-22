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
