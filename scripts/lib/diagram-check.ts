import { expectedAdvance } from './font-check'

export interface DiagramIssue {
  /** 图示内 0 基行号 */
  line: number
  /** 0 基列号（中文按 2 列） */
  col: number
  /** 该位置的字符 */
  char: string
  hint: string
}

/** 网站里每个字符占的列数：与字宽校验同一规则（advance 1000 → 2 列） */
export function displayWidth(ch: string): 1 | 2 {
  return expectedAdvance(ch.codePointAt(0)!) === 1000 ? 2 : 1
}

/** 向下开口：这一行的该列下面应该接着竖线（或竖线的收口）；含圆角 ╭╮，向上的箭头尖 ▲ 下面接线 */
const OPENS_DOWN = new Set('┌┐┬┼├┤│╭╮▲')
/** 向上开口：这一行的该列上面应该接着竖线（或竖线的起点）；含圆角 ╰╯，向下的箭头尖 ▼ 上面接线 */
const OPENS_UP = new Set('└┘┴┼├┤│▼╰╯')
const BOX_CHARS = /[─-╿]/

/** 把一行展开成「列 → 字符」；中文占两列，第二列记为 '' */
function cells(line: string): string[] {
  const out: string[] = []
  for (const ch of line) {
    out.push(ch)
    if (displayWidth(ch) === 2) out.push('')
  }
  return out
}

/**
 * 字符画对齐提示（保守：宁可漏报不误报）。
 * 逐对相邻行比较：上行某列是向下开口的框线字符，下行同列却是既不是空白也不是向上开口的字符
 * （通常是方框里的中文把右边框挤歪了），或者反过来，就报一条。
 * 圆角 ╭╮╰╯、箭头、纯文字行不参与判断。每块最多报 3 条。
 */
export function checkDiagram(text: string, limit = 3): DiagramIssue[] {
  const lines = text.replace(/\n$/, '').split('\n')
  const issues: DiagramIssue[] = []
  for (let i = 0; i + 1 < lines.length && issues.length < limit; i++) {
    if (!BOX_CHARS.test(lines[i]) || !BOX_CHARS.test(lines[i + 1])) continue
    const up = cells(lines[i])
    const down = cells(lines[i + 1])
    const width = Math.max(up.length, down.length)
    for (let c = 0; c < width && issues.length < limit; c++) {
      const a = up[c] ?? ' '
      const b = down[c] ?? ' '
      const blankA = a === '' || a.trim() === ''
      const blankB = b === '' || b.trim() === ''
      if (OPENS_DOWN.has(a) && !blankB && !OPENS_UP.has(b)) {
        issues.push({ line: i + 1, col: c, char: b, hint: `上一行第 ${c + 1} 列是「${a}」，这一列应接竖线，却是「${b}」` })
      } else if (OPENS_UP.has(b) && !blankA && !OPENS_DOWN.has(a)) {
        issues.push({ line: i + 1, col: c, char: b, hint: `「${b}」上面应接竖线，上一行同列却是「${a}」` })
      } else if (b === '│' && blankA && (OPENS_DOWN.has(up[c - 1] ?? '') || OPENS_DOWN.has(up[c + 1] ?? ''))) {
        // 竖线错开一列：上一行的拐角在左边或右边一列（典型原因：方框里的中文按 1 列画了）
        const side = OPENS_DOWN.has(up[c - 1] ?? '') ? `左边一列是「${up[c - 1]}」` : `右边一列是「${up[c + 1]}」`
        issues.push({ line: i + 1, col: c, char: b, hint: `「│」上一行同列是空白，${side}，竖线错开了一列` })
      } else if (a === '│' && blankB && (OPENS_UP.has(down[c - 1] ?? '') || OPENS_UP.has(down[c + 1] ?? ''))) {
        const side = OPENS_UP.has(down[c - 1] ?? '') ? `左边一列是「${down[c - 1]}」` : `右边一列是「${down[c + 1]}」`
        issues.push({ line: i + 1, col: c, char: b, hint: `上一行第 ${c + 1} 列的「│」下面是空白，${side}，竖线错开了一列` })
      }
    }
  }
  return issues
}
