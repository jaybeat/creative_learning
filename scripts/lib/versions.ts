import { createMd } from './md'

const VERSION_RE = /编辑器(\d+\.\d+)|(\d+\.\d+)版/g

/**
 * 一章里当作「版本号」用的两段号：正文中出现过「编辑器N.M」或「N.M版」的 N.M。
 * 只看正文 text（代码块、行内代码不算）。交叉引用插件在这一章里遇到这些数字时按版本号处理，
 * 其他章照常当节号链接——「1.1」在第 1 章是节号，在第 2 章是编辑器 1.1。
 */
export function detectVersionNumbers(src: string): string[] {
  const found = new Set<string>()
  for (const t of createMd().parse(src, {})) {
    if (t.type !== 'inline' || !t.children) continue
    const text = t.children
      .filter((c) => c.type === 'text')
      .map((c) => c.content)
      .join('')
    for (const m of text.matchAll(VERSION_RE)) found.add(m[1] ?? m[2])
  }
  return [...found].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}
