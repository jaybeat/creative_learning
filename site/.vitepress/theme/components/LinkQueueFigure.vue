<script setup lang="ts">
import { computed } from 'vue'

/**
 * 链队的箭头图（第3章）：横着画，左边是头结点（数据格空着），往右依次是队头到队尾。
 * 画法沿用 LinkStackFigure：结点分数据格和地址格，地址格写下一个结点的地址，最后一个写 0；
 * 结点下面标自己的地址。front、p、q 的箭头在上面，rear 的箭头在下面。纯静态 SVG。
 *
 * items：开始时队里的元素，空格分开，从队头到队尾。地址按 addrs 依次分配（头结点先拿）。
 * ops：一串操作，空格分开；给了就画一排小图（第一张是调用前，之后每步一张）。
 *   整个操作：`en:4`、`de`、`gethead`、`init`。
 *   EnQueue 分步：`new:4` 申请结点 q 放 4、q->next = NULL；`link` rear->next = q；`move` rear = q。
 *   DeQueue 分步：`take` p = front->next、*x = p->data；`next` front->next = p->next（p 结点掉到下面一行）；
 *     `fixrear` 删的是最后一个时 rear 退回头结点；`free` free(p)。
 * nohead：不带头结点（front 指队头结点，空队列时 front、rear 都是 NULL）。只支持 items 和 en。
 * skip：去掉前几张小图。labels：同 StackFigure，用 | 分开、~ 换行。
 */
const props = withDefaults(
  defineProps<{ items?: string; ops?: string; addrs?: string; nohead?: boolean; skip?: number | string; labels?: string }>(),
  { items: '', ops: '', addrs: '100 109 105 112 118 124 130', nohead: false, skip: 0, labels: '' },
)

interface Node {
  v: string // 头结点为 ''
  addr: string
  next: string // 地址格：'0' 表示没有，'?' 表示还没填
  state: 'live' | 'new' | 'out' | 'freed' // out：已经从链上摘下来，还没释放
  head?: boolean
}
type Hi = '' | 'node' | 'next' | 'data' | 'front' | 'rear'
interface Frame {
  nodes: Node[] // 从左到右
  front: string // 地址，空为 NULL
  rear: string
  tmp: string // q 或 p 指着的地址
  tmpName: string
  hi: Hi
  hiAddr: string
  caption: string
  note: string
  more?: string[]
}

const frames = computed<Frame[]>(() => {
  const pool = props.addrs.trim().split(/\s+/)
  let used = 0
  const take = () => pool[used++] ?? String(200 + used * 8)
  let nodes: Node[] = []
  if (!props.nohead) nodes.push({ v: '', addr: take(), next: '0', state: 'live', head: true })
  for (const v of props.items.trim().split(/\s+/).filter(Boolean)) {
    const n: Node = { v, addr: take(), next: '0', state: 'live' }
    if (nodes.length) nodes[nodes.length - 1].next = n.addr
    nodes.push(n)
  }
  let front = nodes[0]?.addr ?? 'NULL'
  let rear = nodes[nodes.length - 1]?.addr ?? 'NULL'
  let tmp = ''
  let tmpName = ''
  const clone = () => nodes.map((n) => ({ ...n }))
  const byAddr = (a: string) => nodes.find((n) => n.addr === a)
  const headNode = () => nodes.find((n) => n.head)!
  const tokens = props.ops.trim().split(/\s+/).filter(Boolean)
  const out: Frame[] = [
    { nodes: clone(), front, rear, tmp, tmpName, hi: '', hiAddr: '', caption: tokens.length ? '调用前' : '', note: '' },
  ]
  // 出队的各步
  const deTake = () => {
    const h = headNode()
    if (h.next === '0') throw new Error('LinkQueueFigure: 空队列不能出队')
    tmp = h.next
    tmpName = 'p'
    return byAddr(tmp)!
  }
  const deNext = () => {
    const p = byAddr(tmp)!
    headNode().next = p.next
    p.state = 'out'
  }
  const deFix = () => {
    const was = rear === tmp
    if (was) rear = front
    return was
  }
  const deFree = () => {
    byAddr(tmp)!.state = 'freed'
  }
  for (const t of tokens) {
    const [op, arg] = t.split(':')
    let hi: Hi = ''
    let hiAddr = ''
    let caption = ''
    let note = ''
    // 上一步释放掉的结点，这一步不再画
    nodes = nodes.filter((n) => n.state !== 'freed')
    if (op === 'new') {
      const addr = take()
      nodes.push({ v: arg, addr, next: '0', state: 'new' })
      tmp = addr
      tmpName = 'q'
      ;[hi, hiAddr, caption] = ['node', addr, `申请结点q，放${arg}`]
      note = 'q->next = NULL'
    } else if (op === 'link') {
      byAddr(rear)!.next = tmp
      ;[hi, hiAddr, caption] = ['next', rear, 'Q->rear->next = q']
    } else if (op === 'move') {
      rear = tmp
      byAddr(tmp)!.state = 'live'
      ;[hi, hiAddr, caption] = ['rear', rear, 'Q->rear = q']
    } else if (op === 'en') {
      const addr = take()
      if (props.nohead && rear === 'NULL') front = addr
      else byAddr(rear)!.next = addr
      nodes.push({ v: arg, addr, next: '0', state: 'live' })
      rear = addr
      tmp = ''
      ;[hi, hiAddr, caption] = ['node', addr, `EnQueue(Q, ${arg})`]
    } else if (op === 'take') {
      const p = deTake()
      ;[hi, hiAddr, caption, note] = ['data', p.addr, 'p = Q->front->next', `*x = p->data，x = ${p.v}`]
    } else if (op === 'next') {
      deNext()
      ;[hi, hiAddr, caption] = ['next', headNode().addr, 'Q->front->next = p->next']
    } else if (op === 'fixrear') {
      const was = deFix()
      ;[hi, hiAddr, caption, note] = was
        ? ['rear', rear, 'Q->rear = Q->front', '删的是最后一个，rear退回头结点']
        : ['', '', 'Q->rear != p', 'rear不用动']
    } else if (op === 'free') {
      deFree()
      ;[hi, hiAddr, caption] = ['node', tmp, 'free(p)']
    } else if (op === 'de') {
      const p = deTake()
      deNext()
      deFix()
      deFree()
      nodes = nodes.filter((n) => n.state !== 'freed')
      tmp = ''
      ;[caption, note] = ['DeQueue(Q, &x)', `x = ${p.v}`]
    } else if (op === 'gethead') {
      const h = headNode()
      if (h.next === '0') throw new Error('LinkQueueFigure: 空队列没有队头')
      const n = byAddr(h.next)!
      ;[hi, hiAddr, caption, note] = ['data', n.addr, 'GetHead(Q, &x)', `x = ${n.v}`]
    } else if (op === 'init') {
      nodes = [{ v: '', addr: take(), next: '0', state: 'live', head: true }]
      front = rear = nodes[0].addr
      tmp = ''
      caption = 'InitQueue(Q)'
    } else {
      throw new Error(`LinkQueueFigure: 看不懂的操作「${t}」`)
    }
    out.push({ nodes: clone(), front, rear, tmp, tmpName, hi, hiAddr, caption, note })
  }
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

// 几何
const dataW = 28
const nextW = 34
const nodeW = dataW + nextW
const gap = 20
const nodeH = 28
const pad = 8
const nodeTop = 38 // 上面留给 front、p、q
const drop = 40 // 摘下来的结点往下掉多少
const slots = computed(() => Math.max(3, ...frames.value.map((f) => f.nodes.length)))
const anyOut = computed(() => frames.value.some((f) => f.nodes.some((n) => n.state === 'out' || n.state === 'freed')))
const W = computed(() => pad * 2 + slots.value * nodeW + (slots.value - 1) * gap)
const rowBottom = computed(() => nodeTop + nodeH + (anyOut.value ? drop : 0))
const rearY = computed(() => rowBottom.value + 44)
const H = computed(() => rearY.value + 6)
const nodeX = (k: number) => pad + k * (nodeW + gap)
const nodeY = (n: Node) => (n.state === 'out' || n.state === 'freed' ? nodeTop + drop : nodeTop)
const idx = (f: Frame, addr: string) => f.nodes.findIndex((n) => n.addr === addr)

/** 地址格到下一个结点的箭头：从地址格右边出发，到目标结点左边 */
function arrowPath(f: Frame, k: number) {
  const n = f.nodes[k]
  const j = idx(f, n.next)
  if (j < 0) return null
  const t = f.nodes[j]
  const x1 = nodeX(k) + nodeW
  const y1 = nodeY(n) + nodeH / 2
  const x2 = nodeX(j) - 2
  const y2 = nodeY(t) + nodeH / 2
  return { x1, y1, x2, y2 }
}
function head(x2: number, y2: number, x1: number, y1: number) {
  const a = Math.atan2(y2 - y1, x2 - x1)
  const p = (d: number, r: number) => `${x2 - Math.cos(a + r) * d},${y2 - Math.sin(a + r) * d}`
  return `${x2},${y2} ${p(8, 0.45)} ${p(8, -0.45)}`
}
function label(f: Frame) {
  // 从队头顺着地址格走，走得到的才在队里
  const live: string[] = []
  const first = f.nodes.find((n) => n.head)?.next ?? f.front
  for (let n = f.nodes.find((m) => m.addr === first); n && live.length <= 20; n = f.nodes.find((m) => m.addr === n!.next)) {
    live.push(n.v)
  }
  return live.length ? `链队：从队头到队尾是${live.join('、')}` : '空的链队'
}
</script>

<template>
  <div class="link-queue" :class="{ multi }">
    <figure v-for="(f, i) in frames" :key="i" class="lq-frame" :style="{ width: `${W}px` }">
      <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="label(f)">
        <!-- 地址格的箭头 -->
        <template v-for="(n, k) in f.nodes" :key="'a' + n.addr">
          <g v-if="arrowPath(f, k) && n.state !== 'freed'" class="arrow" :class="{ faint: n.state === 'out' }">
            <line :x1="arrowPath(f, k)!.x1" :y1="arrowPath(f, k)!.y1" :x2="arrowPath(f, k)!.x2 - 4" :y2="arrowPath(f, k)!.y2" />
            <polygon :points="head(arrowPath(f, k)!.x2, arrowPath(f, k)!.y2, arrowPath(f, k)!.x1, arrowPath(f, k)!.y1)" />
          </g>
        </template>
        <!-- 结点 -->
        <g v-for="(n, k) in f.nodes" :key="n.addr" class="node" :class="[n.state, { now: f.hi === 'node' && f.hiAddr === n.addr }]">
          <rect class="box" :x="nodeX(k)" :y="nodeY(n)" :width="nodeW" :height="nodeH" />
          <rect v-if="n.head" class="headfill" :x="nodeX(k) + 1" :y="nodeY(n) + 1" :width="dataW - 1" :height="nodeH - 2" />
          <rect v-if="f.hi === 'data' && f.hiAddr === n.addr" class="hi" :x="nodeX(k)" :y="nodeY(n)" :width="dataW" :height="nodeH" />
          <rect v-if="f.hi === 'next' && f.hiAddr === n.addr" class="hi" :x="nodeX(k) + dataW" :y="nodeY(n)" :width="nextW" :height="nodeH" />
          <line class="sep" :x1="nodeX(k) + dataW" :y1="nodeY(n)" :x2="nodeX(k) + dataW" :y2="nodeY(n) + nodeH" />
          <text class="v" :x="nodeX(k) + dataW / 2" :y="nodeY(n) + nodeH / 2 + 5" text-anchor="middle">{{ n.v }}</text>
          <text class="a" :x="nodeX(k) + dataW + nextW / 2" :y="nodeY(n) + nodeH / 2 + 4" text-anchor="middle">{{ n.next }}</text>
          <text class="own" :x="nodeX(k) + nodeW" :y="nodeY(n) + nodeH + 12" text-anchor="end">{{ n.addr }}</text>
          <!-- 写在结点左边，免得压住下面的 rear 箭头 -->
          <text v-if="n.state === 'freed'" class="freed-note" :x="nodeX(k) - 4" :y="nodeY(n) + nodeH / 2 + 4" text-anchor="end">已释放</text>
        </g>
        <!-- front 和 p、q：在上面 -->
        <g v-if="f.front !== 'NULL' && idx(f, f.front) >= 0" class="ptr" :class="{ now: f.hi === 'front' }">
          <text :x="nodeX(idx(f, f.front)) + dataW / 2 - 6" y="13">front</text>
          <line :x1="nodeX(idx(f, f.front)) + dataW / 2" y1="18" :x2="nodeX(idx(f, f.front)) + dataW / 2" :y2="nodeTop - 6" />
          <polygon :points="`${nodeX(idx(f, f.front)) + dataW / 2},${nodeTop - 1} ${nodeX(idx(f, f.front)) + dataW / 2 - 4},${nodeTop - 8} ${nodeX(idx(f, f.front)) + dataW / 2 + 4},${nodeTop - 8}`" />
        </g>
        <g v-if="f.tmp && idx(f, f.tmp) >= 0" class="ptr tmp">
          <text :x="nodeX(idx(f, f.tmp)) + dataW / 2" y="13" text-anchor="middle">{{ f.tmpName }}</text>
          <line :x1="nodeX(idx(f, f.tmp)) + dataW / 2" y1="18" :x2="nodeX(idx(f, f.tmp)) + dataW / 2" :y2="nodeY(f.nodes[idx(f, f.tmp)]) - 6" />
          <polygon :points="`${nodeX(idx(f, f.tmp)) + dataW / 2},${nodeY(f.nodes[idx(f, f.tmp)]) - 1} ${nodeX(idx(f, f.tmp)) + dataW / 2 - 4},${nodeY(f.nodes[idx(f, f.tmp)]) - 8} ${nodeX(idx(f, f.tmp)) + dataW / 2 + 4},${nodeY(f.nodes[idx(f, f.tmp)]) - 8}`" />
        </g>
        <!-- rear：在下面 -->
        <g v-if="f.rear !== 'NULL' && idx(f, f.rear) >= 0" class="ptr" :class="{ now: f.hi === 'rear', bad: f.nodes[idx(f, f.rear)].state === 'freed' }">
          <text :x="nodeX(idx(f, f.rear)) + dataW / 2 - 6" :y="rearY">rear</text>
          <line :x1="nodeX(idx(f, f.rear)) + dataW / 2" :y1="rearY - 14" :x2="nodeX(idx(f, f.rear)) + dataW / 2" :y2="nodeY(f.nodes[idx(f, f.rear)]) + nodeH + 6" />
          <polygon :points="`${nodeX(idx(f, f.rear)) + dataW / 2},${nodeY(f.nodes[idx(f, f.rear)]) + nodeH + 1} ${nodeX(idx(f, f.rear)) + dataW / 2 - 4},${nodeY(f.nodes[idx(f, f.rear)]) + nodeH + 8} ${nodeX(idx(f, f.rear)) + dataW / 2 + 4},${nodeY(f.nodes[idx(f, f.rear)]) + nodeH + 8}`" />
        </g>
        <text v-if="f.front === 'NULL'" class="null" :x="pad" y="13">front = NULL</text>
        <text v-if="f.rear === 'NULL'" class="null" :x="pad" :y="rearY">rear = NULL</text>
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
.link-queue {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  margin: 16px 0;
}
.link-queue.multi {
  justify-content: flex-start;
  gap: 16px;
}
/* 宽度按 viewBox 一比一（模板里写 style），各张图的字一样大；放不下就缩小。宽屏一行两张，窄屏一行一张 */
.lq-frame {
  margin: 0;
  max-width: 100%;
  text-align: center;
}
svg {
  display: block;
  width: 100%;
  height: auto;
}
.box {
  fill: var(--vp-c-bg-soft);
  stroke: var(--vp-c-text-1);
  stroke-width: 1.5;
}
.headfill {
  fill: var(--vp-c-default-soft);
}
.sep {
  stroke: var(--vp-c-text-1);
  stroke-width: 1.5;
}
.hi {
  fill: var(--vp-c-brand-soft);
  stroke: var(--vp-c-brand-1);
  stroke-width: 1.5;
}
.node.now .box,
.node.new .box {
  fill: var(--vp-c-brand-soft);
  stroke: var(--vp-c-brand-1);
}
.node.freed .box,
.node.freed .sep {
  fill: none;
  stroke: var(--vp-c-text-3);
  stroke-dasharray: 3 2;
}
.node.freed .headfill {
  display: none;
}
.v {
  font-size: 16px;
  font-weight: 600;
  fill: var(--vp-c-text-1);
}
.a {
  font-size: 12px;
  fill: var(--vp-c-text-1);
}
.own {
  font-size: 12px;
  fill: var(--vp-c-text-3);
}
.node.freed .v,
.node.freed .a {
  fill: var(--vp-c-text-3);
  font-weight: 400;
}
.freed-note {
  font-size: 12px;
  fill: var(--vp-c-danger-1);
}
.arrow line {
  stroke: var(--vp-c-text-2);
  stroke-width: 1.5;
}
.arrow polygon {
  fill: var(--vp-c-text-2);
}
.arrow.faint line {
  stroke: var(--vp-c-text-3);
  stroke-dasharray: 3 2;
}
.arrow.faint polygon {
  fill: var(--vp-c-text-3);
}
.ptr text,
.null {
  font-size: 14px;
  fill: var(--vp-c-text-1);
}
.ptr line {
  stroke: var(--vp-c-text-2);
  stroke-width: 1.5;
}
.ptr polygon {
  fill: var(--vp-c-text-2);
}
.ptr.now text {
  fill: var(--vp-c-brand-1);
  font-weight: 600;
}
.ptr.now line {
  stroke: var(--vp-c-brand-1);
}
.ptr.now polygon {
  fill: var(--vp-c-brand-1);
}
.ptr.bad text {
  fill: var(--vp-c-danger-1);
  font-weight: 600;
}
.ptr.bad line {
  stroke: var(--vp-c-danger-1);
}
.ptr.bad polygon {
  fill: var(--vp-c-danger-1);
}
.ptr.tmp text {
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
