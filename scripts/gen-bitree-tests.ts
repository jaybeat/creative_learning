/**
 * 生成「二叉树的结点表」两问的测试数据：book/problems/tests/ch04-ex-N/NN.in、NN.out。
 *   npx tsx scripts/gen-bitree-tests.ts
 * 两问用同一批输入（各自的样例在前），输出由 scripts/lib/bitree-ref.ts 的参考解计算；
 * 开始前先断言参考解对题面全部样例输出一致。随机数用固定种子，重复运行结果不变。
 * 所有输入满足题面数据范围：1 ≤ n ≤ 1000，值是大写字母（可重复），一定是一棵二叉树。
 */
import fs from 'node:fs'
import path from 'node:path'
import { PROBLEMS_DIR } from './lib/paths'
import { parseProblemSet } from './lib/problems'
import { SOLVERS, parseTable } from './lib/bitree-ref'

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
  const shuffle = <T>(xs: T[]) => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = int(0, i)
      ;[xs[i], xs[j]] = [xs[j], xs[i]]
    }
    return xs
  }
  return { next, int, shuffle }
}
type Rng = ReturnType<typeof rng>

/** 树的形状：结点 0..n-1，0 是根，lc/rc 是孩子（-1 表示空） */
interface Shape {
  lc: number[]
  rc: number[]
}

const empty = (n: number): Shape => ({ lc: Array(n).fill(-1), rc: Array(n).fill(-1) })

/** 一条链：dir 决定每一步往左还是往右 */
function chain(n: number, dir: (i: number) => 'L' | 'R'): Shape {
  const s = empty(n)
  for (let i = 0; i + 1 < n; i++) (dir(i) === 'L' ? s.lc : s.rc)[i] = i + 1
  return s
}

/** 完全二叉树：按层编号，i 的孩子是 2i+1、2i+2 */
function complete(n: number): Shape {
  const s = empty(n)
  for (let i = 0; i < n; i++) {
    if (2 * i + 1 < n) s.lc[i] = 2 * i + 1
    if (2 * i + 2 < n) s.rc[i] = 2 * i + 2
  }
  return s
}

/** 随机形状：每个新结点挂到一个还有空位的已有结点下面；deep 越大越偏向挂在最近的结点下面（树更高） */
function random(r: Rng, n: number, deep = 0): Shape {
  const s = empty(n)
  const open: number[] = [0]
  for (let i = 1; i < n; i++) {
    const k = r.next() < deep ? open.length - 1 : r.int(0, open.length - 1)
    const x = open[k]
    const slots = [s.lc[x] === -1 ? 'L' : '', s.rc[x] === -1 ? 'R' : ''].filter(Boolean)
    const side = slots[r.int(0, slots.length - 1)]
    ;(side === 'L' ? s.lc : s.rc)[x] = i
    if (s.lc[x] !== -1 && s.rc[x] !== -1) open.splice(k, 1)
    open.push(i)
  }
  return s
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * 形状 → 输入文本。编号重新随机分配（ids 为 'keep' 时保持 0 是根），行序打乱或按 rows 指定；
 * 值从 letters 里取。
 */
function render(r: Rng, s: Shape, o: { letters?: string; ids?: 'keep' | 'shuffle'; rows?: 'shuffle' | 'byId' | 'rootLast' } = {}): string {
  const n = s.lc.length
  const letters = o.letters ?? LETTERS
  const perm = Array.from({ length: n }, (_, i) => i)
  if ((o.ids ?? 'shuffle') === 'shuffle') r.shuffle(perm)
  const id = (x: number) => (x === -1 ? -1 : perm[x])
  // 值：字母够用时尽量不重复，按形状里的次序给（0 → 第一个字母）
  const val = (x: number) => (letters.length >= n ? letters[x] : letters[r.int(0, letters.length - 1)])
  let rows = Array.from({ length: n }, (_, x) => ({ x, line: `${id(x)} ${val(x)} ${id(s.lc[x])} ${id(s.rc[x])}` }))
  const mode = o.rows ?? 'shuffle'
  if (mode === 'byId') rows.sort((a, b) => perm[a.x] - perm[b.x])
  else {
    r.shuffle(rows)
    if (mode === 'rootLast') rows = [...rows.filter((x) => x.x !== 0), ...rows.filter((x) => x.x === 0)]
  }
  return [String(n), ...rows.map((x) => x.line)].join('\n')
}

function cases(): string[] {
  const r = rng(20261119)
  return [
    // 两个结点：只有左孩子 / 只有右孩子，根在第二行
    render(r, chain(2, () => 'L'), { ids: 'keep', rows: 'rootLast' }),
    render(r, chain(2, () => 'R'), { rows: 'rootLast' }),
    // 满二叉树 7 个结点，按编号给行
    render(r, complete(7), { ids: 'keep', rows: 'byId' }),
    // 随机小树
    render(r, random(r, 10)),
    render(r, random(r, 26, 0.5), { rows: 'rootLast' }),
    // 全是同一个字母：只能靠编号
    render(r, random(r, 40), { letters: 'A' }),
    // 两个字母
    render(r, random(r, 200, 0.3), { letters: 'XY' }),
    // 1000 层的链：左链、右链、之字形（递归深度 1000）
    render(r, chain(1000, () => 'L')),
    render(r, chain(1000, () => 'R'), { rows: 'rootLast' }),
    render(r, chain(1000, (i) => (i % 2 ? 'L' : 'R'))),
    // 完全二叉树 1000 个结点
    render(r, complete(1000), { ids: 'keep', rows: 'byId' }),
    render(r, complete(1000)),
    // 随机大树：矮胖、细高
    render(r, random(r, 1000)),
    render(r, random(r, 1000, 0.9), { rows: 'rootLast' }),
  ]
}

function main(): void {
  const set = parseProblemSet(fs.readFileSync(path.join(PROBLEMS_DIR, 'ch04-bitree.md'), 'utf8'), 'ch04-bitree.md')
  const shared = cases()
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
    const inputs = [...p.samples.map((s) => s.input), ...shared]
    const dir = path.join(PROBLEMS_DIR, 'tests', p.id)
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    inputs.forEach((input, i) => {
      parseTable(input) // 检查数据范围、确实是一棵二叉树
      const name = String(i + 1).padStart(2, '0')
      fs.writeFileSync(path.join(dir, `${name}.in`), input + '\n')
      fs.writeFileSync(path.join(dir, `${name}.out`), solve(input + '\n'))
    })
    console.log(`[gen-bitree-tests] ${p.id}：${inputs.length} 组（含样例 ${p.samples.length} 组）`)
  }
}

main()
