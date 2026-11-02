<script setup lang="ts">
import { computed } from 'vue'

/**
 * 顺序队列的示意图：横放的一段数组，下面标下标，front 箭头在上、rear 箭头在下。纯静态 SVG。
 * front 指着队头元素，rear 指着队尾的下一个空格。不在队里的格子，旧值留着、变灰。
 *
 * capacity：格子数（MAXSIZE），默认 5。
 * pre：先悄悄做完的一串操作，画的是做完之后的样子（接着前一页的队列往下走）。
 * ops：一串操作，空格分开；给了 ops 就竖着画一列（第一行是调用前，之后每个操作一行，左边写操作名，像一张操作记录）：
 *   `en:4` 入队 4；`de` 出队；`gethead` 取队头；`empty` 判空；`init` 初始化成空队列。
 * circular：front、rear 走到末尾后绕回第 0 格（循环队列）。不给时只往右走，rear 可以走到数组外面。
 * spare：空一格不用：rear 的下一格是 front 时就算满，入队不成功。
 *   不给 spare 时，放满 capacity 个才算满（满和空都是 front 等于 rear）。
 * ring：画成首尾相接的一圈（只画一张，取最后的样子）。
 * skip、labels：同 StackFigure。labels 里一张的第一段写在左边的操作名处，后面几段是说明。
 */
const props = withDefaults(
  defineProps<{
    capacity?: number | string
    pre?: string
    ops?: string
    circular?: boolean
    spare?: boolean
    ring?: boolean
    skip?: number | string
    labels?: string
  }>(),
  { capacity: 5, pre: '', ops: '', circular: false, spare: false, ring: false, skip: 0, labels: '' },
)

type Kind = 'start' | 'en' | 'de' | 'gethead' | 'empty' | 'init' | 'fail'
interface Frame {
  data: string[] // 每个格子里的值（包括不在队里的旧值），没放过东西是 ''
  front: number
  rear: number
  count: number // 队里有几个元素（只用来画图，front 等于 rear 时分清满和空）
  kind: Kind
  idx: number // 这一步碰到的格子，没有为 -1
  moved: '' | 'front' | 'rear'
  caption: string
  notes: string[]
}

const cap = computed(() => Number(props.capacity) || 5)

const frames = computed<Frame[]>(() => {
  const n = cap.value
  const data: string[] = Array(n).fill('')
  let front = 0
  let rear = 0
  let count = 0
  const next = (i: number) => (props.circular ? (i + 1) % n : i + 1)
  const out: Frame[] = []
  const snap = (f: Omit<Frame, 'data' | 'front' | 'rear' | 'count'>) => out.push({ ...f, data: [...data], front, rear, count })

  function run(t: string) {
    const [op, arg] = t.split(':')
    if (op === 'en') {
      const full = props.spare ? next(rear) === front || rear >= n : rear >= n || count === n
      if (full) {
        const why = rear >= n ? `没有第${rear}格` : '队满，放不进'
        snap({ kind: 'fail', idx: -1, moved: '', caption: `EnQueue(Q, ${arg})`, notes: [why] })
        return
      }
      const at = rear
      data[at] = arg
      rear = next(rear)
      count++
      snap({ kind: 'en', idx: at, moved: 'rear', caption: `EnQueue(Q, ${arg})`, notes: [`data[${at}] = ${arg}`, `rear = ${rear}`] })
    } else if (op === 'de') {
      if (count === 0) throw new Error('SqQueueFigure: 空队列不能出队')
      const at = front
      front = next(front)
      count--
      snap({ kind: 'de', idx: at, moved: 'front', caption: 'DeQueue(Q, &x)', notes: [`x = data[${at}] = ${data[at]}`, `front = ${front}`] })
    } else if (op === 'gethead') {
      if (count === 0) throw new Error('SqQueueFigure: 空队列没有队头')
      snap({ kind: 'gethead', idx: front, moved: '', caption: 'GetHead(Q, &x)', notes: [`x = data[${front}] = ${data[front]}`] })
    } else if (op === 'empty') {
      snap({ kind: 'empty', idx: -1, moved: '', caption: 'QueueEmpty(Q)', notes: [count === 0 ? '返回1（空）' : '返回0（不空）'] })
    } else if (op === 'init') {
      data.fill('')
      front = rear = count = 0
      snap({ kind: 'init', idx: -1, moved: '', caption: 'InitQueue(Q)', notes: ['front = rear = 0'] })
    } else {
      throw new Error(`SqQueueFigure: 看不懂的操作「${t}」`)
    }
  }

  const split = (s: string) => s.trim().split(/\s+/).filter(Boolean)
  for (const t of split(props.pre)) run(t)
  out.length = 0
  const tokens = split(props.ops)
  snap({ kind: 'start', idx: -1, moved: '', caption: tokens.length ? '调用前' : '', notes: [] })
  for (const t of tokens) run(t)
  // 第一个操作就是 InitQueue 时，调用前的样子没有意义，不画
  if (tokens[0] === 'init') out.shift()
  const shown = out.slice(Number(props.skip) || 0)
  if (props.labels) {
    const ls = props.labels.split('|')
    shown.forEach((f, i) => {
      const [a = '', ...rest] = (ls[i] ?? '').split('~')
      f.caption = a.trim()
      f.notes = rest.map((s) => s.trim()).filter(Boolean)
    })
  }
  return props.ring ? shown.slice(-1) : shown
})

const multi = computed(() => !props.ring && frames.value.length > 1)

// 第 k 格在不在队里
function live(f: Frame, k: number) {
  if (f.count === 0) return false
  const n = cap.value
  const d = (k - f.front + n) % n
  return props.circular ? d < f.count : k >= f.front && k < f.front + f.count
}

// ---- 直线数组的几何 ----
const cellW = 38
const cellH = 32
const x0 = 14
const cellsTop = 26
// rear 走到数组外面时，多画一个虚线格
const ghost = computed(() => frames.value.some((f) => f.rear >= cap.value))
const W = computed(() => x0 * 2 + (cap.value + (ghost.value ? 1 : 0)) * cellW)
const H = cellsTop + cellH + 14 + 26
const cellX = (k: number) => x0 + k * cellW
const midX = (k: number) => cellX(k) + cellW / 2

// ---- 一圈的几何 ----
const R = 76
const RW = 280
const RH = 250
const rc = { x: RW / 2, y: RH / 2 }
const ang = (k: number) => ((-90 + (k * 360) / cap.value) * Math.PI) / 180
const at = (k: number, r: number) => ({ x: rc.x + r * Math.cos(ang(k)), y: rc.y + r * Math.sin(ang(k)) })
// 圆上两格之间的小箭头，顺时针，表示下一格是哪一格（第4格的下一格是第0格）
function chevron(k: number) {
  const a = ((-90 + ((k + 0.5) * 360) / cap.value) * Math.PI) / 180
  const p = { x: rc.x + R * Math.cos(a), y: rc.y + R * Math.sin(a) }
  const t = { x: -Math.sin(a), y: Math.cos(a) } // 顺时针切线方向
  const nx = Math.cos(a)
  const ny = Math.sin(a)
  const tip = { x: p.x + t.x * 5, y: p.y + t.y * 5 }
  const b1 = { x: p.x - t.x * 4 + nx * 5, y: p.y - t.y * 4 + ny * 5 }
  const b2 = { x: p.x - t.x * 4 - nx * 5, y: p.y - t.y * 4 - ny * 5 }
  return `${tip.x},${tip.y} ${b1.x},${b1.y} ${b2.x},${b2.y}`
}

// 等宽字体只有代码里用到的汉字，带汉字的说明用正文字体
const cjk = (s: string) => /[一-鿿]/.test(s)

function label(f: Frame) {
  const n = cap.value
  const items: string[] = []
  for (let i = 0; i < f.count; i++) items.push(f.data[(f.front + i) % n])
  const q = items.length ? `队列：从队头到队尾是${items.join('、')}` : '空队列'
  return `${q}，front=${f.front}，rear=${f.rear}`
}
</script>

<template>
  <div class="sq-figures" :class="{ multi }">
    <figure v-for="(f, i) in frames" :key="i" class="sq-figure" :class="{ fail: f.kind === 'fail', 'ring-wrap': ring }">
      <figcaption v-if="multi || f.caption || f.notes.length">
        <span class="op" :class="{ code: !cjk(f.caption) }">{{ f.caption }}</span>
        <span v-for="(m, j) in f.notes" :key="j" class="note" :class="{ code: !cjk(m) }">{{ m }}</span>
      </figcaption>
      <!-- 首尾相接的一圈 -->
      <svg v-if="ring" :viewBox="`0 0 ${RW} ${RH}`" role="img" :aria-label="label(f)">
        <circle class="loop" :cx="rc.x" :cy="rc.y" :r="R" />
        <polygon v-for="k in cap" :key="'c' + k" class="chev" :points="chevron(k - 1)" />
        <g v-for="k in cap" :key="k" class="cell" :class="{ stale: !live(f, k - 1), now: k - 1 === f.idx }">
          <rect :x="at(k - 1, R).x - 19" :y="at(k - 1, R).y - 16" width="38" height="32" class="slotbox" />
          <text :x="at(k - 1, R).x" :y="at(k - 1, R).y + 5" text-anchor="middle">{{ f.data[k - 1] }}</text>
          <text class="idx" :x="at(k - 1, R - 32).x" :y="at(k - 1, R - 30).y + 4" text-anchor="middle">{{ k - 1 }}</text>
        </g>
        <text class="ptr" :x="at(f.front, R + 42).x" :y="at(f.front, R + 42).y + (f.front === f.rear ? -4 : 4)" text-anchor="middle">front</text>
        <text class="ptr" :x="at(f.rear, R + 42).x" :y="at(f.rear, R + 42).y + (f.front === f.rear ? 12 : 4)" text-anchor="middle">rear</text>
      </svg>
      <!-- 直线数组 -->
      <svg v-else :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="label(f)">
        <g v-for="k in cap" :key="k" class="cell" :class="{ stale: !live(f, k - 1), now: k - 1 === f.idx }">
          <rect class="slotbox" :x="cellX(k - 1)" :y="cellsTop" :width="cellW" :height="cellH" />
          <text :x="midX(k - 1)" :y="cellsTop + cellH / 2 + 5" text-anchor="middle">{{ f.data[k - 1] }}</text>
          <text class="idx" :x="midX(k - 1)" :y="cellsTop + cellH + 11" text-anchor="middle">{{ k - 1 }}</text>
        </g>
        <g v-if="ghost" class="ghost">
          <rect :x="cellX(cap)" :y="cellsTop" :width="cellW" :height="cellH" />
          <text class="idx" :x="midX(cap)" :y="cellsTop + cellH + 11" text-anchor="middle">{{ cap }}</text>
        </g>
        <!-- front 在上，rear 在下 -->
        <g class="ptr" :class="{ now: f.moved === 'front' }">
          <text :x="midX(f.front)" :y="10" text-anchor="middle">front</text>
          <line :x1="midX(f.front)" y1="13" :x2="midX(f.front)" :y2="cellsTop - 5" />
          <polygon :points="`${midX(f.front)},${cellsTop - 1} ${midX(f.front) - 4},${cellsTop - 7} ${midX(f.front) + 4},${cellsTop - 7}`" />
        </g>
        <g class="ptr" :class="{ now: f.moved === 'rear' }">
          <line :x1="midX(f.rear)" :y1="H - 11" :x2="midX(f.rear)" :y2="cellsTop + cellH + 19" />
          <polygon :points="`${midX(f.rear)},${cellsTop + cellH + 15} ${midX(f.rear) - 4},${cellsTop + cellH + 21} ${midX(f.rear) + 4},${cellsTop + cellH + 21}`" />
          <text :x="midX(f.rear)" :y="H - 1" text-anchor="middle">rear</text>
        </g>
      </svg>
    </figure>
  </div>
</template>

<style scoped>
.sq-figures {
  display: flex;
  justify-content: center;
  margin: 16px 0;
}
.sq-figures.multi {
  flex-direction: column;
  gap: 10px;
}
.sq-figure {
  margin: 0;
  width: 260px;
}
/* 单张图：说明写在图下面 */
.sq-figures:not(.multi) .sq-figure {
  display: flex;
  flex-direction: column-reverse;
  text-align: center;
}
/* 竖着一列：左边是操作记录，右边是这一步做完的数组，各行的数组上下对齐 */
.ring-wrap {
  width: 300px;
}
.multi .sq-figure {
  width: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}
.multi .sq-figure svg {
  width: 250px;
  flex: none;
}
.multi figcaption {
  flex: none;
  width: 9.5em;
  text-align: right;
}
@media (max-width: 480px) {
  .multi .sq-figure {
    gap: 8px;
  }
  .multi .sq-figure svg {
    width: auto;
    flex: 1 1 0;
    min-width: 0;
  }
  .multi figcaption {
    width: 8.5em;
    font-size: 12px;
  }
}
svg {
  display: block;
  width: 100%;
  height: auto;
}
.slotbox {
  fill: var(--vp-c-bg);
  stroke: var(--vp-c-text-1);
  stroke-width: 1.5;
}
.cell.now .slotbox {
  fill: var(--vp-c-brand-soft);
  stroke: var(--vp-c-brand-1);
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
.cell text.idx,
.ghost text.idx {
  font-size: 10px;
  font-weight: 400;
  fill: var(--vp-c-text-3);
}
.ghost rect {
  fill: none;
  stroke: var(--vp-c-text-3);
  stroke-width: 1;
  stroke-dasharray: 4 3;
}
.chev {
  fill: var(--vp-c-text-3);
}
.loop {
  fill: none;
  stroke: var(--vp-c-text-3);
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
}
.ptr line {
  stroke: var(--vp-c-text-2);
  stroke-width: 1.5;
}
.ptr polygon {
  fill: var(--vp-c-text-2);
}
.ptr text,
text.ptr {
  font-size: 12px;
  fill: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
}
.ptr.now line {
  stroke: var(--vp-c-brand-1);
}
.ptr.now polygon {
  fill: var(--vp-c-brand-1);
}
.ptr.now text {
  fill: var(--vp-c-brand-1);
  font-weight: 600;
}
figcaption {
  display: flex;
  flex-direction: column;
  font-size: 14px;
  line-height: 1.45;
  color: var(--vp-c-text-2);
}
figcaption .code {
  font-family: var(--vp-font-family-mono);
}
figcaption .op {
  color: var(--vp-c-text-1);
  font-weight: 600;
}
.fail figcaption .note {
  color: var(--vp-c-danger-1);
}
</style>
