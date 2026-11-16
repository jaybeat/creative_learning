import type MarkdownIt from 'markdown-it'
import type { MdToken } from './md'

/**
 * 图文按行配对（写法库第 13 条「左右对照」用在书稿正文里）：
 *
 *   ::: side
 *   **根**。A 是这棵树的根……
 *
 *   <TreeFigure binary tree="A(B(D,),C(,F))" hi="A" />
 *
 *   **左子树**。……
 *
 *   <TreeFigure … />
 *   :::
 *
 * 容器里每遇到一张图（以大写字母开头的组件，或 figure-pair），就把它和它前面的文字配成一行：
 * 宽屏时文字在左、图在右，窄屏时图落到文字下面（样式在 custom.css 的 .side-row）。
 * 最后一张图后面剩下的文字单独成一行，占满整行。
 *
 * 版面会上下排，所以正文里不要写"左边的图""右边的图"，一律说"图里"。
 */

type TokenCtor = new (type: string, tag: string, nesting: 0 | 1 | -1) => MdToken
type BlockState = Parameters<Parameters<MarkdownIt['block']['ruler']['before']>[2]>[0]

function sideBlock(state: BlockState, startLine: number, endLine: number, silent: boolean): boolean {
  if (state.sCount[startLine] - state.blkIndent >= 4) return false
  const first = state.src.slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine])
  if (!/^:::\s*side\s*$/.test(first.trimEnd())) return false
  if (silent) return true

  let next = startLine
  let closed = false
  while (++next < endLine) {
    const start = state.bMarks[next] + state.tShift[next]
    const max = state.eMarks[next]
    if (start < max && state.sCount[next] < state.blkIndent) break
    if (state.sCount[next] - state.blkIndent < 4 && /^:::\s*$/.test(state.src.slice(start, max))) {
      closed = true
      break
    }
  }

  const oldParent = state.parentType
  const oldLineMax = state.lineMax
  state.parentType = 'side' as typeof state.parentType
  state.lineMax = next

  const open = state.push('side_open', 'div', 1)
  open.map = [startLine, next + (closed ? 1 : 0)]
  open.block = true
  state.md.block.tokenize(state, startLine + 1, next)
  const close = state.push('side_close', 'div', -1)
  close.block = true

  state.parentType = oldParent
  state.lineMax = oldLineMax
  state.line = next + (closed ? 1 : 0)
  return true
}

const FIGURE_RE = /^<(?:[A-Z][\w-]*[\s/>]|div\s+class="figure-pair")/

// 单独一行的组件：普通 markdown-it 给 html_block；VitePress 的组件插件给 html_inline，后面跟一个空的 inline
export const isFigure = (t: MdToken): boolean =>
  (t.type === 'html_block' || t.type === 'html_inline') && FIGURE_RE.test(t.content.trim())

function html(Token: TokenCtor, content: string): MdToken {
  const t = new Token('html_block', '', 0)
  t.content = content
  t.block = true
  return t
}

/** 找到和 tokens[i]（side_open）配对的 side_close */
function matchClose(tokens: MdToken[], i: number): number {
  let depth = 0
  for (let j = i; j < tokens.length; j++) {
    if (tokens[j].type === 'side_open') depth++
    else if (tokens[j].type === 'side_close' && --depth === 0) return j
  }
  return tokens.length - 1
}

/** 只看顶层：嵌在列表、引用块里的 html_block 不算一张独立的图 */
function rows(Token: TokenCtor, inner: MdToken[]): MdToken[] {
  const out: MdToken[] = [html(Token, '<div class="side">\n')]
  let text: MdToken[] = []
  let level = 0
  for (let k = 0; k < inner.length; k++) {
    const t = inner[k]
    if (level === 0 && isFigure(t)) {
      const fig = [t]
      while (inner[k + 1]?.type === 'inline' && inner[k + 1].content === '') fig.push(inner[++k])
      out.push(html(Token, '<div class="side-row">\n<div class="side-text">\n'), ...text)
      out.push(html(Token, '</div>\n<div class="side-fig">\n'), ...fig, html(Token, '</div>\n</div>\n'))
      text = []
      continue
    }
    level += t.nesting
    text.push(t)
  }
  if (text.length) out.push(html(Token, '<div class="side-row side-row-text">\n'), ...text, html(Token, '</div>\n'))
  out.push(html(Token, '</div>\n'))
  return out
}

export function sidePlugin(md: MarkdownIt): void {
  md.block.ruler.before('fence', 'side', sideBlock, { alt: ['paragraph', 'reference', 'blockquote', 'list'] })
  md.core.ruler.push('side', (state) => {
    const Token = state.Token as TokenCtor
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'side_open') continue
      const end = matchClose(tokens, i)
      const rebuilt = rows(Token, tokens.slice(i + 1, end))
      tokens.splice(i, end - i + 1, ...rebuilt)
      i += rebuilt.length - 1
    }
  })
}
