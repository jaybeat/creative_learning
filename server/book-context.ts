import fs from 'node:fs'
import path from 'node:path'

/** 节页 `ch02/2-1`、练习页 `ch02/ex-1`、章首页 `ch02/index` */
export const PAGE_RE = /^ch(\d{2})\/(\d+-\d+|ex-\d+|index)$/

/** 喂给模型的原文上限（字符）：一节最长约 1 万字，截掉尾部影响不大，省 token */
export const CONTEXT_CHARS = 8000

export interface PageContext {
  kind: 'section' | 'exercise' | 'chapter'
  /** 「2.1 线性表」「第一问：整理多项式」 */
  title: string
  text: string
}

const cache = new Map<string, string | null>()

function read(file: string): string | null {
  if (!cache.has(file)) {
    try {
      cache.set(file, fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'))
    } catch {
      cache.set(file, null)
    }
  }
  return cache.get(file)!
}

/** 按 `## ` 切块；跳过代码围栏里的行（书里有 `#define`，见 HANDOFF 陷阱 A） */
function h2Blocks(src: string): { heading: string; body: string }[] {
  const out: { heading: string; body: string }[] = []
  let fence = false
  let cur: { heading: string; lines: string[] } | null = null
  for (const line of src.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence
    if (!fence && line.startsWith('## ')) {
      if (cur) out.push({ heading: cur.heading, body: cur.lines.join('\n') })
      cur = { heading: line.slice(3).trim(), lines: [line] }
    } else cur?.lines.push(line)
  }
  if (cur) out.push({ heading: cur.heading, body: cur.lines.join('\n') })
  return out
}

/** 练习题文件名在 book.yml 里（`problems: ch02-poly.md`），这里不引入 yaml 解析，直接找 */
function problemsFile(root: string, ch: string): string | null {
  const yml = read(path.join(root, 'book', 'book.yml')) ?? ''
  const m = new RegExp(`file:\\s*ch${ch}\\.md[\\s\\S]*?(?:\\n\\s*-\\s*file:|$)`).exec(yml)
  const p = m && /problems:\s*(\S+\.md)/.exec(m[0])
  return p ? path.join(root, 'book', 'problems', p[1]) : null
}

export function pageContext(page: string, root = process.cwd()): PageContext | null {
  const m = PAGE_RE.exec(page)
  if (!m) return null
  const [, ch, rest] = m
  const clip = (s: string) => (s.length > CONTEXT_CHARS ? `${s.slice(0, CONTEXT_CHARS)}\n……（后文略）` : s)

  if (rest.startsWith('ex-')) {
    const file = problemsFile(root, ch)
    const src = file && read(file)
    const b = src ? h2Blocks(src)[Number(rest.slice(3)) - 1] : undefined
    return b ? { kind: 'exercise', title: b.heading, text: clip(b.body) } : null
  }

  const src = read(path.join(root, 'book', 'chapters', `ch${ch}.md`))
  if (!src) return null
  if (rest === 'index') {
    const title = /^# (.+)$/m.exec(src)?.[1] ?? `第${Number(ch)}章`
    const end = src.indexOf('\n## ')
    return { kind: 'chapter', title, text: clip(end < 0 ? src : src.slice(0, end)) }
  }
  const num = rest.replace('-', '.')
  const b = h2Blocks(src).find((x) => x.heading.startsWith(`${num} `))
  return b ? { kind: 'section', title: b.heading, text: clip(b.body) } : null
}
