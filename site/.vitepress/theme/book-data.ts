import book from '../generated/book.json'

/** 站内路径 → 当前书稿里的标题（「2.8 动态扩容：编辑器1.1」「第2章 线性表」）；不存在返回 null */
export function titleOf(path: string): string | null {
  for (const ch of book.chapters) {
    if (path === `/${ch.slug}/`) return `第${ch.number}章 ${ch.title}`
    const s = ch.sections.find((x) => x.link === path)
    if (s) return `${s.number} ${s.title}`
  }
  return null
}

export const firstSectionLink: string | null = book.chapters[0]?.firstSection ?? null
