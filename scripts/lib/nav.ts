import type { Chapter, Section } from './splitter'
import type { Problem, ProblemSet } from './problems'
import { SECTION_RE } from './slug'

export interface ChapterEntry {
  chapter: Chapter
  draft: boolean
  /** 本章末尾的练习题 */
  problems?: ProblemSet
}

export interface PageRef {
  text: string
  link: string
}

export interface PageInfo {
  kind: 'chapter' | 'section' | 'problem'
  /** 站内链接，如 `/ch02/2-8` 或 `/ch02/` */
  link: string
  /** 显示文字，如「2.8 链表：关系存哪里」或「第2章 线性表」 */
  text: string
  /** site 目录下的相对文件路径，如 `ch02/2-8.md` */
  file: string
  chapter: Chapter
  section?: Section
  problemSet?: ProblemSet
  problem?: Problem
}

export interface LinkedPage extends PageInfo {
  prev: PageRef | false
  next: PageRef | false
}

export interface SidebarItem {
  text: string
  link?: string
  collapsed?: boolean
  items?: SidebarItem[]
}

export function chapterText(ch: Chapter): string {
  return `第${ch.number}章 ${ch.title}`
}

export function sectionText(s: Section): string {
  return `${s.number} ${s.title}`
}

/** 题目页的标题：「一元多项式的运算 · 第一问」 */
export function problemText(set: ProblemSet, p: Problem): string {
  return `${set.title} · ${p.short}`
}

export function problemsGroupText(set: ProblemSet): string {
  return `练习：${set.title}`
}

/** 全书阅读顺序：章首页 → 各节 → 本章练习，跨章连续。draft 章不参与。 */
export function listPages(entries: ChapterEntry[]): PageInfo[] {
  const pages: PageInfo[] = []
  for (const { chapter, draft, problems } of entries) {
    if (draft) continue
    pages.push({
      kind: 'chapter',
      link: `/${chapter.slug}/`,
      text: chapterText(chapter),
      file: `${chapter.slug}/index.md`,
      chapter,
    })
    for (const s of chapter.sections) {
      pages.push({
        kind: 'section',
        link: `/${chapter.slug}/${s.slug}`,
        text: sectionText(s),
        file: `${chapter.slug}/${s.slug}.md`,
        chapter,
        section: s,
      })
    }
    for (const p of problems?.problems ?? []) {
      pages.push({
        kind: 'problem',
        link: `/${chapter.slug}/${p.slug}`,
        text: problemText(problems!, p),
        file: `${chapter.slug}/${p.slug}.md`,
        chapter,
        problemSet: problems,
        problem: p,
      })
    }
  }
  return pages
}

export function linkPrevNext(pages: PageInfo[]): LinkedPage[] {
  return pages.map((p, i) => ({
    ...p,
    prev: i > 0 ? { text: pages[i - 1].text, link: pages[i - 1].link } : false,
    next: i < pages.length - 1 ? { text: pages[i + 1].text, link: pages[i + 1].link } : false,
  }))
}

/**
 * 侧栏：章 → 节两级。全部 `collapsed: true`，VitePress 会自动展开包含当前页的分组，
 * 因此「当前章默认展开」无需额外处理。draft 章完全隐藏（作者要求）。
 */
export function buildSidebar(entries: ChapterEntry[]): SidebarItem[] {
  return entries
    .filter((e) => !e.draft)
    .map(({ chapter, problems }) => {
      const items: SidebarItem[] = chapter.sections.map((s) => ({
        text: sectionText(s),
        link: `/${chapter.slug}/${s.slug}`,
      }))
      if (problems?.problems.length) {
        items.push({
          text: problemsGroupText(problems),
          items: problems.problems.map((p) => ({ text: p.title, link: `/${chapter.slug}/${p.slug}` })),
        })
      }
      return { text: chapterText(chapter), link: `/${chapter.slug}/`, collapsed: true, items }
    })
}

/**
 * 交叉引用索引：`"2.8" → "/ch02/2-8"`，`"2.8.1" → "/ch02/2-8#2-8-1"`，`"ch2" → "/ch02/"`。
 * 供 M2 的交叉引用插件使用。
 */
export function buildXref(entries: ChapterEntry[]): Record<string, string> {
  const xref: Record<string, string> = {}
  for (const { chapter, draft } of entries) {
    if (draft) continue
    xref[`ch${chapter.number}`] = `/${chapter.slug}/`
    for (const s of chapter.sections) {
      const pageLink = `/${chapter.slug}/${s.slug}`
      xref[s.number] = pageLink
      for (const h of s.headings) {
        if (h.level < 3) continue
        const m = SECTION_RE.exec(h.text)
        if (!m) continue
        xref[m[1]] = `${pageLink}#${m[1].replace(/\./g, '-')}`
      }
    }
  }
  return xref
}
