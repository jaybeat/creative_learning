<script setup lang="ts">
import { computed } from 'vue'

/**
 * 邻接矩阵（第5章）：上面一行、左边一列是顶点编号，格子里是 0、1 或权。纯静态 SVG。
 *
 * cells：一行一行写，行之间用 `/` 分开，同一行的格子用空格分开，例如 `0 1 0/1 0 1/0 1 0`。
 *   `∞` 照写（也可以写 inf）。
 * heads：行列的标题，空格分开，默认 0、1、2……
 * hirow、hicol：高亮的行号、列号（从 0 数），空格分开。
 * hi：高亮的格子，`行,列` 空格分开，例如 `0,1 1,0`。
 * rowsum：在右边多加一列，写每行里"有边"的格子个数（不是 0、不是 ∞ 的格子），值是这一列的标题，例如 `度`。
 * colsum：在下面多加一行，写每列里"有边"的格子个数，值是这一行的标题，例如 `入度`。
 * caption：图下面的一行说明。
 */
const props = withDefaults(
  defineProps<{
    cells: string
    heads?: string
    hirow?: string
    hicol?: string
    hi?: string
    rowsum?: string
    colsum?: string
    caption?: string
  }>(),
  { heads: '', hirow: '', hicol: '', hi: '', rowsum: '', colsum: '', caption: '' },
)

const words = (v: string) => v.trim().split(/\s+/).filter(Boolean)
const cellW = 30
const cellH = 28
const top = 22

const rows = computed(() =>
  props.cells
    .split('/')
    .map((r) => words(r).map((v) => (v === 'inf' ? '∞' : v))),
)
const n = computed(() => rows.value.length)
const cols = computed(() => Math.max(...rows.value.map((r) => r.length)))
const heads = computed(() => {
  const h = words(props.heads)
  return h.length ? h : Array.from({ length: Math.max(n.value, cols.value) }, (_, i) => String(i))
})
const hiRows = computed(() => new Set(words(props.hirow).map(Number)))
const hiCols = computed(() => new Set(words(props.hicol).map(Number)))
const hiCells = computed(() => new Set(words(props.hi)))
const hasEdge = (v: string) => v !== '0' && v !== '∞' && v !== ''
const rowSums = computed(() => rows.value.map((r) => r.filter(hasEdge).length))
const colSums = computed(() => Array.from({ length: cols.value }, (_, j) => rows.value.filter((r) => hasEdge(r[j] ?? '')).length))

const sumW = computed(() => (props.rowsum ? Math.max(36, [...props.rowsum].length * 13 + 10) : 0))
const sumH = computed(() => (props.colsum ? cellH : 0))
const textW = (t: string) => [...t].reduce((a, c) => a + (/[　-鿿＀-￯]/.test(c) ? 13 : 8), 0)
// 左边一列标题有多宽，矩阵就从哪里开始
const gridX = computed(() => Math.max(...heads.value.map(textW), props.colsum ? textW(props.colsum) : 0) + 12)
const W = computed(() => gridX.value + cols.value * cellW + sumW.value + 4)
const H = computed(() => top + n.value * cellH + sumH.value + 4)
const cx = (j: number) => gridX.value + j * cellW
const cy = (i: number) => top + i * cellH
const inHi = (i: number, j: number) => hiRows.value.has(i) || hiCols.value.has(j) || hiCells.value.has(`${i},${j}`)
const strong = (i: number, j: number) => hiCells.value.has(`${i},${j}`)
const figW = computed(() => Math.max(W.value, props.caption ? [...props.caption].length * 13 + 8 : 0))
const aria = computed(() => `邻接矩阵：${rows.value.map((r, i) => `第${heads.value[i]}行 ${r.join(' ')}`).join('；')}`)
</script>

<template>
  <figure class="matrix-figure" :style="{ width: `${figW}px` }">
    <svg :viewBox="`0 0 ${W} ${H}`" :style="{ width: `${W}px` }" role="img" :aria-label="aria">
      <text
        v-for="j in cols"
        :key="'h' + j"
        class="head"
        :class="{ on: hiCols.has(j - 1) }"
        :x="cx(j - 1) + cellW / 2"
        :y="top - 7"
        text-anchor="middle"
      >{{ heads[j - 1] }}</text>
      <text
        v-for="i in n"
        :key="'r' + i"
        class="head"
        :class="{ on: hiRows.has(i - 1) }"
        :x="gridX - 8"
        :y="cy(i - 1) + cellH / 2 + 5"
        text-anchor="end"
      >{{ heads[i - 1] }}</text>
      <template v-for="(r, i) in rows" :key="'row' + i">
        <g v-for="(v, j) in r" :key="i + '-' + j" class="cell" :class="{ hi: inHi(i, j), strong: strong(i, j), diag: i === j }">
          <rect :x="cx(j)" :y="cy(i)" :width="cellW" :height="cellH" />
          <text :x="cx(j) + cellW / 2" :y="cy(i) + cellH / 2 + 5" text-anchor="middle" :class="{ one: hasEdge(v) }">{{ v }}</text>
        </g>
      </template>
      <template v-if="rowsum">
        <text class="sum-title" :x="cx(cols) + sumW / 2 + 2" :y="top - 7" text-anchor="middle">{{ rowsum }}</text>
        <text
          v-for="(s, i) in rowSums"
          :key="'s' + i"
          class="sum"
          :class="{ on: hiRows.has(i) }"
          :x="cx(cols) + sumW / 2 + 2"
          :y="cy(i) + cellH / 2 + 5"
          text-anchor="middle"
        >{{ s }}</text>
      </template>
      <template v-if="colsum">
        <text class="sum-title" :x="gridX - 8" :y="cy(n) + cellH / 2 + 5" text-anchor="end">{{ colsum }}</text>
        <text
          v-for="(s, j) in colSums"
          :key="'c' + j"
          class="sum"
          :class="{ on: hiCols.has(j) }"
          :x="cx(j) + cellW / 2"
          :y="cy(n) + cellH / 2 + 5"
          text-anchor="middle"
        >{{ s }}</text>
      </template>
    </svg>
    <figcaption v-if="caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.matrix-figure {
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
  fill: var(--vp-c-bg);
  stroke: var(--vp-c-divider);
  stroke-width: 1;
}
.cell.diag rect {
  fill: var(--vp-c-default-soft);
}
.cell.hi rect {
  fill: var(--vp-c-brand-soft);
}
.cell.strong rect {
  stroke: var(--vp-c-brand-1);
  stroke-width: 2;
}
.cell text {
  font-size: 14px;
  fill: var(--vp-c-text-3);
}
.cell text.one {
  fill: var(--vp-c-text-1);
  font-weight: 600;
}
.head {
  font-size: 12px;
  fill: var(--vp-c-text-2);
}
.head.on {
  fill: var(--vp-c-brand-1);
  font-weight: 700;
}
.sum-title {
  font-size: 12px;
  fill: var(--vp-c-text-2);
}
.sum {
  font-size: 14px;
  font-weight: 600;
  fill: var(--vp-c-text-1);
}
.sum.on {
  fill: var(--vp-c-brand-1);
}
figcaption {
  margin-top: 4px;
  text-align: center;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
</style>
