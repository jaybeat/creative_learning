/** 题目页的本机存储：代码草稿、分栏比例。只在 onMounted 之后调用，读写全部 try/catch（隐私模式下可能抛异常）。 */

export const TEMPLATE = '#include <stdio.h>\n\nint main(void) {\n    \n    return 0;\n}\n'

export const draftKey = (problemId: string) => `ds-book:code:${problemId}`
export const SPLIT_KEY = 'ds-book:problem-split'

export function readDraft(problemId: string): string | null {
  try {
    return localStorage.getItem(draftKey(problemId))
  } catch {
    return null
  }
}

export function writeDraft(problemId: string, code: string): void {
  try {
    if (code === TEMPLATE) localStorage.removeItem(draftKey(problemId))
    else localStorage.setItem(draftKey(problemId), code)
  } catch {
    /* 配额不足或隐私模式：本次会话内仍可编辑 */
  }
}

/** 左栏宽度占比，限制在 [0.25, 0.75] */
export function clampSplit(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0.5
  return Math.min(0.75, Math.max(0.25, n))
}

export function readSplit(): number {
  try {
    const v = localStorage.getItem(SPLIT_KEY)
    return v === null ? 0.5 : clampSplit(v)
  } catch {
    return 0.5
  }
}

export function writeSplit(v: number): void {
  try {
    localStorage.setItem(SPLIT_KEY, String(clampSplit(v)))
  } catch {
    /* ignore */
  }
}
