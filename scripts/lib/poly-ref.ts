/**
 * 「一元多项式的运算」参考解：生成测试数据的输出用。题面规则见 book/problems/ch02-poly.md。
 * 多项式用 Map<指数, 系数> 表示，系数为 0 的项随时删掉。
 */
export type Poly = Map<number, number>

/** 解析一行「n c1 e1 c2 e2 …」并合并同类项 */
export function parsePoly(line: string): Poly {
  const nums = line.trim().split(/\s+/).filter(Boolean).map(Number)
  const n = nums[0] ?? 0
  if (nums.length !== 1 + 2 * n) throw new Error(`项数与数字个数不符：${line}`)
  const p: Poly = new Map()
  for (let i = 0; i < n; i++) addTerm(p, nums[1 + 2 * i], nums[2 + 2 * i])
  return p
}

export function addTerm(p: Poly, c: number, e: number): void {
  const v = (p.get(e) ?? 0) + c
  if (v === 0) p.delete(e)
  else p.set(e, v)
}

export function add(a: Poly, b: Poly, sign = 1): Poly {
  const r: Poly = new Map(a)
  for (const [e, c] of b) addTerm(r, sign * c, e)
  return r
}

export function mul(a: Poly, b: Poly): Poly {
  const r: Poly = new Map()
  for (const [ea, ca] of a) for (const [eb, cb] of b) addTerm(r, ca * cb, ea + eb)
  return r
}

/** 按题面规则输出：「k c1 e1 c2 e2 …」，指数从高到低，零多项式为「0」 */
export function formatPoly(p: Poly): string {
  const terms = [...p.entries()].filter(([, c]) => c !== 0).sort((x, y) => y[0] - x[0])
  return [terms.length, ...terms.map(([e, c]) => `${c} ${e}`)].join(' ')
}

/** 三问的完整解：输入全文 → 期望输出全文 */
export const SOLVERS: Record<string, (input: string) => string> = {
  'ch02-ex-1': (input) => formatPoly(parsePoly(lines(input)[0] ?? '0')) + '\n',
  'ch02-ex-2': (input) => {
    const [a, b] = lines(input).map(parsePoly)
    return `${formatPoly(add(a, b))}\n${formatPoly(add(a, b, -1))}\n`
  },
  'ch02-ex-3': (input) => {
    const [a, b] = lines(input).map(parsePoly)
    return formatPoly(mul(a, b)) + '\n'
  },
}

function lines(s: string): string[] {
  return s.split('\n').map((l) => l.trim()).filter(Boolean)
}
