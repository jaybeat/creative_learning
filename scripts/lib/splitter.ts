import { createMd } from './md'
import { CHAPTER_RE, SECTION_RE, chapterSlug, slugify } from './slug'

export interface Heading {
  level: number
  /** 相对于所在节 body 的 0 基行号 */
  line: number
  text: string
}

export interface ParaTitle {
  /** 相对于所在节 body 的 0 基行号 */
  line: number
  /** 去掉 ** 后的标题文字 */
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
  /** 独占一行的 `**加粗**` 段落：作者当小标题用，切页时提升为带锚点的三级标题 */
  paraTitles: ParaTitle[]
}

export interface Chapter {
  file: string
  number: number
  title: string
  /** 「ch02」 */
  slug: string
  /** `#` 与第一个 `##` 之间的原文，可能为空 */
  intro: string
  /** intro 在章文件里的 0 基起始行（即 h1 的下一行） */
  introStartLine: number
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

  // 独占一行、只含一个粗体的顶层段落（不在引用块 / 列表里）
  const paraTitles: { line: number; text: string }[] = []
  tokens.forEach((t, i) => {
    if (t.type !== 'paragraph_open' || t.level !== 0 || !t.map || t.map[1] - t.map[0] !== 1) return
    const inline = tokens[i + 1]
    if (inline?.type !== 'inline' || tokens[i + 2]?.type !== 'paragraph_close') return
    const c = (inline.children ?? []).filter((x) => !(x.type === 'text' && x.content === ''))
    if (c.length === 3 && c[0].type === 'strong_open' && c[1].type === 'text' && c[2].type === 'strong_close') {
      // 「**本书的组织。**」→ 标题「本书的组织」：去掉收尾标点
      paraTitles.push({ line: t.map[0], text: c[1].content.trim().replace(/[。：:]+$/, '') })
    }
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
      paraTitles: paraTitles
        .filter((p) => p.line > h.line && p.line < endLine)
        .map((p) => ({ line: p.line - h.line, text: p.text })),
    }
  })

  return { file: fileName, number, title: cm[2].trim(), slug, intro, introStartLine: h1.end, sections }
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
 * 独占一行的 `**加粗**` 段落改写为 `### 文字 {#2-8-p1 .para-title}`：进右侧大纲、有稳定的纯 ASCII 锚点。
 * 只改由 token.map 定位到的行，代码块里的 `#`、`**` 不受影响。
 */
export function renderSectionPage(section: Section, fm: Record<string, FrontmatterValue>): string {
  const lines = section.body.split('\n')
  for (const h of section.headings) {
    lines[h.line] = lines[h.line].replace(/^(\s*)#/, '$1')
  }
  section.paraTitles.forEach((p, i) => {
    lines[p.line] = `### ${p.text} {#${section.slug}-p${i + 1} .para-title}`
  })
  return renderFrontmatter(fm) + lines.join('\n').replace(/\s*$/, '') + '\n'
}

/**
 * 章首页：章标题 + 引言（若有）+ <ChapterIndex> 组件（本章目录、已读标记、开始/继续阅读）。
 * 组件在 SSR 时就渲染出完整目录；已读标记与「继续阅读」挂载后才出现。
 */
export function renderChapterIndex(chapter: Chapter, fm: Record<string, FrontmatterValue>): string {
  const parts: string[] = [renderFrontmatter(fm), `# 第${chapter.number}章 ${chapter.title}`, '']
  if (chapter.intro.trim()) parts.push(chapter.intro.trim(), '')
  parts.push(`<ChapterIndex chapter="${chapter.slug}" />`)
  return parts.join('\n') + '\n'
}
