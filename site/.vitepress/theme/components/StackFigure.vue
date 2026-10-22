<script setup lang="ts">
import { computed } from 'vue'

/**
 * 栈的示意图（同教材图 3.1(a)）：一个竖立、上面开口的容器，元素从下往上叠。纯静态 SVG。
 *
 * items：开始时栈里的元素，空格分开，从栈底到栈顶，例如 `1 2 3`。
 * ops：一串操作，空格分开；给了 ops 就画一排小图（第一张是调用前，之后每个操作一张）：
 *   `push:3` 入栈 3；`pop` 出栈；`calc:*` 弹出两个数算好放回（后缀式求值）；`gettop` 取栈顶；`empty` 判空；`init` 初始化成空栈。
 *   顺序栈的分步：`set:2=3` 只做 data[2] = 3；`top:3` 只做 top = 3；`read:2` 只做 x = data[2]。
 * capacity：画成数组（顺序栈）：画出 capacity 个格子和下标，出栈后格子里的旧值留着、变灰。
 * top：在右边画 top 箭头，指向下一个空格（top 等于元素个数）。只在 capacity 模式下有意义。
 * skip：去掉前几张小图，只画后面的（例如某一步只画这一步做完的样子）。
 * labels：自己写每张小图下面的说明，用 | 分开，和画出来的小图一一对应（skip 之后的）；一张里用 ~ 换行。给了 labels 就不再显示默认的 Push(S, 3)、x = 3。
 * bare：不画进栈、出栈箭头（逐步小图默认不画，单张图默认画）。
 */
const props = withDefaults(
  defineProps<{ items?: string; ops?: string; capacity?: number | string; top?: boolean; bare?: boolean; skip?: number | string; labels?: string }>(),
  { items: '', ops: '', capacity: 0, top: false, bare: undefined, skip: 0, labels: '' },
)

type Kind = 'start' | 'push' | 'pop' | 'gettop' | 'empty' | 'init' | 'set' | 'top' | 'read' | 'calc'
interface Frame {
  data: string[] // 数组里的格子（capacity 模式下包括 top 以上的旧值）
  top: number // 元素个数
  kind: Kind
  value: string // 这一步涉及的元素
  caption: string
  note: string // 第二行说明，如 x = 3
  idx: number // 分步时这一步碰到的格子，没有为 -1
}

const cap = computed(() => Number(props.capacity) || 0)

const frames = computed<Frame[]>(() => {
  const data = props.items.trim().split(/\s+/).filter(Boolean)
  let top = data.length
  const tokens = props.ops.trim().split(/\s+/).filter(Boolean)
  const out: Frame[] = [{ data: [...data], top, kind: 'start', value: '', caption: tokens.length ? '调用前' : '', note: '', idx: -1 }]
  for (const t of tokens) {
    const [op, arg] = t.split(':')
    let f: Omit<Frame, 'data' | 'top' | 'idx'> & { idx?: number }
    if (op === 'push') {
      if (cap.value && top === cap.value) throw new Error('StackFigure: 栈满，不能入栈')
      data[top] = arg
      top++
      f = { kind: 'push', value: arg, caption: `Push(S, ${arg})`, note: '' }
    } else if (op === 'pop') {
      if (top === 0) throw new Error('StackFigure: 空栈不能出栈')
      top--
      const v = data[top]
      f = { kind: 'pop', value: v, caption: 'Pop(S, &x)', note: `x = ${v}` }
    } else if (op === 'calc') {
      // 后缀式的一个运算符：弹出两个数（先弹出的是右边的），算好放回去
      if (top < 2) throw new Error('StackFigure: 栈里不到两个数，不能运算')
      const b = Number(data[top - 1])
      const a = Number(data[top - 2])
      const v = arg === '+' ? a + b : arg === '-' ? a - b : arg === '*' ? a * b : Math.trunc(a / b)
      top -= 2
      data[top] = String(v)
      top++
      if (!cap.value) data.length = top
      f = { kind: 'calc', value: String(v), caption: `读到 ${arg}`, note: `${a} ${arg} ${b} = ${v}` }
    } else if (op === 'gettop') {
      if (top === 0) throw new Error('StackFigure: 空栈没有栈顶')
      const v = data[top - 1]
      f = { kind: 'gettop', value: v, caption: 'GetTop(S, &x)', note: `x = ${v}` }
    } else if (op === 'empty') {
      f = { kind: 'empty', value: '', caption: 'StackEmpty(S)', note: top === 0 ? '返回1（空）' : '返回0（不空）' }
    } else if (op === 'init') {
      top = 0
      data.length = 0
      f = { kind: 'init', value: '', caption: 'InitStack(S)', note: '' }
    } else if (op === 'set') {
      const [i, v] = arg.split('=')
      data[Number(i)] = v
      f = { kind: 'set', value: v, caption: `data[${i}] = ${v}`, note: '', idx: Number(i) }
    } else if (op === 'top') {
      top = Number(arg)
      f = { kind: 'top', value: '', caption: `top = ${arg}`, note: '' }
    } else if (op === 'read') {
      const v = data[Number(arg)]
      f = { kind: 'read', value: v, caption: `x = data[${arg}]`, note: `x = ${v}`, idx: Number(arg) }
    } else {
      throw new Error(`StackFigure: 看不懂的操作「${t}」`)
    }
    if (!cap.value) data.length = top // 不画数组时，出栈的元素直接拿走
    out.push({ idx: -1, ...f, data: [...data], top })
  }
  // 第一个操作就是 InitStack 时，调用前的样子没有意义，不画
  if (tokens[0] === 'init') out.shift()
  const shown = out.slice(Number(props.skip) || 0)
  if (props.labels) {
    const ls = props.labels.split('|')
    shown.forEach((f, i) => {
      const [a = '', b = ''] = (ls[i] ?? '').split('~')
      f.caption = a.trim()
      f.note = b.trim()
    })
  }
  return shown
})

// 画 top 箭头时右边要多留地方写 top=3
const W = computed(() => (props.top ? 240 : 220))
const multi = computed(() => frames.value.length > 1)
const showArrows = computed(() => (props.bare === undefined ? !multi.value : !props.bare))

// 几何：所有小图同样高，格子数取 capacity 或各步里最多的元素个数（至少 3）
const cellH = 30
const boxL = 76
const boxR = 146
const rows = computed(() => cap.value || Math.max(3, ...frames.value.map((f) => f.data.length)))
// 容器上方：箭头，或出栈时浮在上面的元素；都没有就只留一点边
const headroom = computed(() => (showArrows.value ? 58 : frames.value.some((f) => f.kind === 'pop') ? 44 : cap.value ? 16 : 6))
const boxTop = computed(() => headroom.value + 14)
const bottom = computed(() => boxTop.value + rows.value * cellH)
const H = computed(() => bottom.value + 8)
const cellY = (k: number) => bottom.value - (k + 1) * cellH

function label(f: Frame) {
  const live = f.data.slice(0, f.top)
  return live.length ? `栈：从栈底到栈顶是${live.join('、')}` : '空栈'
}
</script>

<template>
  <div class="stack-figures" :class="{ multi }">
    <figure v-for="(f, i) in frames" :key="i" class="stack-figure">
      <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="label(f)">
        <!-- 进栈、出栈 -->
        <g v-if="showArrows" class="dir">
          <path :d="`M 200 ${boxTop - 34} Q 150 ${boxTop - 30} 126 ${boxTop - 6}`" />
          <polygon :points="`122,${boxTop - 2} 124,${boxTop - 12} 132,${boxTop - 6}`" />
          <text x="214" :y="boxTop - 40" text-anchor="end">进栈</text>
          <path :d="`M 96 ${boxTop - 6} Q 72 ${boxTop - 30} 24 ${boxTop - 34}`" />
          <polygon :points="`18,${boxTop - 34} 26,${boxTop - 39} 26,${boxTop - 29}`" />
          <text x="8" :y="boxTop - 40">出栈</text>
        </g>
        <!-- 容器：上面开口 -->
        <path class="box" :d="`M ${boxL} ${boxTop} V ${bottom} H ${boxR} V ${boxTop}`" />
        <!-- 数组模式：每个格子的分隔线和下标 -->
        <g v-if="cap" class="slot">
          <line v-for="k in rows - 1" :key="k" :x1="boxL" :y1="cellY(k - 1)" :x2="boxR" :y2="cellY(k - 1)" />
          <text v-for="k in rows" :key="'i' + k" :x="boxL + 6" :y="cellY(k - 1) + 12">{{ k - 1 }}</text>
        </g>
        <g v-for="(it, k) in f.data" :key="k" class="cell" :class="{
          stale: k >= f.top && k !== f.idx,
          now: ((f.kind === 'push' || f.kind === 'gettop' || f.kind === 'calc') && k === f.top - 1) || k === f.idx,
        }">
          <rect v-if="k < f.top || k === f.idx" :x="boxL + 1" :y="cellY(k) + 1" :width="boxR - boxL - 2" :height="cellH - 2" />
          <!-- 和下面一格的分隔线（最底下一格靠容器底） -->
          <line v-if="!cap && k > 0 && k < f.top" :x1="boxL" :y1="cellY(k) + cellH" :x2="boxR" :y2="cellY(k) + cellH" />
          <text :x="(boxL + boxR) / 2" :y="cellY(k) + cellH / 2 + 5" text-anchor="middle">{{ it }}</text>
        </g>
        <!-- 刚出栈的元素浮在容器上方 -->
        <g v-if="f.kind === 'pop'" class="cell now">
          <rect :x="boxL + 8" :y="boxTop - 40" :width="boxR - boxL - 16" :height="cellH - 4" rx="3" />
          <text :x="(boxL + boxR) / 2" :y="boxTop - 40 + (cellH - 4) / 2 + 5" text-anchor="middle">{{ f.value }}</text>
        </g>
        <!-- 栈顶、栈底 -->
        <g v-if="f.top" class="term">
          <text :x="boxL - 8" :y="cellY(f.top - 1) + cellH / 2 + 4" text-anchor="end">栈顶 →</text>
          <text v-if="f.top > 1" :x="boxL - 8" :y="cellY(0) + cellH / 2 + 4" text-anchor="end">栈底 →</text>
        </g>
        <g v-else-if="!cap" class="term">
          <text :x="(boxL + boxR) / 2" :y="bottom - cellH / 2 + 4" text-anchor="middle">空栈</text>
        </g>
        <!-- top 箭头：指向下一个空格 -->
        <g v-if="cap && top" class="topptr" :class="{ now: f.kind === 'top' }">
          <line :x1="boxR + 34" :y1="cellY(f.top) + cellH / 2" :x2="boxR + 6" :y2="cellY(f.top) + cellH / 2" />
          <polygon :points="`${boxR + 2},${cellY(f.top) + cellH / 2} ${boxR + 9},${cellY(f.top) + cellH / 2 - 4} ${boxR + 9},${cellY(f.top) + cellH / 2 + 4}`" />
          <text :x="boxR + 38" :y="cellY(f.top) + cellH / 2 + 4">top={{ f.top }}</text>
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
.stack-figures {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
}
.stack-figures.multi {
  justify-content: flex-start;
  gap: 16px 12px;
  margin: 16px 0;
}
.stack-figure {
  margin: 0;
  width: 240px;
  text-align: center;
}
/* 一行三张；窄屏一行两张 */
.multi .stack-figure {
  width: calc((100% - 24px) / 3);
}
@media (max-width: 480px) {
  .multi .stack-figure {
    width: calc((100% - 12px) / 2);
  }
}
svg {
  display: block;
  width: 100%;
  height: auto;
}
.box {
  fill: none;
  stroke: var(--vp-c-text-1);
  stroke-width: 2;
}
.slot line,
.cell line {
  stroke: var(--vp-c-text-2);
  stroke-width: 1;
}
.slot text {
  font-size: 10px;
  fill: var(--vp-c-text-3);
}
.cell rect {
  fill: transparent;
}
.cell.now rect {
  fill: var(--vp-c-brand-soft);
  stroke: var(--vp-c-brand-1);
  stroke-width: 1.5;
}
.cell text {
  font-size: 15px;
  font-weight: 600;
  fill: var(--vp-c-text-1);
}
.cell.stale text {
  fill: var(--vp-c-text-3);
  font-weight: 400;
}
.dir path,
.topptr line {
  fill: none;
  stroke: var(--vp-c-text-3);
  stroke-width: 1.5;
}
.topptr.now line {
  stroke: var(--vp-c-brand-1);
}
.topptr.now polygon {
  fill: var(--vp-c-brand-1);
}
.topptr.now text {
  fill: var(--vp-c-brand-1);
  font-weight: 600;
}
.dir polygon,
.topptr polygon {
  fill: var(--vp-c-text-3);
}
.dir text,
.term text,
.topptr text {
  font-size: 13px;
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
