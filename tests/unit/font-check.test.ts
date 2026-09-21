import fs from 'node:fs'
import { describe, expect, test } from 'vitest'
import { FONT_SRC } from '../../scripts/lib/paths'
import { collectCodeChars, withAscii } from '../../scripts/lib/charset'
import { checkFont, expectedAdvance, formatProblems, openFont } from '../../scripts/lib/font-check'
import { fixture } from './helpers'

describe('expectedAdvance', () => {
  test('中文、CJK 标点、全角标点 → 1000', () => {
    for (const ch of ['中', '步', '、', '。', '，', '：', '（']) expect(expectedAdvance(ch.codePointAt(0)!)).toBe(1000)
  })
  test('ASCII、制表符、箭头、圆点、省略号 → 500', () => {
    for (const ch of ['a', ' ', '─', '│', '┼', '╱', '►', '▼', '▲', '◄', '●', '→', '…', '—']) {
      expect(expectedAdvance(ch.codePointAt(0)!)).toBe(500)
    }
  })
})

describe('checkFont（真实字体）', () => {
  if (!fs.existsSync(FONT_SRC)) {
    throw new Error(`缺少 ${FONT_SRC}，请先按 README 下载 Sarasa Fixed SC Regular`)
  }
  const font = openFont(fs.readFileSync(FONT_SRC))

  test('unitsPerEm 为 1000（HANDOFF 实测）', () => {
    expect(font.unitsPerEm).toBe(1000)
  })

  test('HANDOFF 表格里的字符全部宽度正确', () => {
    const sample = withAscii([...'─│┼╱▲►▼◄●→←↑↓…—中，：'].map((ch) => ({ ch, file: 't', line: 1 })))
    expect(checkFont(font, sample)).toEqual([])
  })

  test('真实夹具零违规', () => {
    const chars = withAscii(collectCodeChars(fixture('ch02-mini.md'), 'ch02-mini.md'))
    expect(checkFont(font, chars)).toEqual([])
  })

  test('字体不支持的字符被报出并定位到源文件行', () => {
    const chars = withAscii(collectCodeChars(fixture('bad-glyph.md'), 'bad-glyph.md'))
    const problems = checkFont(font, chars)
    expect(problems).toHaveLength(1)
    expect(problems[0].ch).toBe('🙂')
    expect(problems[0].file).toBe('bad-glyph.md')
    expect(problems[0].line).toBe(7)
    expect(formatProblems(problems)).toContain('bad-glyph.md:7')
  })
})
