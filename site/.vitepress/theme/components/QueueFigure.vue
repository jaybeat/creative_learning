<script setup lang="ts">
import { computed } from 'vue'

/**
 * 队列的示意图：一段横放、两头都开口的管子。左边是队头（出队），右边是队尾（入队）。纯静态 SVG。
 *
 * items：开始时队列里的元素，空格分开，从队头到队尾，例如 `1 2 3`。
 * ops：一串操作，空格分开；给了 ops 就画一排小图（第一张是调用前，之后每个操作一张）：
 *   `en:4` 入队 4；`de` 出队；`gethead` 取队头；`empty` 判空；`init` 初始化成空队列。
 * ends：两个箭头上的字，先出口后入口，空格分开，默认 `出队 入队`（场景页可以写成 `叫号 取号`）。
 * plain：不标队头、队尾（还没点名的场景页用）。
 * skip、labels、bare：同 StackFigure。
 */
const props = withDefaults(
  defineProps<{ items?: string; ops?: string; ends?: string; plain?: boolean; bare?: boolean; skip?: number | string; labels?: string }>(),
  { items: '', ops: '', ends: '出队 入队', plain: false, bare: undefined, skip: 0, labels: '' },
)

type Kind = 'start' | 'en' | 'de' | 'gethead' | 'empty' | 'init'
interface Frame {
  data: string[] // 从队头到队尾
  kind: Kind
  value: string // 这一步涉及的元素
  caption: string
  note: string // 第二行说明，如 x = 1
  more?: string[] // labels 里第三行以后的说明
}

const frames = computed<Frame[]>(() => {
  const data = props.items.trim().split(/\s+/).filter(Boolean)
  const tokens = props.ops.trim().split(/\s+/).filter(Boolean)
  const out: Frame[] = [{ data: [...data], kind: 'start', value: '', caption: tokens.length ? '调用前' : '', note: '' }]
  for (const t of tokens) {
    const [op, arg] = t.split(':')
    let f: Omit<Frame, 'data'>
    if (op === 'en') {
      data.push(arg)
      f = { kind: 'en', value: arg, caption: `EnQueue(Q, ${arg})`, note: '' }
    } else if (op === 'de') {
      if (!data.length) throw new Error('QueueFigure: 空队列不能出队')
      const v = data.shift()!
      f = { kind: 'de', value: v, caption: 'DeQueue(Q, &x)', note: `x = ${v}` }
    } else if (op === 'gethead') {
      if (!data.length) throw new Error('QueueFigure: 空队列没有队头')
      f = { kind: 'gethead', value: data[0], caption: 'GetHead(Q, &x)', note: `x = ${data[0]}` }
    } else if (op === 'empty') {
      f = { kind: 'empty', value: '', caption: 'QueueEmpty(Q)', note: data.length ? '返回0（不空）' : '返回1（空）' }
    } else if (op === 'init') {
      data.length = 0
      f = { kind: 'init', value: '', caption: 'InitQueue(Q)', note: '' }
    } else {
      throw new Error(`QueueFigure: 看不懂的操作「${t}」`)
    }
    out.push({ ...f, data: [...data] })
  }
  // 第一个操作就是 InitQueue 时，调用前的样子没有意义，不画
  if (tokens[0] === 'init') out.shift()
  const shown = out.slice(Number(props.skip) || 0)
  if (props.labels) {
    const ls = props.labels.split('|')
    shown.forEach((f, i) => {
      const [a = '', b = '', ...rest] = (ls[i] ?? '').split('~')
      f.caption = a.trim()
      f.note = b.trim()
      f.more = rest.map((s) => s.trim()).filter(Boolean)
    })
  }
  return shown
})

const multi = computed(() => frames.value.length > 1)
const showArrows = computed(() => (props.bare === undefined ? !multi.value : !props.bare))
const endText = computed(() => {
  const [o = '出队', i = '入队'] = props.ends.trim().split(/\s+/)
  return { out: o, in: i }
})

// 几何：所有小图同样宽，格子数取各步里最多的元素个数（至少 4）
const cellW = 34
const cellH = 30
const cols = computed(() => Math.max(4, ...frames.value.map((f) => f.data.length)))
// 管子左边：箭头，或出队时浮在外面的元素；右边：箭头，或留一点边
const left = computed(() => (showArrows.value ? 54 : frames.value.some((f) => f.kind === 'de') ? 40 : 6))
const right = computed(() => (showArrows.value ? 54 : 6))
const tubeL = computed(() => left.value)
const tubeR = computed(() => left.value + cols.value * cellW)
// 至少和 StackFigure 一样宽（220），小图里的字才和栈的图一样大；多出来的宽度两边平分
const W = computed(() => Math.max(220, tubeR.value + right.value))
const dx = computed(() => (W.value - tubeR.value - right.value) / 2)
const tubeTop = computed(() => (showArrows.value ? 22 : 6))
const tubeBot = computed(() => tubeTop.value + cellH)
const H = computed(() => tubeBot.value + (props.plain ? 8 : 24))
const cellX = (k: number) => tubeL.value + k * cellW
const midY = computed(() => tubeTop.value + cellH / 2)

function label(f: Frame) {
  return f.data.length ? `队列：从队头到队尾是${f.data.join('、')}` : '空队列'
}
</script>

<template>
  <div class="queue-figures" :class="{ multi }">
    <figure v-for="(f, i) in frames" :key="i" class="queue-figure">
      <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="label(f)">
        <g :transform="`translate(${dx} 0)`">
        <!-- 出队（左）、入队（右），箭头都朝左 -->
        <g v-if="showArrows" class="dir">
          <line :x1="tubeL - 6" :y1="midY" :x2="10" :y2="midY" />
          <polygon :points="`4,${midY} 12,${midY - 5} 12,${midY + 5}`" />
          <text :x="tubeL / 2 + 2" :y="tubeTop - 8" text-anchor="middle">{{ endText.out }}</text>
          <line :x1="tubeR + right - 4" :y1="midY" :x2="tubeR + 14" :y2="midY" />
          <polygon :points="`${tubeR + 6},${midY} ${tubeR + 14},${midY - 5} ${tubeR + 14},${midY + 5}`" />
          <text :x="tubeR + right / 2" :y="tubeTop - 8" text-anchor="middle">{{ endText.in }}</text>
        </g>
        <!-- 管子：上下两条边，两头开口 -->
        <line class="box" :x1="tubeL" :y1="tubeTop" :x2="tubeR" :y2="tubeTop" />
        <line class="box" :x1="tubeL" :y1="tubeBot" :x2="tubeR" :y2="tubeBot" />
        <g v-for="(it, k) in f.data" :key="k" class="cell" :class="{
          now: (f.kind === 'en' && k === f.data.length - 1) || (f.kind === 'gethead' && k === 0),
        }">
          <rect :x="cellX(k) + 1" :y="tubeTop + 1" :width="cellW - 2" :height="cellH - 2" />
          <line v-if="k > 0" :x1="cellX(k)" :y1="tubeTop" :x2="cellX(k)" :y2="tubeBot" />
          <text :x="cellX(k) + cellW / 2" :y="midY + 5" text-anchor="middle">{{ it }}</text>
        </g>
        <!-- 刚出队的元素浮在管子左边 -->
        <g v-if="f.kind === 'de'" class="cell now">
          <rect :x="tubeL - cellW - 6" :y="tubeTop + 2" :width="cellW - 4" :height="cellH - 4" rx="3" />
          <text :x="tubeL - cellW / 2 - 8" :y="midY + 5" text-anchor="middle">{{ f.value }}</text>
        </g>
        <text v-if="!f.data.length" class="term" :x="(tubeL + tubeR) / 2" :y="midY + 4" text-anchor="middle">空队列</text>
        <!-- 队头、队尾 -->
        <g v-if="!plain && f.data.length" class="term">
          <template v-if="f.data.length > 1">
            <text :x="cellX(0) + cellW / 2" :y="tubeBot + 17" text-anchor="middle">队头</text>
            <text :x="cellX(f.data.length - 1) + cellW / 2" :y="tubeBot + 17" text-anchor="middle">队尾</text>
          </template>
          <text v-else :x="cellX(0) + 2" :y="tubeBot + 17">队头、队尾</text>
        </g>
        </g>
      </svg>
      <figcaption v-if="f.caption">
        <span class="op">{{ f.caption }}</span>
        <span v-if="f.note" class="note">{{ f.note }}</span>
        <span v-for="(m, j) in f.more" :key="j" class="note">{{ m }}</span>
      </figcaption>
    </figure>
  </div>
</template>

<style scoped>
.queue-figures {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
}
.queue-figures.multi {
  justify-content: flex-start;
  gap: 16px 12px;
  margin: 16px 0;
}
.queue-figure {
  margin: 0;
  width: 260px;
  text-align: center;
}
/* 一行三张；窄屏一行两张 */
.multi .queue-figure {
  width: calc((100% - 24px) / 3);
}
@media (max-width: 480px) {
  .multi .queue-figure {
    width: calc((100% - 12px) / 2);
  }
}
svg {
  display: block;
  width: 100%;
  height: auto;
}
.box {
  stroke: var(--vp-c-text-1);
  stroke-width: 2;
}
.cell line {
  stroke: var(--vp-c-text-2);
  stroke-width: 1;
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
.dir line {
  stroke: var(--vp-c-text-3);
  stroke-width: 1.5;
}
.dir polygon {
  fill: var(--vp-c-text-3);
}
.dir text,
.term,
.term text {
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
