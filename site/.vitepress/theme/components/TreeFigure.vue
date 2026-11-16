<script setup lang="ts">
import { computed } from 'vue'

/**
 * 树的示意图（第4章）：根在上，一层一层往下画，父子之间连线。纯静态 SVG。
 *
 * tree：括号写法，结点名后面的括号里是它的孩子，逗号分开，例如 `文档(工作(周报,合同),论文(初稿),下载/)`。
 *   最外层写几棵树（逗号分开）就是森林，并排画。名字末尾的 `/` 表示文件夹（显示时去掉），空文件夹靠它认出来。
 * folders：把文件夹（有孩子的结点，以及名字带 `/` 的）画成带折角的框，文件只写名字。不给时每个结点都画圆角框。
 * hi：高亮的结点名，空格分开。
 * circle：圈出以这个结点为根的子树，空格分开可以圈几棵。
 * path：从根到这个结点的路径加粗。
 * 孩子兄弟表示法的分步图（颜色在 custom.css 的 --tree-first、--tree-sib、--tree-cut）：
 *   keep：留下的长子边，`父-子`，画成绿色粗线；
 *   cut：要删掉的父子边，画成橙色虚线；
 *   drop：已经删掉的父子边，不画；
 *   sib：新连上的兄弟边，`甲-乙`，画成紫色粗线，带箭头；
 *   compact：结点名只有一个字母时用，结点框窄一些，成对的两张图才放得进一行。
 *   spread：兄弟之间留宽一点。分步图里每一张都要加，原树和变换后的图才一样大、位置对得上。
 * extra：反例里多出来的父子关系，`父-子` 用空格分开，画成红色虚线，子结点描红。
 * levels：左边标"第1层""第2层"……
 * label：结点旁边的小字，`名:文字` 用空格分开，例如 `文档:4 工作:3`。
 * dim：画成灰色的结点名（比如去掉的根）。
 * binary：二叉树。每个结点的孩子写成"左,右"两个位置，空着的一边不写，例如 `-(,3)` 只有右孩子、`!(3,)` 只有左孩子。
 *   只有一个孩子时画在左下或右下，不居中。tree 为空串时画一个"空"字（空二叉树）。
 * slots：二叉树里把空着的位置画成虚线小框。
 * lr：二叉树里左边按长子边的颜色（--tree-first）、右边按兄弟边的颜色（--tree-sib）上色，接 4.3 的分步图。
 * linked：二叉链表（要和 binary 一起用）。结点画成"左指针 | 值 | 右指针"三格，指针从格子里连到孩子，空指针写 ∧。
 *   parent：再加一格双亲指针（三叉链表），画成"左指针 | 值 | 双亲 | 右指针"，虚线箭头连回双亲；根的双亲写 ∧。
 *   nulls：把 ∧ 标成高亮色（数空指针）。ptrs：把非空的指针线标成高亮色（数非空指针）。
 *   地址写在 label 里，例如 `A:200 B:340`。
 * tour：二叉树遍历的"绕一圈"。沿外圈从根的左边出发，绕过每个结点，最后回到根的右边，每个结点经过三次（左边、下边、右边）。
 *   `path` 只画路线；`all` 再在三处各画一个小点；`pre`、`in`、`post` 只在左边、下边、右边画点，并标上第几个经过。
 *   upto：只画到第几个点（分步图），不给时画全。
 * 递归求值的"递"和"归"（二叉树，画在边的两旁）：
 *   ask：结点名，空格分开。从这些结点到它们孩子的每条边旁，画一个朝下的虚线小箭头和"?"：问题交下去。
 *     有 slots 时，通往空子树的边也画。叶子要画到空子树，tree 里写成 `D(,)`。
 *   ret：`名:值`，空格分开。从这个结点到它双亲的边旁，画一个朝上的实线小箭头和值：这棵子树带回的答案。
 *   zero：结点名，空格分开。它通往空子树的边旁，画朝上的箭头和 empty 的值（空树带回的答案，默认 0）。
 * bits：二叉树的编码树。每条通往左孩子的边旁标 0，通往右孩子的边旁标 1（空子树不标）。
 * caption：图下面的一行说明。
 */
const props = withDefaults(
  defineProps<{
    tree: string
    folders?: boolean
    hi?: string
    circle?: string
    path?: string
    extra?: string
    levels?: boolean
    label?: string
    dim?: string
    cut?: string
    sib?: string
    keep?: string
    drop?: string
    spread?: boolean
    compact?: boolean
    binary?: boolean
    slots?: boolean
    lr?: boolean
    linked?: boolean
    parent?: boolean
    nulls?: boolean
    ptrs?: boolean
    tour?: string
    upto?: number | string
    bits?: boolean
    ask?: string
    ret?: string
    zero?: string
    empty?: string
    caption?: string
  }>(),
  { bits: false, ask: '', ret: '', zero: '', empty: '0', tour: '', upto: 0, linked: false, parent: false, nulls: false, ptrs: false, folders: false, hi: '', circle: '', path: '', extra: '', levels: false, label: '', dim: '', cut: '', sib: '', keep: '', drop: '', spread: false, compact: false, binary: false, slots: false, lr: false, caption: '' },
)

interface TNode {
  name: string
  folder: boolean
  kids: TNode[]
  depth: number
  x: number
  y: number
  w: number
  parent: TNode | null
  empty?: boolean // 二叉树里空着的位置
}

function parse(src: string): TNode[] {
  let i = 0
  const s = src.trim()
  function list(depth: number, parent: TNode | null): TNode[] {
    const out: TNode[] = []
    for (;;) {
      let name = ''
      while (i < s.length && !'(),'.includes(s[i])) name += s[i++]
      name = name.trim()
      const n: TNode = { name, folder: false, kids: [], depth, x: 0, y: 0, w: 0, parent }
      if (name.endsWith('/')) {
        n.name = name.slice(0, -1).trim()
        n.folder = true
      }
      if (s[i] === '(') {
        i++
        n.kids = list(depth + 1, n)
        if (s[i] !== ')') throw new Error(`TreeFigure: 括号不配对「${src}」`)
        if (props.binary && n.kids.length !== 2) throw new Error(`TreeFigure: 二叉树的孩子要写成"左,右"两个位置「${src}」`)
        i++
        n.folder = true
      }
      if (!n.name) {
        if (!props.binary || n.kids.length) throw new Error(`TreeFigure: 有结点没写名字「${src}」`)
        n.empty = true
      }
      out.push(n)
      if (s[i] === ',') {
        i++
        continue
      }
      return out
    }
  }
  const roots = list(1, null)
  if (i !== s.length) throw new Error(`TreeFigure: 多出来的字符「${s.slice(i)}」`)
  return roots
}

const words = (v: string) => v.trim().split(/\s+/).filter(Boolean)

// 粗略量字宽：汉字 14px，其他 8px（字号 14）
const textW = (t: string) => [...t].reduce((a, c) => a + (/[　-鿿＀-￯]/.test(c) ? 14 : 8), 0)

const levelGap = 58
// 二叉链表里一个指针格的宽度，值那一格的宽度
const ptrW = 18
const dataW = (n: { name: string }) => Math.max(26, textW(n.name) + 12)
const nodeH = 26
// 要画兄弟横箭头时，兄弟之间多留些地方
const gapX = computed(() => (props.spread || props.sib.trim() ? 22 : 10))
// 结点旁有小字时，根上面的小字要留地方
const top = computed(() => (props.label.trim() ? 18 : 8))

// 图的宽度：树的宽度，和下面那行说明（13px 字，按 14px 字宽估的 0.93）里大的那个
const figW = computed(() => Math.max(layout.value.W, props.caption ? Math.ceil(textW(props.caption) * 0.93) + 8 : 0))

const isEmptyTree = computed(() => props.binary && props.tree.trim() === '')

const layout = computed(() => {
  // 空二叉树：画一个占位的结点，模板里换成"空"字
  const roots = isEmptyTree.value ? parse('空') : parse(props.tree)
  const all: TNode[] = []
  const walk = (n: TNode) => {
    all.push(n)
    n.kids.forEach(walk)
  }
  roots.forEach(walk)
  for (const n of all) {
    n.w = n.empty ? (props.compact ? 24 : 30) : Math.max(props.compact ? 28 : 36, textW(n.name) + 16)
    if (props.linked && !n.empty) n.w = dataW(n) + ptrW * (props.parent ? 3 : 2)
  }
  // 叶子从左到右排，父结点放在第一个和最后一个孩子的正中
  const flow = props.ask.trim() || props.ret.trim() || props.zero.trim() ? 16 : 0
  const left0 = (props.levels ? 52 : 8) + (props.tour ? 22 : 0) + flow
  let cursor = left0
  const place = (n: TNode) => {
    if (!n.kids.length) {
      n.x = cursor + n.w / 2
      cursor += n.w + gapX.value
    } else {
      n.kids.forEach(place)
      n.x = (n.kids[0].x + n.kids[n.kids.length - 1].x) / 2
      // 父结点比孩子们宽时，右边的兄弟要让开
      cursor = Math.max(cursor, n.x + n.w / 2 + gapX.value)
    }
    n.y = top.value + (n.depth - 1) * levelGap
  }
  roots.forEach((r, k) => {
    if (k) cursor += 28 // 森林里几棵树之间多空一点
    place(r)
  })
  const maxDepth = Math.max(...all.map((n) => n.depth))
  // 结点旁边的小字也要算进宽度，否则最右边的会被裁掉
  const tagW = (n: TNode) => {
    const t = words(props.label).find((w) => w.startsWith(n.name + ':'))
    return t ? textW(t.slice(n.name.length + 1)) + 4 : 0
  }
  const right = Math.max(...all.map((n) => n.x + n.w / 2 + tagW(n) + (props.tour ? 22 : 0) + flow))
  return { roots, all, W: Math.ceil(right + 8), H: top.value + (maxDepth - 1) * levelGap + nodeH + 8 + (props.tour ? 16 : 0), maxDepth }
})

const byName = (name: string) => layout.value.all.find((n) => n.name === name)
const hiSet = computed(() => new Set(words(props.hi)))
const dimSet = computed(() => new Set(words(props.dim)))
const labels = computed(() => {
  const m = new Map<string, string>()
  for (const w of words(props.label)) {
    const k = w.indexOf(':')
    if (k > 0) m.set(w.slice(0, k), w.slice(k + 1))
  }
  return m
})
const pathSet = computed(() => {
  const s = new Set<TNode>()
  for (let n = props.path ? byName(props.path) : undefined; n; n = n.parent ?? undefined) s.add(n)
  return s
})
const extras = computed(() =>
  words(props.extra).map((w) => {
    const [a, b] = w.split('-')
    const p = byName(a)
    const c = byName(b)
    if (!p || !c) throw new Error(`TreeFigure: extra 里找不到结点「${w}」`)
    return { p, c }
  }),
)
const cutSet = computed(() => new Set(words(props.cut)))
const keepSet = computed(() => new Set(words(props.keep)))
const dropSet = computed(() => new Set(words(props.drop)))
// 兄弟之间的横箭头：从甲的右边到乙的左边
const sibs = computed(() =>
  words(props.sib).map((w) => {
    const [a, b] = w.split('-')
    const p = byName(a)
    const c = byName(b)
    if (!p || !c) throw new Error(`TreeFigure: sib 里找不到结点「${w}」`)
    const x1 = p.x + p.w / 2 + 2
    const x2 = c.x - c.w / 2 - 2
    const y = p.y + nodeH / 2
    return { x1, x2, y, head: `${x2},${y} ${x2 - 8},${y - 4} ${x2 - 8},${y + 4}` }
  }),
)
const extraKids = computed(() => new Set(extras.value.map((e) => e.c)))
// 圈出的子树：取子树里所有结点的外框
const circles = computed(() =>
  words(props.circle).map((name) => {
    const r = byName(name)
    if (!r) throw new Error(`TreeFigure: circle 里找不到结点「${name}」`)
    const ns: TNode[] = []
    const walk = (n: TNode) => {
      ns.push(n)
      n.kids.forEach(walk)
    }
    walk(r)
    const x1 = Math.min(...ns.map((n) => n.x - n.w / 2)) - 5
    const x2 = Math.max(...ns.map((n) => n.x + n.w / 2)) + 5
    const y1 = r.y - 5
    const y2 = Math.max(...ns.map((n) => n.y)) + nodeH + 5
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
  }),
)
// 多出来的边画成弧线，免得和原有的边叠在一起
function bend(p: TNode, c: TNode) {
  const x1 = p.x
  const y1 = p.y + nodeH
  const x2 = c.x
  const y2 = c.y
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  // 往左边鼓出去
  const cx = (x1 + x2) / 2 - ((y2 - y1) / len) * 36
  const cy = (y1 + y2) / 2 + ((x2 - x1) / len) * 36
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
}
const edges = computed(() =>
  layout.value.all
    .flatMap((n) => n.kids.map((c, k) => ({ p: n, c, side: k === 0 ? 'left' : 'right' })))
    .filter((e) => !props.linked && (!e.c.empty || props.slots) && !dropSet.value.has(`${e.p.name}-${e.c.name}`)),
)
// 二叉链表：每个结点的几格（左、值、[双亲]、右），以及从指针格连出去的线
interface Field {
  x: number
  w: number
  kind: 'l' | 'd' | 'p' | 'r'
  nil: boolean
}
function fields(n: TNode): Field[] {
  const x0 = n.x - n.w / 2
  const dw = dataW(n)
  const kid = (k: number) => n.kids[k] && !n.kids[k].empty
  const out: Field[] = [
    { x: x0, w: ptrW, kind: 'l', nil: !kid(0) },
    { x: x0 + ptrW, w: dw, kind: 'd', nil: false },
  ]
  if (props.parent) out.push({ x: x0 + ptrW + dw, w: ptrW, kind: 'p', nil: !n.parent })
  out.push({ x: x0 + n.w - ptrW, w: ptrW, kind: 'r', nil: !kid(1) })
  return out
}
function arrow(x1: number, y1: number, x2: number, y2: number) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  const [ux, uy] = [(x2 - x1) / len, (y2 - y1) / len]
  const [bx, by] = [x2 - ux * 7, y2 - uy * 7]
  return { d: `M ${x1} ${y1} L ${bx} ${by}`, head: `${x2},${y2} ${bx - uy * 3.5},${by + ux * 3.5} ${bx + uy * 3.5},${by - ux * 3.5}` }
}
// 递和归：沿着父子边，在边的两旁各画一个短箭头。朝下的在左手边，朝上的在右手边（从双亲看向孩子）
const flows = computed(() => {
  const askSet = new Set(words(props.ask))
  const zeroSet = new Set(words(props.zero))
  const rets = new Map<string, string>()
  for (const w of words(props.ret)) {
    const k = w.indexOf(':')
    if (k > 0) rets.set(w.slice(0, k), w.slice(k + 1))
  }
  const out: { d: string; head: string; up: boolean; text: string; tx: number; ty: number }[] = []
  for (const n of layout.value.all) {
    if (n.empty) continue
    for (const c of n.kids) {
      if (c.empty && !props.slots) continue
      const x1 = n.x
      const y1 = n.y + nodeH
      const x2 = c.x
      const y2 = c.y
      const len = Math.hypot(x2 - x1, y2 - y1) || 1
      const [ux, uy] = [(x2 - x1) / len, (y2 - y1) / len]
      // 法向量：沿边往下看的左手边
      const [nx, ny] = [uy, -ux]
      const seg = (side: number, down: boolean, text: string) => {
        const off = 8 * side
        const a = 0.28
        const b = 0.72
        const p1 = [x1 + (x2 - x1) * a + nx * off, y1 + (y2 - y1) * a + ny * off]
        const p2 = [x1 + (x2 - x1) * b + nx * off, y1 + (y2 - y1) * b + ny * off]
        const [s1, s2] = down ? [p1, p2] : [p2, p1]
        const ar = arrow(s1[0], s1[1], s2[0], s2[1])
        const mx = (p1[0] + p2[0]) / 2 + nx * 9 * side
        const my = (p1[1] + p2[1]) / 2 + ny * 9 * side + 4
        out.push({ ...ar, up: !down, text, tx: mx, ty: my })
      }
      if (askSet.has(n.name)) seg(1, true, '?')
      if (c.empty ? zeroSet.has(n.name) : rets.has(c.name)) seg(-1, false, c.empty ? props.empty : rets.get(c.name)!)
    }
  }
  return out
})

// 编码树：边的中点往外侧挪一点，写 0 或 1
const bitMarks = computed(() => {
  if (!props.bits) return []
  const out: { x: number; y: number; t: string }[] = []
  for (const n of layout.value.all) {
    n.kids.forEach((c, k) => {
      if (c.empty) return
      const mx = (n.x + c.x) / 2
      const my = (n.y + nodeH + c.y) / 2
      out.push({ x: mx + (k === 0 ? -8 : 8), y: my, t: k === 0 ? '0' : '1' })
    })
  }
  return out
})

const links = computed(() => {
  if (!props.linked) return []
  const out: { d: string; head: string; up: boolean; x: number; y: number }[] = []
  for (const n of layout.value.all) {
    if (n.empty) continue
    for (const f of fields(n)) {
      const cx = f.x + f.w / 2
      const cy = n.y + nodeH / 2
      if ((f.kind === 'l' || f.kind === 'r') && !f.nil) {
        const c = n.kids[f.kind === 'l' ? 0 : 1]
        out.push({ ...arrow(cx, cy, c.x, c.y - 1), up: false, x: cx, y: cy })
      }
      if (f.kind === 'p' && n.parent) {
        const p = n.parent
        out.push({ ...arrow(cx, n.y, p.x + (cx < p.x ? -6 : 6), p.y + nodeH + 1), up: true, x: cx, y: cy })
      }
    }
  }
  return out
})

// 绕一圈：每个结点的左边、下边、右边各一个点，按"左 → 左子树 → 下 → 右子树 → 右"的次序连起来
interface TourPt {
  x: number
  y: number
  kind: 'pre' | 'in' | 'post'
  n: TNode
}
const tourPts = computed<TourPt[]>(() => {
  if (!props.tour || isEmptyTree.value) return []
  const out: TourPt[] = []
  const gap = 9
  const walk = (n: TNode | undefined) => {
    if (!n || n.empty) return
    out.push({ x: n.x - n.w / 2 - gap, y: n.y + nodeH / 2, kind: 'pre', n })
    walk(n.kids[0])
    out.push({ x: n.x, y: n.y + nodeH + gap, kind: 'in', n })
    walk(n.kids[1])
    out.push({ x: n.x + n.w / 2 + gap, y: n.y + nodeH / 2, kind: 'post', n })
  }
  layout.value.roots.forEach(walk)
  return out
})
const tourLimit = computed(() => Number(props.upto) || tourPts.value.length)
// 路线：相邻两点之间用二次曲线，拐角圆一些
const tourPath = computed(() => {
  const pts = tourPts.value.slice(0, tourLimit.value)
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1]
    const b = pts[k]
    // 往外鼓一点：同一个结点上的两点之间绕着结点走
    const cx = (a.x + b.x) / 2 + (a.n === b.n ? 0 : 0)
    const cy = a.n === b.n ? Math.max(a.y, b.y) + 4 : (a.y + b.y) / 2
    d += ` Q ${cx} ${cy} ${b.x} ${b.y}`
  }
  return d
})
const tourHead = computed(() => {
  const pts = tourPts.value.slice(0, tourLimit.value)
  if (pts.length < 2) return ''
  const b = pts[pts.length - 1]
  const a = pts[pts.length - 2]
  const cx = (a.x + b.x) / 2
  const cy = a.n === b.n ? Math.max(a.y, b.y) + 4 : (a.y + b.y) / 2
  const len = Math.hypot(b.x - cx, b.y - cy) || 1
  const [ux, uy] = [(b.x - cx) / len, (b.y - cy) / len]
  const [bx, by] = [b.x - ux * 7, b.y - uy * 7]
  return `${b.x},${b.y} ${bx - uy * 3.5},${by + ux * 3.5} ${bx + uy * 3.5},${by - ux * 3.5}`
})
// 要画的点：all 画全部（不编号）；pre/in/post 只画那一种，按经过的先后编号
const tourDots = computed(() => {
  const shown = tourPts.value.slice(0, tourLimit.value)
  if (props.tour === 'all') return shown.map((p) => ({ ...p, no: 0 }))
  if (!['pre', 'in', 'post'].includes(props.tour)) return []
  let no = 0
  return shown.filter((p) => p.kind === props.tour).map((p) => ({ ...p, no: ++no }))
})

const shown = computed(() => (isEmptyTree.value ? [] : layout.value.all.filter((n) => !n.empty)))
const slotNodes = computed(() => (props.slots && !props.linked ? layout.value.all.filter((n) => n.empty) : []))

function aria() {
  if (isEmptyTree.value) return '空二叉树'
  const show = (n: TNode): string => (n.empty ? '空' : n.kids.length ? `${n.name}（${n.kids.map(show).join('，')}）` : n.name)
  return `${props.binary ? '二叉树' : '树'}：${layout.value.roots.map(show).join('；')}`
}
</script>

<template>
  <figure class="tree-figure" :style="{ width: `${figW}px` }">
    <svg :viewBox="`0 0 ${layout.W} ${layout.H}`" :style="{ width: `${layout.W}px` }" role="img" :aria-label="aria()">
      <g v-if="levels" class="lvl">
        <text v-for="d in layout.maxDepth" :key="d" x="4" :y="top + (d - 1) * levelGap + nodeH / 2 + 4">第{{ d }}层</text>
      </g>
      <rect v-for="(c, k) in circles" :key="'c' + k" class="circle" :x="c.x" :y="c.y" :width="c.w" :height="c.h" rx="10" />
      <line
        v-for="(e, k) in edges"
        :key="'e' + k"
        class="edge"
        :class="{ on: pathSet.has(e.c) && pathSet.has(e.p), dim: dimSet.has(e.p.name), cut: cutSet.has(`${e.p.name}-${e.c.name}`), keep: keepSet.has(`${e.p.name}-${e.c.name}`) || (lr && e.side === 'left'), lsib: lr && e.side === 'right', slot: e.c.empty }"
        :x1="e.p.x"
        :y1="e.p.y + nodeH"
        :x2="e.c.x"
        :y2="e.c.y"
      />
      <g v-for="(e, k) in sibs" :key="'s' + k" class="sib">
        <line :x1="e.x1" :y1="e.y" :x2="e.x2 - 4" :y2="e.y" />
        <polygon :points="e.head" />
      </g>
      <g v-for="(l, k) in links" :key="'l' + k" class="link" :class="{ up: l.up, on: ptrs && !l.up }">
        <circle :cx="l.x" :cy="l.y" r="2.5" />
        <path :d="l.d" />
        <polygon :points="l.head" />
      </g>
      <g v-if="tourPath" class="tour">
        <path :d="tourPath" />
        <polygon :points="tourHead" />
      </g>
      <text v-for="(b, k) in bitMarks" :key="'b' + k" class="bit" :x="b.x" :y="b.y" text-anchor="middle">{{ b.t }}</text>
      <g v-for="(f, k) in flows" :key="'f' + k" class="flow" :class="{ up: f.up }">
        <path :d="f.d" />
        <polygon :points="f.head" />
        <text :x="f.tx" :y="f.ty" text-anchor="middle">{{ f.text }}</text>
      </g>
      <path v-for="(e, k) in extras" :key="'x' + k" class="edge bad" :d="bend(e.p, e.c)" />
      <g
        v-for="n in shown"
        :key="n.name + n.depth + n.x"
        class="node"
        :class="{ hi: hiSet.has(n.name), on: pathSet.has(n), bad: extraKids.has(n), dim: dimSet.has(n.name), file: folders && !n.folder }"
      >
        <path
          v-if="folders && n.folder"
          class="box"
          :d="`M ${n.x - n.w / 2} ${n.y + 4} h ${Math.min(18, n.w / 3)} l 3 -4 h ${n.w - Math.min(18, n.w / 3) - 3} v ${nodeH} h ${-n.w} z`"
        />
        <template v-else-if="linked">
          <rect v-for="(f, k) in fields(n)" :key="k" class="box field" :class="{ ptr: f.kind !== 'd' }" :x="f.x" :y="n.y" :width="f.w" :height="nodeH" />
          <template v-for="(f, k) in fields(n)" :key="'t' + k">
            <text v-if="f.kind === 'd'" class="name" :x="f.x + f.w / 2" :y="n.y + nodeH / 2 + 6" text-anchor="middle">{{ n.name }}</text>
            <text v-else-if="f.nil" class="nil" :class="{ on: nulls }" :x="f.x + f.w / 2" :y="n.y + nodeH / 2 + 5" text-anchor="middle">∧</text>
          </template>
        </template>
        <rect v-else class="box" :x="n.x - n.w / 2" :y="n.y" :width="n.w" :height="nodeH" rx="5" />
        <text v-if="!linked" class="name" :x="n.x" :y="n.y + nodeH / 2 + 6" text-anchor="middle">{{ n.name }}</text>
        <text v-if="labels.get(n.name)" class="tag" :x="n.x + n.w / 2 + 2" :y="n.y - 1">{{ labels.get(n.name) }}</text>
      </g>
      <g v-for="(p, k) in tourDots" :key="'t' + k" class="tour-dot" :class="p.kind">
        <circle :cx="p.x" :cy="p.y" :r="p.no ? 4.5 : 3" />
        <text
          v-if="p.no"
          :x="p.kind === 'pre' ? p.x - 8 : p.kind === 'post' ? p.x + 8 : p.x + 7"
          :y="p.kind === 'in' ? p.y + 12 : p.y - 6"
          :text-anchor="p.kind === 'pre' ? 'end' : 'start'"
        >{{ p.no }}</text>
      </g>
      <!-- 二叉树里空着的位置 -->
      <rect v-for="(n, k) in slotNodes" :key="'s' + k" class="slot" :x="n.x - n.w / 2" :y="n.y" :width="n.w" :height="nodeH" rx="5" />
      <g v-if="isEmptyTree" class="node">
        <rect class="slot" :x="layout.all[0].x - 18" :y="top" width="36" :height="nodeH" rx="5" />
        <text class="name empty" :x="layout.all[0].x" :y="top + nodeH / 2 + 6" text-anchor="middle">空</text>
      </g>
    </svg>
    <figcaption v-if="caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.tree-figure {
  margin: 16px auto;
  max-width: 100%;
}
svg {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
}
.edge.slot,
.slot {
  fill: none;
  stroke: var(--vp-c-text-3);
  stroke-dasharray: 3 3;
  stroke-width: 1.2;
}
.name.empty {
  fill: var(--vp-c-text-3);
}
.edge.lsib {
  stroke: var(--tree-sib);
  stroke-width: 3;
}
figcaption {
  margin-top: 4px;
  text-align: center;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.edge {
  stroke: var(--vp-c-text-2);
  stroke-width: 1.5;
}
.edge.on {
  stroke: var(--vp-c-brand-1);
  stroke-width: 3;
}
.edge.bad {
  fill: none;
  stroke: var(--vp-c-danger-1);
  stroke-dasharray: 5 3;
  stroke-width: 2;
}
.edge.cut {
  stroke: var(--tree-cut);
  stroke-dasharray: 5 4;
  stroke-width: 1.8;
}
.edge.keep {
  stroke: var(--tree-first);
  stroke-width: 3;
}
.sib line {
  stroke: var(--tree-sib);
  stroke-width: 3;
}
.sib polygon {
  fill: var(--tree-sib);
}
.edge.dim {
  stroke: var(--vp-c-text-3);
  stroke-dasharray: 3 3;
}
.box {
  fill: var(--vp-c-bg-soft);
  stroke: var(--vp-c-text-1);
  stroke-width: 1.5;
}
.node.file .box {
  fill: transparent;
  stroke: transparent;
}
.node.hi .box,
.node.on .box {
  fill: var(--vp-c-brand-soft);
  stroke: var(--vp-c-brand-1);
}
.node.bad .box {
  stroke: var(--vp-c-danger-1);
  stroke-width: 2;
}
.node.dim .box {
  stroke: var(--vp-c-text-3);
  stroke-dasharray: 3 3;
}
.node.dim .name {
  fill: var(--vp-c-text-3);
}
.name {
  font-size: 14px;
  fill: var(--vp-c-text-1);
}
.node.hi .name,
.node.on .name {
  font-weight: 600;
}
.tag {
  font-size: 12px;
  font-weight: 600;
  fill: var(--vp-c-brand-1);
  /* 压在连线上时也看得清 */
  paint-order: stroke;
  stroke: var(--vp-c-bg);
  stroke-width: 3px;
}
.field.ptr {
  fill: var(--vp-c-bg);
}
.node.hi .field.ptr {
  fill: var(--vp-c-bg);
}
.nil {
  font-size: 13px;
  fill: var(--vp-c-text-2);
}
.nil.on {
  fill: var(--vp-c-danger-1);
  font-weight: 700;
}
.link path {
  fill: none;
  stroke: var(--vp-c-text-2);
  stroke-width: 1.5;
}
.link polygon,
.link circle {
  fill: var(--vp-c-text-2);
}
.link.up path {
  stroke-dasharray: 4 3;
}
.link.on path {
  stroke: var(--vp-c-brand-1);
  stroke-width: 2.2;
}
.link.on polygon,
.link.on circle {
  fill: var(--vp-c-brand-1);
}
.bit {
  font-size: 12px;
  font-weight: 700;
  fill: var(--tree-sib);
  paint-order: stroke;
  stroke: var(--vp-c-bg);
  stroke-width: 3px;
}
.flow path {
  fill: none;
  stroke: var(--vp-c-text-3);
  stroke-width: 1.4;
  stroke-dasharray: 3 2;
}
.flow polygon {
  fill: var(--vp-c-text-3);
}
.flow text {
  font-size: 12px;
  font-weight: 700;
  fill: var(--vp-c-text-2);
  paint-order: stroke;
  stroke: var(--vp-c-bg);
  stroke-width: 3px;
}
.flow.up path {
  stroke: var(--tree-first);
  stroke-width: 1.8;
  stroke-dasharray: none;
}
.flow.up polygon {
  fill: var(--tree-first);
}
.flow.up text {
  fill: var(--tree-first);
}
.tour path {
  fill: none;
  stroke: var(--tree-sib);
  stroke-width: 1.6;
  stroke-dasharray: 5 3;
  opacity: 0.8;
}
.tour polygon {
  fill: var(--tree-sib);
}
.tour-dot circle {
  fill: var(--vp-c-brand-1);
  stroke: var(--vp-c-bg);
  stroke-width: 1.5;
}
.tour-dot text {
  font-size: 12px;
  font-weight: 700;
  fill: var(--vp-c-brand-1);
  paint-order: stroke;
  stroke: var(--vp-c-bg);
  stroke-width: 3px;
}
.lvl text {
  font-size: 12px;
  fill: var(--vp-c-text-3);
}
.circle {
  fill: none;
  stroke: var(--vp-c-brand-1);
  stroke-width: 1.5;
  stroke-dasharray: 6 4;
}
</style>
