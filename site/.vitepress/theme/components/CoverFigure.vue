<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

/**
 * 封面图：上层四种逻辑结构（线性 / 树形 / 图 / 集合），下层一排内存格子，
 * 左段连续的格子是顺序存储（位置表示关系），右段散落的格子 + 箭头是链式存储（地址表示关系）。
 * SSR 与首帧都是静态全图；挂载后每 4 秒轮流高亮一种结构，并重放格子落入内存的动画。
 * 用户要求减少动效时不轮播；标签页不可见时暂停。
 */
type Pt = [number, number]
interface Structure {
  nodes: Pt[]
  edges: [number, number][]
}

const structures: Structure[] = [
  // 线性：一对一
  { nodes: [[24, 88], [52, 88], [80, 88], [108, 88]], edges: [[0, 1], [1, 2], [2, 3]] },
  // 树形：一对多
  {
    nodes: [[184, 46], [158, 86], [210, 86], [142, 126], [174, 126]],
    edges: [[0, 1], [0, 2], [1, 3], [1, 4]],
  },
  // 图：多对多，有环
  {
    nodes: [[276, 52], [332, 52], [276, 118], [332, 118], [304, 85]],
    edges: [[0, 1], [0, 2], [1, 3], [2, 3], [0, 4], [4, 3]],
  },
  // 集合：只有「属于同一个集合」
  { nodes: [[412, 64], [444, 76], [404, 104], [436, 112], [424, 88]], edges: [] },
]
/** 集合的外框 */
const setRing = { cx: 424, cy: 88, rx: 40, ry: 42 }

/** 每种结构汇入内存的淡线：[结构底部, 内存条顶部] */
const funnels: [Pt, Pt][] = [
  [[66, 150], [156, 226]],
  [[184, 150], [220, 226]],
  [[304, 150], [268, 226]],
  [[424, 150], [332, 226]],
]

// 内存：一排 16 个格子
const CELL = 28
const MEM_X = 16
const MEM_Y = 236
const cells = Array.from({ length: 16 }, (_, i) => MEM_X + i * CELL)
/** 顺序存储：连续的 4 格 */
const seq = [1, 2, 3, 4]
/** 链式存储：散落的 3 格，箭头依次相连 */
const linked = [7, 10, 14]
const cx = (i: number) => MEM_X + i * CELL + CELL / 2
/** 链式箭头：从格子底部弧形连到下一格底部 */
const arrows = linked.slice(0, -1).map((from, k) => {
  const to = linked[k + 1]
  const x1 = cx(from)
  const x2 = cx(to) - 4
  const y = MEM_Y + CELL
  return `M ${x1} ${y} Q ${(x1 + x2) / 2} ${y + 34} ${x2} ${y + 6}`
})

const active = ref<number | null>(null)
const cycle = ref(0)
const animating = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

function tick(): void {
  active.value = ((active.value ?? -1) + 1) % structures.length
  cycle.value++
}
function start(): void {
  if (timer) return
  tick()
  timer = setInterval(tick, 4000)
}
function stop(): void {
  clearInterval(timer)
  timer = undefined
}
function onVisibility(): void {
  if (document.hidden) stop()
  else start()
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  animating.value = true
  start()
  document.addEventListener('visibilitychange', onVisibility)
})
onUnmounted(() => {
  stop()
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <svg
    class="cover-figure"
    :class="{ 'is-animating': animating }"
    viewBox="0 0 480 320"
    role="img"
    aria-labelledby="cover-figure-title"
  >
    <title id="cover-figure-title">四种逻辑结构（线性、树形、图、集合）放进一排内存格子：连续存放的顺序存储，与用地址相连的链式存储</title>
    <defs>
      <marker id="cf-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 8 4 L 0 8 z" class="cf-arrowhead" />
      </marker>
    </defs>

    <!-- 汇入内存的淡线 -->
    <g class="cf-funnels">
      <line
        v-for="(f, i) in funnels"
        :key="i"
        :class="{ on: active === i }"
        :x1="f[0][0]"
        :y1="f[0][1]"
        :x2="f[1][0]"
        :y2="f[1][1]"
      />
    </g>

    <!-- 上层：四种逻辑结构 -->
    <g
      v-for="(s, i) in structures"
      :key="i"
      class="cf-structure"
      :class="{ on: active === i, off: active !== null && active !== i }"
    >
      <ellipse v-if="i === 3" class="cf-ring" v-bind="setRing" />
      <line
        v-for="([a, b], j) in s.edges"
        :key="j"
        class="cf-edge"
        :x1="s.nodes[a][0]"
        :y1="s.nodes[a][1]"
        :x2="s.nodes[b][0]"
        :y2="s.nodes[b][1]"
      />
      <circle v-for="(n, j) in s.nodes" :key="j" class="cf-node" :cx="n[0]" :cy="n[1]" r="6" />
    </g>

    <!-- 下层：一排内存格子 -->
    <g class="cf-memory">
      <rect v-for="(x, i) in cells" :key="i" class="cf-cell" :x="x" :y="MEM_Y" :width="CELL" :height="CELL" />
    </g>
    <!-- 数据落进格子；cycle 变化时整组重建，动画重放 -->
    <g :key="cycle" class="cf-data">
      <rect
        v-for="(c, k) in seq"
        :key="'s' + c"
        class="cf-fill cf-seq"
        :style="{ animationDelay: `${k * 0.12}s` }"
        :x="MEM_X + c * CELL + 4"
        :y="MEM_Y + 4"
        :width="CELL - 8"
        :height="CELL - 8"
      />
      <rect
        v-for="(c, k) in linked"
        :key="'l' + c"
        class="cf-fill cf-link"
        :style="{ animationDelay: `${0.6 + k * 0.12}s` }"
        :x="MEM_X + c * CELL + 4"
        :y="MEM_Y + 4"
        :width="CELL - 8"
        :height="CELL - 8"
      />
      <path
        v-for="(d, k) in arrows"
        :key="'a' + k"
        class="cf-pointer"
        :style="{ animationDelay: `${1 + k * 0.25}s` }"
        :d="d"
        pathLength="1"
        marker-end="url(#cf-arrow)"
      />
    </g>
  </svg>
</template>
