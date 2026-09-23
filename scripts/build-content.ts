import fs from 'node:fs'
import path from 'node:path'
import { CHAPTERS_DIR, GENERATED_DIR, SITE_DIR } from './lib/paths'
import { loadBookConfig } from './lib/book-config'
import { parseChapter, renderChapterIndex, renderSectionPage, type FrontmatterValue } from './lib/splitter'
import { buildSidebar, buildXref, linkPrevNext, listPages, type ChapterEntry } from './lib/nav'
import { writeIfChanged } from './lib/fs-utils'

export function runBuildContent(): void {
  const book = loadBookConfig()

  const entries: ChapterEntry[] = book.chapters.map((c) => ({
    chapter: parseChapter(fs.readFileSync(path.join(CHAPTERS_DIR, c.file), 'utf8'), c.file),
    draft: c.draft,
  }))

  const pages = linkPrevNext(listPages(entries))
  const expected = new Set<string>()
  for (const p of pages) {
    const fm: Record<string, FrontmatterValue> = { title: p.text, chapter: p.chapter.number }
    // srcFile / srcLine：让渲染期插件能把警告定位回作者的源文件。
    // 节页正文第 0 行就是 `## ` 标题行；章首页正文第 2 行起是引言（第 0 行是 `# ` 标题，第 1 行空）。
    fm.srcFile = p.chapter.file
    if (p.section) {
      fm.section = p.section.number
      fm.srcLine = p.section.startLine + 1
    } else {
      fm.chapterIndex = true
      fm.outline = false // 章首页只有一个「本章目录」标题，右栏大纲没有意义
      fm.srcLine = p.chapter.introStartLine - 1
    }
    fm.prev = p.prev
    fm.next = p.next

    const out = path.join(SITE_DIR, p.file)
    expected.add(path.normalize(out))
    writeIfChanged(out, p.section ? renderSectionPage(p.section, fm) : renderChapterIndex(p.chapter, fm))
  }

  // 清理生成的章目录 site/chNN/ 里不再需要的文件（节被删除、章改为 draft 等），其余目录不碰
  for (const name of fs.readdirSync(SITE_DIR)) {
    if (!/^ch\d{2}$/.test(name)) continue
    const dir = path.join(SITE_DIR, name)
    for (const f of fs.readdirSync(dir)) {
      const full = path.normalize(path.join(dir, f))
      if (!expected.has(full)) fs.rmSync(full, { recursive: true, force: true })
    }
    if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir)
  }

  const write = (name: string, data: unknown) =>
    writeIfChanged(path.join(GENERATED_DIR, name), JSON.stringify(data, null, 2) + '\n')
  write('sidebar.json', buildSidebar(entries))
  write('xref.json', buildXref(entries))
  write('book.json', {
    title: book.title,
    subtitle: book.subtitle,
    author: book.author,
    description: book.description,
    repo: book.repo,
    xref: book.xref,
    // draft 章完全隐藏：不进首页章节列表
    chapters: entries
      .filter((e) => !e.draft)
      .map(({ chapter }) => ({
        number: chapter.number,
        title: chapter.title,
        slug: chapter.slug,
        firstSection: chapter.sections[0] ? `/${chapter.slug}/${chapter.sections[0].slug}` : null,
        sections: chapter.sections.map((s) => ({ number: s.number, title: s.title, link: `/${chapter.slug}/${s.slug}` })),
      })),
  })

  for (const { chapter, draft } of entries) {
    console.log(
      draft
        ? `[build-content] 第${chapter.number}章 ${chapter.title}：draft，已隐藏（不生成页面、不进目录）`
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
