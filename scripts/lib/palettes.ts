// 贴纸版的色系令牌。主题 CSS（scripts/lib/sticker.ts）只用 var(--xxx)，帧文件和 kit 元素里不写色值，
// 所以换色系 = 换根元素上的 data-palette。新增色系要先过 npx tsx scripts/palette-check.ts。
// 语义规则（和色系无关）：强调色只给"正在讲的那个 / 对的那个"；错误不用颜色，用 --wrong 灰 + 压暗 + 划线；
// 紫色 --ptr 留给指针（docs/course/visual-spec.md）。

export type Palette = {
  name: string
  bg: string // 底
  dot: string // 底上的点阵
  ink: string // 正文
  mute: string // 次要文字（≥12px 画布）
  paper: string // 贴纸的白
  tile: string // 普通格子
  tileInk: string // 格子上的字
  off: string // 没点亮的格子
  offInk: string
  acc: string // 强调
  accSoft: string // 强调浅底（高亮行、标签底）
  accInk: string // 强调色上的字
  accLine: string // 强调色的线和小字：强调色太浅时（明黄、芥末）退回深色
  ok: string // ✓ 的圆底
  wrong: string // ✗ 的圆底、划线
  dark: string // 暗场底
  darkDot: string
  darkInk: string
  darkMute: string
  big: string // 大数字
  bigStroke: string // 大数字描边（亮底上）
  bigStrokeW: number // 描边宽度（画布 px）
  field: string // 编辑器、输入框的内底
  fieldLine: string
  ptr: string // 指针（紫）
}

const PTR = '#7048e8'

export const PALETTES: Record<string, Palette> = {
  p0: {
    name: 'P0 原片 冷灰·炭·朱橙',
    bg: '#eef0f1', dot: '#d3d8dc', ink: '#1e2226', mute: '#5f656b', paper: '#ffffff',
    tile: '#2a2f35', tileInk: '#ffffff', off: '#d6dbdf', offInk: '#5f656b',
    acc: '#e8492f', accSoft: '#fbe1da', accInk: '#ffffff', accLine: '#d43d24',
    ok: '#2a2f35', wrong: '#9aa0a6',
    dark: '#1f2429', darkDot: '#2e343a', darkInk: '#ffffff', darkMute: '#b4bac0',
    big: '#e8492f', bigStroke: '#ffffff', bigStrokeW: 9,
    field: '#f5f6f7', fieldLine: '#dadfe3', ptr: PTR,
  },
  p1: {
    name: 'P1 暖纸·墨·番茄红',
    bg: '#f3eee4', dot: '#dcd3c2', ink: '#26221d', mute: '#6b6357', paper: '#fffdf8',
    tile: '#2e2a25', tileInk: '#ffffff', off: '#ded6c8', offInk: '#6b6357',
    acc: '#d6452b', accSoft: '#f6dbcf', accInk: '#ffffff', accLine: '#c43c23',
    ok: '#2f6b4f', wrong: '#a39a8c',
    dark: '#24201b', darkDot: '#36302a', darkInk: '#fffdf8', darkMute: '#c4baa9',
    big: '#d6452b', bigStroke: '#fffdf8', bigStrokeW: 9,
    field: '#faf7f1', fieldLine: '#e2dacb', ptr: PTR,
  },
  p3: {
    name: 'P3 雾白·深青·珊瑚',
    bg: '#ecf2ef', dot: '#d0dcd6', ink: '#16302b', mute: '#55665f', paper: '#ffffff',
    tile: '#1d4b44', tileInk: '#ffffff', off: '#d2ded9', offInk: '#55665f',
    acc: '#e0614a', accSoft: '#fce0da', accInk: '#ffffff', accLine: '#c9533c',
    ok: '#1d4b44', wrong: '#93a29c',
    dark: '#13302b', darkDot: '#1f413b', darkInk: '#ffffff', darkMute: '#a9bfb8',
    big: '#e0614a', bigStroke: '#ffffff', bigStrokeW: 9,
    field: '#f5f8f7', fieldLine: '#d6e0dc', ptr: PTR,
  },
  n1: {
    name: 'N1 Nord 极光',
    bg: '#eceff4', dot: '#d8dee9', ink: '#2e3440', mute: '#5b6375', paper: '#ffffff',
    tile: '#2e3440', tileInk: '#eceff4', off: '#d8dee9', offInk: '#5b6375',
    acc: '#ebcb8b', accSoft: '#f6ebd3', accInk: '#2e3440', accLine: '#2e3440',
    ok: '#2e3440', wrong: '#9aa3b5',
    dark: '#2e3440', darkDot: '#3b4252', darkInk: '#eceff4', darkMute: '#b8c0d0',
    big: '#ebcb8b', bigStroke: '#2e3440', bigStrokeW: 5,
    field: '#f5f7fa', fieldLine: '#d8dee9', ptr: PTR,
  },
  z1: {
    name: 'Z1 中国色 宣纸·黛蓝·赭石',
    bg: '#f1ece1', dot: '#dcd4c3', ink: '#2b2f36', mute: '#6a6458', paper: '#fffcf5',
    tile: '#3f4d5e', tileInk: '#ffffff', off: '#ddd5c5', offInk: '#6a6458',
    acc: '#b96a2f', accSoft: '#f1dcc8', accInk: '#ffffff', accLine: '#a85d25',
    ok: '#5c7a5e', wrong: '#a39b8b',
    dark: '#262b33', darkDot: '#343a44', darkInk: '#fffcf5', darkMute: '#c2bcb0',
    big: '#b96a2f', bigStroke: '#fffcf5', bigStrokeW: 9,
    field: '#faf6ee', fieldLine: '#e2d9c7', ptr: PTR,
  },
  m2: {
    name: 'M2 莫兰迪 灰蓝·芥末',
    bg: '#e5e7e5', dot: '#cdd2cf', ink: '#2f3539', mute: '#5d6467', paper: '#ffffff',
    tile: '#4e5d6c', tileInk: '#ffffff', off: '#d2d6d4', offInk: '#5d6467',
    acc: '#c9a44e', accSoft: '#f1e6c8', accInk: '#2f3539', accLine: '#2f3539',
    ok: '#66806d', wrong: '#9ca3a6',
    dark: '#2e353c', darkDot: '#3c444c', darkInk: '#ffffff', darkMute: '#b9c0c4',
    big: '#c9a44e', bigStroke: '#4e5d6c', bigStrokeW: 4,
    field: '#f2f3f2', fieldLine: '#d6dad8', ptr: PTR,
  },
}

export const DEFAULT_PALETTE = 'p0'

const VAR: Record<keyof Omit<Palette, 'name'>, string> = {
  bg: '--bg', dot: '--dot', ink: '--ink', mute: '--mute', paper: '--paper',
  tile: '--tile', tileInk: '--tile-ink', off: '--off', offInk: '--off-ink',
  acc: '--acc', accSoft: '--acc-soft', accInk: '--acc-ink', accLine: '--acc-line',
  ok: '--ok', wrong: '--wrong',
  dark: '--dark', darkDot: '--dark-dot', darkInk: '--dark-ink', darkMute: '--dark-mute',
  big: '--big', bigStroke: '--big-stroke', bigStrokeW: '--big-stroke-w',
  field: '--field', fieldLine: '--field-line', ptr: '--ptr',
}

/** 每套色系一个 [data-palette="id"] 块；def 那套同时挂在 :root 上作默认值 */
export function paletteCss(def = DEFAULT_PALETTE): string {
  const block = (p: Palette) =>
    (Object.keys(VAR) as (keyof typeof VAR)[]).map((k) => `${VAR[k]}:${k === 'bigStrokeW' ? p[k] + 'px' : p[k]}`).join(';')
  return [
    `:root{${block(PALETTES[def])}}`,
    ...Object.entries(PALETTES).map(([id, p]) => `[data-palette="${id}"]{${block(p)}}`),
  ].join('\n')
}
