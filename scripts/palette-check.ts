// 检查贴纸版色系是否合格：npx tsx scripts/palette-check.ts
// 1. 对比度（WCAG）：正文、次要文字在底和贴纸上 ≥ 4.5；格子字、暗场字 ≥ 4.5；熄灭格子字 ≥ 3（格子字都是大号粗体）；
//    强调色上的字 ≥ 3（只用在大号粗体）；大数字本身或它的描边和底 ≥ 3。
// 2. 色差（CIEDE2000）：强调色和指针紫 ≥ 20，讲到指针时不混；强调格子和普通格子、熄灭格子 ≥ 20。
// 不合格的反例 REJECTED 也跑一遍，确认检查拦得住（P4 电光蓝离指针紫太近）。
import { PALETTES, type Palette } from './lib/palettes'

const REJECTED: Record<string, Palette> = {
  p4: {
    ...PALETTES.p0,
    name: 'P4 冷白·炭·电光蓝（反例）',
    acc: '#2f6bff', accSoft: '#dde7ff', accLine: '#2f6bff', big: '#2f6bff',
  },
}

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const lum = (h: string) => { const [r, g, b] = hex(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

function lab(h: string) {
  const [r, g, b] = hex(h).map(lin)
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}
// CIEDE2000
function dE(h1: string, h2: string) {
  const [L1, a1, b1] = lab(h1), [L2, a2, b2] = lab(h2), rad = Math.PI / 180
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)))
  const A1 = a1 * (1 + G), A2 = a2 * (1 + G), c1 = Math.hypot(A1, b1), c2 = Math.hypot(A2, b2)
  const hh = (b: number, a: number) => { const v = Math.atan2(b, a) / rad; return v < 0 ? v + 360 : v }
  const h1p = hh(b1, A1), h2p = hh(b2, A2)
  const dL = L2 - L1, dC = c2 - c1
  let dh = h2p - h1p; if (c1 * c2 === 0) dh = 0; else if (dh > 180) dh -= 360; else if (dh < -180) dh += 360
  const dH = 2 * Math.sqrt(c1 * c2) * Math.sin((dh / 2) * rad)
  const Lm = (L1 + L2) / 2, cm = (c1 + c2) / 2
  let hm = h1p + h2p; if (c1 * c2 !== 0) hm = Math.abs(h1p - h2p) > 180 ? (hm + (hm < 360 ? 360 : -360)) / 2 : hm / 2
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad)
  const SL = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2), SC = 1 + 0.045 * cm, SH = 1 + 0.015 * cm * T
  const RT = -2 * Math.sqrt(cm ** 7 / (cm ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hm - 275) / 25) ** 2)) * rad)
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH))
}

function check(p: Palette): string[] {
  const bad: string[] = []
  const need = (what: string, v: number, min: number) => { if (v < min) bad.push(`${what} ${v.toFixed(2)} < ${min}`) }
  need('正文/底', contrast(p.ink, p.bg), 4.5)
  need('次要文字/底', contrast(p.mute, p.bg), 4.5)
  need('正文/贴纸', contrast(p.ink, p.paper), 4.5)
  need('次要文字/贴纸', contrast(p.mute, p.paper), 4.5)
  need('格子字/格子', contrast(p.tileInk, p.tile), 4.5)
  need('熄灭格子字/熄灭格子（大字）', contrast(p.offInk, p.off), 3)
  need('暗场字/暗场', contrast(p.darkInk, p.dark), 4.5)
  need('暗场次要字/暗场', contrast(p.darkMute, p.dark), 4.5)
  need('强调字/强调色', contrast(p.accInk, p.acc), 3)
  need('强调线/贴纸', contrast(p.accLine, p.paper), 3)
  need('大数字/底（含描边）', Math.max(contrast(p.big, p.bg), p.bigStrokeW >= 3 ? contrast(p.bigStroke, p.bg) : 0), 3)
  need('强调色↔指针紫 ΔE', dE(p.acc, p.ptr), 20)
  need('强调格子↔普通格子 ΔE', dE(p.acc, p.tile), 20)
  need('强调格子↔熄灭格子 ΔE', dE(p.acc, p.off), 20)
  return bad
}

let failed = 0
for (const [id, p] of Object.entries(PALETTES)) {
  const bad = check(p)
  console.log(`${bad.length ? '✗' : '✓'} ${id} ${p.name}${bad.length ? '\n    ' + bad.join('\n    ') : ''}`)
  if (bad.length) failed++
}
for (const [id, p] of Object.entries(REJECTED)) {
  const bad = check(p)
  console.log(`${bad.length ? '✓ 已拦下' : '✗ 没拦下'} ${id} ${p.name}${bad.length ? '：' + bad.join('；') : ''}`)
  if (!bad.length) failed++
}
if (failed) { console.error(`[palette-check] ${failed} 处不合格`); process.exit(1) }
console.log(`[palette-check] ${Object.keys(PALETTES).length} 套色系全部合格`)
