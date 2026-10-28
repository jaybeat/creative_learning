import { describe, expect, test } from 'vitest'
import { FOCUS_IN, GLIDE, NOTE_ARROW, arrowHead, ease, focusState, glideRect, groupRects, notePlace, noteState } from '../../scripts/lib/guide/runtime.js'

const R = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 })

describe('引导模块浏览器端的纯计算', () => {
  test('挨着的格子合成一个框，分开的各一个框', () => {
    // 一行里三个挨着的格子 + 下面另一行一个格子
    const g = groupRects([R(40, 10, 55, 34), R(10, 10, 25, 34), R(25, 10, 40, 34), R(10, 100, 25, 124)])
    expect(g).toEqual([R(10, 10, 55, 34), R(10, 100, 25, 124)])
    // 同一行但隔得远（栈里的 * 和输入带的 -）：两个框
    expect(groupRects([R(10, 10, 25, 34), R(200, 10, 215, 34)])).toHaveLength(2)
  })

  test('一串聚焦开头淡入、到达时收紧；有上一个框时不淡入、滑过去', () => {
    const f = { k: 'a', t0: 10, t1: 20 }
    const start = focusState(f, 10, false, false)
    expect(start).toMatchObject({ g: 1, a: 0, pad: 9 })
    expect(focusState(f, 10 + FOCUS_IN, false, false).a).toBe(1)
    expect(focusState(f, 15, false, false).pad).toBe(4)
    // 有上一个框：一开始就是满的，g 从 0 到 1
    const glide = focusState(f, 10, true, true)
    expect(glide).toMatchObject({ g: 0, a: 1 })
    expect(focusState(f, 10 + GLIDE, true, true).g).toBe(1)
    // 后面没有接着的聚焦：结尾淡出；有：不淡出
    expect(focusState(f, 19.9, false, false).a).toBeLessThan(1)
    expect(focusState(f, 19.9, false, true).a).toBe(1)
  })

  test('框从上一组里最近的那个滑过来', () => {
    const r = R(100, 100, 120, 120)
    const R0 = [R(0, 0, 20, 20), R(90, 90, 110, 110)]
    expect(glideRect(R0, r, 0)).toEqual(R(90, 90, 110, 110))
    expect(glideRect(R0, r, 0.5)).toEqual(R(95, 95, 115, 115))
    expect(glideRect([], r, 0.3)).toEqual(r)
  })

  test('批注默认写在右边，右边出画布换左边，左边也放不下写下面（和目标左边对齐）', () => {
    expect(notePlace(R(100, 100, 120, 120), 60, 20).side).toBe('r')
    expect(notePlace(R(560, 100, 580, 120), 60, 20).side).toBe('l')
    const b = notePlace(R(20, 100, 40, 120), 620, 20)
    expect(b.side).toBe('b')
    expect(b.tx).toBe(12) // 632 - 620：不越过右边
    expect(notePlace(R(100, 100, 120, 120), 60, 20, 'b')).toMatchObject({ side: 'b', tx: 100 })
  })

  test('批注先画箭头再写字，框滑走前淡出', () => {
    const f = { k: 'a', t0: 10, t1: 20, note: '等右边' }
    expect(noteState(f, 10, 0, 1, true)).toEqual({ pa: 0, pw: 0, op: 1 })
    const mid = noteState(f, 10 + NOTE_ARROW, 0, 1, true)
    expect(mid.pa).toBeCloseTo(1)
    expect(mid.pw).toBeCloseTo(0)
    expect(noteState(f, 12, 0, 1, true).pw).toBe(1)
    // 框要滑走（goesOn）：结束前淡出；滑过来的框（delay）到了才开始画
    expect(noteState(f, 19.9, 0, 1, true).op).toBeCloseTo(0.5)
    expect(noteState(f, 10.2, 0.3, 1, false).pa).toBe(0)
  })

  test('缓动和箭头尖', () => {
    expect([ease(-1), ease(0), ease(1), ease(2)]).toEqual([0, 0, 1, 1])
    expect(arrowHead(10, 10, 0, 10)).toMatch(/^M[\d.]+ [\d.]+ L10 10 L[\d.]+ [\d.]+$/)
  })
})
