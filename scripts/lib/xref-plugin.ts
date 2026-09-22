import type MarkdownIt from 'markdown-it'
import type { MdToken } from './md'

export interface Unresolved {
  /** 原文写法，如「第1章」「2.13节」 */
  ref: string
  /** 作者的源文件名，如 ch02.md */
  file: string
  /** 源文件 1 基行号；无法定位时为 0 */
  line: number
  /** 生成页面路径，如 ch02/2-5.md */
  page: string
}

export interface XrefOptions {
  /** `"2.8" → "/ch02/2-8"`、`"2.8.1" → "/ch02/2-8#2-8-1"`、`"ch2" → "/ch02/"` */
  xref: Record<string, string>
  onUnresolved?: (u: Unresolved) => void
}

/**
 * 只匹配带「节」后缀的写法（`2.6节`、`2.4.3节`）和「第N章」。
 * 前置断言 (?<![\d.]) 保证「编辑器2.2」这类版本号后面即使跟着别的数字也不会被截出一段来匹配，
 * 而裸的「2.2」「1.1」因为没有「节」字根本不进入匹配（HANDOFF 陷阱 B）。
 */
const REF_RE = /(?<![\d.])(\d+\.\d+(?:\.\d+)?)节|第(\d+)章/g

interface Ctx {
  xref: Record<string, string>
  currentChapter: number | undefined
  report: (ref: string) => void
}

function resolve(m: RegExpExecArray, ctx: Ctx): { target: string | null; skip: boolean } {
  if (m[1]) return { target: ctx.xref[m[1]] ?? null, skip: false }
  const n = Number(m[2])
  if (n === ctx.currentChapter) return { target: null, skip: true }
  return { target: ctx.xref[`ch${n}`] ?? null, skip: false }
}

function splitText(state: { Token: new (type: string, tag: string, nesting: 0 | 1 | -1) => MdToken }, t: MdToken, ctx: Ctx): MdToken[] {
  const src = t.content
  const out: MdToken[] = []
  let last = 0
  let m: RegExpExecArray | null
  REF_RE.lastIndex = 0
  const text = (s: string) => {
    if (!s) return
    const tk = new state.Token('text', '', 0)
    tk.content = s
    out.push(tk)
  }
  while ((m = REF_RE.exec(src))) {
    const { target, skip } = resolve(m, ctx)
    if (!target) {
      if (!skip) ctx.report(m[0])
      continue
    }
    text(src.slice(last, m.index))
    const open = new state.Token('link_open', 'a', 1)
    open.attrs = [['href', target]]
    out.push(open)
    text(m[0])
    out.push(new state.Token('link_close', 'a', -1))
    last = m.index + m[0].length
  }
  if (last === 0) return [t]
  text(src.slice(last))
  return out
}

/**
 * 交叉引用自动链接。只处理 inline 的 text 子 token；代码块、行内代码、标题、已有链接内的文字不碰。
 * 目标不存在时保持纯文本并通过 onUnresolved 上报（带源文件与行号），绝不让构建失败。
 */
export function xrefPlugin(md: MarkdownIt, opts: XrefOptions): void {
  md.core.ruler.after('inline', 'xref', (state) => {
    const env = (state.env ?? {}) as { relativePath?: string; frontmatter?: Record<string, unknown> }
    const fm = env.frontmatter ?? {}
    const currentChapter = typeof fm.chapter === 'number' ? fm.chapter : undefined
    const srcLine = typeof fm.srcLine === 'number' ? fm.srcLine : undefined
    const file = typeof fm.srcFile === 'string' ? fm.srcFile : (env.relativePath ?? '?')
    const page = env.relativePath ?? '?'

    let inHeading = false
    for (const block of state.tokens) {
      if (block.type === 'heading_open') inHeading = true
      if (block.type === 'heading_close') inHeading = false
      if (block.type !== 'inline' || inHeading || !block.children) continue

      const line = srcLine !== undefined && block.map ? srcLine + block.map[0] : 0
      const ctx: Ctx = {
        xref: opts.xref,
        currentChapter,
        report: (ref) => opts.onUnresolved?.({ ref, file, line, page }),
      }
      let linkDepth = 0
      const out: MdToken[] = []
      for (const t of block.children) {
        if (t.type === 'link_open') linkDepth++
        if (t.type === 'link_close') linkDepth--
        if (t.type !== 'text' || linkDepth > 0) {
          out.push(t)
          continue
        }
        out.push(...splitText(state, t, ctx))
      }
      block.children = out
    }
  })
}

/** 构建结束时的汇总文本；同一页同一行同一引用只算一次（VitePress 可能渲染一页多次）。 */
export function formatUnresolved(list: Unresolved[]): string {
  const seen = new Set<string>()
  const uniq = list.filter((u) => {
    const k = `${u.page}|${u.line}|${u.ref}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  if (!uniq.length) return ''
  const byRef = new Map<string, Unresolved[]>()
  for (const u of uniq) {
    const arr = byRef.get(u.ref) ?? []
    arr.push(u)
    byRef.set(u.ref, arr)
  }
  const lines = [`[xref] 未解析的交叉引用 ${uniq.length} 处（目标章节尚不存在，已保持为纯文本）：`]
  for (const [ref, arr] of byRef) {
    lines.push(`  ${ref}  ← ${arr.map((u) => `${u.file}:${u.line}`).join(', ')}`)
  }
  return lines.join('\n')
}
