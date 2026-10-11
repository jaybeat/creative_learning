/**
 * 生成「一元多项式的运算」三问的测试数据：book/problems/tests/ch02-ex-N/NN.in、NN.out。
 *   npx tsx scripts/gen-poly-tests.ts
 * 输出由 scripts/lib/poly-ref.ts 的参考解计算；开始前先断言参考解对题面全部样例输出一致。
 * 随机数用固定种子，重复运行结果不变。所有输入满足题面数据范围：
 * n ≤ 100，|c| ≤ 1000 且合并同类项后仍 ≤ 1000，0 ≤ e ≤ 10⁸。
 */
import fs from 'node:fs'
import path from 'node:path'
import { PROBLEMS_DIR } from './lib/paths'
import { parseProblemSet } from './lib/problems'
import { SOLVERS, parsePoly } from './lib/poly-ref'

const MAX_E = 100_000_000
type Term = [c: number, e: number]

/** mulberry32：小而确定的伪随机数 */
function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1))
  const coef = (max = 1000) => {
    const v = int(1, max)
    return next() < 0.5 ? -v : v
  }
  const shuffle = <T>(xs: T[]) => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = int(0, i)
      ;[xs[i], xs[j]] = [xs[j], xs[i]]
    }
    return xs
  }
  return { next, int, coef, shuffle }
}

const line = (terms: Term[]) => [terms.length, ...terms.flat()].join(' ')

/**
 * 随机多项式：k 个不同指数，再把其中一些项拆成两项（合并后不变），总项数 n ≤ 100，顺序打乱。
 * zeroPairs：额外加入若干对「c 与 -c」同指数项，合并后消失。
 */
function randomPoly(r: ReturnType<typeof rng>, o: { n: number; maxE: number; zeroPairs?: number; small?: boolean }): Term[] {
  const zeroPairs = o.zeroPairs ?? 0
  const rest = o.n - 2 * zeroPairs
  const k = rest > 0 ? Math.max(1, Math.floor(rest * 0.7)) : 0
  const exps = new Set<number>()
  while (exps.size < Math.min(k, o.maxE + 1)) exps.add(r.int(0, o.maxE))
  const terms: Term[] = [...exps].map((e) => [r.coef(o.small ? 9 : 1000), e])
  // 拆项：c = a + b，|a|、|b| ≤ 1000 且都不为 0
  while (terms.length < o.n - 2 * zeroPairs) {
    const i = r.int(0, terms.length - 1)
    const [c, e] = terms[i]
    let a = 0
    for (let tries = 0; tries < 20 && (a === 0 || a === c || Math.abs(c - a) > 1000); tries++) a = r.coef()
    if (a === 0 || a === c || Math.abs(c - a) > 1000) continue
    terms[i] = [a, e]
    terms.push([c - a, e])
  }
  for (let i = 0; i < zeroPairs; i++) {
    const e = r.int(0, o.maxE)
    const c = r.coef()
    terms.push([c, e], [-c, e])
  }
  return r.shuffle(terms)
}

/** 校验一行输入满足数据范围 */
function checkInput(l: string): void {
  const nums = l.split(' ').map(Number)
  const n = nums[0]
  if (n < 0 || n > 100 || nums.length !== 1 + 2 * n) throw new Error(`项数不对：${l.slice(0, 80)}`)
  for (let i = 0; i < n; i++) {
    const c = nums[1 + 2 * i]
    const e = nums[2 + 2 * i]
    if (!Number.isInteger(c) || Math.abs(c) > 1000 || !Number.isInteger(e) || e < 0 || e > MAX_E) throw new Error(`超出数据范围：${c} ${e}`)
  }
  for (const c of parsePoly(l).values()) if (Math.abs(c) > 1000) throw new Error(`合并后系数超过 1000：${c}`)
}

function cases(id: string): string[] {
  const r = rng(id.split('').reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7))
  const P = (o: Parameters<typeof randomPoly>[1]) => line(randomPoly(r, o))
  const one = (terms: Term[]) => line(terms)
  if (id === 'ch02-ex-1') {
    return [
      one([]),
      one([[-7, 0]]),
      one([[-1, 1]]),
      one([[1, 0]]),
      one([[-1, 0], [1, MAX_E]]),
      one([[1000, MAX_E], [-1000, 0], [1, 1]]),
      one([[3, 2], [3, 2], [3, 2], [-9, 2], [-1, 5]]),
      one(Array.from({ length: 100 }, (_, i) => [((i % 7) - 3) || 1, 99 - i] as Term)),
      P({ n: 100, maxE: MAX_E }),
      P({ n: 100, maxE: 20, zeroPairs: 10 }),
      P({ n: 99, maxE: MAX_E, zeroPairs: 30 }),
    ]
  }
  if (id === 'ch02-ex-2') {
    const a = P({ n: 100, maxE: 200 })
    const negA = line(parsePolyTerms(a).map(([c, e]) => [-c, e]))
    return [
      `${one([])}\n${one([])}`,
      `${one([])}\n${one([[5, 3], [-1, 0]])}`,
      `${one([[-1, 1], [1, 0]])}\n${one([])}`,
      `${a}\n${a}`,
      `${a}\n${negA}`,
      `${one([[1, 2], [1, 1]])}\n${one([[-2, 2], [1, 1]])}`,
      `${one([[1000, MAX_E]])}\n${one([[1000, MAX_E], [-1, 0]])}`,
      `${P({ n: 100, maxE: MAX_E })}\n${P({ n: 100, maxE: MAX_E })}`,
      `${P({ n: 100, maxE: 60, zeroPairs: 5 })}\n${P({ n: 100, maxE: 60, zeroPairs: 5 })}`,
      `${P({ n: 1, maxE: 10 })}\n${P({ n: 100, maxE: 10 })}`,
    ]
  }
  if (id === 'ch02-ex-3') {
    return [
      `${one([[3, 4]])}\n${one([])}`,
      `${one([[-2, 0]])}\n${one([[1, 3], [-1, 1], [4, 0]])}`,
      `${one([[1, 1], [1, 0]])}\n${one([[1, 1], [-1, 0]])}`,
      `${one([[1, 2], [1, 1], [1, 0]])}\n${one([[-1, 1], [1, 0]])}`,
      `${one([[1, MAX_E], [1, 0]])}\n${one([[1, MAX_E], [1, 0]])}`,
      `${P({ n: 100, maxE: 50, small: true })}\n${P({ n: 100, maxE: 50, small: true })}`,
      `${P({ n: 100, maxE: 1000 })}\n${P({ n: 100, maxE: 1000 })}`,
      // 大指数、几乎不重合：乘积约 1 万项，检验乘法的效率
      `${P({ n: 100, maxE: MAX_E })}\n${P({ n: 100, maxE: MAX_E })}`,
      `${P({ n: 30, maxE: 5, zeroPairs: 5 })}\n${P({ n: 30, maxE: 5 })}`,
    ]
  }
  throw new Error(id)
}

function parsePolyTerms(l: string): Term[] {
  const nums = l.split(' ').map(Number)
  return Array.from({ length: nums[0] }, (_, i) => [nums[1 + 2 * i], nums[2 + 2 * i]] as Term)
}

function main(): void {
  const set = parseProblemSet(fs.readFileSync(path.join(PROBLEMS_DIR, 'ch02-poly.md'), 'utf8'), 'ch02-poly.md')
  for (const p of set.problems) {
    const solve = SOLVERS[p.id]
    // 1. 参考解必须与题面样例一致
    for (const [i, s] of p.samples.entries()) {
      const got = solve(s.input + '\n')
      if (got.trimEnd() !== s.output.trimEnd()) {
        throw new Error(`${p.id} 样例 ${i + 1}：参考解输出\n${got}\n与题面\n${s.output}\n不一致`)
      }
    }
    // 2. 样例在前，其后是构造与随机数据
    const inputs = [...p.samples.map((s) => s.input), ...cases(p.id)]
    const dir = path.join(PROBLEMS_DIR, 'tests', p.id)
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    inputs.forEach((input, i) => {
      for (const l of input.split('\n')) checkInput(l)
      const name = String(i + 1).padStart(2, '0')
      fs.writeFileSync(path.join(dir, `${name}.in`), input + '\n')
      fs.writeFileSync(path.join(dir, `${name}.out`), solve(input + '\n'))
    })
    const biggest = Math.max(...inputs.map((x) => solve(x + '\n').length))
    console.log(`[gen-poly-tests] ${p.id}：${inputs.length} 组（含样例 ${p.samples.length} 组），最长输出 ${biggest} 字节`)
  }
}

main()
