/**
 * 划词定位（W3C Web Annotation 的 TextQuoteSelector 思路）。
 *
 * 书稿会不断修改，评论不能挂在「第几个字符」上：发评论时存下选中原文 exact + 前后各 CONTEXT 个字，
 * 以后每次打开页面都在当前正文里重新找这段原文；找不到就是「原文已修改」。
 *
 * 「正文文本」= .vp-doc 里的文本节点（跳过复制按钮、语言角标、标题 # 链接等界面文字），
 * 连续空白折叠为一个空格。存引文和找引文用同一套规则，所以排版上的空白变化不影响定位。
 */

export const CONTEXT = 32

/** 不属于正文的界面元素 */
export const IGNORE = '.header-anchor, button, .lang, .copy, .fold-toggle, [data-comment-ignore]'

export interface Quote {
  exact: string
  prefix: string
  suffix: string
}

/* ---------- 纯字符串部分（可单测） ---------- */

/** 两段字符串从末尾往前相同的字符数 */
export function commonSuffix(a: string, b: string): number {
  let n = 0
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++
  return n
}

/** 两段字符串从开头往后相同的字符数 */
export function commonPrefix(a: string, b: string): number {
  let n = 0
  while (n < a.length && n < b.length && a[n] === b[n]) n++
  return n
}

export function quoteAt(text: string, start: number, end: number): Quote {
  return {
    exact: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT), start),
    suffix: text.slice(end, end + CONTEXT),
  }
}

/**
 * 在正文里找引文，返回 [start, end)；找不到返回 null。
 * 多处命中时按上下文吻合的字数打分；同分时优先落在 hint 区间（评论所在小节）里的那一处。
 */
export function locate(text: string, q: Quote, hint?: { start: number; end: number } | null): { start: number; end: number } | null {
  if (!q.exact) return null
  let best: { start: number; score: number } | null = null
  for (let i = text.indexOf(q.exact); i !== -1; i = text.indexOf(q.exact, i + 1)) {
    let score = commonSuffix(text.slice(Math.max(0, i - q.prefix.length), i), q.prefix) + commonPrefix(text.slice(i + q.exact.length), q.suffix)
    if (hint && i >= hint.start && i < hint.end) score += 0.5
    if (!best || score > best.score) best = { start: i, score }
  }
  return best && { start: best.start, end: best.start + q.exact.length }
}

/* ---------- DOM 部分 ---------- */

export interface TextIndex {
  /** 折叠空白后的正文 */
  text: string
  /** text 每个字符对应的文本节点与节点内偏移 */
  map: { node: Text; offset: number }[]
  /** 按出现顺序的小节标题：id 与它在 text 中的起点 */
  headings: { id: string; pos: number }[]
}

const isSpace = (ch: string) => /\s/.test(ch)

export function buildTextIndex(root: Element): TextIndex {
  const map: TextIndex['map'] = []
  const headings: TextIndex['headings'] = []
  let text = ''
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (n.nodeType === Node.ELEMENT_NODE) return (n as Element).matches(IGNORE) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as Element
      if (/^H[1-4]$/.test(el.tagName) && el.id) headings.push({ id: el.id, pos: text.length })
      continue
    }
    const t = n as Text
    const s = t.data
    for (let i = 0; i < s.length; i++) {
      if (isSpace(s[i])) {
        if (text.length === 0 || text[text.length - 1] === ' ') continue
        text += ' '
      } else {
        text += s[i]
      }
      map.push({ node: t, offset: i })
    }
  }
  return { text, map, headings }
}

/** 某个位置所在小节的标题 id */
export function headingAt(index: TextIndex, pos: number): string | null {
  let id: string | null = null
  for (const h of index.headings) {
    if (h.pos > pos) break
    id = h.id
  }
  return id
}

/** 某小节在正文中的区间，用作定位时的同分优先区 */
export function sectionRange(index: TextIndex, id: string | null): { start: number; end: number } | null {
  if (!id) return null
  const i = index.headings.findIndex((h) => h.id === id)
  if (i < 0) return null
  return { start: index.headings[i].pos, end: index.headings[i + 1]?.pos ?? index.text.length }
}

/** 浏览器选区 → 正文中的 [start, end)；选区不在正文里时返回 null。首尾空白去掉。 */
export function rangeToOffsets(index: TextIndex, range: Range): { start: number; end: number } | null {
  let start = -1
  let end = -1
  let lastNode: Text | null = null
  let hit = false
  for (let i = 0; i < index.map.length; i++) {
    const { node, offset } = index.map[i]
    if (node !== lastNode) {
      lastNode = node
      hit = range.intersectsNode(node)
      if (!hit && start >= 0) break
    }
    if (!hit) continue
    // 字符起点在选区内（选区终点本身不算）即视为选中
    const selected = range.comparePoint(node, offset) === 0 && !(node === range.endContainer && offset === range.endOffset)
    if (selected) {
      if (start < 0) start = i
      end = i + 1
    }
  }
  if (start < 0) return null
  while (start < end && index.text[start] === ' ') start++
  while (end > start && index.text[end - 1] === ' ') end--
  return end > start ? { start, end } : null
}

/** 正文中的 [start, end) → DOM Range（用于高亮） */
export function offsetsToRange(index: TextIndex, start: number, end: number): Range | null {
  const a = index.map[start]
  const b = index.map[end - 1]
  if (!a || !b) return null
  const r = a.node.ownerDocument.createRange()
  r.setStart(a.node, a.offset)
  r.setEnd(b.node, b.offset + 1)
  return r
}
