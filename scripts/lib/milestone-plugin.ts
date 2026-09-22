import type MarkdownIt from 'markdown-it'
import type { MdToken } from './md'

/** 触发识别的首行标签 */
export const MILESTONE_START = '到这里你有了'

/** 标签 → 视觉类别。未知标签一律 note，不报错（作者以后会发明新标签）。 */
export const LABEL_KIND: Record<string, string> = {
  到这里你有了: 'done',
  下一步: 'next',
  还没解决的: 'open',
  学到的: 'note',
  验证了: 'note',
  用到的操作: 'note',
  接口: 'note',
}

export function kindOf(label: string): string {
  return LABEL_KIND[label] ?? 'note'
}

type TokenCtor = new (type: string, tag: string, nesting: 0 | 1 | -1) => MdToken

/**
 * markdown-it 的 emphasis 后处理会把 `**` 的第一个 `*` 留成一个内容为空的 text token
 * （行首的 `**标签**` 前面就会多出一个空 text），先把这些空 token 去掉再做结构判断。
 */
function compact(children: MdToken[]): MdToken[] {
  return children.filter((t) => !(t.type === 'text' && t.content === ''))
}

function isLabelStart(group: MdToken[]): boolean {
  return group.length >= 3 && group[0].type === 'strong_open' && group[1].type === 'text' && group[2].type === 'strong_close'
}

function isMilestoneStart(inline: MdToken): boolean {
  const c = compact(inline.children ?? [])
  return isLabelStart(c) && c[1].content.trim() === MILESTONE_START
}

/** 按 softbreak / hardbreak 把 inline children 切成行 */
function splitLines(children: MdToken[]): MdToken[][] {
  const lines: MdToken[][] = [[]]
  for (const t of children) {
    if (t.type === 'softbreak' || t.type === 'hardbreak') lines.push([])
    else lines[lines.length - 1].push(t)
  }
  return lines.filter((l) => l.length)
}

function rowsFromInline(Token: TokenCtor, inline: MdToken): MdToken[] {
  const out: MdToken[] = []
  for (const line of splitLines(compact(inline.children ?? []))) {
    let label = ''
    let body = line
    if (isLabelStart(line)) {
      label = line[1].content.trim()
      body = line.slice(3)
      const first = body[0]
      if (first?.type === 'text') {
        first.content = first.content.replace(/^\s*[：:]\s*/, '')
        if (!first.content) body = body.slice(1)
      }
    }
    const open = new Token('milestone_row_open', 'div', 1)
    open.meta = { label, kind: label ? kindOf(label) : 'plain' }
    open.block = true
    const inl = new Token('inline', '', 0)
    inl.children = body
    inl.content = body.map((t) => t.content).join('')
    inl.map = inline.map
    const close = new Token('milestone_row_close', 'div', -1)
    close.block = true
    out.push(open, inl, close)
  }
  return out
}

/**
 * 里程碑卡片：blockquote 第一段以 `**到这里你有了**` 开头时，
 * 把「**标签**：内容」的每一行渲染成卡片的一行（图标 + 标签 + 内容）。
 * 其他引用块原样不动。作者的 Markdown 写法不变，在普通预览器里仍是正常引用块。
 */
export function milestonePlugin(md: MarkdownIt): void {
  md.core.ruler.after('inline', 'milestone', (state) => {
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'blockquote_open') continue

      // 找到配对的 blockquote_close
      let depth = 0
      let close = -1
      for (let k = i; k < tokens.length; k++) {
        if (tokens[k].type === 'blockquote_open') depth++
        else if (tokens[k].type === 'blockquote_close' && --depth === 0) {
          close = k
          break
        }
      }
      if (close < 0) continue

      const firstInline = tokens.slice(i + 1, close).find((t) => t.type === 'inline')
      if (!firstInline || !isMilestoneStart(firstInline)) continue

      tokens[i].attrJoin('class', 'milestone')
      const inner = tokens.slice(i + 1, close)
      const rebuilt: MdToken[] = []
      for (let k = 0; k < inner.length; k++) {
        const t = inner[k]
        if (t.type === 'paragraph_open' && inner[k + 1]?.type === 'inline' && inner[k + 2]?.type === 'paragraph_close') {
          rebuilt.push(...rowsFromInline(state.Token as TokenCtor, inner[k + 1]))
          k += 2
        } else {
          rebuilt.push(t)
        }
      }
      tokens.splice(i + 1, close - i - 1, ...rebuilt)
      i += rebuilt.length + 1
    }
  })

  md.renderer.rules.milestone_row_open = (tokens, idx) => {
    const { label, kind } = tokens[idx].meta as { label: string; kind: string }
    const labelHtml = label ? `<span class="ms-label">${md.utils.escapeHtml(label)}</span>` : ''
    return `<div class="ms-row ms-${kind}"><span class="ms-icon" aria-hidden="true"></span>${labelHtml}<div class="ms-body">`
  }
  md.renderer.rules.milestone_row_close = () => '</div></div>\n'
}
