/** 节标题：以「2.8」「2.8.1」这样的编号开头。 */
export const SECTION_RE = /^(\d+(?:\.\d+)*)\s+(.*)$/
/** 章标题：「第2章 线性表」。 */
export const CHAPTER_RE = /^第(\d+)章\s+(.*)$/

export function chapterSlug(n: number): string {
  return `ch${String(n).padStart(2, '0')}`
}

/**
 * 标题 → URL 片段。
 * - 「2.8 链表」→ `2-8`，「2.8.1 …」→ `2-8-1`（纯数字，分享时不会变成百分号编码）
 * - 「第2章 线性表」→ `ch02`
 * - 其他：小写、去标点、空白转 `-`
 */
export function slugify(title: string): string {
  const t = title.trim()
  const s = SECTION_RE.exec(t)
  if (s) return s[1].replace(/\./g, '-')
  const c = CHAPTER_RE.exec(t)
  if (c) return chapterSlug(Number(c[1]))
  return t
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}
