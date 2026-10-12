<script setup lang="ts">
import { computed } from 'vue'

/**
 * 链栈的箭头图（第3章）：竖着画，栈顶在上，和 StackFigure 一致。
 * 画法沿用 2.9 的箭头图：结点分数据格和地址格，地址格写下一个结点的地址，最后一个写 0；
 * 结点右边标自己的地址；左边是 `S = 地址` 和指向栈顶结点的箭头。纯静态 SVG。
 *
 * items：开始时栈里的元素，空格分开，从栈底到栈顶。地址按 addrs 依次分配（栈底先拿）。
 * ops：一串操作，空格分开；给了就画一排小图（第一张是调用前，之后每步一张）。
 *   整个操作：`push:3`、`pop`、`gettop`、`init`。
 *   Push 分步：`new:3` 申请结点 q 放 3；`link` q->next = *S；`move` *S = q。
 *   Pop 分步：`take` q = *S、*x = q->data；`next` *S = q->next；`free` free(q)。
 * skip：去掉前几张小图。
 */
const props = withDefaults(defineProps<{ items?: string; ops?: string; addrs?: string; skip?: number | string }>(), {
  items: '',
  ops: '',
  addrs: '100 109 105 112 118 124',
  skip: 0,
})

interface Node {
  v: string
  addr: string
  next: string // 地址格：下一个结点的地址，'0' 表示没有，'?' 表示还没填
  state: 'live' | 'new' | 'freed'
}
type Hi = '' | 'node' | 'next' | 'S' | 'data'
interface Frame {
  nodes: Node[] // 从上到下（栈顶在上）
  S: string // 栈顶结点的地址，空栈为 NULL
  q: string // q 指着的地址，没有为 ''
  hi: Hi
  hiAddr: string
  caption: string
  note: string
}

const frames = computed<Frame[]>(() => {
  const pool = props.addrs.trim().split(/\s+/)
  let used = 0
  const take = () => pool[used++] ?? String(200 + used * 8)
  // nodes 从栈顶到栈底
  let nodes: Node[] = []
  for (const v of props.items.trim().split(/\s+/).filter(Boolean)) {
    const addr = take()
    nodes.unshift({ v, addr, next: nodes[0]?.addr ?? '0', state: 'live' })
  }
  let S = nodes[0]?.addr ?? 'NULL'
  let q = ''
  const clone = () => nodes.map((n) => ({ ...n }))
  const tokens = props.ops.trim().split(/\s+/).filter(Boolean)
  const out: Frame[] = [{ nodes: clone(), S, q, hi: '', hiAddr: '', caption: tokens.length ? '调用前' : '', note: '' }]
  const live = () => nodes.filter((n) => n.state !== 'freed')
  for (const t of tokens) {
    const [op, arg] = t.split(':')
    let hi: Hi = ''
    let hiAddr = ''
    let caption = ''
    let note = ''
    // 上一步释放掉的结点，这一步不再画
    nodes = nodes.filter((n) => n.state !== 'freed')
    if (op === 'new') {
      const addr = take()
      nodes.unshift({ v: arg, addr, next: '?', state: 'new' })
      q = addr
      ;[hi, hiAddr, caption] = ['node', addr, `申请结点q，放${arg}`]
    } else if (op === 'link') {
      nodes[0].next = S === 'NULL' ? '0' : S
      ;[hi, hiAddr, caption] = ['next', nodes[0].addr, 'q->next = *S']
    } else if (op === 'move') {
      S = q
      nodes[0].state = 'live'
      ;[hi, hiAddr, caption] = ['S', S, '*S = q']
    } else if (op === 'take') {
      q = S
      const top = nodes.find((n) => n.addr === S)!
      ;[hi, hiAddr, caption, note] = ['data', S, 'q = *S; *x = q->data', `x = ${top.v}`]
    } else if (op === 'next') {
      const top = nodes.find((n) => n.addr === q)!
      S = top.next === '0' ? 'NULL' : top.next
      ;[hi, caption] = ['S', '*S = q->next']
      hiAddr = S
    } else if (op === 'free') {
      const n = nodes.find((m) => m.addr === q)!
      n.state = 'freed'
      ;[hi, hiAddr, caption] = ['node', q, 'free(q)']
    } else if (op === 'push') {
      const addr = take()
      nodes.unshift({ v: arg, addr, next: S === 'NULL' ? '0' : S, state: 'live' })
      S = addr
      q = ''
      ;[hi, hiAddr, caption] = ['node', addr, `Push(S, ${arg})`]
    } else if (op === 'pop') {
      const top = live()[0]
      if (!top) throw new Error('LinkStackFigure: 空栈不能出栈')
      nodes = nodes.filter((n) => n !== top)
      S = nodes[0]?.addr ?? 'NULL'
      q = ''
      ;[caption, note] = ['Pop(S, &x)', `x = ${top.v}`]
    } else if (op === 'gettop') {
      const top = live()[0]
      ;[hi, hiAddr, caption, note] = ['data', top.addr, 'GetTop(S, &x)', `x = ${top.v}`]
    } else if (op === 'init') {
      nodes = []
      S = 'NULL'
      q = ''
      caption = 'InitStack(S)'
    } else {
      throw new Error(`LinkStackFigure: 看不懂的操作「${t}」`)
    }
    out.push({ nodes: clone(), S, q, hi, hiAddr, caption, note })
  }
  if (tokens[0] === 'init') out.shift()
  return out.slice(Number(props.skip) || 0)
})

const multi = computed(() => frames.value.length > 1)

// 几何
const W = 232
const nodeX = 72
const dataW = 34
const nextW = 44
const nodeH = 28
const rowGap = 54
const top0 = 10
const rows = computed(() => Math.max(3, ...frames.value.map((f) => f.nodes.length)))
const H = computed(() => top0 + (rows.value - 1) * rowGap + nodeH + 10)
const rowY = (r: number) => top0 + r * rowGap
const midY = (r: number) => rowY(r) + nodeH / 2

function rowOf(f: Frame, addr: string) {
  return f.nodes.findIndex((n) => n.addr === addr)
}
function label(f: Frame) {
  // 从 S 顺着地址格走，走得到的才在栈里
  const live: Node[] = []
  for (let n = f.nodes.find((m) => m.addr === f.S); n; n = f.nodes.find((m) => m.addr === n!.next)) live.push(n)
  return live.length ? `链栈：从栈顶到栈底是${live.map((n) => n.v).join('、')}` : '空的链栈'
}
</script>

<template>
  <div class="link-stack" :class="{ multi }">
    <figure v-for="(f, i) in frames" :key="i" class="ls-frame">
      <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="label(f)">
        <!-- 结点 -->
        <g v-for="(n, r) in f.nodes" :key="n.addr" class="node" :class="[n.state, { now: f.hi === 'node' && f.hiAddr === n.addr }]">
          <rect class="box" :x="nodeX" :y="rowY(r)" :width="dataW + nextW" :height="nodeH" />
          <rect v-if="f.hi === 'data' && f.hiAddr === n.addr" class="hi" :x="nodeX" :y="rowY(r)" :width="dataW" :height="nodeH" />
          <rect v-if="f.hi === 'next' && f.hiAddr === n.addr" class="hi" :x="nodeX + dataW" :y="rowY(r)" :width="nextW" :height="nodeH" />
          <line class="sep" :x1="nodeX + dataW" :y1="rowY(r)" :x2="nodeX + dataW" :y2="rowY(r) + nodeH" />
          <text class="v" :x="nodeX + dataW / 2" :y="midY(r) + 5" text-anchor="middle">{{ n.v }}</text>
          <text class="a" :x="nodeX + dataW + nextW / 2" :y="midY(r) + 4" text-anchor="middle">{{ n.next }}</text>
          <text class="own" :x="nodeX + dataW + nextW + 6" :y="midY(r) + 4">{{ n.addr }}</text>
          <!-- 地址格的箭头：指向下一个结点 -->
          <g v-if="n.next !== '0' && n.next !== '?' && rowOf(f, n.next) > r" class="arrow">
            <line :x1="nodeX + dataW + nextW / 2" :y1="rowY(r) + nodeH" :x2="nodeX + dataW + nextW / 2" :y2="rowY(rowOf(f, n.next)) - 5" />
            <polygon :points="`${nodeX + dataW + nextW / 2},${rowY(rowOf(f, n.next)) - 1} ${nodeX + dataW + nextW / 2 - 4},${rowY(rowOf(f, n.next)) - 8} ${nodeX + dataW + nextW / 2 + 4},${rowY(rowOf(f, n.next)) - 8}`" />
          </g>
          <text v-if="n.state === 'freed'" class="freed-note" :x="nodeX" :y="rowY(r) + nodeH + 14">已释放</text>
        </g>
        <!-- S：栈顶指针 -->
        <g class="ptr" :class="{ now: f.hi === 'S' }">
          <template v-if="f.S !== 'NULL'">
            <text x="4" :y="midY(rowOf(f, f.S)) + 4">S = {{ f.S }}</text>
            <line x1="56" :y1="midY(rowOf(f, f.S))" :x2="nodeX - 6" :y2="midY(rowOf(f, f.S))" />
            <polygon :points="`${nodeX - 2},${midY(rowOf(f, f.S))} ${nodeX - 9},${midY(rowOf(f, f.S)) - 4} ${nodeX - 9},${midY(rowOf(f, f.S)) + 4}`" />
          </template>
          <text v-else x="4" :y="midY(0) + 4">S = NULL</text>
        </g>
        <!-- q：右边 -->
        <g v-if="f.q && rowOf(f, f.q) >= 0" class="ptr q">
          <text :x="W - 4" :y="midY(rowOf(f, f.q)) + 4" text-anchor="end">◄ q</text>
        </g>
      </svg>
      <figcaption v-if="f.caption">
        <span class="op">{{ f.caption }}</span>
        <span v-if="f.note" class="note">{{ f.note }}</span>
      </figcaption>
    </figure>
  </div>
</template>

<style scoped>
.link-stack {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  margin: 16px 0;
}
.link-stack.multi {
  justify-content: flex-start;
  gap: 16px 12px;
}
.ls-frame {
  margin: 0;
  width: 240px;
  max-width: 100%;
  text-align: center;
}
/* 一行三张；窄屏一行两张 */
.multi .ls-frame {
  width: calc((100% - 24px) / 3);
}
/* 窄屏一行一张，字才看得清 */
@media (max-width: 480px) {
  .multi .ls-frame {
    width: 240px;
    margin: 0 auto;
  }
}
svg {
  display: block;
  width: 100%;
  height: auto;
}
.box {
  fill: var(--vp-c-bg-soft);
  stroke: var(--vp-c-text-1);
  stroke-width: 1.5;
}
.sep {
  stroke: var(--vp-c-text-1);
  stroke-width: 1.5;
}
.hi {
  fill: var(--vp-c-brand-soft);
  stroke: var(--vp-c-brand-1);
  stroke-width: 1.5;
}
.node.now .box,
.node.new .box {
  fill: var(--vp-c-brand-soft);
  stroke: var(--vp-c-brand-1);
}
.node.freed .box,
.node.freed .sep {
  fill: none;
  stroke: var(--vp-c-text-3);
  stroke-dasharray: 3 2;
}
.v {
  font-size: 16px;
  font-weight: 600;
  fill: var(--vp-c-text-1);
}
.a {
  font-size: 13px;
  fill: var(--vp-c-text-1);
}
.own {
  font-size: 12px;
  fill: var(--vp-c-text-3);
}
.node.freed .v,
.node.freed .a {
  fill: var(--vp-c-text-3);
  font-weight: 400;
}
.freed-note {
  font-size: 11px;
  fill: var(--vp-c-danger-1);
}
.arrow line {
  stroke: var(--vp-c-text-2);
  stroke-width: 1.5;
}
.arrow polygon {
  fill: var(--vp-c-text-2);
}
.node.freed .arrow line {
  stroke: var(--vp-c-text-3);
  stroke-dasharray: 3 2;
}
.ptr text {
  font-size: 14px;
  fill: var(--vp-c-text-1);
}
.ptr line {
  stroke: var(--vp-c-text-2);
  stroke-width: 1.5;
}
.ptr polygon {
  fill: var(--vp-c-text-2);
}
.ptr.now text {
  fill: var(--vp-c-brand-1);
  font-weight: 600;
}
.ptr.now line {
  stroke: var(--vp-c-brand-1);
}
.ptr.now polygon {
  fill: var(--vp-c-brand-1);
}
.ptr.q text {
  fill: var(--vp-c-text-2);
}
figcaption {
  display: flex;
  flex-direction: column;
  font-size: 13px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}
figcaption .op {
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-1);
  font-weight: 600;
}
</style>
