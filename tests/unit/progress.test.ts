import { describe, expect, test } from 'vitest'
import { empty, isRead, markRead, pagePath, parse, setLast, validLast } from '../../site/.vitepress/theme/progress'

const titleOf = (path: string) => ({ '/ch02/2-8': '2.8 动态扩容：编辑器1.1', '/ch02/2-9': '2.9 链表' })[path] ?? null

describe('parse', () => {
  test('null、空串、非 JSON、非对象都回退为空记录', () => {
    for (const raw of [null, '', '{', '42', '"x"', 'null']) expect(parse(raw)).toEqual(empty())
  })

  test('旧格式（read 为字符串数组）的项被丢弃', () => {
    expect(parse('{"read":["/ch02/2-1","/ch02/2-8"]}')).toEqual({ last: null, read: [] })
  })

  test('缺字段或字段类型不对时只保留合法部分', () => {
    expect(parse('{"read":[{"path":"/ch02/2-1","title":"2.1 x"},{"path":"/a"},3,null]}')).toEqual({
      last: null,
      read: [{ path: '/ch02/2-1', title: '2.1 x' }],
    })
    expect(parse('{"last":{"title":"x"}}')).toEqual({ last: null, read: [] })
    expect(parse('{"last":{"path":"/ch02/2-9","scrollY":"abc"}}')).toEqual({
      last: { path: '/ch02/2-9', title: '', scrollY: 0, at: 0 },
      read: [],
    })
  })

  test('完整数据原样解析', () => {
    const p = { last: { path: '/ch02/2-9', title: '2.9 x', scrollY: 120, at: 1 }, read: [{ path: '/ch02/2-8', title: '2.8 y' }] }
    expect(parse(JSON.stringify(p))).toEqual(p)
  })
})

describe('markRead / isRead', () => {
  test('幂等、保持顺序、同路径换标题时覆盖', () => {
    let p = empty()
    p = markRead(p, '/ch02/2-1', '2.1 a')
    p = markRead(p, '/ch02/2-2', '2.2 b')
    expect(markRead(p, '/ch02/2-1', '2.1 a')).toBe(p)
    const q = markRead(p, '/ch02/2-1', '2.1 改名了')
    expect(q.read).toEqual([
      { path: '/ch02/2-1', title: '2.1 改名了' },
      { path: '/ch02/2-2', title: '2.2 b' },
    ])
  })

  test('标题不一致不算已读；标题未知（路径不存在）不算已读', () => {
    const p = markRead(empty(), '/ch02/2-8', '2.8 链表：关系存哪里')
    expect(isRead(p, '/ch02/2-8', '2.8 链表：关系存哪里')).toBe(true)
    expect(isRead(p, '/ch02/2-8', '2.8 动态扩容：编辑器1.1')).toBe(false)
    expect(isRead(p, '/ch02/2-8', null)).toBe(false)
  })
})

describe('setLast / validLast', () => {
  test('setLast 覆盖并允许清空', () => {
    const last = { path: '/ch02/2-9', title: '2.9 链表', scrollY: 1, at: 2 }
    expect(setLast(empty(), last).last).toEqual(last)
    expect(setLast(setLast(empty(), last), null).last).toBeNull()
  })

  test('最近阅读只在标题仍一致时有效', () => {
    const ok = setLast(empty(), { path: '/ch02/2-9', title: '2.9 链表', scrollY: 1, at: 2 })
    expect(validLast(ok, titleOf)).toEqual(ok.last)
    const stale = setLast(empty(), { path: '/ch02/2-8', title: '2.8 链表：关系存哪里', scrollY: 1, at: 2 })
    expect(validLast(stale, titleOf)).toBeNull()
    const gone = setLast(empty(), { path: '/ch02/2-99', title: 'x', scrollY: 1, at: 2 })
    expect(validLast(gone, titleOf)).toBeNull()
    expect(validLast(empty(), titleOf)).toBeNull()
  })
})

describe('pagePath', () => {
  test('节页与章首页', () => {
    expect(pagePath('ch02/2-8.md')).toBe('/ch02/2-8')
    expect(pagePath('ch02/index.md')).toBe('/ch02/')
    expect(pagePath('index.md')).toBe('/')
  })
})
