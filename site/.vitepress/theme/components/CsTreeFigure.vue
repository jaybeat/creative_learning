<script setup lang="ts">
import { computed } from 'vue'

/**
 * 孩子兄弟表示法的结点图（第4章）：向下的箭头是 first，向右的箭头是 next，没有箭头就是 NULL。纯静态 SVG。
 * 哪个结点放哪、谁连谁都直接写出来，所以一步一图时每张图只写这一步的样子。
 *
 * nodes：`名字@行,列`，空格分开。行列都从 0 数，比如 `工作@0,0 周报@1,0 合同@1,1`。
 * first、next：箭头，`从>到`，空格分开，比如 first="工作>周报" next="周报>合同"。
 * now：这一步刚改的箭头，写法同上，要同时写在 first 或 next 里，画成主题色。
 * hi：高亮的结点名。gone：已经释放的结点名，画成灰色虚线框。
 * ptr：指针变量，`变量>结点`，写在结点上方，比如 ptr="q>周报 p>工作"。
 * caption：图下面的一行说明。
 */
const props = withDefaults(
  defineProps<{ nodes: string; first?: string; next?: string; now?: string; hi?: string; gone?: string; ptr?: string; caption?: string }>(),
  { first: '', next: '', now: '', hi: '', gone: '', ptr: '', caption: '' },
)

const words = (v: string) => v.trim().split(/\s+/).filter(Boolean)
const pairs = (v: string) =>
  words(v).map((w) => {
    const k = w.indexOf('>')
    return [w.slice(0, k), w.slice(k + 1)] as const
  })

const cellW = 72
const cellH = 60
const boxW = 60
const boxH = 28
const left = 4
const top = 24

const nodes = computed(() =>
  words(props.nodes).map((w) => {
    const at = w.lastIndexOf('@')
    const [r, c] = w.slice(at + 1).split(',').map(Number)
    return { name: w.slice(0, at), x: left + c * cellW + boxW / 2, y: top + r * cellH + boxH / 2, c, r }
  }),
)
const W = computed(() => left * 2 + Math.max(...nodes.value.map((n) => n.c)) * cellW + boxW)
const H = computed(() => top + Math.max(...nodes.value.map((n) => n.r)) * cellH + boxH + 6)
const find = (name: string) => {
  const n = nodes.value.find((m) => m.name === name)
  if (!n) throw new Error(`CsTreeFigure: 找不到结点「${name}」`)
  return n
}
const hiSet = computed(() => new Set(words(props.hi)))
const goneSet = computed(() => new Set(words(props.gone)))
const nowSet = computed(() => new Set(words(props.now)))

// 箭头从起点框的边出发，到终点框的边为止（从中心连线，在框上裁掉）
function clip(dx: number, dy: number) {
  const tx = dx ? boxW / 2 / Math.abs(dx) : Infinity
  const ty = dy ? boxH / 2 / Math.abs(dy) : Infinity
  return Math.min(tx, ty)
}
const arrows = computed(() =>
  [...pairs(props.first), ...pairs(props.next)].map(([a, b]) => {
    const p = find(a)
    const q = find(b)
    const dx = q.x - p.x
    const dy = q.y - p.y
    const t = clip(dx, dy)
    const x1 = p.x + dx * t
    const y1 = p.y + dy * t
    const x2 = q.x - dx * t
    const y2 = q.y - dy * t
    const ang = Math.atan2(dy, dx)
    const tip = (d: number, r: number) => `${x2 - Math.cos(ang + r) * d},${y2 - Math.sin(ang + r) * d}`
    return {
      key: `${a}>${b}`,
      now: nowSet.value.has(`${a}>${b}`),
      x1,
      y1,
      x2: x2 - Math.cos(ang) * 4,
      y2: y2 - Math.sin(ang) * 4,
      head: `${x2},${y2} ${tip(8, 0.45)} ${tip(8, -0.45)}`,
    }
  }),
)
const ptrs = computed(() => pairs(props.ptr).map(([v, b]) => ({ v, n: find(b) })))
const aria = computed(() => {
  const f = pairs(props.first).map(([a, b]) => `${a}的第一个孩子是${b}`)
  const n = pairs(props.next).map(([a, b]) => `${a}的下一个兄弟是${b}`)
  return `孩子兄弟表示法：${[...f, ...n].join('，')}`
})
</script>

<template>
  <figure class="cs-tree" :style="{ width: `${W}px` }">
    <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="aria">
      <g v-for="a in arrows" :key="a.key" class="arrow" :class="{ now: a.now }">
        <line :x1="a.x1" :y1="a.y1" :x2="a.x2" :y2="a.y2" />
        <polygon :points="a.head" />
      </g>
      <g v-for="n in nodes" :key="n.name" class="node" :class="{ hi: hiSet.has(n.name), gone: goneSet.has(n.name) }">
        <rect :x="n.x - boxW / 2" :y="n.y - boxH / 2" :width="boxW" :height="boxH" rx="4" />
        <text :x="n.x" :y="n.y + 5" text-anchor="middle">{{ n.name }}</text>
      </g>
      <g v-for="p in ptrs" :key="p.v" class="ptr">
        <text :x="p.n.x" :y="p.n.y - boxH / 2 - 8" text-anchor="middle">{{ p.v }}</text>
      </g>
    </svg>
    <figcaption v-if="caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.cs-tree {
  margin: 16px auto;
  max-width: 100%;
  text-align: center;
}
svg {
  display: block;
  width: 100%;
  height: auto;
}
.node rect {
  fill: var(--vp-c-bg-soft);
  stroke: var(--vp-c-text-1);
  stroke-width: 1.5;
}
.node.hi rect {
  fill: var(--vp-c-brand-soft);
  stroke: var(--vp-c-brand-1);
}
.node.gone rect {
  fill: none;
  stroke: var(--vp-c-text-3);
  stroke-dasharray: 3 2;
}
.node text {
  font-size: 13px;
  fill: var(--vp-c-text-1);
}
.node.gone text {
  fill: var(--vp-c-text-3);
}
.arrow line {
  stroke: var(--vp-c-text-2);
  stroke-width: 1.5;
}
.arrow polygon {
  fill: var(--vp-c-text-2);
}
.arrow.now line {
  stroke: var(--vp-c-brand-1);
  stroke-width: 2.5;
}
.arrow.now polygon {
  fill: var(--vp-c-brand-1);
}
.ptr text {
  font-size: 13px;
  font-weight: 600;
  fill: var(--vp-c-brand-1);
}
figcaption {
  font-size: 13px;
  line-height: 1.5;
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-1);
}
</style>
