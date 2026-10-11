import type MarkdownIt from 'markdown-it'
import type { MdToken } from './md'

/**
 * 分页与练习题。
 *
 * 分页：节里单独一行 `<!-- 分页 -->`（前后空行），把这一节切成几页，在同一个网址里翻页
 * （theme/lesson/Lesson.vue）。没有分页标记的节照原样单页显示。HTML 注释在普通 Markdown 预览器里不可见。
 *
 * 练习题：
 *
 *   ::: quiz 多选            ← 「单选」「多选」；不写时按正确选项个数判断
 *   题干（可以多段）
 *
 *   - [x] 正确选项
 *     这一行起是这个选项的解析（可选，答题后显示）
 *   - [ ] 错误选项
 *
 *   列表后面的段落是整题解析（答对或看答案后显示）
 *   :::
 *
 * 渲染成 <Quiz>（theme/lesson/Quiz.vue），选项与解析放在具名插槽里，所以里面仍可用行内代码、加粗等。
 */

export const PAGE_BREAK = '<!-- 分页 -->'

export type QuizKind = 'single' | 'multi'

const KIND_WORDS: Record<string, QuizKind> = { 单选: 'single', 多选: 'multi' }
const MARK_RE = /^\[([ xX])\]\s*/

type TokenCtor = new (type: string, tag: string, nesting: 0 | 1 | -1) => MdToken
type BlockState = Parameters<Parameters<MarkdownIt['block']['ruler']['before']>[2]>[0]

/** `::: quiz …` 到单独一行 `:::` 之间的块，内部按普通 Markdown 解析。 */
function quizBlock(state: BlockState, startLine: number, endLine: number, silent: boolean): boolean {
  if (state.sCount[startLine] - state.blkIndent >= 4) return false
  const first = state.src.slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine])
  const m = /^:::\s*quiz(?:\s+(.*))?$/.exec(first.trimEnd())
  if (!m) return false
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
  state.parentType = 'quiz' as typeof state.parentType
  state.lineMax = next

  const open = state.push('quiz_open', 'div', 1)
  open.info = (m[1] ?? '').trim()
  open.map = [startLine, next + (closed ? 1 : 0)]
  open.block = true
  state.md.block.tokenize(state, startLine + 1, next)
  const close = state.push('quiz_close', 'div', -1)
  close.block = true

  state.parentType = oldParent
  state.lineMax = oldLineMax
  state.line = next + (closed ? 1 : 0)
  return true
}

function html(Token: TokenCtor, content: string): MdToken {
  const t = new Token('html_block', '', 0)
  t.content = content
  return t
}

/** 合并相邻的 text token，方便判断选项开头的 `[x]` */
function joinText(children: MdToken[]): MdToken[] {
  const out: MdToken[] = []
  for (const c of children) {
    const prev = out[out.length - 1]
    if (c.type === 'text' && prev?.type === 'text') prev.content += c.content
    else out.push(c)
  }
  return out
}

function paragraph(Token: TokenCtor, children: MdToken[], map: [number, number] | null, hidden: boolean): MdToken[] {
  const open = new Token('paragraph_open', 'p', 1)
  open.hidden = hidden
  open.block = true
  const inline = new Token('inline', '', 0)
  inline.children = children
  inline.content = children.map((c) => c.content).join('')
  inline.map = map
  const close = new Token('paragraph_close', 'p', -1)
  close.hidden = hidden
  close.block = true
  return [open, inline, close]
}

/** 找与 tokens[i]（nesting=1）配对的关闭 token 下标 */
function matchClose(tokens: MdToken[], i: number): number {
  let depth = 0
  for (let k = i; k < tokens.length; k++) {
    depth += tokens[k].nesting
    if (depth === 0) return k
  }
  return tokens.length - 1
}

export interface QuizError {
  line: number
  message: string
}

function pageId(env: unknown): string {
  const rel = String((env as { relativePath?: string } | null)?.relativePath ?? 'page')
  return rel.replace(/\.md$/, '').replace(/[\\/]/g, '-').replace(/-index$/, '')
}

/** 把一个 quiz_open…quiz_close 区间改写成 <Quiz> 组件；返回新 token 列表 */
function rewriteQuiz(Token: TokenCtor, inner: MdToken[], open: MdToken, index: number, qid: string, where: string): MdToken[] {
  const fail = (message: string): never => {
    throw new Error(`${where} 练习题：${message}`)
  }

  // 直接子块：题干 | 第一个列表（选项）| 解析
  const listAt = inner.findIndex((t) => t.type === 'bullet_list_open' && t.level === open.level + 1)
  if (listAt < 0) fail('没有找到选项列表（每个选项写成「- [x] …」或「- [ ] …」）')
  const listEnd = matchClose(inner, listAt)
  const stem = inner.slice(0, listAt)
  const explain = inner.slice(listEnd + 1)

  const options: { text: MdToken[]; why: MdToken[]; correct: boolean }[] = []
  for (let k = listAt + 1; k < listEnd; k++) {
    if (inner[k].type !== 'list_item_open') continue
    const end = matchClose(inner, k)
    const body = inner.slice(k + 1, end)
    k = end
    if (body[0]?.type !== 'paragraph_open' || body[1]?.type !== 'inline') fail('选项要以一段文字开头')
    const inline = body[1]
    const children = joinText(inline.children ?? [])
    const head = children[0]
    const mark = head?.type === 'text' ? MARK_RE.exec(head.content) : null
    if (!mark) fail(`选项「${inline.content.split('\n')[0]}」前面缺少 [x] 或 [ ]`)
    head.content = head.content.slice(mark![0].length)
    if (!head.content) children.shift()

    // 选项第一行是选项本身；同一段里换行之后的部分，以及后面的块，都是这个选项的解析
    const br = children.findIndex((c) => c.type === 'softbreak' || c.type === 'hardbreak')
    const text = br < 0 ? children : children.slice(0, br)
    const why: MdToken[] = []
    if (br >= 0 && br < children.length - 1) why.push(...paragraph(Token, children.slice(br + 1), inline.map, false))
    for (const t of body.slice(3)) {
      if (t.type === 'paragraph_open' || t.type === 'paragraph_close') t.hidden = false
      why.push(t)
    }
    options.push({ text: paragraph(Token, text, inline.map, true), why, correct: mark![1] !== ' ' })
  }

  if (options.length < 2) fail('至少要有两个选项')
  const correct = options.flatMap((o, i) => (o.correct ? [i] : []))
  if (correct.length === 0) fail('没有标出正确选项（[x]）')
  const word = open.info.split(/\s+/)[0]
  if (word && !(word in KIND_WORDS)) fail(`题型「${word}」不认识，只能写「单选」「多选」或「填空」`)
  const kind: QuizKind = word ? KIND_WORDS[word] : correct.length === 1 ? 'single' : 'multi'
  if (kind === 'single' && correct.length !== 1) fail(`单选题只能有一个正确选项，现在有 ${correct.length} 个`)

  const out: MdToken[] = [
    html(Token, `<Quiz kind="${kind}" :correct="[${correct.join(',')}]" :count="${options.length}" :index="${index}" qid="${qid}">\n`),
    html(Token, '<template #stem>\n'),
    ...stem,
    html(Token, '</template>\n'),
  ]
  options.forEach((o, i) => {
    out.push(html(Token, `<template #o${i}>\n`), ...o.text, html(Token, '</template>\n'))
    if (o.why.length) out.push(html(Token, `<template #x${i}>\n`), ...o.why, html(Token, '</template>\n'))
  })
  if (explain.length) out.push(html(Token, '<template #explain>\n'), ...explain, html(Token, '</template>\n'))
  out.push(html(Token, '</Quiz>\n'))
  return out
}

const BLANK_RE = /\[\[([^\]]+)\]\]/g
const OTHERS_LABEL = '其他选项'

/** 按 qid 做种子的伪随机（mulberry32）：选项顺序每次构建都一样，不在读者端随机 */
function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  const rand = () => {
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** 属性值里放 JSON：转义成 HTML 实体，Vue 编译模板时会还原 */
function jsonAttr(md: MarkdownIt, value: unknown): string {
  return md.utils.escapeHtml(JSON.stringify(value))
}

/**
 * 填空题：正文里的 `[[答案]]` 是一个空，换成 <QuizBlank>；`**其他选项**：甲、乙` 一段给出干扰项。
 * 最后一个带空的块之前是题目（可以有代码、列表），之后的段落是整题解析。
 */
function rewriteFill(md: MarkdownIt, Token: TokenCtor, inner: MdToken[], open: MdToken, index: number, qid: string, where: string): MdToken[] {
  const fail = (message: string): never => {
    throw new Error(`${where} 填空题：${message}`)
  }
  const answers: string[] = []
  const distractors: string[] = []
  const top = open.level + 1

  // 1. 去掉「其他选项」那一段，收集干扰项
  for (let k = 0; k < inner.length; k++) {
    const t = inner[k]
    if (t.type !== 'paragraph_open' || t.level !== top || inner[k + 1]?.type !== 'inline') continue
    const c = joinText((inner[k + 1].children ?? []).filter((x) => !(x.type === 'text' && x.content === '')))
    if (c[0]?.type !== 'strong_open' || c[1]?.content.trim() !== OTHERS_LABEL || c[2]?.type !== 'strong_close') continue
    const rest = c.slice(3).map((x) => x.content).join('').replace(/^\s*[：:]\s*/, '')
    distractors.push(...rest.split(/[、，,]/).map((s) => s.trim()).filter(Boolean))
    inner.splice(k, 3)
    k--
  }

  // 2. 把文字里的 [[答案]] 换成空位；记下每个顶层块里有没有空
  let lastBlankAt = -1
  for (let k = 0; k < inner.length; k++) {
    const t = inner[k]
    if (t.type === 'inline' && t.children) {
      const out: MdToken[] = []
      let found = false
      for (const c of joinText(t.children)) {
        if (c.type !== 'text' || !BLANK_RE.test(c.content)) {
          out.push(c)
          continue
        }
        BLANK_RE.lastIndex = 0
        let last = 0
        for (const m of c.content.matchAll(BLANK_RE)) {
          if (m.index! > last) {
            const txt = new Token('text', '', 0)
            txt.content = c.content.slice(last, m.index)
            out.push(txt)
          }
          const blank = new Token('html_inline', '', 0)
          blank.content = `<QuizBlank :n="${answers.length}" />`
          out.push(blank)
          answers.push(m[1].trim())
          last = m.index! + m[0].length
        }
        if (last < c.content.length) {
          const txt = new Token('text', '', 0)
          txt.content = c.content.slice(last)
          out.push(txt)
        }
        found = true
      }
      t.children = out
      if (found) lastBlankAt = k
    }
  }
  if (answers.length === 0) fail('没有找到空（写成 [[答案]]）')

  // 3. 最后一个带空的顶层块结束处，把题目和解析分开
  let cut = inner.length
  if (lastBlankAt >= 0) {
    // 往前找到包住它的顶层块的开头，再找这个块的结尾
    let s = lastBlankAt
    while (s > 0 && !(inner[s].level === top && inner[s].nesting !== -1)) s--
    cut = inner[s].nesting === 1 ? matchClose(inner, s) + 1 : s + 1
  }
  const body = inner.slice(0, cut)
  const explain = inner.slice(cut)

  // 打乱后如果开头几个恰好就是按顺序排的答案，等于把答案摆出来了，换个种子再打乱
  const pool = [...answers, ...distractors]
  let options = seededShuffle(pool, qid)
  for (let k = 1; k < 10 && answers.every((a, n) => options[n] === a); k++) options = seededShuffle(pool, `${qid}#${k}`)
  const out: MdToken[] = [
    html(Token, `<FillQuiz :answers="${jsonAttr(md, answers)}" :options="${jsonAttr(md, options)}" :index="${index}" qid="${qid}">\n`),
    html(Token, '<template #body>\n'),
    ...body,
    html(Token, '</template>\n'),
  ]
  if (explain.length) out.push(html(Token, '<template #explain>\n'), ...explain, html(Token, '</template>\n'))
  out.push(html(Token, '</FillQuiz>\n'))
  return out
}

export function lessonPlugin(md: MarkdownIt): void {
  md.block.ruler.before('fence', 'quiz', quizBlock, { alt: ['paragraph', 'reference', 'blockquote', 'list'] })

  // 放在最后：要在 text_join 之后看 inline children
  md.core.ruler.push('lesson', (state) => {
    const Token = state.Token as TokenCtor
    let tokens = state.tokens
    const page = pageId(state.env)
    // 报错定位回作者的源文件（frontmatter 由 build-content 写入，同 xref-plugin）
    const fm = ((state.env ?? {}) as { frontmatter?: Record<string, unknown> }).frontmatter ?? {}
    const srcFile = typeof fm.srcFile === 'string' ? fm.srcFile : page
    const srcLine = typeof fm.srcLine === 'number' ? fm.srcLine : 1

    // 1. 练习题
    let seq = 0
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'quiz_open') continue
      const end = matchClose(tokens, i)
      seq++
      const where = `${srcFile}:${srcLine + (tokens[i].map?.[0] ?? 0)}`
      const inner = tokens.slice(i + 1, end)
      const rebuilt =
        tokens[i].info.split(/\s+/)[0] === '填空'
          ? rewriteFill(md, Token, inner, tokens[i], seq, `${page}-q${seq}`, where)
          : rewriteQuiz(Token, inner, tokens[i], seq, `${page}-q${seq}`, where)
      tokens.splice(i, end - i + 1, ...rebuilt)
      i += rebuilt.length - 1
    }

    // 2. 分页：只认顶层的分页注释
    const breaks = tokens.flatMap((t, i) => (t.type === 'html_block' && t.level === 0 && t.content.trim() === PAGE_BREAK ? [i] : []))
    if (breaks.length === 0) return

    // 页面从节标题之后开始。分页的节由每页的页标题担任最醒目的标题，节标题只留在结构里
    // （视觉隐藏：读屏软件、评论定位照常用它），见 lesson.css 的 .lesson-section-title
    let start = 0
    if (tokens[0]?.type === 'heading_open') {
      tokens[0].attrJoin('class', 'lesson-section-title')
      start = matchClose(tokens, 0) + 1
    }
    const pages = breaks.length + 1
    const out: MdToken[] = [...tokens.slice(0, start), html(Token, `<Lesson :pages="${pages}">\n<template #p1>\n`)]
    let n = 1
    for (let i = start; i < tokens.length; i++) {
      if (breaks.includes(i)) out.push(html(Token, `</template>\n<template #p${++n}>\n`))
      else out.push(tokens[i])
    }
    out.push(html(Token, '</template>\n</Lesson>\n'))
    tokens = out
    state.tokens = tokens
  })
}
