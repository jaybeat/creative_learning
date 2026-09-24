import { describe, expect, test } from 'vitest'
import { checkDiagram, displayWidth } from '../../scripts/lib/diagram-check'

const ok = (s: string) => expect(checkDiagram(s), s).toEqual([])

describe('displayWidth', () => {
  test('中文 2 列，其余 1 列', () => {
    expect(displayWidth('文')).toBe(2)
    expect(displayWidth('，')).toBe(2)
    for (const ch of ['a', '│', '►', '●', '␣', '①', '…']) expect(displayWidth(ch)).toBe(1)
  })
})

describe('对齐的图示不报', () => {
  test('第 2 章 2.9.1 的箭头图', () => {
    ok(['head = 100', '  │', '  ▼', '┌───┬─────┐     ┌───┬─────┐     ┌───┬─────┐', '│ c │ 108 │────►│ a │ 104 │────►│ t │  0  │', '└───┴─────┘     └───┴─────┘     └───┴─────┘', '    100             108             104'].join('\n'))
  })

  test('第 2 章的内存格子图', () => {
    ok(['┌───┬───┬───┬───┐', '│ c │   │   │ t │', '└───┴───┴───┴───┘', ' 100 101 102 103'].join('\n'))
  })

  test('第 1 章的线性图（含 ␣）与集合图（圆角不参与）', () => {
    ok(['┌───┐   ┌───┐', '│ I │──►│ ␣ │──► …', '└───┘   └───┘'].join('\n'))
    ok(['   ╭──────────────╮', '   │  138…   150… │', '   ╰──────────────╯'].join('\n'))
  })

  test('方框里的中文按 2 列算就对齐', () => {
    ok(['┌────┐', '│ 家 │', '└─┬──┘', '  │'].join('\n'))
  })

  test('箭头尖顶着方框底边（第 2 章 2.10.3 第四步图）', () => {
    ok(['└───┴─────┘     └───┴───┬─┘     └───┴─────┘', '    100             108 │        ▲  104', '                   prev │        │', '                        │ ┌───┬──┴──┐', '                        └►│ x │ 104 │', '                          └───┴─────┘'].join('\n'))
  })

  test('真实夹具里的图示', () => {
    ok(['┌───┬───┐', '│ c │ ●─┼────►', '└───┴───┘', '  p 第0步'].join('\n'))
  })
})

describe('错位的图示会报', () => {
  test('第 1 章图关系图：「│ 家 │」比上方 ┌───┐ 宽一列', () => {
    const issues = checkDiagram(['    ┌───┐', '    │ 家 │────', '    └─┬─┘'].join('\n'))
    expect(issues.length).toBeGreaterThan(0)
    // 右边框 │ 在第 9 列（0 基），上一行同列空白、左边一列是 ┐
    expect(issues[0]).toMatchObject({ line: 1, col: 9, char: '│' })
  })

  test('第 1 章树形图：右边框在 ┐ 的右边一列', () => {
    const issues = checkDiagram(['          ┌───────┐', '          │ 文档   │', '          └───┬───┘'].join('\n'))
    expect(issues.length).toBeGreaterThan(0)
    expect(issues[0]).toMatchObject({ line: 1, col: 19, char: '│' })
  })

  test('拐角落在上一行的横线上（第 1 章树形图第三个方框）', () => {
    const issues = checkDiagram(['       ┌──────┼──────┐', '   ┌───┴───┐ ┌┴────┐ ┌┴──────┐'].join('\n'))
    expect(issues.some((x) => x.col === 21)).toBe(true)
  })

  test('每块最多 3 条', () => {
    const bad = ['┌───┐', '│ 家 │', '┌───┐', '│ 家 │', '┌───┐', '│ 家 │', '┌───┐', '│ 家 │'].join('\n')
    expect(checkDiagram(bad)).toHaveLength(3)
  })
})
