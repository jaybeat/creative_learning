import fs from 'node:fs'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'
import { BOOK_YML, CHAPTERS_DIR, PROBLEMS_DIR } from './paths'
import { PROBLEM_FILE_RE } from './problems'

export interface ChapterConfig {
  file: string
  draft: boolean
  /** 本章要解决的问题（首页目录显示），可空 */
  question: string
  /** 本章的练习题文件（book/problems/ 下），可空 */
  problems: string
  /** 第 i 问挂在节号 problemsAfter[i] 后面；空数组表示都挂在章末 */
  problemsAfter: string[]
}

export interface BookConfig {
  title: string
  subtitle: string
  /** 英文书名，可空 */
  titleEn: string
  author: string
  description: string
  repo: string
  chapters: ChapterConfig[]
}

const FILE_RE = /^ch\d{2}\.md$/

export function parseBookConfig(yamlText: string, chaptersDir: string = CHAPTERS_DIR, problemsDir: string = PROBLEMS_DIR): BookConfig {
  const raw = (parseYaml(yamlText) ?? {}) as Record<string, unknown>
  if (typeof raw.title !== 'string' || !raw.title.trim()) {
    throw new Error('book.yml: 缺少 title')
  }
  if (!Array.isArray(raw.chapters)) throw new Error('book.yml: chapters 必须是数组')

  const chapters: ChapterConfig[] = raw.chapters.map((c, i) => {
    const item = (c ?? {}) as Record<string, unknown>
    const file = item.file
    if (typeof file !== 'string' || !FILE_RE.test(file)) {
      throw new Error(`book.yml: chapters[${i}].file 须形如 chNN.md，实际是 ${JSON.stringify(file)}`)
    }
    if (!fs.existsSync(path.join(chaptersDir, file))) {
      throw new Error(`book.yml: chapters[${i}] 指向的 ${file} 不存在（应放在 book/chapters/ 下）`)
    }
    let problems = ''
    let problemsAfter: string[] = []
    if (item.problems !== undefined) {
      // 两种写法：`problems: chNN-名字.md`（都挂章末），或 `problems: { file, after: ['4.7', '4.8'] }`（第 i 问挂在第 i 个节后面）
      let p: unknown = item.problems
      if (p && typeof p === 'object' && !Array.isArray(p)) {
        const o = p as Record<string, unknown>
        p = o.file
        if (o.after !== undefined) {
          if (!Array.isArray(o.after) || !o.after.every((x) => typeof x === 'string' && /^\d+\.\d+$/.test(x))) {
            throw new Error(`book.yml: chapters[${i}].problems.after 须是节号列表，如 ['4.7', '4.8']（要加引号），实际是 ${JSON.stringify(o.after)}`)
          }
          problemsAfter = o.after as string[]
        }
      }
      const m = typeof p === 'string' ? PROBLEM_FILE_RE.exec(p) : null
      if (typeof p !== 'string' || !m) {
        throw new Error(`book.yml: chapters[${i}].problems 须形如 chNN-名字.md，实际是 ${JSON.stringify(p)}`)
      }
      if (`ch${m[1]}.md` !== file) throw new Error(`book.yml: chapters[${i}].problems 的 ${p} 与本章 ${file} 章号不一致`)
      if (!fs.existsSync(path.join(problemsDir, p))) {
        throw new Error(`book.yml: chapters[${i}].problems 指向的 ${p} 不存在（应放在 book/problems/ 下）`)
      }
      problems = p
    }
    return { file, draft: item.draft === true, question: typeof item.question === 'string' ? item.question.trim() : '', problems, problemsAfter }
  })

  const str = (k: string) => (typeof raw[k] === 'string' ? (raw[k] as string).trim() : '')
  if (raw.xref !== undefined) {
    console.warn('[book.yml] xref 字段已不再使用（版本号现在按章自动识别），已忽略')
  }
  return {
    title: raw.title.trim(),
    subtitle: str('subtitle'),
    titleEn: str('titleEn'),
    author: str('author'),
    description: str('description'),
    repo: str('repo').replace(/\/+$/, ''),
    chapters,
  }
}

export function loadBookConfig(): BookConfig {
  return parseBookConfig(fs.readFileSync(BOOK_YML, 'utf8'))
}
