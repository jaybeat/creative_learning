import { describe, expect, test } from 'vitest'
import { collectCodeChars, withAscii } from '../../scripts/lib/charset'
import { fixture } from './helpers'

const hits = collectCodeChars(fixture('ch02-mini.md'), 'ch02-mini.md')
const chars = withAscii(hits)

describe('collectCodeChars', () => {
  test('围栏里的字符被收集并定位到行', () => {
    const box = hits.find((h) => h.ch === '┌')
    expect(box).toBeDefined()
    expect(box!.file).toBe('ch02-mini.md')
    // 夹具中 ┌ 在图示围栏的第一行内容
    const lines = fixture('ch02-mini.md').split('\n')
    expect(lines[box!.line - 1]).toContain('┌')
  })

  test('行内代码里的 < 被收集', () => {
    expect(hits.some((h) => h.ch === '<')).toBe(true)
  })

  test('围栏中文注释与图示标注被收集', () => {
    expect(chars.has('步')).toBe(true)
    expect(chars.has('第')).toBe(true)
  })

  test('正文里的 ≤ 与 ␣ 不收集（不在代码里）', () => {
    expect(chars.has('≤')).toBe(false)
    expect(chars.has('␣')).toBe(false)
  })

  test('制表符、换行不收集', () => {
    expect(chars.has('\n')).toBe(false)
    expect(chars.has('\t')).toBe(false)
  })
})

describe('withAscii', () => {
  test('ASCII 可打印字符全部存在', () => {
    for (let cp = 0x20; cp <= 0x7e; cp++) expect(chars.has(String.fromCodePoint(cp))).toBe(true)
  })

  test('保留首次出现位置', () => {
    const first = hits.find((h) => h.ch === '#')!
    expect(chars.get('#')).toEqual(first)
  })
})
