import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { compareOutput, normalizeLines } from '../../scripts/lib/compare'
import { SOLVERS, formatPoly, parsePoly } from '../../scripts/lib/poly-ref'
import { parseProblemSet } from '../../scripts/lib/problems'
import { PROBLEMS_DIR } from '../../scripts/lib/paths'

describe('compareOutput', () => {
  it('忽略行尾空白、末尾空行与 \r', () => {
    expect(compareOutput('a\nb\n', 'a  \r\nb\t\n\n\n')).toEqual({ ok: true })
    expect(normalizeLines('x \n\n')).toEqual(['x'])
  })
  it('行首空格、行中差异、多一行少一行都算不同，并给出第一处不同的行号', () => {
    expect(compareOutput('a\nb', ' a\nb')).toEqual({ ok: false, line: 1 })
    expect(compareOutput('a\nb', 'a\nc')).toEqual({ ok: false, line: 2 })
    expect(compareOutput('a', 'a\nb')).toEqual({ ok: false, line: 2 })
    expect(compareOutput('a\nb', 'a')).toEqual({ ok: false, line: 2 })
    expect(compareOutput('0', '')).toEqual({ ok: false, line: 1 })
  })
})

describe('多项式参考解', () => {
  it('输出规则：系数 ±1、指数 0 / 1、首项负号、零多项式', () => {
    expect(formatPoly(parsePoly('3 -1 1 1 0 1 3'))).toBe('x^3 - x + 1')
    expect(formatPoly(parsePoly('2 -1 3 -5 0'))).toBe('-x^3 - 5')
    expect(formatPoly(parsePoly('2 4 3 -4 3'))).toBe('0')
    expect(formatPoly(parsePoly('0'))).toBe('0')
  })

  it('与题面全部样例一致（gen-poly-tests 也会检查）', () => {
    const set = parseProblemSet(fs.readFileSync(path.join(PROBLEMS_DIR, 'ch02-poly.md'), 'utf8'), 'ch02-poly.md')
    for (const p of set.problems) {
      for (const s of p.samples) expect(SOLVERS[p.id](s.input + '\n').trimEnd()).toBe(s.output.trimEnd())
    }
  })

  it('仓库里的测试数据与参考解一致（改了题面或参考解要重新生成）', () => {
    for (const id of Object.keys(SOLVERS)) {
      const dir = path.join(PROBLEMS_DIR, 'tests', id)
      const ins = fs.readdirSync(dir).filter((f) => f.endsWith('.in'))
      expect(ins.length).toBeGreaterThanOrEqual(10)
      for (const f of ins) {
        const input = fs.readFileSync(path.join(dir, f), 'utf8')
        expect(fs.readFileSync(path.join(dir, f.replace(/\.in$/, '.out')), 'utf8')).toBe(SOLVERS[id](input))
      }
    }
  })
})
