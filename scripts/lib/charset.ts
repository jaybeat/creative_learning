import { createMd } from './md'

export interface CharHit {
  ch: string
  file: string
  /** 1 基行号；ASCII 补集为 0 */
  line: number
}

function isSkippable(cp: number): boolean {
  // 控制字符（含 \t \n \r）与 DEL 不参与字体校验
  return cp < 0x20 || cp === 0x7f
}

/**
 * 收集一章里所有代码围栏、缩进代码块、行内代码中出现的字符，并记录首次出现的位置。
 * 正文里的字符不收集：正文用系统字体，不走 BookMono。
 */
export function collectCodeChars(src: string, file: string): CharHit[] {
  const tokens = createMd().parse(src, {})
  const hits: CharHit[] = []

  const pushText = (text: string, baseLine: number) => {
    const lines = text.split('\n')
    lines.forEach((ln, i) => {
      for (const ch of ln) {
        const cp = ch.codePointAt(0)!
        if (isSkippable(cp)) continue
        hits.push({ ch, file, line: baseLine + i })
      }
    })
  }

  for (const t of tokens) {
    if ((t.type === 'fence' || t.type === 'code_block') && t.map) {
      // fence 的内容从围栏起始行的下一行开始；code_block 从 map[0] 开始
      const first = t.type === 'fence' ? t.map[0] + 2 : t.map[0] + 1
      pushText(t.content, first)
    } else if (t.type === 'inline' && t.children && t.map) {
      // 行内代码没有自己的 map，用所在段落的起始行 + 之前 softbreak 数量估算
      let offset = 0
      for (const c of t.children) {
        if (c.type === 'softbreak' || c.type === 'hardbreak') offset++
        else if (c.type === 'code_inline') pushText(c.content, t.map[0] + 1 + offset)
      }
    }
  }
  return hits
}

/** 去重（保留首次出现位置），并并上 ASCII 可打印字符 U+0020–U+007E。 */
export function withAscii(hits: CharHit[]): Map<string, CharHit> {
  const map = new Map<string, CharHit>()
  for (const h of hits) if (!map.has(h.ch)) map.set(h.ch, h)
  for (let cp = 0x20; cp <= 0x7e; cp++) {
    const ch = String.fromCodePoint(cp)
    if (!map.has(ch)) map.set(ch, { ch, file: '(ascii)', line: 0 })
  }
  return map
}
