<script setup lang="ts">
import { computed } from 'vue'

/**
 * 树的示意图（第4章）：根在上，一层一层往下画，父子之间连线。纯静态 SVG。
 *
 * tree：括号写法，结点名后面的括号里是它的孩子，逗号分开，例如 `文档(工作(周报,合同),论文(初稿),下载/)`。
 *   最外层写几棵树（逗号分开）就是森林，并排画。名字末尾的 `/` 表示文件夹（显示时去掉），空文件夹靠它认出来。
 * folders：把文件夹（有孩子的结点，以及名字带 `/` 的）画成带折角的框，文件只写名字。不给时每个结点都画圆角框。
 * hi：高亮的结点名，空格分开。
 * circle：圈出以这个结点为根的子树，空格分开可以圈几棵。
 * path：从根到这个结点的路径加粗。
 * 孩子兄弟表示法的分步图（颜色在 custom.css 的 --tree-first、--tree-sib、--tree-cut）：
 *   keep：留下的长子边，`父-子`，画成绿色粗线；
 *   cut：要删掉的父子边，画成橙色虚线；
 *   drop：已经删掉的父子边，不画；
 *   sib：新连上的兄弟边，`甲-乙`，画成紫色粗线，带箭头；
 *   compact：结点名只有一个字母时用，结点框窄一些，成对的两张图才放得进一行。
 *   spread：兄弟之间留宽一点。分步图里每一张都要加，原树和变换后的图才一样大、位置对得上。
 * extra：反例里多出来的父子关系，`父-子` 用空格分开，画成红色虚线，子结点描红。
 * levels：左边标"第1层""第2层"……
 * label：结点旁边的小字，`名:文字` 用空格分开，例如 `文档:4 工作:3`。
 * dim：画成灰色的结点名（比如去掉的根）。
 * binary：二叉树。每个结点的孩子写成"左,右"两个位置，空着的一边不写，例如 `-(,3)` 只有右孩子、`!(3,)` 只有左孩子。
 *   只有一个孩子时画在左下或右下，不居中。tree 为空串时画一个"空"字（空二叉树）。
 * slots：二叉树里把空着的位置画成虚线小框。
 * lr：二叉树里左边按长子边的颜色（--tree-first）、右边按兄弟边的颜色（--tree-sib）上色，接 4.3 的分步图。
 * caption：图下面的一行说明。
 */
const props = withDefaults(
  defineProps<{
    tree: string
    folders?: boolean
    hi?: string
    circle?: string
    path?: string
    extra?: string
    levels?: boolean
    label?: string
    dim?: string
    cut?: string
    sib?: string
    keep?: string
    drop?: string
    spread?: boolean
    compact?: boolean
    binary?: boolean
    slots?: boolean
    lr?: boolean
    caption?: string
  }>(),
  { folders: false, hi: '', circle: '', path: '', extra: '', levels: false, label: '', dim: '', cut: '', sib: '', keep: '', drop: '', spread: false, compact: false, binary: false, slots: false, lr: false, caption: '' },
)

interface TNode {
  name: string
  folder: boolean
  kids: TNode[]
  depth: number
  x: number
  y: number
  w: number
  parent: TNode | null
  empty?: boolean // 二叉树里空着的位置
}

function parse(src: string): TNode[] {
  let i = 0
  const s = src.trim()
  function list(depth: number, parent: TNode | null): TNode[] {
    const out: TNode[] = []
    for (;;) {
      let name = ''
      while (i < s.length && !'(),'.includes(s[i])) name += s[i++]
      name = name.trim()
      const n: TNode = { name, folder: false, kids: [], depth, x: 0, y: 0, w: 0, parent }
      if (name.endsWith('/')) {
        n.name = name.slice(0, -1).trim()
        n.folder = true
      }
      if (s[i] === '(') {
        i++
        n.kids = list(depth + 1, n)
        if (s[i] !== ')') throw new Error(`TreeFigure: 括号不配对「${src}」`)
        if (props.binary && n.kids.length !== 2) throw new Error(`TreeFigure: 二叉树的孩子要写成"左,右"两个位置「${src}」`)
        i++
        n.folder = true
      }
      if (!n.name) {
        if (!props.binary || n.kids.length) throw new Error(`TreeFigure: 有结点没写名字「${src}」`)
        n.empty = true
      }
      out.push(n)
      if (s[i] === ',') {
        i++
        continue
      }
      return out
    }
  }
  const roots = list(1, null)
  if (i !== s.length) throw new Error(`TreeFigure: 多出来的字符「${s.slice(i)}」`)
  return roots
}

const words = (v: string) => v.trim().split(/\s+/).filter(Boolean)

// 粗略量字宽：汉字 14px，其他 8px（字号 14）
const textW = (t: string) => [...t].reduce((a, c) => a + (/[　-鿿＀-￯]/.test(c) ? 14 : 8), 0)

const levelGap = 58
const nodeH = 26
// 要画兄弟横箭头时，兄弟之间多留些地方
const gapX = computed(() => (props.spread || props.sib.trim() ? 22 : 10))
// 结点旁有小字时，根上面的小字要留地方
const top = computed(() => (props.label.trim() ? 18 : 8))

// 图的宽度：树的宽度，和下面那行说明（13px 字，按 14px 字宽估的 0.93）里大的那个
const figW = computed(() => Math.max(layout.value.W, props.caption ? Math.ceil(textW(props.caption) * 0.93) + 8 : 0))

const isEmptyTree = computed(() => props.binary && props.tree.trim() === '')

const layout = computed(() => {
  // 空二叉树：画一个占位的结点，模板里换成"空"字
  const roots = isEmptyTree.value ? parse('空') : parse(props.tree)
  const all: TNode[] = []
  const walk = (n: TNode) => {
    all.push(n)
    n.kids.forEach(walk)
  }
  roots.forEach(walk)
  for (const n of all) n.w = n.empty ? (props.compact ? 24 : 30) : Math.max(props.compact ? 28 : 36, textW(n.name) + 16)
  // 叶子从左到右排，父结点放在第一个和最后一个孩子的正中
  const left0 = props.levels ? 52 : 8
  let cursor = left0
  const place = (n: TNode) => {
    if (!n.kids.length) {
      n.x = cursor + n.w / 2
      cursor += n.w + gapX.value
    } else {
      n.kids.forEach(place)
      n.x = (n.kids[0].x + n.kids[n.kids.length - 1].x) / 2
      // 父结点比孩子们宽时，右边的兄弟要让开
      cursor = Math.max(cursor, n.x + n.w / 2 + gapX.value)
    }
    n.y = top.value + (n.depth - 1) * levelGap
  }
  roots.forEach((r, k) => {
    if (k) cursor += 28 // 森林里几棵树之间多空一点
    place(r)
  })
  const maxDepth = Math.max(...all.map((n) => n.depth))
  // 结点旁边的小字也要算进宽度，否则最右边的会被裁掉
  const tagW = (n: TNode) => {
    const t = words(props.label).find((w) => w.startsWith(n.name + ':'))
    return t ? textW(t.slice(n.name.length + 1)) + 4 : 0
  }
  const right = Math.max(...all.map((n) => n.x + n.w / 2 + tagW(n)))
  return { roots, all, W: Math.ceil(right + 8), H: top.value + (maxDepth - 1) * levelGap + nodeH + 8, maxDepth }
})

const byName = (name: string) => layout.value.all.find((n) => n.name === name)
const hiSet = computed(() => new Set(words(props.hi)))
const dimSet = computed(() => new Set(words(props.dim)))
const labels = computed(() => {
  const m = new Map<string, string>()
  for (const w of words(props.label)) {
    const k = w.indexOf(':')
    if (k > 0) m.set(w.slice(0, k), w.slice(k + 1))
  }
  return m
})
const pathSet = computed(() => {
  const s = new Set<TNode>()
  for (let n = props.path ? byName(props.path) : undefined; n; n = n.parent ?? undefined) s.add(n)
  return s
})
const extras = computed(() =>
  words(props.extra).map((w) => {
    const [a, b] = w.split('-')
    const p = byName(a)
    const c = byName(b)
    if (!p || !c) throw new Error(`TreeFigure: extra 里找不到结点「${w}」`)
    return { p, c }
  }),
)
const cutSet = computed(() => new Set(words(props.cut)))
const keepSet = computed(() => new Set(words(props.keep)))
const dropSet = computed(() => new Set(words(props.drop)))
// 兄弟之间的横箭头：从甲的右边到乙的左边
const sibs = computed(() =>
  words(props.sib).map((w) => {
    const [a, b] = w.split('-')
    const p = byName(a)
    const c = byName(b)
    if (!p || !c) throw new Error(`TreeFigure: sib 里找不到结点「${w}」`)
    const x1 = p.x + p.w / 2 + 2
    const x2 = c.x - c.w / 2 - 2
    const y = p.y + nodeH / 2
    return { x1, x2, y, head: `${x2},${y} ${x2 - 8},${y - 4} ${x2 - 8},${y + 4}` }
  }),
)
const extraKids = computed(() => new Set(extras.value.map((e) => e.c)))
// 圈出的子树：取子树里所有结点的外框
const circles = computed(() =>
  words(props.circle).map((name) => {
    const r = byName(name)
    if (!r) throw new Error(`TreeFigure: circle 里找不到结点「${name}」`)
    const ns: TNode[] = []
    const walk = (n: TNode) => {
      ns.push(n)
      n.kids.forEach(walk)
    }
    walk(r)
    const x1 = Math.min(...ns.map((n) => n.x - n.w / 2)) - 5
    const x2 = Math.max(...ns.map((n) => n.x + n.w / 2)) + 5
    const y1 = r.y - 5
    const y2 = Math.max(...ns.map((n) => n.y)) + nodeH + 5
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
  }),
)
// 多出来的边画成弧线，免得和原有的边叠在一起
function bend(p: TNode, c: TNode) {
  const x1 = p.x
  const y1 = p.y + nodeH
  const x2 = c.x
  const y2 = c.y
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  // 往左边鼓出去
  const cx = (x1 + x2) / 2 - ((y2 - y1) / len) * 36
  const cy = (y1 + y2) / 2 + ((x2 - x1) / len) * 36
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
}
const edges = computed(() =>
  layout.value.all
    .flatMap((n) => n.kids.map((c, k) => ({ p: n, c, side: k === 0 ? 'left' : 'right' })))
    .filter((e) => (!e.c.empty || props.slots) && !dropSet.value.has(`${e.p.name}-${e.c.name}`)),
)
const shown = computed(() => (isEmptyTree.value ? [] : layout.value.all.filter((n) => !n.empty)))
const slotNodes = computed(() => (props.slots ? layout.value.all.filter((n) => n.empty) : []))

function aria() {
  if (isEmptyTree.value) return '空二叉树'
  const show = (n: TNode): string => (n.empty ? '空' : n.kids.length ? `${n.name}（${n.kids.map(show).join('，')}）` : n.name)
  return `${props.binary ? '二叉树' : '树'}：${layout.value.roots.map(show).join('；')}`
}
</script>

<template>
  <figure class="tree-figure" :style="{ width: `${figW}px` }">
    <svg :viewBox="`0 0 ${layout.W} ${layout.H}`" :style="{ width: `${layout.W}px` }" role="img" :aria-label="aria()">
      <g v-if="levels" class="lvl">
        <text v-for="d in layout.maxDepth" :key="d" x="4" :y="top + (d - 1) * levelGap + nodeH / 2 + 4">第{{ d }}层</text>
      </g>
      <rect v-for="(c, k) in circles" :key="'c' + k" class="circle" :x="c.x" :y="c.y" :width="c.w" :height="c.h" rx="10" />
      <line
        v-for="(e, k) in edges"
        :key="'e' + k"
        class="edge"
        :class="{ on: pathSet.has(e.c) && pathSet.has(e.p), dim: dimSet.has(e.p.name), cut: cutSet.has(`${e.p.name}-${e.c.name}`), keep: keepSet.has(`${e.p.name}-${e.c.name}`) || (lr && e.side === 'left'), lsib: lr && e.side === 'right', slot: e.c.empty }"
        :x1="e.p.x"
        :y1="e.p.y + nodeH"
        :x2="e.c.x"
        :y2="e.c.y"
      />
      <g v-for="(e, k) in sibs" :key="'s' + k" class="sib">
        <line :x1="e.x1" :y1="e.y" :x2="e.x2 - 4" :y2="e.y" />
        <polygon :points="e.head" />
      </g>
      <path v-for="(e, k) in extras" :key="'x' + k" class="edge bad" :d="bend(e.p, e.c)" />
      <g
        v-for="n in shown"
        :key="n.name + n.depth + n.x"
        class="node"
        :class="{ hi: hiSet.has(n.name), on: pathSet.has(n), bad: extraKids.has(n), dim: dimSet.has(n.name), file: folders && !n.folder }"
      >
        <path
          v-if="folders && n.folder"
          class="box"
          :d="`M ${n.x - n.w / 2} ${n.y + 4} h ${Math.min(18, n.w / 3)} l 3 -4 h ${n.w - Math.min(18, n.w / 3) - 3} v ${nodeH} h ${-n.w} z`"
        />
        <rect v-else class="box" :x="n.x - n.w / 2" :y="n.y" :width="n.w" :height="nodeH" rx="5" />
        <text class="name" :x="n.x" :y="n.y + nodeH / 2 + 6" text-anchor="middle">{{ n.name }}</text>
        <text v-if="labels.get(n.name)" class="tag" :x="n.x + n.w / 2 + 2" :y="n.y - 1">{{ labels.get(n.name) }}</text>
      </g>
      <!-- 二叉树里空着的位置 -->
      <rect v-for="(n, k) in slotNodes" :key="'s' + k" class="slot" :x="n.x - n.w / 2" :y="n.y" :width="n.w" :height="nodeH" rx="5" />
      <g v-if="isEmptyTree" class="node">
        <rect class="slot" :x="layout.all[0].x - 18" :y="top" width="36" :height="nodeH" rx="5" />
        <text class="name empty" :x="layout.all[0].x" :y="top + nodeH / 2 + 6" text-anchor="middle">空</text>
      </g>
    </svg>
    <figcaption v-if="caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.tree-figure {
  margin: 16px auto;
  max-width: 100%;
}
svg {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
}
.edge.slot,
.slot {
  fill: none;
  stroke: var(--vp-c-text-3);
  stroke-dasharray: 3 3;
  stroke-width: 1.2;
}
.name.empty {
  fill: var(--vp-c-text-3);
}
.edge.lsib {
  stroke: var(--tree-sib);
  stroke-width: 3;
}
figcaption {
  margin-top: 4px;
  text-align: center;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.edge {
  stroke: var(--vp-c-text-2);
  stroke-width: 1.5;
}
.edge.on {
  stroke: var(--vp-c-brand-1);
  stroke-width: 3;
}
.edge.bad {
  fill: none;
  stroke: var(--vp-c-danger-1);
  stroke-dasharray: 5 3;
  stroke-width: 2;
}
.edge.cut {
  stroke: var(--tree-cut);
  stroke-dasharray: 5 4;
  stroke-width: 1.8;
}
.edge.keep {
  stroke: var(--tree-first);
  stroke-width: 3;
}
.sib line {
  stroke: var(--tree-sib);
  stroke-width: 3;
}
.sib polygon {
  fill: var(--tree-sib);
}
.edge.dim {
  stroke: var(--vp-c-text-3);
  stroke-dasharray: 3 3;
}
.box {
  fill: var(--vp-c-bg-soft);
  stroke: var(--vp-c-text-1);
  stroke-width: 1.5;
}
.node.file .box {
  fill: transparent;
  stroke: transparent;
}
.node.hi .box,
.node.on .box {
  fill: var(--vp-c-brand-soft);
  stroke: var(--vp-c-brand-1);
}
.node.bad .box {
  stroke: var(--vp-c-danger-1);
  stroke-width: 2;
}
.node.dim .box {
  stroke: var(--vp-c-text-3);
  stroke-dasharray: 3 3;
}
.node.dim .name {
  fill: var(--vp-c-text-3);
}
.name {
  font-size: 14px;
  fill: var(--vp-c-text-1);
}
.node.hi .name,
.node.on .name {
  font-weight: 600;
}
.tag {
  font-size: 12px;
  font-weight: 600;
  fill: var(--vp-c-brand-1);
  /* 压在连线上时也看得清 */
  paint-order: stroke;
  stroke: var(--vp-c-bg);
  stroke-width: 3px;
}
.lvl text {
  font-size: 12px;
  fill: var(--vp-c-text-3);
}
.circle {
  fill: none;
  stroke: var(--vp-c-brand-1);
  stroke-width: 1.5;
  stroke-dasharray: 6 4;
}
</style>
