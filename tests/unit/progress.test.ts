import { describe, expect, test } from 'vitest'
import { empty, isRead, markRead, pagePath, parse, setLast } from '../../site/.vitepress/theme/progress'

describe('parse', () => {
  test('null、空串、非 JSON、非对象都回退为空记录', () => {
    for (const raw of [null, '', '{', '42', '"x"', 'null']) expect(parse(raw)).toEqual(empty())
  })

  test('缺字段或字段类型不对时只保留合法部分', () => {
    expect(parse('{"read":["/ch02/2-1", 3, null]}')).toEqual({ last: null, read: ['/ch02/2-1'] })
    expect(parse('{"last":{"title":"x"}}')).toEqual({ last: null, read: [] })
    expect(parse('{"last":{"path":"/ch02/2-9","scrollY":"abc"}}')).toEqual({
      last: { path: '/ch02/2-9', title: '', scrollY: 0, at: 0 },
      read: [],
    })
  })

  test('完整数据原样解析', () => {
    const p = { last: { path: '/ch02/2-9', title: '2.9 x', scrollY: 120, at: 1 }, read: ['/ch02/2-8'] }
    expect(parse(JSON.stringify(p))).toEqual(p)
  })
})

describe('markRead / setLast / isRead', () => {
  test('markRead 幂等且保持顺序', () => {
    let p = empty()
    p = markRead(p, '/ch02/2-1')
    p = markRead(p, '/ch02/2-2')
    const same = markRead(p, '/ch02/2-1')
    expect(same).toBe(p)
    expect(p.read).toEqual(['/ch02/2-1', '/ch02/2-2'])
    expect(isRead(p, '/ch02/2-2')).toBe(true)
    expect(isRead(p, '/ch02/2-3')).toBe(false)
  })

  test('setLast 覆盖并允许清空', () => {
    const last = { path: '/ch02/2-9', title: 't', scrollY: 1, at: 2 }
    expect(setLast(empty(), last).last).toEqual(last)
    expect(setLast(setLast(empty(), last), null).last).toBeNull()
  })
})

describe('pagePath', () => {
  test('节页与章首页', () => {
    expect(pagePath('ch02/2-8.md')).toBe('/ch02/2-8')
    expect(pagePath('ch02/index.md')).toBe('/ch02/')
    expect(pagePath('index.md')).toBe('/')
  })
})
