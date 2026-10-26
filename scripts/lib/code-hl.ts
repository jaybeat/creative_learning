// 课程代码卡（c-editor）的语法高亮：和网站正文代码块同一个 shiki，配色照 github-light。
// 用 css-variables 主题，输出里只有 var(--shiki-*)，色值写在 clean-tokens.ts 的 CODE_TOKENS，帧文件里不写色值。
import { codeToTokens, createCssVariablesTheme } from 'shiki'

const theme = createCssVariablesTheme({ name: 'course-css-vars', variablePrefix: '--shiki-' })
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** 把几行 C 代码高亮成 HTML，一行一个字符串（整段一起分词，跨行的注释也对） */
export async function highlightC(lines: string[]): Promise<string[]> {
  const { tokens } = await codeToTokens(lines.join('\n'), { lang: 'c', theme })
  return tokens.map((row) => row.map((t) => (t.color ? `<span style="color:${t.color}">${esc(t.content)}</span>` : esc(t.content))).join(''))
}
