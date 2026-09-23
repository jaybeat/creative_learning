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
  xref: { versionNumbers: string[] }
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
  const xrefRaw = (raw.xref ?? {}) as { versionNumbers?: unknown }
  const versionNumbers = Array.isArray(xrefRaw.versionNumbers) ? xrefRaw.versionNumbers.map(String) : []
  for (const v of versionNumbers) {
    if (!/^\d+\.\d+$/.test(v)) throw new Error(`book.yml: xref.versionNumbers 里的 ${JSON.stringify(v)} 须形如 "2.1"（用引号，避免被当成小数）`)
  }
  return {
    title: raw.title.trim(),
    subtitle: str('subtitle'),
    author: str('author'),
    description: str('description'),
    repo: str('repo').replace(/\/+$/, ''),
    xref: { versionNumbers },
    chapters,
  }
}

export function loadBookConfig(): BookConfig {
  return parseBookConfig(fs.readFileSync(BOOK_YML, 'utf8'))
}
