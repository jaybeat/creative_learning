import { createMd, type MdToken } from './md'
import { renderFrontmatter, type FrontmatterValue } from './splitter'

/**
 * 练习题（book/problems/chNN-xxx.md）：一个文件是一组题，挂在第 NN 章末尾。
 *
 *   # 组标题                 ← 一组
 *   引言（三问共用的说明、数据范围）
 *   ## 第一问：输出多项式     ← 一页
 *   ### 题目描述 / 输入格式 / 输出格式 / 样例 / 提示
 *
 * 样例的固定写法：可选的「**样例 N**」一行，紧跟 ```输入 与 ```输出 两个围栏，说明文字跟在后面。
 */

export const PROBLEM_FILE_RE = /^ch(\d{2})-[a-z0-9-]+\.md$/

export interface Sample {
  input: string
  output: string
}

export interface Problem {
  /** 1 起 */
  index: number
  /** 「第一问：输出多项式」 */
  title: string
  /** 「第一问」：冒号前的部分，用于切换条 */
  short: string
  /** 「ex-1」 */
  slug: string
  /** 「ch02-ex-1」：稳定 id，提交记录用 */
  id: string
  /** 本页正文（含 `## ` 标题行，样例已替换为 <SampleCase>） */
  body: string
  samples: Sample[]
  /** 在题目文件里的 0 基起始行 */
  startLine: number
}

export interface ProblemSet {
  file: string
  chapter: number
  /** 「一元多项式的运算」 */
  title: string
  intro: string
  problems: Problem[]
}

const IN = '输入'
const OUT = '输出'
const LABEL_RE = /^\*\*样例\s*\d*\*\*\s*$/

/** 去掉首尾空行与分隔线 `---` */
function trimBlock(lines: string[]): string {
  const l = lines.slice()
  const junk = (s: string | undefined) => s !== undefined && /^\s*(-{3,}|\*{3,}|_{3,})?\s*$/.test(s)
  while (l.length && junk(l[0])) l.shift()
  while (l.length && junk(l[l.length - 1])) l.pop()
  return l.join('\n')
}

export function parseProblemSet(src: string, file: string): ProblemSet {
  const fm = PROBLEM_FILE_RE.exec(file)
  if (!fm) throw new Error(`题目文件名 ${file} 须形如 chNN-名字.md（NN 是所属章号，名字只用小写字母、数字、-）`)
  const lines = src.split('\n')
  const tokens = createMd().parse(src, {})

  const heads: { level: number; line: number; end: number; text: string }[] = []
  tokens.forEach((t, i) => {
    if (t.type === 'heading_open' && t.map && t.level === 0) {
      heads.push({ level: Number(t.tag.slice(1)), line: t.map[0], end: t.map[1], text: tokens[i + 1]?.content.trim() ?? '' })
    }
  })
  const h1s = heads.filter((h) => h.level === 1)
  if (h1s.length !== 1) throw new Error(`${file}: 需要且只能有一个一级标题（题组名），找到 ${h1s.length} 个`)
  const h2s = heads.filter((h) => h.level === 2)
  if (h2s.length === 0) throw new Error(`${file}: 至少要有一个「## 第一问：…」`)

  // 顶层围栏：样例
  const fences = tokens.filter((t): t is MdToken & { map: [number, number] } => t.type === 'fence' && t.level === 0 && !!t.map)

  const chapter = Number(fm[1])
  const problems: Problem[] = h2s.map((h, i) => {
    const end = h2s[i + 1]?.line ?? lines.length
    const index = i + 1
    const slug = `ex-${index}`
    const body = lines.slice(h.line, end)
    const samples: Sample[] = []
    // 从后往前替换，行号不会错位
    const replacements: { from: number; to: number; n: number }[] = []
    const mine = fences.filter((f) => f.map[0] > h.line && f.map[0] < end)
    for (let k = 0; k < mine.length; k++) {
      const f = mine[k]
      const info = f.info.trim()
      if (info === OUT) throw new Error(`${file}:${f.map[0] + 1} 「输出」围栏前面缺少「输入」围栏`)
      if (info !== IN) continue
      const next = mine[k + 1]
      // 输入与输出之间只允许空行
      const gap = next ? lines.slice(f.map[1], next.map[0]) : ['x']
      if (!next || next.info.trim() !== OUT || gap.some((s) => s.trim())) {
        throw new Error(`${file}:${f.map[0] + 1} 「输入」围栏后面要紧跟一个「输出」围栏`)
      }
      let from = f.map[0]
      // 前面的「**样例 N**」一行（中间只隔空行）一并替换掉，组件自己显示编号
      let p = from - 1
      while (p > h.line && !lines[p].trim()) p--
      if (LABEL_RE.test(lines[p].trim())) from = p
      replacements.push({ from, to: next.map[1], n: samples.length })
      samples.push({ input: f.content.replace(/\n$/, ''), output: next.content.replace(/\n$/, '') })
      k++
    }
    for (const r of replacements.reverse()) {
      body.splice(r.from - h.line, r.to - r.from, `<SampleCase :n="${r.n}" />`)
    }
    const title = h.text
    return {
      index,
      title,
      short: title.split(/[：:]/)[0].trim(),
      slug,
      id: `ch${fm[1]}-${slug}`,
      body: trimBlock(body),
      samples,
      startLine: h.line,
    }
  })

  return {
    file,
    chapter,
    title: h1s[0].text,
    intro: trimBlock(lines.slice(h1s[0].end, h2s[0].line)),
    problems,
  }
}

/**
 * 题目页：`## 第一问…` 提升为 `# …`，`###` 提升为 `##`；三问共用的引言放在标题下的提示框里。
 * 只改由 token 流定位的标题行，代码块里的 `#include` 不受影响。
 */
export function renderProblemPage(set: ProblemSet, p: Problem, fm: Record<string, FrontmatterValue>): string {
  const lines = p.body.split('\n')
  const tokens = createMd().parse(p.body, {})
  for (const t of tokens) {
    if (t.type === 'heading_open' && t.map && t.level === 0) lines[t.map[0]] = lines[t.map[0]].replace(/^(\s*)#/, '$1')
  }
  const [h1, ...rest] = lines
  const out = [h1, '']
  if (set.intro.trim()) out.push('::: info 本题说明', set.intro.trim(), ':::', '')
  while (rest.length && !rest[0].trim()) rest.shift()
  out.push(...rest)
  return renderFrontmatter(fm) + out.join('\n').replace(/\s*$/, '') + '\n'
}
