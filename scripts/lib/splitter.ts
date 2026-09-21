import { createMd } from './md'
import { CHAPTER_RE, SECTION_RE, chapterSlug, slugify } from './slug'

export interface Heading {
  level: number
  /** 相对于所在节 body 的 0 基行号 */
  line: number
  text: string
}

export interface Section {
  /** 「2.8」 */
  number: string
  /** 不含编号的标题 */
  title: string
  /** 「2-8」 */
  slug: string
  /** 节的原文（含 `## ` 标题行） */
  body: string
  /** 在章文件里的 0 基起始行 */
  startLine: number
  headings: Heading[]
}

export interface Chapter {
  file: string
  number: number
  title: string
  /** 「ch02」 */
  slug: string
  /** `#` 与第一个 `##` 之间的原文，可能为空 */
  intro: string
  sections: Section[]
}

interface RawHeading {
  level: number
  line: number
  end: number
  text: string
}

/**
 * 解析一章。用 markdown-it 的 token 流定位标题（token.map 给出源码行号），
 * 因此代码围栏里的 `#define` 等不会被误判为标题（HANDOFF 陷阱 A）。
 */
export function parseChapter(src: string, fileName: string): Chapter {
  const lines = src.split('\n')
  const tokens = createMd().parse(src, {})
  const heads: RawHeading[] = []

  tokens.forEach((t, i) => {
    if (t.type !== 'heading_open' || !t.map) return
    const text = tokens[i + 1]?.content.trim() ?? ''
    const startLine = t.map[0]
    if (!lines[startLine].trimStart().startsWith('#')) {
      throw new Error(`${fileName}:${startLine + 1} 只支持 ATX 标题（以 # 开头），不支持下划线式标题`)
    }
    heads.push({ level: Number(t.tag.slice(1)), line: startLine, end: t.map[1], text })
  })

  const h1s = heads.filter((h) => h.level === 1)
  if (h1s.length !== 1) {
    throw new Error(`${fileName}: 一章需要且只能有一个一级标题「# 第N章 标题」，找到 ${h1s.length} 个`)
  }
  const h1 = h1s[0]
  const cm = CHAPTER_RE.exec(h1.text)
  if (!cm) throw new Error(`${fileName}:${h1.line + 1} 一级标题须形如「第N章 标题」，实际是「${h1.text}」`)
  const number = Number(cm[1])
  const slug = chapterSlug(number)
  const baseName = fileName.replace(/\.md$/i, '')
  if (baseName !== slug) {
    throw new Error(`文件名 ${fileName} 与文件内的「第${number}章」不一致，应命名为 ${slug}.md`)
  }

  const h2s = heads.filter((h) => h.level === 2)
  const introEnd = h2s[0]?.line ?? lines.length
  const intro = lines.slice(h1.end, introEnd).join('\n')

  const sections: Section[] = h2s.map((h, i) => {
    const endLine = h2s[i + 1]?.line ?? lines.length
    const sm = SECTION_RE.exec(h.text)
    if (!sm) throw new Error(`${fileName}:${h.line + 1} 二级标题须以节号开头（如「## 2.3 …」），实际是「${h.text}」`)
    if (!sm[1].startsWith(`${number}.`)) {
      throw new Error(`${fileName}:${h.line + 1} 节号「${sm[1]}」与章号 ${number} 不匹配`)
    }
    return {
      number: sm[1],
      title: sm[2].trim(),
      slug: slugify(h.text),
      body: lines.slice(h.line, endLine).join('\n'),
      startLine: h.line,
      headings: heads
        .filter((x) => x.line >= h.line && x.line < endLine)
        .map((x) => ({ level: x.level, line: x.line - h.line, text: x.text })),
    }
  })

  return { file: fileName, number, title: cm[2].trim(), slug, intro, sections }
}

export type FrontmatterValue = string | number | boolean | { text: string; link: string }

/** 生成 YAML frontmatter；字符串一律 JSON 编码，避免「：」「"」等破坏 YAML。 */
export function renderFrontmatter(fm: Record<string, FrontmatterValue>): string {
  const out: string[] = ['---']
  for (const [k, v] of Object.entries(fm)) {
    if (typeof v === 'object') {
      out.push(`${k}:`)
      out.push(`  text: ${JSON.stringify(v.text)}`)
      out.push(`  link: ${JSON.stringify(v.link)}`)
    } else if (typeof v === 'string') {
      out.push(`${k}: ${JSON.stringify(v)}`)
    } else {
      out.push(`${k}: ${String(v)}`)
    }
  }
  out.push('---', '')
  return out.join('\n')
}

/**
 * 节页面：`## 2.8 …` 提升为 `# 2.8 …`，`###` 提升为 `##`，其余原样。
 * 只改标题所在的行（由 token.map 定位），代码块里的 `#` 不受影响。
 */
export function renderSectionPage(section: Section, fm: Record<string, FrontmatterValue>): string {
  const lines = section.body.split('\n')
  for (const h of section.headings) {
    lines[h.line] = lines[h.line].replace(/^(\s*)#/, '$1')
  }
  return renderFrontmatter(fm) + lines.join('\n').replace(/\s*$/, '') + '\n'
}

/**
 * 章首页：章标题 + 引言（若有）+ 各节链接列表 + 开始阅读。
 * 「继续阅读」与已读标记属于 M2，届时用组件替换列表。
 */
export function renderChapterIndex(chapter: Chapter, fm: Record<string, FrontmatterValue>): string {
  const parts: string[] = [renderFrontmatter(fm), `# 第${chapter.number}章 ${chapter.title}`, '']
  if (chapter.intro.trim()) parts.push(chapter.intro.trim(), '')
  parts.push('## 本章目录', '')
  for (const s of chapter.sections) {
    parts.push(`- [${s.number} ${s.title}](/${chapter.slug}/${s.slug})`)
  }
  if (chapter.sections.length) {
    parts.push('', `[开始阅读 →](/${chapter.slug}/${chapter.sections[0].slug})`)
  }
  return parts.join('\n') + '\n'
}
