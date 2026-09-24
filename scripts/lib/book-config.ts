import fs from 'node:fs'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'
import { BOOK_YML, CHAPTERS_DIR } from './paths'

export interface ChapterConfig {
  file: string
  draft: boolean
}

export interface BookConfig {
  title: string
  subtitle: string
  author: string
  description: string
  repo: string
  chapters: ChapterConfig[]
}

const FILE_RE = /^ch\d{2}\.md$/

export function parseBookConfig(yamlText: string, chaptersDir: string = CHAPTERS_DIR): BookConfig {
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
    return { file, draft: item.draft === true }
  })

  const str = (k: string) => (typeof raw[k] === 'string' ? (raw[k] as string).trim() : '')
  if (raw.xref !== undefined) {
    console.warn('[book.yml] xref 字段已不再使用（版本号现在按章自动识别），已忽略')
  }
  return {
    title: raw.title.trim(),
    subtitle: str('subtitle'),
    author: str('author'),
    description: str('description'),
    repo: str('repo').replace(/\/+$/, ''),
    chapters,
  }
}

export function loadBookConfig(): BookConfig {
  return parseBookConfig(fs.readFileSync(BOOK_YML, 'utf8'))
}
