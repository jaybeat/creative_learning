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
 * extra：反例里多出来的父子关系，`父-子` 用空格分开，画成红色虚线，子结点描红。
 * levels：左边标"第1层""第2层"……
 * label：结点旁边的小字，`名:文字` 用空格分开，例如 `文档:4 工作:3`。
 * dim：画成灰色的结点名（比如去掉的根）。
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
  }>(),
  { folders: false, hi: '', circle: '', path: '', extra: '', levels: false, label: '', dim: '' },
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
        i++
        n.folder = true
      }
      if (!n.name) throw new Error(`TreeFigure: 有结点没写名字「${src}」`)
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
const gapX = 10
const top = 8

const layout = computed(() => {
  const roots = parse(props.tree)
  const all: TNode[] = []
  const walk = (n: TNode) => {
    all.push(n)
    n.kids.forEach(walk)
  }
  roots.forEach(walk)
  for (const n of all) n.w = Math.max(36, textW(n.name) + 16)
  // 叶子从左到右排，父结点放在第一个和最后一个孩子的正中
  const left0 = props.levels ? 52 : 8
  let cursor = left0
  const place = (n: TNode) => {
    if (!n.kids.length) {
      n.x = cursor + n.w / 2
      cursor += n.w + gapX
    } else {
      n.kids.forEach(place)
      n.x = (n.kids[0].x + n.kids[n.kids.length - 1].x) / 2
      // 父结点比孩子们宽时，右边的兄弟要让开
      cursor = Math.max(cursor, n.x + n.w / 2 + gapX)
    }
    n.y = top + (n.depth - 1) * levelGap
  }
  roots.forEach((r, k) => {
    if (k) cursor += 28 // 森林里几棵树之间多空一点
    place(r)
  })
  const maxDepth = Math.max(...all.map((n) => n.depth))
  const right = Math.max(...all.map((n) => n.x + n.w / 2))
  return { roots, all, W: Math.ceil(right + 8), H: top + (maxDepth - 1) * levelGap + nodeH + 8, maxDepth }
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
const edges = computed(() => layout.value.all.flatMap((n) => n.kids.map((c) => ({ p: n, c }))))

function aria() {
  const show = (n: TNode): string => (n.kids.length ? `${n.name}（${n.kids.map(show).join('，')}）` : n.name)
  return `树：${layout.value.roots.map(show).join('；')}`
}
</script>

<template>
  <figure class="tree-figure" :style="{ width: `${layout.W}px` }">
    <svg :viewBox="`0 0 ${layout.W} ${layout.H}`" role="img" :aria-label="aria()">
      <g v-if="levels" class="lvl">
        <text v-for="d in layout.maxDepth" :key="d" x="4" :y="top + (d - 1) * levelGap + nodeH / 2 + 4">第{{ d }}层</text>
      </g>
      <rect v-for="(c, k) in circles" :key="'c' + k" class="circle" :x="c.x" :y="c.y" :width="c.w" :height="c.h" rx="10" />
      <line
        v-for="(e, k) in edges"
        :key="'e' + k"
        class="edge"
        :class="{ on: pathSet.has(e.c) && pathSet.has(e.p), dim: dimSet.has(e.p.name) }"
        :x1="e.p.x"
        :y1="e.p.y + nodeH"
        :x2="e.c.x"
        :y2="e.c.y"
      />
      <path v-for="(e, k) in extras" :key="'x' + k" class="edge bad" :d="bend(e.p, e.c)" />
      <g
        v-for="n in layout.all"
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
    </svg>
  </figure>
</template>

<style scoped>
.tree-figure {
  margin: 16px auto;
  max-width: 100%;
}
svg {
  display: block;
  width: 100%;
  height: auto;
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
