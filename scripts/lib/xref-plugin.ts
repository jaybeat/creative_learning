import type MarkdownIt from 'markdown-it'
import type { MdToken } from './md'

export interface Unresolved {
  /** 原文写法，如「第1章」「2.13节」「2.16」 */
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
  /**
   * 各章里作为「版本号」出现、可能与节号撞车的两段号（构建时按章扫描「编辑器N.M」「N.M版」得到，
   * 如第 2 章的 1.0 / 1.1 / 2.0 / 2.1 / 2.2）。键是章号字符串。
   * 在该章里它们只在写作「N.M节」「N.M的」「N.M练一练」时才链接；「（N.M）」「N.M + 汉字」这类模糊写法一律不动。
   * 其他章不受影响：「1.1」在第 1 章是节号，照常链接。
   */
  versionsByChapter?: Record<string, string[]>
  onUnresolved?: (u: Unresolved) => void
}

/** 练一练行的锚点（与 milestone-plugin 的 PRACTICE_ID 一致） */
export const PRACTICE_ANCHOR = '#practice'

const CANDIDATE = /(\d+\.\d+(?:\.\d+)?)|第(\d+)章/g
const HAN = /\p{Script=Han}/u
const isDigitOrDot = (ch: string | undefined) => ch !== undefined && /[\d.]/.test(ch)

interface Ctx {
  xref: Record<string, string>
  versionNumbers: Set<string>
  currentChapter: number | undefined
  report: (ref: string) => void
}

interface Hit {
  /** 匹配起止（含被并入链接文字的「节」「练一练」后缀） */
  start: number
  end: number
  text: string
  target: string | null
  /** 无目标时上报用的写法；null 表示静默跳过 */
  report: string | null
}

/**
 * 判定一个候选：返回 null 表示这不是引用（版本号、表格里的裸数字等），静默跳过。
 * 规则见 README「交叉引用」。
 */
function judge(src: string, m: RegExpExecArray, ctx: Ctx): Hit | null {
  const start = m.index
  let end = start + m[0].length

  if (m[2] !== undefined) {
    const n = Number(m[2])
    if (n === ctx.currentChapter) return null
    return { start, end, text: m[0], target: ctx.xref[`ch${n}`] ?? null, report: m[0] }
  }

  const num = m[1]
  const prev = src[start - 1]
  const next = src[end]
  if (isDigitOrDot(prev) || isDigitOrDot(next)) return null
  const before = src.slice(0, start)
  if (before.endsWith('编辑器') || before.endsWith('版本')) return null
  if (next === '版') return null

  const target = ctx.xref[num] ?? null
  const parts = num.split('.').length
  if (next === '节') return { start, end: end + 1, text: `${num}节`, target, report: `${num}节` }
  if (parts >= 3) return { start, end, text: num, target, report: num }

  const isVersion = ctx.versionNumbers.has(num)
  if (src.startsWith('练一练', end)) {
    return { start, end: end + 3, text: `${num}练一练`, target: target ? target + PRACTICE_ANCHOR : null, report: `${num}练一练` }
  }
  if (next === '的') return { start, end, text: num, target, report: num }
  if (isVersion) return null
  if (prev === '（' && next === '）') return { start, end, text: num, target, report: num }
  if (next !== undefined && HAN.test(next)) return { start, end, text: num, target, report: num }
  return null
}

function splitText(state: { Token: new (type: string, tag: string, nesting: 0 | 1 | -1) => MdToken }, t: MdToken, ctx: Ctx): MdToken[] {
  const src = t.content
  const out: MdToken[] = []
  let last = 0
  let m: RegExpExecArray | null
  CANDIDATE.lastIndex = 0
  const text = (s: string) => {
    if (!s) return
    const tk = new state.Token('text', '', 0)
    tk.content = s
    out.push(tk)
  }
  while ((m = CANDIDATE.exec(src))) {
    const hit = judge(src, m, ctx)
    if (!hit) continue
    if (!hit.target) {
      if (hit.report) ctx.report(hit.report)
      continue
    }
    text(src.slice(last, hit.start))
    const open = new state.Token('link_open', 'a', 1)
    open.attrs = [['href', hit.target]]
    out.push(open)
    text(hit.text)
    out.push(new state.Token('link_close', 'a', -1))
    last = hit.end
    CANDIDATE.lastIndex = hit.end
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
    const versionNumbers = new Set(currentChapter !== undefined ? (opts.versionsByChapter?.[String(currentChapter)] ?? []) : [])
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
        versionNumbers,
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
