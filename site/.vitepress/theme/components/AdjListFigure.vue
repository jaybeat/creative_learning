<script setup lang="ts">
import { computed } from 'vue'

/**
 * 邻接表（第5章）：左边竖排的顶点表，每一项是一格 firstarc（给了 data 时是"data | firstarc"）；后面跟一串边结点"adjvex | nextarc"，最后一个写 ∧。
 * 纯静态 SVG。
 *
 * lists：每个顶点的边结点，按顶点编号一个顶点一段，段之间用 `/` 分开；段里按链上的先后写邻接点的编号，空格分开。
 *   没有边的顶点写空段。带权时写 `邻接点:权`，边结点多画一格权。例如 `1 3/0 2 4/1:5`。
 * data：顶点表里 data 那一格写什么，空格分开。不给就不画 data 这一格，顶点表只是一列指针（顶点只有编号时）。
 * fields：在第一行上面标出各格的名字（data、firstarc、adjvex、nextarc、权）。
 * hirow：高亮的顶点编号（整行：顶点和它的整条链），空格分开。
 * hinode：高亮的边结点，`顶点.第几个`（都从 0 数），空格分开，例如 `0.1`。
 * hiadj：高亮 adjvex 等于这些编号的全部边结点，空格分开（数入度时用）。
 * caption：图下面的一行说明。
 */
const props = withDefaults(
  defineProps<{
    lists: string
    data?: string
    fields?: boolean
    hirow?: string
    hinode?: string
    hiadj?: string
    caption?: string
  }>(),
  { data: '', fields: false, hirow: '', hinode: '', hiadj: '', caption: '' },
)

const words = (v: string) => v.trim().split(/\s+/).filter(Boolean)
const idxW = 18
const ptrW = 22
const valW = 28
const gap = 20
const rowH = 28
const rowGap = 10

const lists = computed(() =>
  props.lists.split('/').map((seg) =>
    words(seg).map((w) => {
      const k = w.indexOf(':')
      return k < 0 ? { adj: w, w: '' } : { adj: w.slice(0, k), w: w.slice(k + 1) }
    }),
  ),
)
const hasData = computed(() => props.data.trim() !== '')
// 没有 data 时，顶点表那一格宽一点，上面的字段名才放得下
const dataW = computed(() => (hasData.value ? 30 : 0))
const vPtrW = computed(() => (hasData.value ? ptrW : 28))
const weighted = computed(() => lists.value.some((l) => l.some((e) => e.w)))
const dataList = computed(() => {
  const d = words(props.data)
  return lists.value.map((_, i) => d[i] ?? String(i))
})
const nodeW = computed(() => valW + (weighted.value ? valW : 0) + ptrW)
const top = computed(() => (props.fields ? 22 : 4))
const vx = idxW
const chainX = computed(() => vx + dataW.value + vPtrW.value + gap)
const nodeX = (k: number) => chainX.value + k * (nodeW.value + gap)
const rowY = (i: number) => top.value + i * (rowH + rowGap)
const maxLen = computed(() => Math.max(0, ...lists.value.map((l) => l.length)))
const W = computed(() => nodeX(maxLen.value) - gap + 4)
const H = computed(() => rowY(lists.value.length) - rowGap + 4)

const hiRows = computed(() => new Set(words(props.hirow).map(Number)))
const hiNodes = computed(() => new Set(words(props.hinode)))
const hiAdj = computed(() => new Set(words(props.hiadj)))
const nodeOn = (i: number, k: number, adj: string) => hiRows.value.has(i) || hiNodes.value.has(`${i}.${k}`) || hiAdj.value.has(adj)

// 从一格指针的中心画到下一个格子的左边
function arrow(x1: number, y: number, x2: number) {
  return { d: `M ${x1} ${y} H ${x2 - 1}`, head: `${x2},${y} ${x2 - 7},${y - 3.5} ${x2 - 7},${y + 3.5}` }
}
const figW = computed(() => Math.max(W.value, props.caption ? [...props.caption].length * 13 + 8 : 0))
const aria = computed(
  () =>
    `邻接表：${lists.value
      .map((l, i) => `顶点${dataList.value[i]}：${l.length ? l.map((e) => e.adj + (e.w ? `（${e.w}）` : '')).join('、') : '没有边'}`)
      .join('；')}`,
)
</script>

<template>
  <figure class="adjlist-figure" :style="{ width: `${figW}px` }">
    <svg :viewBox="`0 0 ${W} ${H}`" :style="{ width: `${W}px` }" role="img" :aria-label="aria">
      <g v-if="fields" class="fields">
        <template v-if="hasData">
          <text :x="vx + dataW / 2" :y="14" text-anchor="middle">data</text>
          <text :x="vx + dataW + 1" :y="14" text-anchor="start">firstarc</text>
        </template>
        <text v-else :x="vx + vPtrW / 2" :y="14" text-anchor="middle">firstarc</text>
        <template v-if="maxLen">
          <text :x="chainX + valW / 2" :y="14" text-anchor="middle">adjvex</text>
          <text v-if="weighted" :x="chainX + valW * 1.5" :y="14" text-anchor="middle">权</text>
          <text :x="chainX + nodeW - ptrW + 3" :y="14" text-anchor="start">nextarc</text>
        </template>
      </g>
      <g v-for="(l, i) in lists" :key="'r' + i" class="row" :class="{ on: hiRows.has(i) }">
        <text class="idx" :x="idxW - 6" :y="rowY(i) + rowH / 2 + 5" text-anchor="end">{{ i }}</text>
        <g class="vertex">
          <rect v-if="hasData" :x="vx" :y="rowY(i)" :width="dataW" :height="rowH" />
          <rect class="ptr" :x="vx + dataW" :y="rowY(i)" :width="vPtrW" :height="rowH" />
          <text v-if="hasData" class="val" :x="vx + dataW / 2" :y="rowY(i) + rowH / 2 + 5" text-anchor="middle">{{ dataList[i] }}</text>
          <text v-if="!l.length" class="nil" :x="vx + dataW + vPtrW / 2" :y="rowY(i) + rowH / 2 + 5" text-anchor="middle">∧</text>
          <template v-else>
            <circle class="dot" :cx="vx + dataW + vPtrW / 2" :cy="rowY(i) + rowH / 2" r="2.5" />
            <g class="link">
              <path :d="arrow(vx + dataW + vPtrW / 2, rowY(i) + rowH / 2, chainX).d" />
              <polygon :points="arrow(vx + dataW + vPtrW / 2, rowY(i) + rowH / 2, chainX).head" />
            </g>
          </template>
        </g>
        <g v-for="(e, k) in l" :key="'n' + k" class="enode" :class="{ on: nodeOn(i, k, e.adj) }">
          <rect :x="nodeX(k)" :y="rowY(i)" :width="valW" :height="rowH" />
          <text class="val" :x="nodeX(k) + valW / 2" :y="rowY(i) + rowH / 2 + 5" text-anchor="middle">{{ e.adj }}</text>
          <template v-if="weighted">
            <rect :x="nodeX(k) + valW" :y="rowY(i)" :width="valW" :height="rowH" />
            <text class="wt" :x="nodeX(k) + valW * 1.5" :y="rowY(i) + rowH / 2 + 5" text-anchor="middle">{{ e.w }}</text>
          </template>
          <rect class="ptr" :x="nodeX(k) + nodeW - ptrW" :y="rowY(i)" :width="ptrW" :height="rowH" />
          <text v-if="k === l.length - 1" class="nil" :x="nodeX(k) + nodeW - ptrW / 2" :y="rowY(i) + rowH / 2 + 5" text-anchor="middle">∧</text>
          <template v-else>
            <circle class="dot" :cx="nodeX(k) + nodeW - ptrW / 2" :cy="rowY(i) + rowH / 2" r="2.5" />
            <g class="link">
              <path :d="arrow(nodeX(k) + nodeW - ptrW / 2, rowY(i) + rowH / 2, nodeX(k + 1)).d" />
              <polygon :points="arrow(nodeX(k) + nodeW - ptrW / 2, rowY(i) + rowH / 2, nodeX(k + 1)).head" />
            </g>
          </template>
        </g>
      </g>
    </svg>
    <figcaption v-if="caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.adjlist-figure {
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
rect.ptr {
  fill: var(--vp-c-bg);
}
.vertex rect {
  fill: var(--vp-c-default-soft);
}
.vertex rect.ptr {
  fill: var(--vp-c-bg);
}
.row.on .vertex rect,
.enode.on rect {
  fill: var(--vp-c-brand-soft);
  stroke: var(--vp-c-brand-1);
  stroke-width: 1.8;
}
.row.on .vertex rect.ptr,
.enode.on rect.ptr {
  fill: var(--vp-c-bg);
}
.val {
  font-size: 14px;
  fill: var(--vp-c-text-1);
}
.enode.on .val,
.row.on .vertex .val {
  font-weight: 700;
}
.wt {
  font-size: 13px;
  fill: var(--vp-c-text-2);
}
.idx {
  font-size: 12px;
  fill: var(--vp-c-text-3);
}
.row.on .idx {
  fill: var(--vp-c-brand-1);
  font-weight: 700;
}
.nil {
  font-size: 13px;
  fill: var(--vp-c-text-2);
}
.dot {
  fill: var(--vp-c-text-2);
}
.link path {
  fill: none;
  stroke: var(--vp-c-text-2);
  stroke-width: 1.5;
}
.link polygon {
  fill: var(--vp-c-text-2);
}
.fields text {
  font-size: 10px;
  fill: var(--vp-c-text-3);
}
figcaption {
  margin-top: 4px;
  text-align: center;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
</style>
