// 课程播放器的练习题：从书稿这一节的 ::: quiz 读。选择题和填空题（::: quiz 填空）两种。
// 填空题的写法和网站一样（scripts/lib/lesson-plugin.ts 的 rewriteFill）：正文里 [[答案]] 是一个空，
// "**其他选项**：甲、乙"一段给干扰项（只按顿号分，选项里可以带逗号）；最后一个带空的块之后是解析。
// 选项顺序也和网站一样：同一个种子打乱，读文字和看动画看到的选项块排列相同。
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, esc, md } from './course'
import { seededShuffle } from './lesson-plugin'

export type ChoiceQuiz = { kind: 'single' | 'multi'; stem: string; options: { html: string; correct: boolean; why: string }[]; explain: string }
/** stem 里每个空是 <button class="c-blank fq-b" data-n="k">；answers[k] 是第 k 个空的答案，options 是打乱后的选项池（纯文字） */
export type FillQuiz = { kind: 'fill'; stem: string; answers: string[]; options: string[]; explain: string }
export type Quiz = ChoiceQuiz | FillQuiz

const BLANK_RE = /\[\[([^\]]+)\]\]/g
const OTHERS_RE = /^\*\*其他选项\*\*\s*[：:]\s*/

export function parseQuizzes(file: string, section: string): Quiz[] {
  return parseQuizText(fs.readFileSync(path.join(ROOT, file), 'utf8'), section, path.basename(file, '.md'))
}

/** chapter 是书稿文件名（ch02），用来拼网站上的题目编号（ch02-2-2-q1），填空题按它打乱选项 */
export function parseQuizText(src: string, section: string, chapter: string): Quiz[] {
  const lines = src.split('\n')
  const start = lines.findIndex((l) => l.startsWith(`## ${section} `))
  if (start < 0) throw new Error(`${chapter} 里找不到 ## ${section}`)
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l))
  if (end < 0) end = lines.length
  const quizzes: Quiz[] = []
  for (let i = start; i < end; i++) {
    const m = /^:::\s*quiz(?:\s+(单选|多选|填空))?\s*$/.exec(lines[i])
    if (!m) continue
    let j = i + 1
    while (j < end && !/^:::\s*$/.test(lines[j])) j++
    const body = lines.slice(i + 1, j)
    const qid = `${chapter}-${section.replace(/\./g, '-')}-q${quizzes.length + 1}`
    quizzes.push(m[1] === '填空' ? parseFill(body, qid) : parseChoice(body, m[1]))
    i = j
  }
  return quizzes
}

function parseChoice(body: string[], kindTag: string | undefined): ChoiceQuiz {
  const stem: string[] = []
  const options: ChoiceQuiz['options'] = []
  const explain: string[] = []
  for (const l of body) {
    const opt = /^- \[([ xX])\]\s*(.*)$/.exec(l)
    if (opt) options.push({ html: md(opt[2]), correct: opt[1] !== ' ', why: '' })
    else if (/^\s{2,}\S/.test(l) && options.length && !explain.length) options.at(-1)!.why += md(l.trim())
    else if (l.trim() && !options.length) stem.push(md(l.trim()))
    else if (l.trim()) explain.push(md(l.trim()))
  }
  const kind = kindTag === '单选' ? 'single' : kindTag === '多选' ? 'multi' : options.filter((o) => o.correct).length > 1 ? 'multi' : 'single'
  return { kind, stem: stem.join('<br>'), options, explain: explain.join('<br>') }
}

/** 按空行分块；代码块整块保留 */
function blocks(body: string[]): string[][] {
  const out: string[][] = []
  let cur: string[] = []
  let fence = false
  for (const l of body) {
    if (/^\s*```/.test(l)) fence = !fence
    if (!fence && !l.trim() && !/^\s*```/.test(l)) {
      if (cur.length) out.push(cur), (cur = [])
      continue
    }
    cur.push(l)
  }
  if (cur.length) out.push(cur)
  return out
}

/** 一块的 HTML：代码块、列表（- 或 1.）、段落（行直接相连，中文不加空格）。inline 处理段落和列表项里的文字 */
function blockHtml(b: string[], inline: (s: string) => string): string {
  if (/^\s*```/.test(b[0])) return `<pre><code>${esc(b.slice(1, b.at(-1)!.trim().startsWith('```') ? -1 : undefined).join('\n'))}</code></pre>`
  const ul = b.every((l) => /^- /.test(l) || /^\s+\S/.test(l))
  const ol = b.every((l) => /^\d+\. /.test(l) || /^\s+\S/.test(l))
  if (ul || ol) {
    const items: string[] = []
    for (const l of b) {
      const m = /^(?:-|\d+\.) (.*)$/.exec(l)
      if (m) items.push(m[1])
      else items[items.length - 1] += l.trim()
    }
    const tag = ul ? 'ul' : 'ol'
    return `<${tag}>${items.map((s) => `<li>${inline(s)}</li>`).join('')}</${tag}>`
  }
  return `<p>${inline(b.map((l) => l.trim()).join(''))}</p>`
}

function parseFill(body: string[], qid: string): FillQuiz {
  const answers: string[] = []
  const distractors: string[] = []
  const bs = blocks(body).filter((b) => {
    if (!OTHERS_RE.test(b[0])) return true
    distractors.push(...b.join('').replace(OTHERS_RE, '').split('、').map((s) => s.trim()).filter(Boolean))
    return false
  })
  const hasBlank = (b: string[]) => !/^\s*```/.test(b[0]) && b.some((l) => /\[\[[^\]]+\]\]/.test(l))
  let last = -1
  bs.forEach((b, k) => { if (hasBlank(b)) last = k })
  if (last < 0) throw new Error(`${qid} 填空题：没有找到空（写成 [[答案]]）`)
  // 空先换成占位符再过 md()，免得答案里的字符被当成标记
  const inline = (s: string) =>
    md(s.replace(BLANK_RE, (_, a: string) => `\u0000${answers.push(a.trim()) - 1}\u0000`)).replace(
      /\u0000(\d+)\u0000/g,
      (_, n) => `<button type="button" class="c-blank fq-b" data-n="${n}"></button>`,
    )
  const stem = bs.slice(0, last + 1).map((b) => blockHtml(b, inline)).join('')
  const explain = bs.slice(last + 1).map((b) => blockHtml(b, md)).join('')
  // 和网站一样：打乱后如果开头几个恰好就是按顺序排的答案，换个种子再打乱
  const pool = [...answers, ...distractors]
  let options = seededShuffle(pool, qid)
  for (let k = 1; k < 10 && answers.every((a, n) => options[n] === a); k++) options = seededShuffle(pool, `${qid}#${k}`)
  return { kind: 'fill', stem, answers, options, explain }
}
