import fs from 'node:fs'
import path from 'node:path'
import { CHAPTERS_DIR, GENERATED_DIR, SITE_DIR } from './lib/paths'
import { loadBookConfig } from './lib/book-config'
import { parseChapter, renderChapterIndex, renderSectionPage, type FrontmatterValue } from './lib/splitter'
import { buildSidebar, buildXref, linkPrevNext, listPages, type ChapterEntry } from './lib/nav'

export function runBuildContent(): void {
  const book = loadBookConfig()

  const entries: ChapterEntry[] = book.chapters.map((c) => ({
    chapter: parseChapter(fs.readFileSync(path.join(CHAPTERS_DIR, c.file), 'utf8'), c.file),
    draft: c.draft,
  }))

  // 只清理生成的章目录 site/chNN/，其余不碰
  for (const name of fs.readdirSync(SITE_DIR)) {
    if (/^ch\d{2}$/.test(name)) fs.rmSync(path.join(SITE_DIR, name), { recursive: true, force: true })
  }

  const pages = linkPrevNext(listPages(entries))
  for (const p of pages) {
    const fm: Record<string, FrontmatterValue> = { title: p.text, chapter: p.chapter.number }
    if (p.section) fm.section = p.section.number
    else fm.chapterIndex = true
    fm.prev = p.prev
    fm.next = p.next

    const out = path.join(SITE_DIR, p.file)
    fs.mkdirSync(path.dirname(out), { recursive: true })
    fs.writeFileSync(out, p.section ? renderSectionPage(p.section, fm) : renderChapterIndex(p.chapter, fm))
  }

  fs.mkdirSync(GENERATED_DIR, { recursive: true })
  const write = (name: string, data: unknown) =>
    fs.writeFileSync(path.join(GENERATED_DIR, name), JSON.stringify(data, null, 2) + '\n')
  write('sidebar.json', buildSidebar(entries))
  write('xref.json', buildXref(entries))
  write('book.json', {
    title: book.title,
    subtitle: book.subtitle,
    author: book.author,
    description: book.description,
    repo: book.repo,
    chapters: entries.map(({ chapter, draft }) => ({
      number: chapter.number,
      title: chapter.title,
      slug: chapter.slug,
      draft,
      firstSection: chapter.sections[0] ? `/${chapter.slug}/${chapter.sections[0].slug}` : null,
      sections: chapter.sections.map((s) => ({ number: s.number, title: s.title, link: `/${chapter.slug}/${s.slug}` })),
    })),
  })

  for (const { chapter, draft } of entries) {
    console.log(
      draft
        ? `[build-content] 第${chapter.number}章 ${chapter.title}：draft，不生成页面`
        : `[build-content] 第${chapter.number}章 ${chapter.title}：1 个章首页 + ${chapter.sections.length} 个节页面`,
    )
  }
}

if (process.argv[1]?.endsWith('build-content.ts')) {
  try {
    runBuildContent()
  } catch (err) {
    console.error(`[build-content] ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }
}
