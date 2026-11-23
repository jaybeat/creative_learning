<script setup lang="ts">
import { computed } from 'vue'

/**
 * 图的示意图（第5章）：顶点画成圆，边画成线，有向的弧带箭头。纯静态 SVG。
 * 顶点放在哪里直接写出来，所以同一张图在不同页里位置不变。
 *
 * nodes：`名字@x,y`，空格分开。x、y 是格子坐标（可以带小数），一格约 64 像素，例如 `小王@1,0 小张@0,1`。
 * edges：边，空格分开。`甲-乙` 是无向边，`甲>乙` 是从甲指向乙的弧；后面加 `:数` 是权，例如 `家-超市:300`。
 *   甲>乙、乙>甲 同时出现时，两条弧各往一边弯，不重叠。
 * hi：高亮的顶点名，空格分开。
 * hiedges：高亮的边，写法同 edges（不写权）。
 * path：一条路径，顶点名按走的顺序空格分开，路上的边和顶点都加粗；首尾相同就是一个环。
 * dim：画成灰色虚线的顶点名（比如还没加入的人）。
 * label：顶点旁边的小字，`名:文字` 空格分开，例如 `小王:2 小李:3`。
 * caption：图下面的一行说明。
 */
const props = withDefaults(
  defineProps<{
    nodes: string
    edges?: string
    hi?: string
    hiedges?: string
    path?: string
    dim?: string
    label?: string
    caption?: string
  }>(),
  { edges: '', hi: '', hiedges: '', path: '', dim: '', label: '', caption: '' },
)

const words = (v: string) => v.trim().split(/\s+/).filter(Boolean)
const unit = 64
const pad = 8
const textW = (t: string) => [...t].reduce((a, c) => a + (/[　-鿿＀-￯]/.test(c) ? 14 : 8), 0)

interface Node {
  name: string
  gx: number
  gy: number
  r: number
  x: number
  y: number
}
interface Edge {
  a: Node
  b: Node
  dir: boolean
  w: string
  key: string
}

const rawNodes = computed(() =>
  words(props.nodes).map((w) => {
    const k = w.lastIndexOf('@')
    if (k < 0) throw new Error(`GraphFigure: nodes 里「${w}」要写成 名字@x,y`)
    const name = w.slice(0, k)
    const [gx, gy] = w.slice(k + 1).split(',').map(Number)
    if (Number.isNaN(gx) || Number.isNaN(gy)) throw new Error(`GraphFigure: nodes 里「${w}」的坐标不对`)
    return { name, gx, gy, r: Math.max(15, textW(name) / 2 + 8) }
  }),
)
const labels = computed(() => {
  const m = new Map<string, string>()
  for (const w of words(props.label)) {
    const k = w.indexOf(':')
    m.set(w.slice(0, k), w.slice(k + 1))
  }
  return m
})
const maxR = computed(() => Math.max(15, ...rawNodes.value.map((n) => n.r)))
// 四周留够半径，再给右上角的小字留地方
const margin = computed(() => maxR.value + pad + (labels.value.size ? 14 : 0))
const minX = computed(() => Math.min(...rawNodes.value.map((n) => n.gx)))
const minY = computed(() => Math.min(...rawNodes.value.map((n) => n.gy)))
const nodes = computed<Node[]>(() =>
  rawNodes.value.map((n) => ({
    ...n,
    x: margin.value + (n.gx - minX.value) * unit,
    y: margin.value + (n.gy - minY.value) * unit,
  })),
)
const byName = (s: string) => {
  const n = nodes.value.find((m) => m.name === s)
  if (!n) throw new Error(`GraphFigure: 找不到顶点「${s}」`)
  return n
}

function parseEdge(w: string) {
  const c = w.indexOf(':')
  const body = c < 0 ? w : w.slice(0, c)
  const wt = c < 0 ? '' : w.slice(c + 1)
  const m = body.match(/^(.+?)([->])(.+)$/)
  if (!m) throw new Error(`GraphFigure: 边「${w}」要写成 甲-乙 或 甲>乙`)
  return { a: m[1], b: m[3], dir: m[2] === '>', w: wt }
}
const edgeKey = (a: string, b: string, dir: boolean) => (dir ? `${a}>${b}` : [a, b].sort().join('-'))

const edges = computed<Edge[]>(() =>
  words(props.edges).map((w) => {
    const e = parseEdge(w)
    return { a: byName(e.a), b: byName(e.b), dir: e.dir, w: e.w, key: edgeKey(e.a, e.b, e.dir) }
  }),
)
const keySet = computed(() => new Set(edges.value.map((e) => e.key)))
const hiEdgeSet = computed(() => {
  const s = new Set<string>()
  for (const w of words(props.hiedges)) {
    const e = parseEdge(w)
    s.add(edgeKey(e.a, e.b, e.dir))
  }
  // 路径上相邻两个顶点之间的边：有向图里顺着箭头找，找不到再当无向边
  const p = words(props.path)
  for (let i = 0; i + 1 < p.length; i++) {
    const d = edgeKey(p[i], p[i + 1], true)
    s.add(keySet.value.has(d) ? d : edgeKey(p[i], p[i + 1], false))
  }
  return s
})
const pathSet = computed(() => new Set(words(props.path)))
const hiSet = computed(() => new Set(words(props.hi)))
const dimSet = computed(() => new Set(words(props.dim)))

// 甲>乙、乙>甲 都有时往两边弯
const bendOf = (e: Edge) => (e.dir && keySet.value.has(`${e.b.name}>${e.a.name}`) ? 14 : 0)

function geom(e: Edge) {
  const { a, b } = e
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const [ux, uy] = [dx / len, dy / len]
  // 法向量（顺时针），弯曲往这一边
  const [nx, ny] = [-uy, ux]
  const h = bendOf(e)
  // 弯线的控制点；直线时就是中点
  const mx = (a.x + b.x) / 2 + nx * h * 2
  const my = (a.y + b.y) / 2 + ny * h * 2
  // 起点、终点落在圆周上：弯线时沿着朝控制点的方向出、从控制点的方向进
  const unitTo = (x: number, y: number) => {
    const l = Math.hypot(x, y) || 1
    return [x / l, y / l]
  }
  const [s1, s2] = h ? unitTo(mx - a.x, my - a.y) : [ux, uy]
  const [t1, t2] = h ? unitTo(b.x - mx, b.y - my) : [ux, uy]
  const sx = a.x + s1 * a.r
  const sy = a.y + s2 * a.r
  const ex = b.x - t1 * b.r
  const ey = b.y - t2 * b.r
  return { sx, sy, ex, ey, mx, my, ux, uy, nx, ny, h }
}
function edgePath(e: Edge) {
  const g = geom(e)
  if (!g.h) return `M ${g.sx} ${g.sy} L ${g.ex} ${g.ey}`
  return `M ${g.sx} ${g.sy} Q ${g.mx} ${g.my} ${g.ex} ${g.ey}`
}
function arrowHead(e: Edge) {
  const g = geom(e)
  // 箭头方向：直线沿边，弯线沿控制点到终点
  let [tx, ty] = [g.ux, g.uy]
  if (g.h) {
    const dx = g.ex - g.mx
    const dy = g.ey - g.my
    const l = Math.hypot(dx, dy) || 1
    ;[tx, ty] = [dx / l, dy / l]
  }
  const [bx, by] = [g.ex - tx * 9, g.ey - ty * 9]
  return `${g.ex},${g.ey} ${bx - ty * 4},${by + tx * 4} ${bx + ty * 4},${by - tx * 4}`
}
// 权写在边的中点，往法向挪开一点，免得压在线上
function weightPos(e: Edge) {
  const g = geom(e)
  const cx = g.h ? (g.sx + 2 * g.mx + g.ex) / 4 : (e.a.x + e.b.x) / 2
  const cy = g.h ? (g.sy + 2 * g.my + g.ey) / 4 : (e.a.y + e.b.y) / 2
  return { x: cx + g.nx * 10, y: cy + g.ny * 10 + 4 }
}

const W = computed(() => Math.max(...nodes.value.map((n) => n.x)) + margin.value)
const H = computed(() => Math.max(...nodes.value.map((n) => n.y)) + margin.value)
const figW = computed(() => Math.max(W.value, props.caption ? [...props.caption].length * 13 + 8 : 0))
const aria = computed(() => {
  const v = nodes.value.map((n) => n.name).join('、')
  const e = edges.value.map((x) => `${x.a.name}${x.dir ? '指向' : '和'}${x.b.name}${x.w ? `（${x.w}）` : ''}`).join('，')
  return `图：顶点${v}${e ? `；边：${e}` : '；没有边'}`
})
</script>

<template>
  <figure class="graph-figure" :style="{ width: `${figW}px` }">
    <svg :viewBox="`0 0 ${W} ${H}`" :style="{ width: `${W}px` }" role="img" :aria-label="aria">
      <g v-for="e in edges" :key="e.key" class="edge" :class="{ on: hiEdgeSet.has(e.key) }">
        <path :d="edgePath(e)" />
        <polygon v-if="e.dir" :points="arrowHead(e)" />
      </g>
      <text v-for="e in edges.filter((x) => x.w)" :key="'w' + e.key" class="weight" :x="weightPos(e).x" :y="weightPos(e).y" text-anchor="middle">{{ e.w }}</text>
      <g
        v-for="n in nodes"
        :key="n.name"
        class="node"
        :class="{ hi: hiSet.has(n.name), on: pathSet.has(n.name), dim: dimSet.has(n.name) }"
      >
        <circle :cx="n.x" :cy="n.y" :r="n.r" />
        <text class="name" :x="n.x" :y="n.y + 5" text-anchor="middle">{{ n.name }}</text>
        <text v-if="labels.has(n.name)" class="tag" :x="n.x + n.r * 0.75" :y="n.y - n.r * 0.75 - 2" text-anchor="start">{{ labels.get(n.name) }}</text>
      </g>
    </svg>
    <figcaption v-if="caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.graph-figure {
  margin: 16px auto;
  max-width: 100%;
}
svg {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
}
.edge path {
  fill: none;
  stroke: var(--vp-c-text-2);
  stroke-width: 1.5;
}
.edge polygon {
  fill: var(--vp-c-text-2);
}
.edge.on path {
  stroke: var(--vp-c-brand-1);
  stroke-width: 3;
}
.edge.on polygon {
  fill: var(--vp-c-brand-1);
}
.node circle {
  fill: var(--vp-c-bg-soft);
  stroke: var(--vp-c-text-1);
  stroke-width: 1.2;
}
.node.hi circle,
.node.on circle {
  fill: var(--vp-c-brand-soft);
  stroke: var(--vp-c-brand-1);
  stroke-width: 2;
}
.node.dim circle {
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
.tag,
.weight {
  font-size: 12px;
  font-weight: 600;
  paint-order: stroke;
  stroke: var(--vp-c-bg);
  stroke-width: 3px;
}
.tag {
  fill: var(--vp-c-brand-1);
}
.weight {
  fill: var(--vp-c-text-1);
}
figcaption {
  margin-top: 4px;
  text-align: center;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
</style>
