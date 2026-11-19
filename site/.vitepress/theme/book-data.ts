import book from '../generated/book.json'

/** 站内路径 → 当前书稿里的标题（「2.8 动态扩容：编辑器1.1」「第2章 线性表」「一元多项式的运算 · 第一问」）；不存在返回 null */
export function titleOf(path: string): string | null {
  for (const ch of book.chapters) {
    if (path === `/${ch.slug}/`) return `第${ch.number}章 ${ch.title}`
    const s = ch.sections.find((x) => x.link === path)
    if (s) return `${s.number} ${s.title}`
    const p = ch.problems?.items.find((x) => x.link === path)
    if (p) return `${ch.problems!.title} · ${p.short}`
  }
  return null
}

export const firstSectionLink: string | null = book.chapters[0]?.firstSection ?? null

type BookChapter = (typeof book.chapters)[number]
type ProblemItem = NonNullable<BookChapter['problems']>['items'][number]

/** 挂在某一节后面的问（book.yml 的 problems.after）：目录里插在那一节下面 */
export function problemsAfter(ch: BookChapter, sectionLink: string): ProblemItem[] {
  return ch.problems?.items.filter((p) => p.after === sectionLink) ?? []
}

/** 挂在章末的问：目录最后的「本章练习」 */
export function endProblems(ch: BookChapter): ProblemItem[] {
  return ch.problems?.items.filter((p) => !p.after) ?? []
}
