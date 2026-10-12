<script setup lang="ts">
import { computed } from 'vue'

/**
 * 铁路调度站（第3章栈）：T 形轨道，右边主线开进来，竖直的尽头线停车，左边主线开出去。
 * ops 是一串用空格分开的步骤：`1进` 开进 1 号，`2出` 开出 2 号，`1卡` 表示轮到 1 号却开不出来。
 * 默认每一步画一张小图（做完这一步之后的样子），按顺序排成一排；ops 为空时画一张空站。
 * last：只画最后一张，不带说明文字。terms：标注改用栈的术语（进栈/出栈、栈顶/栈底）。
 * waiting：右边主线上等着进站的车厢，例如 `3`。
 * asks：在图上标出调度员此刻要问的事（站里有没有车、最外面是几号、开出的是几号、下一节开进来），配 last 用。
 * 纯静态 SVG，没有交互和动画，SSR 直接输出。
 */
const props = withDefaults(defineProps<{ ops?: string; last?: boolean; terms?: boolean; waiting?: string; asks?: boolean }>(), {
  ops: '',
  waiting: '',
  asks: false,
  last: false,
  terms: false,
})

type Kind = 'in' | 'out' | 'stuck' | 'none'
interface Frame {
  cars: string[] // 站里的车厢，从最里面到最外面
  gone: string[] // 已经开出的车厢，按开出的先后
  kind: Kind
  car: string // 这一步动的那节
  caption: string
}

const frames = computed<Frame[]>(() => {
  const tokens = props.ops.trim().split(/\s+/).filter(Boolean)
  const cars: string[] = []
  const gone: string[] = []
  const out: Frame[] = []
  if (tokens.length === 0) out.push({ cars: [], gone: [], kind: 'none', car: '', caption: '' })
  for (const t of tokens) {
    const m = /^(\S+?)(进|出|卡)$/.exec(t)
    if (!m) throw new Error(`RailYard: 看不懂的步骤「${t}」`)
    const [, car, act] = m
    let kind: Kind
    let caption: string
    if (act === '进') {
      cars.push(car)
      kind = 'in'
      caption = `${car}号开进`
    } else if (act === '出') {
      if (cars[cars.length - 1] !== car) throw new Error(`RailYard: ${car}号不在最外面，开不出来`)
      cars.pop()
      gone.push(car)
      kind = 'out'
      caption = `${car}号开出`
    } else {
      kind = 'stuck'
      caption = `${car}号开不出`
    }
    out.push({ cars: [...cars], gone: [...gone], kind, car, caption })
  }
  return props.last ? out.slice(-1) : out
})

// 几何（viewBox 180 × 180）
const W = 180
const H = 180
const railTop = 24
const railBottom = 40
const sideL = 74
const sideR = 106
const deadEnd = 168
const carW = 26
const carH = 22
const carX = (sideL + sideR - carW) / 2
const carGap = 25
/** 第 k 节（从最里面数，0 起）车厢的上沿 */
const carY = (k: number) => deadEnd - 4 - carH - k * carGap
const mainTies = Array.from({ length: 20 }, (_, i) => 4 + i * 9).filter((x) => x < sideL - 2 || x > sideR + 2)
const sideTies = Array.from({ length: 13 }, (_, i) => railBottom + 6 + i * 9).filter((y) => y < deadEnd - 2)

// 标注要占的边距：上、左、右
const pad = computed(() => (props.asks ? { t: 22, l: 34, r: 34 } : { t: 0, l: 0, r: 0 }))
const viewBox = computed(() => `${-pad.value.l} ${-pad.value.t} ${W + pad.value.l + pad.value.r} ${H + pad.value.t}`)

const inLabel = computed(() => (props.terms ? '进栈' : '开进'))
const outLabel = computed(() => (props.terms ? '出栈' : '开出'))

function describe(f: Frame) {
  const inside = f.cars.length ? `站里从里到外是${f.cars.join('、')}号` : '站里没有车厢'
  const gone = f.gone.length ? `，已开出${f.gone.join('、')}号` : ''
  return `铁路调度站：${inside}${gone}`
}
</script>

<template>
  <div class="rail-yard" :class="{ single: frames.length === 1 }">
    <figure v-for="(f, i) in frames" :key="i" class="rail-frame" :class="{ wide: asks }">
      <svg :viewBox="viewBox" role="img" :aria-label="describe(f)">
        <!-- 枕木 -->
        <g class="tie">
          <line v-for="x in mainTies" :key="'m' + x" :x1="x" :y1="railTop - 3" :x2="x" :y2="railBottom + 3" />
          <line v-for="y in sideTies" :key="'s' + y" :x1="sideL - 3" :y1="y" :x2="sideR + 3" :y2="y" />
        </g>
        <!-- 钢轨：主线上轨连续，下轨在岔口断开；尽头线两轨，底部挡车 -->
        <g class="rail">
          <line x1="0" :y1="railTop" :x2="W" :y2="railTop" />
          <line x1="0" :y1="railBottom" :x2="sideL" :y2="railBottom" />
          <line :x1="sideR" :y1="railBottom" :x2="W" :y2="railBottom" />
          <line :x1="sideL" :y1="railBottom" :x2="sideL" :y2="deadEnd" />
          <line :x1="sideR" :y1="railBottom" :x2="sideR" :y2="deadEnd" />
        </g>
        <line class="stop" :x1="sideL - 6" :y1="deadEnd + 2" :x2="sideR + 6" :y2="deadEnd + 2" />
        <!-- 进出方向 -->
        <g class="dir">
          <line :x1="W - 6" y1="11" x2="128" y2="11" />
          <polygon points="122,11 129,7 129,15" />
          <text :x="W - 4" y="57" text-anchor="end">{{ inLabel }}</text>
          <line x1="58" y1="11" x2="10" y2="11" />
          <polygon points="4,11 11,7 11,15" />
          <text x="4" y="57">{{ outLabel }}</text>
        </g>
        <!-- 站里的车厢 -->
        <g v-for="(c, k) in f.cars" :key="'c' + c" class="car" :class="{
          now: !asks && f.kind === 'in' && c === f.car && k === f.cars.length - 1,
          stuck: f.kind === 'stuck' && c === f.car,
        }">
          <rect :x="carX" :y="carY(k)" :width="carW" :height="carH" rx="3" />
          <text :x="carX + carW / 2" :y="carY(k) + carH / 2 + 5" text-anchor="middle">{{ c }}</text>
        </g>
        <!-- 刚开出的那节，停在左边主线上 -->
        <g v-if="f.kind === 'out'" class="car now">
          <rect x="20" :y="(railTop + railBottom - carH) / 2" :width="carW" :height="carH" rx="3" />
          <text :x="20 + carW / 2" :y="(railTop + railBottom) / 2 + 5" text-anchor="middle">{{ f.car }}</text>
        </g>
        <!-- 右边主线上等着进站的车厢 -->
        <g v-if="waiting" class="car">
          <rect :x="W - 34" :y="(railTop + railBottom - carH) / 2" :width="carW" :height="carH" rx="3" />
          <text :x="W - 34 + carW / 2" :y="(railTop + railBottom) / 2 + 5" text-anchor="middle">{{ waiting }}</text>
        </g>
        <!-- 调度员要问的事 -->
        <g v-if="asks" class="ask">
          <text x="-30" y="-8">开出去的是几号？</text>
          <text :x="W + 30" y="-8" text-anchor="end">下一节开进来</text>
          <text v-if="f.cars.length" :x="sideR + 6" :y="carY(f.cars.length - 1) + carH / 2 + 4">← 最外面是几号？</text>
          <text :x="sideL - 6" :y="deadEnd - 30" text-anchor="end">站里还有车吗？→</text>
        </g>
        <!-- 栈顶、栈底 -->
        <g v-if="terms && f.cars.length" class="term">
          <text :x="sideR + 8" :y="carY(f.cars.length - 1) + carH / 2 + 4">← 栈顶</text>
          <text v-if="f.cars.length > 1" :x="sideR + 8" :y="carY(0) + carH / 2 + 4">← 栈底</text>
        </g>
      </svg>
      <figcaption v-if="!last && f.caption">
        <span class="step">{{ f.caption }}</span>
        <span class="gone">已开出：{{ f.gone.length ? f.gone.join(' ') : '无' }}</span>
      </figcaption>
    </figure>
  </div>
</template>

<style scoped>
.rail-yard {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 12px;
  margin: 16px 0;
}
.rail-yard.single {
  justify-content: center;
}
/* 一行三张；窄屏一行两张 */
.rail-frame {
  margin: 0;
  width: calc((100% - 24px) / 3);
  text-align: center;
}
.rail-yard.single .rail-frame.wide {
  width: 340px;
  max-width: 100%;
}
.rail-yard.single .rail-frame {
  width: 240px;
}
@media (max-width: 480px) {
  .rail-frame {
    width: calc((100% - 12px) / 2);
  }
}
svg {
  display: block;
  width: 100%;
  height: auto;
}
.tie line {
  stroke: var(--vp-c-divider);
  stroke-width: 2;
}
.rail line {
  stroke: var(--vp-c-text-2);
  stroke-width: 2;
}
.stop {
  stroke: var(--vp-c-text-1);
  stroke-width: 5;
}
.dir line {
  stroke: var(--vp-c-text-3);
  stroke-width: 1.5;
}
.dir polygon {
  fill: var(--vp-c-text-3);
}
.ask text {
  font-size: 12px;
  fill: var(--vp-c-brand-1);
}
.dir text,
.term text {
  font-size: 12px;
  fill: var(--vp-c-text-2);
}
.car rect {
  fill: var(--vp-c-bg-soft);
  stroke: var(--vp-c-text-1);
  stroke-width: 1.5;
}
.car text {
  font-size: 14px;
  font-weight: 600;
  fill: var(--vp-c-text-1);
}
.car.now rect {
  fill: var(--vp-c-brand-soft);
  stroke: var(--vp-c-brand-1);
}
.car.stuck rect {
  fill: var(--vp-c-danger-soft);
  stroke: var(--vp-c-danger-1);
  stroke-dasharray: 3 2;
}
figcaption {
  display: flex;
  flex-direction: column;
  font-size: 13px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}
figcaption .step {
  color: var(--vp-c-text-1);
  font-weight: 600;
}
</style>
