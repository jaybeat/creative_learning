import { parse as parseYaml } from 'yaml'
import { createMd } from './md'

export interface HomeSpec {
  /** 首屏的一句话 */
  tagline: string
  /** frontmatter 之后的 Markdown：每个 `##` 小节是一张理念卡片 */
  body: string
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/** 解析 book/home.md；没有 frontmatter 时 tagline 为空。 */
export function parseHome(src: string): HomeSpec {
  const m = FRONTMATTER_RE.exec(src)
  if (!m) return { tagline: '', body: src }
  const data = (parseYaml(m[1]) ?? {}) as Record<string, unknown>
  return { tagline: typeof data.tagline === 'string' ? data.tagline.trim() : '', body: src.slice(m[0].length) }
}

/** 把正文按 `##` 切成卡片：每张卡片 = 标题行起到下一个 `##` 之前（用 token 流定位，代码块里的 ## 不算） */
export function splitIdeas(body: string): { title: string; markdown: string }[] {
  const lines = body.split('\n')
  const tokens = createMd().parse(body, {})
  const heads: { line: number; text: string }[] = []
  tokens.forEach((t, i) => {
    if (t.type === 'heading_open' && t.tag === 'h2' && t.map) heads.push({ line: t.map[0], text: tokens[i + 1]?.content.trim() ?? '' })
  })
  return heads.map((h, i) => ({
    title: h.text,
    markdown: lines.slice(h.line, heads[i + 1]?.line ?? lines.length).join('\n').trim(),
  }))
}

/**
 * 生成 site/index.md：全宽页面，顶部 <HomeHero>，中间理念卡片（作者的 Markdown 原样进卡片），底部章节列表。
 * home 为 null（没有 book/home.md）时只有 HomeHero 和章节列表。
 */
export function renderHome(home: HomeSpec | null): string {
  const parts: string[] = ['---', 'layout: page', 'title: 首页', 'sidebar: false', 'aside: false', '---', '', '<HomeHero />', '']
  const ideas = home ? splitIdeas(home.body) : []
  if (ideas.length) {
    parts.push('<div class="home-ideas vp-doc">', '')
    ideas.forEach((idea, i) => {
      parts.push(
        '<article class="home-idea">',
        `<span class="home-idea-no" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>`,
        '',
        idea.markdown,
        '',
        '</article>',
        '',
      )
    })
    parts.push('</div>', '')
  }
  parts.push('<section class="home-chapters vp-doc">', '', '## 章节 {#chapters}', '', '<ChapterList />', '', '</section>', '')
  return parts.join('\n')
}
