<script setup lang="ts">
import { computed } from 'vue'

/**
 * 一段横放的数组（二叉树的顺序存储）：格子里写值，下面标下标。纯静态 SVG。
 *
 * cells：每格的值，空格分开；`_` 是空着的格子（没有结点）。第一格的下标是 from。
 * from：第一格的下标，默认 1。
 * zero：在最前面多画一格下标 0，灰色、写"不用"（下标从 1 开始存时）。
 * hi：高亮的下标，空格分开。
 * arcs：格子上方的弧线箭头，`从-到` 空格分开，例如 `2-4 2-5`：从 2 号格指向 4 号格。
 * caption：图下面的一行说明。
 */
const props = withDefaults(
  defineProps<{
    cells: string
    from?: number | string
    zero?: boolean
    hi?: string
    arcs?: string
    caption?: string
  }>(),
  { from: 1, zero: false, hi: '', arcs: '', caption: '' },
)

const words = (v: string) => v.trim().split(/\s+/).filter(Boolean)
const cellW = 30
const cellH = 28
const left = 4

interface Cell {
  idx: number
  value: string
  empty: boolean
  zero: boolean
  x: number
}

const start = computed(() => Number(props.from) || 0)
const cells = computed<Cell[]>(() => {
  const out: Cell[] = []
  if (props.zero) out.push({ idx: 0, value: '', empty: true, zero: true, x: 0 })
  words(props.cells).forEach((v, k) => out.push({ idx: start.value + k, value: v === '_' ? '' : v, empty: v === '_', zero: false, x: 0 }))
  out.forEach((c, k) => (c.x = left + k * cellW))
  return out
})
const hiSet = computed(() => new Set(words(props.hi).map(Number)))
const byIdx = (i: number) => cells.value.find((c) => c.idx === i)

// 弧线：两格之间离得越远，拱得越高
const arcList = computed(() =>
  words(props.arcs).map((w) => {
    const [a, b] = w.split('-').map(Number)
    const p = byIdx(a)
    const q = byIdx(b)
    if (!p || !q) throw new Error(`ArrayFigure: arcs 里找不到下标「${w}」`)
    const x1 = p.x + cellW / 2
    const x2 = q.x + cellW / 2
    const h = Math.min(10 + Math.abs(x2 - x1) * 0.25, 40)
    return { x1, x2, h }
  }),
)
const top = computed(() => (arcList.value.length ? Math.ceil(Math.max(...arcList.value.map((a) => a.h))) + 8 : 4))
const W = computed(() => left * 2 + cells.value.length * cellW)
const H = computed(() => top.value + cellH + 20)

function arcPath(a: { x1: number; x2: number; h: number }) {
  const y = top.value - 2
  return `M ${a.x1} ${y} Q ${(a.x1 + a.x2) / 2} ${y - a.h * 2} ${a.x2} ${y}`
}
// 箭头落在目标格上边，方向沿着弧线的末端
function arcHead(a: { x1: number; x2: number; h: number }) {
  const y = top.value - 2
  const dx = (a.x2 - a.x1) / 2
  const dy = a.h * 2
  const len = Math.hypot(dx, dy) || 1
  const [ux, uy] = [dx / len, dy / len]
  const [bx, by] = [a.x2 - ux * 7, y - uy * 7]
  return `${a.x2},${y} ${bx - uy * 3.5},${by + ux * 3.5} ${bx + uy * 3.5},${by - ux * 3.5}`
}
const figW = computed(() => Math.max(W.value, props.caption ? [...props.caption].length * 13 + 8 : 0))
const aria = computed(() => `数组：${cells.value.map((c) => `${c.idx}号${c.zero ? '不用' : c.empty ? '空' : c.value}`).join('，')}`)
</script>

<template>
  <figure class="array-figure" :style="{ width: `${figW}px` }">
    <svg :viewBox="`0 0 ${W} ${H}`" :style="{ width: `${W}px` }" role="img" :aria-label="aria">
      <g v-for="(a, k) in arcList" :key="'a' + k" class="arc">
        <path :d="arcPath(a)" />
        <polygon :points="arcHead(a)" />
      </g>
      <g v-for="c in cells" :key="c.idx" class="cell" :class="{ hi: hiSet.has(c.idx), empty: c.empty, zero: c.zero }">
        <rect :x="c.x" :y="top" :width="cellW" :height="cellH" />
        <text class="val" :x="c.x + cellW / 2" :y="top + cellH / 2 + 5" text-anchor="middle">{{ c.zero ? '不用' : c.value }}</text>
        <text class="idx" :x="c.x + cellW / 2" :y="top + cellH + 15" text-anchor="middle">{{ c.idx }}</text>
      </g>
    </svg>
    <figcaption v-if="caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.array-figure {
  margin: 16px auto;
  max-width: 100%;
}
svg {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
}
rect {
  fill: var(--vp-c-bg-soft);
  stroke: var(--vp-c-text-1);
  stroke-width: 1.2;
}
.cell.empty rect {
  fill: transparent;
  stroke-dasharray: 3 3;
  stroke: var(--vp-c-text-3);
}
.cell.zero rect {
  fill: var(--vp-c-default-soft);
}
.cell.hi rect {
  fill: var(--vp-c-brand-soft);
  stroke: var(--vp-c-brand-1);
  stroke-width: 1.8;
  stroke-dasharray: none;
}
.val {
  font-size: 14px;
  fill: var(--vp-c-text-1);
}
.cell.zero .val {
  font-size: 10px;
  fill: var(--vp-c-text-3);
}
.cell.hi .val {
  font-weight: 600;
}
.idx {
  font-size: 12px;
  fill: var(--vp-c-text-2);
}
.cell.hi .idx {
  fill: var(--vp-c-brand-1);
  font-weight: 600;
}
.arc path {
  fill: none;
  stroke: var(--vp-c-brand-1);
  stroke-width: 1.5;
}
.arc polygon {
  fill: var(--vp-c-brand-1);
}
figcaption {
  margin-top: 4px;
  text-align: center;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
</style>
