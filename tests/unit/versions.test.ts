import { describe, expect, test } from 'vitest'
import { detectVersionNumbers } from '../../scripts/lib/versions'
import { fixture } from './helpers'

describe('detectVersionNumbers', () => {
  test('「编辑器N.M」与「N.M版」都算，去重排序', () => {
    const src = '## 2.6 编辑器1.0：跑起来\n\n编辑器1.1 比 编辑器1.0 好；1.0版失败，1.1成功；得到编辑器2.2，再看编辑器2.0 和 2.1。\n\n编辑器2.1的main。'
    expect(detectVersionNumbers(src)).toEqual(['1.0', '1.1', '2.0', '2.1', '2.2'])
  })

  test('只提到「编辑器」但没有版本号 → 空', () => {
    expect(detectVersionNumbers('第2章就从上面那个单行编辑器开始。1.1到1.5说的四步。')).toEqual([])
  })

  test('代码块、行内代码里的不算', () => {
    expect(detectVersionNumbers('```c\n/* 编辑器2.2 */\n```\n\n`编辑器1.1`\n')).toEqual([])
  })

  test('真实夹具（第 2 章 mini）里有「编辑器2.2」', () => {
    expect(detectVersionNumbers(fixture('ch02-mini.md'))).toEqual(['2.2'])
  })
})
