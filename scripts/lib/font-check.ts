import * as fontkit from 'fontkit'
import type { CharHit } from './charset'

export type FontLike = {
  unitsPerEm: number
  hasGlyphForCodePoint(cp: number): boolean
  glyphForCodePoint(cp: number): { advanceWidth: number }
}

export function openFont(buf: Buffer): FontLike {
  const f = fontkit.create(buf as unknown as Uint8Array) as unknown as FontLike & { fonts?: FontLike[] }
  if (Array.isArray(f.fonts)) return f.fonts[0]
  return f
}

/**
 * 期望字宽（以 1000 upem 计）：
 * 中文（CJK 统一表意文字及扩展、兼容表意文字）、CJK 标点 U+3000–303F、全角形式 → 1000；
 * 其余一切（ASCII、制表符、箭头、几何图形、`→…—` 等）→ 500。
 * 注意「半角与全角形式」区里的半角片假名/半角符号（FF61–FFDC、FFE8–FFEE）本身就是半角。
 */
export function expectedAdvance(cp: number): 1000 | 500 {
  const wide =
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x20000 && cp <= 0x3134f) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0x3000 && cp <= 0x303f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6)
  return wide ? 1000 : 500
}

export interface FontProblem {
  ch: string
  cp: string
  file: string
  line: number
  reason: string
}

export function checkFont(font: FontLike, chars: Map<string, CharHit>): FontProblem[] {
  const problems: FontProblem[] = []
  const scale = 1000 / font.unitsPerEm
  for (const [ch, hit] of chars) {
    const cp = ch.codePointAt(0)!
    const cpText = `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`
    if (!font.hasGlyphForCodePoint(cp)) {
      problems.push({ ch, cp: cpText, file: hit.file, line: hit.line, reason: '字体里没有这个字符的字形' })
      continue
    }
    const adv = Math.round(font.glyphForCodePoint(cp).advanceWidth * scale)
    const want = expectedAdvance(cp)
    if (adv !== want) {
      problems.push({ ch, cp: cpText, file: hit.file, line: hit.line, reason: `字宽 ${adv}，应为 ${want}` })
    }
  }
  return problems
}

export function formatProblems(problems: FontProblem[]): string {
  return problems
    .map((p) => `  ${p.file}:${p.line}  「${p.ch}」 ${p.cp}  ${p.reason}`)
    .join('\n')
}
