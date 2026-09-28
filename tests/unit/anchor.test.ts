import { describe, expect, it } from 'vitest'
import { commonPrefix, commonSuffix, locate, quoteAt } from '../../site/.vitepress/theme/comments/anchor'

const text = '顺序表的插入要移动元素。链表的插入只改指针。链表需要头结点吗？有了头结点，插入第一个结点也不用特判。'

describe('locate', () => {
  it('唯一命中', () => {
    const q = quoteAt(text, text.indexOf('只改指针'), text.indexOf('只改指针') + 4)
    expect(locate(text, q)).toEqual({ start: text.indexOf('只改指针'), end: text.indexOf('只改指针') + 4 })
  })

  it('多处命中时按上下文选出原来那一处', () => {
    const second = text.indexOf('的插入', text.indexOf('的插入') + 1)
    const q = quoteAt(text, second, second + 3)
    expect(locate(text, q)?.start).toBe(second)
    const first = text.indexOf('的插入')
    expect(locate(text, quoteAt(text, first, first + 3))?.start).toBe(first)
  })

  it('上下文被改了一部分，仍按吻合更多的一处定位', () => {
    const i = text.lastIndexOf('头结点')
    const q = quoteAt(text, i, i + 3)
    const edited = text.replace('有了头结点，插入第一个', '有了头结点以后，插入第一个')
    expect(locate(edited, q)?.start).toBe(edited.lastIndexOf('头结点'))
  })

  it('引文本身被改了 → 找不到（原文已修改）', () => {
    const i = text.indexOf('只改指针')
    const q = quoteAt(text, i, i + 4)
    expect(locate(text.replace('只改指针', '只修改指针'), q)).toBeNull()
  })

  it('上下文相同时优先小节提示区间', () => {
    const t = 'AB 头结点 CD | AB 头结点 CD'
    const q = { exact: '头结点', prefix: 'AB ', suffix: ' CD' }
    expect(locate(t, q)?.start).toBe(3)
    expect(locate(t, q, { start: 12, end: t.length })?.start).toBe(t.lastIndexOf('头结点'))
  })

  it('空引文返回 null', () => {
    expect(locate(text, { exact: '', prefix: '', suffix: '' })).toBeNull()
  })

  it('字符画与代码里的引文', () => {
    const t = '┌───┬───┐ │ c │ ●─┼────►│ a │ p->next = q; p->next = r;'
    const i = t.lastIndexOf('p->next')
    expect(locate(t, quoteAt(t, i, i + 11))?.start).toBe(i)
  })
})

describe('commonPrefix / commonSuffix', () => {
  it('计数', () => {
    expect(commonPrefix('abcd', 'abxd')).toBe(2)
    expect(commonSuffix('xxcd', 'abcd')).toBe(2)
    expect(commonPrefix('', 'a')).toBe(0)
  })
})

describe('quoteAt', () => {
  it('前后文最多 32 个字符，靠近边界时截短', () => {
    const t = 'a'.repeat(50) + 'X' + 'b'.repeat(50)
    const q = quoteAt(t, 50, 51)
    expect(q).toEqual({ exact: 'X', prefix: 'a'.repeat(32), suffix: 'b'.repeat(32) })
    expect(quoteAt('XY', 0, 1)).toEqual({ exact: 'X', prefix: '', suffix: 'Y' })
  })
})
