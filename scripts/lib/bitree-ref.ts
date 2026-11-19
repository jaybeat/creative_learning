/**
 * 「二叉树的结点表」参考解：生成测试数据的输出用。题面规则见 book/problems/ch04-bitree.md。
 * 结点表读进 val[]、lc[]、rc[] 三个数组，下标就是编号。
 */
export interface NodeTable {
  n: number
  val: string[]
  lc: number[]
  rc: number[]
}

/** 解析结点表，并检查它确实是一棵二叉树（每个编号恰好一行、每个结点至多当一次孩子、恰好一个根、从根走得到所有结点） */
export function parseTable(input: string): NodeTable {
  const lines = input.trim().split('\n').map((l) => l.trim())
  const n = Number(lines[0])
  if (!Number.isInteger(n) || n < 1 || n > 1000) throw new Error(`n 超出范围：${lines[0]}`)
  if (lines.length !== n + 1) throw new Error(`应有 ${n} 行结点，实际 ${lines.length - 1} 行`)
  const val: string[] = Array(n).fill('')
  const lc: number[] = Array(n).fill(-2)
  const rc: number[] = Array(n).fill(-2)
  for (const l of lines.slice(1)) {
    const parts = l.split(' ')
    if (parts.length !== 4) throw new Error(`一行要有四项：${l}`)
    const [id, v, a, b] = [Number(parts[0]), parts[1], Number(parts[2]), Number(parts[3])]
    if (!Number.isInteger(id) || id < 0 || id >= n || lc[id] !== -2) throw new Error(`编号不对或重复：${l}`)
    if (!/^[A-Z]$/.test(v)) throw new Error(`值不是一个大写字母：${l}`)
    for (const c of [a, b]) if (!Number.isInteger(c) || c < -1 || c >= n) throw new Error(`孩子编号超出范围：${l}`)
    val[id] = v
    lc[id] = a
    rc[id] = b
  }
  const t = { n, val, lc, rc }
  const parent = parents(t)
  const roots = parent.flatMap((p, i) => (p === -1 ? [i] : []))
  if (roots.length !== 1) throw new Error(`应恰好一个根，找到 ${roots.length} 个`)
  if (preorder(t, roots[0]).length !== n) throw new Error('从根出发走不到所有结点（有环）')
  return t
}

/** 由孩子指针反推双亲；某结点当了两次孩子就报错 */
export function parents(t: NodeTable): number[] {
  const p = Array(t.n).fill(-1)
  for (let i = 0; i < t.n; i++) {
    for (const c of [t.lc[i], t.rc[i]]) {
      if (c === -1) continue
      if (p[c] !== -1 || c === i) throw new Error(`结点 ${c} 有不止一个双亲`)
      p[c] = i
    }
  }
  return p
}

export function rootOf(t: NodeTable): number {
  return parents(t).indexOf(-1)
}

/** 用显式栈，不怕 1000 层的链 */
function order(t: NodeTable, root: number, kind: 'pre' | 'in' | 'post'): number[] {
  const out: number[] = []
  // [结点, 第几次经过]：0 第一次到（先序），1 左子树走完（中序），2 右子树走完（后序）
  const st: [number, number][] = [[root, 0]]
  while (st.length) {
    const top = st[st.length - 1]
    const [x, k] = top
    if (k === 0) {
      if (kind === 'pre') out.push(x)
      top[1] = 1
      if (t.lc[x] !== -1) st.push([t.lc[x], 0])
    } else if (k === 1) {
      if (kind === 'in') out.push(x)
      top[1] = 2
      if (t.rc[x] !== -1) st.push([t.rc[x], 0])
    } else {
      if (kind === 'post') out.push(x)
      st.pop()
    }
  }
  return out
}

export const preorder = (t: NodeTable, root: number) => order(t, root, 'pre')

export function solveInfo(input: string): string {
  const t = parseTable(input)
  const p = parents(t)
  const deg = t.lc.map((a, i) => (a !== -1 ? 1 : 0) + (t.rc[i] !== -1 ? 1 : 0))
  const cnt = [0, 1, 2].map((d) => deg.filter((x) => x === d).length)
  return [String(p.indexOf(-1)), ...p.map((x, i) => `${x} ${deg[i]}`), cnt.join(' ')].join('\n') + '\n'
}

export function solveTraversal(input: string): string {
  const t = parseTable(input)
  const r = rootOf(t)
  return (['pre', 'in', 'post'] as const).map((k) => order(t, r, k).map((x) => t.val[x]).join(' ')).join('\n') + '\n'
}

export const SOLVERS: Record<string, (input: string) => string> = {
  'ch04-ex-1': solveInfo,
  'ch04-ex-2': solveTraversal,
}
