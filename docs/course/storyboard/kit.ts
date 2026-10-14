// 分镜画面元素：每个函数返回一段 HTML，画在 640×360 的画布上。
// 低保真线框：灰色调；cls 里带 new 的元素用强调色描边，表示"这一帧新出现/刚变化"。

export const at = (x: number, y: number, html: string, style = '') =>
  `<div class="abs" style="left:${x}px;top:${y}px;${style}">${html}</div>`

export const title = (s: string) => `<div class="t">${s}</div>`

export const tag = (s: string, cls = '') => `<span class="tag ${cls}">${s}</span>`

export const note = (s: string, cls = '') => `<span class="note ${cls}">${s}</span>`

/** 编辑器框。cursor 是光标左边的字符数；cursor 为 -1 表示不画光标。 */
export function editor(text: string, opt: { cursor?: number; cls?: string; hi?: number[] } = {}) {
  const c = opt.cursor ?? text.length
  const ch = [...text].map((s, i) => (opt.hi?.includes(i) ? `<b class="hl">${s}</b>` : s))
  const body = c < 0 ? ch.join('') : ch.slice(0, c).join('') + '<span class="cur">|</span>' + ch.slice(c).join('')
  return `<div class="ed ${opt.cls ?? ''}">${body || '&nbsp;'}</div>`
}

type CellOpt = {
  idx?: string[] // 格子下方的编号
  top?: string[] // 格子上方的标签
  cls?: string[] // 每个格子的额外 class（new / hl / dim）
  arrows?: boolean // 格子之间画箭头
  size?: number
}
/** 一排格子 */
export function cells(items: string[], o: CellOpt = {}) {
  const s = o.size ?? 38
  const parts = items.map((v, i) => {
    const top = o.top?.[i] ? `<span class="ct">${o.top[i]}</span>` : ''
    const idx = o.idx?.[i] !== undefined ? `<span class="ci">${o.idx[i]}</span>` : ''
    return `<div class="cell ${o.cls?.[i] ?? ''}" style="width:${s}px;height:${s}px">${top}${v}${idx}</div>`
  })
  return `<div class="cells ${o.arrows ? 'gap' : ''}">${parts.join(o.arrows ? '<span class="arr">→</span>' : '')}</div>`
}

export const Q = ['程序要记住这一行字的什么？', '要对它做哪些事？', '怎么把它放进内存？']

/** 问题卡。corner=true 时缩在右上角。 */
export function qcard(o: { show?: number; hi?: number; done?: number[]; corner?: boolean; cls?: string } = {}) {
  const n = o.show ?? 3
  const lines = Q.slice(0, n).map((q, i) => {
    const c = [i === o.hi ? 'on' : '', o.done?.includes(i) ? 'ok' : ''].join(' ')
    return `<li class="${c}">${q}${o.done?.includes(i) ? ' <b class="okm">✓</b>' : ''}</li>`
  })
  return `<div class="qc ${o.corner ? 'corner' : ''} ${o.cls ?? ''}"><div class="qh">问题</div><ol>${lines.join('')}</ol></div>`
}

export const ACC = ['定义', '同类型', '一个接一个', '个数有限', '可以重复']

/**
 * 五行手风琴卡片。open 是展开的行号（-1 表示全部收起）；
 * 展开行之前的行显示 sum 里的结果，之后的行只显示行名。
 */
export function acc(o: { open: number; body?: string; sum?: string[]; tick?: number[]; cls?: Record<number, string> }) {
  const rows = ACC.map((name, i) => {
    const c = o.cls?.[i] ?? ''
    const tick = o.tick?.includes(i) ? '<b class="okm">✓</b>' : ''
    if (i === o.open) return `<div class="row open ${c}"><div class="rn">${name}</div><div class="rb">${o.body ?? ''}</div></div>`
    const s = (o.open === -1 || i < o.open) && o.sum?.[i] ? `<span class="rs">${o.sum[i]}</span>` : ''
    return `<div class="row ${c}"><div class="rn">${name}</div>${s}${tick}</div>`
  })
  return `<div class="acc">${rows.join('')}</div>`
}

/** 五行收起后的结果 */
export const SUM = ['(c, a, t)　长度 3', 'c a t 都是字符', 'c → a → t', '长度 0 → 3', 'b o o k']

/** 例题卡片下面的三行检查 */
export function checks(marks: string[], cls: string[] = []) {
  const names = ['同类型', '一个接一个', '个数有限']
  return `<div class="checks">${names
    .map((n, i) => {
      const m = marks[i] ?? ''
      const mk = m === '✓' ? '<b class="okm">✓</b>' : m === '✗' ? '<b class="nom">✗</b>' : ''
      return `<div class="ck ${cls[i] ?? ''}">${n}${mk}</div>`
    })
    .join('')}</div>`
}

export const card = (html: string, cls = '', style = '') => `<div class="card ${cls}" style="${style}">${html}</div>`

export const pause = (s: string) => `<div class="pause"><div class="pi">⏸</div><div>${s}</div></div>`

// ───────── 纸面版元素（只在 <id>.paper.frames.ts 里用，样式和笔迹在 scripts/lib/paper.ts） ─────────
// 纸片层是印刷体（卡片、表格、格子）；笔迹层只给老师的批注：手写字、箭头、圈、勾叉、图章、便利贴。

type InkColor = 'green' | 'red' | 'blue'
/** 手写批注。to 是箭头终点（画布坐标），不给就只写字 */
export const ink = (s: string, o: { to?: [number, number]; c?: InkColor; size?: number } = {}) =>
  `<span class="ink ${o.c ?? 'green'}"${o.to ? ` data-to="${o.to[0]},${o.to[1]}"` : ''}${o.size ? ` style="font-size:${o.size}px"` : ''}>${s}</span>`

/** 手画圈，圈住画布上 (x, y, w, h) 这块区域 */
export const circle = (x: number, y: number, w: number, h: number, c: InkColor = 'red') =>
  `<div class="abs circ ${c}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`

/** 橡皮图章：盖结论用 */
export const stamp = (s: string, ok = true) => `<span class="stamp ${ok ? 'ok' : 'no'}">${s}</span>`

/** 便利贴：只放关键提醒 */
export const sticky = (html: string, style = '') => `<div class="sticky" style="${style}">${html}</div>`

/** 主角光标：红色马克笔画的竖光标，停在"正在讲的东西"旁边 */
export const hero = (x: number, y: number, h = 30) => at(x, y, `<span class="hero" style="height:${h}px"></span>`)

/** 暗场大字（帧上加 dark: true，或放在 lead 里） */
export const darkTitle = (big: string, sub = '') =>
  `<div class="dk"><div class="dk-big">${big}</div>${sub ? `<div class="dk-sub">${sub}</div>` : ''}</div>`

// ───────── 贴纸版元素（只在 <id>.sticker.frames.ts 里用，样式在 scripts/lib/sticker.ts） ─────────
// 参考原片"一部手机里藏着多少种元素"：白边贴纸 + 深炭元素格子 + 一个强调色 + 大数字 + 引线标注。
// 这里不写任何色值：颜色全在色系令牌里（scripts/lib/palettes.ts），换色系只换 data-palette。
// 错误不用颜色：wrong() 把内容压暗、去色、划一道线；✗ 用灰色圆底。强调色只给"正在讲的那个 / 对的那个"。

/** 左上角小标：强调色小方块 + 中文 + 英文副标 */
export const kicker = (zh: string, en = '') => `<div class="s-kick"><i></i><b>${zh}</b>${en ? `<span>${en}</span>` : ''}</div>`

/** 大标题；hl 部分下面画强调色下划线，en 是标题后面的英文小字 */
export const head = (a: string, hl = '', en = '') =>
  `<div class="s-head">${a}${hl ? `<u>${hl}</u>` : ''}${en ? `<span class="s-en">${en}</span>` : ''}</div>`

/** 标题下的一行灰字 */
export const lede = (s: string) => `<div class="s-lede">${s}</div>`

export type TileState = 'on' | 'hi' | 'off' | 'ghost'
/** 元素格子：on 普通、hi 正在讲的、off 没点亮、ghost 虚线空位。top/idx 是格子上下的小字，可以带 <b> 强调 */
export const tile = (ch: string, st: TileState = 'on', s = 48, o: { top?: string; idx?: string; cls?: string } = {}) =>
  `<span class="s-tile s-${st} ${o.cls ?? ''}" style="--s:${s}px">${ch}${o.top ? `<em class="s-top">${o.top}</em>` : ''}${o.idx !== undefined ? `<em class="s-idx">${o.idx}</em>` : ''}</span>`

/** 一排格子；arrows 时格子之间画箭头 */
export function tiles(
  chars: string[],
  o: { s?: number; gap?: number; st?: TileState | ((i: number) => TileState); top?: string[]; idx?: string[]; arrows?: boolean; cls?: string; tcls?: string[] } = {},
) {
  const st = (i: number) => (typeof o.st === 'function' ? o.st(i) : (o.st ?? 'on'))
  const parts = chars.map((ch, i) => tile(ch, st(i), o.s ?? 48, { top: o.top?.[i], idx: o.idx?.[i], cls: o.tcls?.[i] }))
  return `<div class="s-tiles ${o.arrows ? 's-arrows' : ''} ${o.cls ?? ''}" style="--g:${o.gap ?? 8}px">${parts.join(o.arrows ? '<i class="s-arr"></i>' : '')}</div>`
}

/** 白边贴纸。rot 是倾斜角（度），逐帧写死，所以同一张贴纸每帧角度一样 */
export const stk = (html: string, o: { w?: number; h?: number; rot?: number; pad?: number; cls?: string } = {}) =>
  `<div class="s-stk ${o.cls ?? ''}" style="${o.w ? `width:${o.w}px;` : ''}${o.h ? `height:${o.h}px;` : ''}${o.rot ? `--r:${o.rot}deg;` : ''}${o.pad !== undefined ? `padding:${o.pad}px;` : ''}">${html}</div>`

/** 贴纸编辑器（单行输入框）。cursor 是光标左边的字符数，-1 不画；hi 是要标出来的字符下标 */
export function sed(text: string, o: { cursor?: number; s?: number; w?: number; ph?: string; icon?: 'search' | 'send'; rot?: number; hi?: number[]; cls?: string } = {}) {
  const c = o.cursor ?? [...text].length
  const ch = [...text].map((s, i) => (o.hi?.includes(i) ? `<b class="s-mark">${s}</b>` : s))
  const cur = '<i class="s-cur"></i>'
  const body = text ? (c < 0 ? ch.join('') : ch.slice(0, c).join('') + cur + ch.slice(c).join('')) : (o.ph ? `<span class="s-ph">${o.ph}</span>` : '') + (c < 0 ? '' : cur)
  const icon = o.icon === 'search' ? '<i class="s-ico"></i>' : o.icon === 'send' ? '<span class="s-send">发送</span>' : ''
  return `<div class="s-stk s-ed ${o.cls ?? ''}" style="--fs:${o.s ?? 22}px;${o.w ? `width:${o.w}px;` : ''}${o.rot ? `--r:${o.rot}deg;` : ''}"><div class="s-field">${body}${icon}</div></div>`
}

/** 按键贴纸 */
export const key = (k: string, cls = '') => `<div class="s-stk s-key ${cls}">${k}</div>`

/** 画布坐标系里的线条层（640×360），线条颜色按 tone 走令牌 */
export type Tone = 'ink' | 'mute' | 'acc' | 'wrong'
export const lines = (...parts: string[]) => `<svg class="s-svg" viewBox="0 0 640 360">${parts.join('')}</svg>`
export const ln = (x1: number, y1: number, x2: number, y2: number, tone: Tone = 'ink', o: { dash?: boolean; w?: number } = {}) =>
  `<line class="s-${tone}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${o.w ?? 1.2}"${o.dash ? ' stroke-dasharray="4 3"' : ''}/>`
export function arrow(x1: number, y1: number, x2: number, y2: number, tone: Tone = 'ink', o: { dash?: boolean; w?: number } = {}) {
  const a = Math.atan2(y2 - y1, x2 - x1), L = 8
  const p = (d: number) => `${(x2 - L * Math.cos(a + d)).toFixed(1)},${(y2 - L * Math.sin(a + d)).toFixed(1)}`
  return ln(x1, y1, x2, y2, tone, { w: o.w ?? 1.6, dash: o.dash }) + `<polygon class="s-${tone}" points="${x2},${y2} ${p(0.45)} ${p(-0.45)}"/>`
}
export const dot = (x: number, y: number, tone: Tone = 'ink') => `<circle class="s-${tone}" cx="${x}" cy="${y}" r="2.6"/>`
export const path = (d: string, tone: Tone = 'ink', w = 1.2) => `<path class="s-${tone}" d="${d}" fill="none" stroke-width="${w}"/>`

/** 引线标注：从 (x1,y1) 的圆点拉一根细线到 (x2,y2)，标签贴在线尾；end 时标签在线尾左边 */
export function callout(x1: number, y1: number, x2: number, y2: number, label: string, o: { tone?: 'ink' | 'mute' | 'acc'; sub?: string; end?: boolean; cls?: string } = {}) {
  const tone = o.tone ?? 'ink'
  const lab = `<div class="abs s-call ${tone} ${o.end ? 'end' : ''} ${o.cls ?? ''}" style="left:${o.end ? x2 - 4 : x2 + 4}px;top:${y2 - 9}px">${label}${o.sub ? `<small>${o.sub}</small>` : ''}</div>`
  return lines(ln(x1, y1, x2, y2, tone), dot(x1, y1, tone)) + lab
}

/** 大数字（强调色，粗描边）；den 是后面的小字，比如"/ 长度" */
export const bignum = (n: string, den = '', s = 150) =>
  `<div class="s-big"><svg width="${Math.round(s * 0.62 * [...n].length + 16)}" height="${Math.round(s * 1.02)}" overflow="visible"><text x="6" y="${Math.round(s * 0.86)}" style="font-size:${s}px">${n}</text></svg>${den ? `<span class="s-den" style="font-size:${Math.round(s * 0.24)}px">${den}</span>` : ''}</div>`

export type ChipTone = 'acc' | 'soft' | 'tile' | 'ok' | 'wrong'
/** 胶囊标签 */
export const chip = (s: string, tone: ChipTone = 'tile', cls = '') => `<span class="s-chip s-c-${tone} ${cls}">${s}</span>`

/** 圆底勾叉：ok 打勾；no 打叉（灰色，错误不用颜色）；wait 还没判 */
export const chk = (kind: 'ok' | 'no' | 'wait' = 'ok') => `<span class="s-chk s-k-${kind}">${kind === 'ok' ? '✓' : kind === 'no' ? '✗' : ''}</span>`

/** 强调色编号方块 */
export const num = (n: string, cls = '') => `<span class="s-num ${cls}">${n}</span>`

/** 错误项：压暗、去色、划一道线 */
export const wrong = (html: string) => `<span class="s-wrongx">${html}</span>`

/** 强调色圆角框，框住画布上 (x, y, w, h)；dash 时画虚线 */
export const ring = (x: number, y: number, w: number, h: number, o: { dash?: boolean; cls?: string } = {}) =>
  `<div class="abs s-ring ${o.dash ? 'dash' : ''} ${o.cls ?? ''}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`

/** 右上角的三问小卡：hi 高亮哪一问，done 里的问题打勾 */
export const qmini = (o: { hi?: number; done?: number[]; cls?: string } = {}) =>
  at(436, 16, `<div class="s-stk s-q ${o.cls ?? ''}">${['记住什么？', '做哪些事？', '怎么放进内存？']
    .map((s, i) => `<div class="s-qr${i === o.hi ? ' on' : ''}"><b>0${i + 1}</b>${s}${o.done?.includes(i) ? chk('ok') : ''}</div>`)
    .join('')}</div>`)

/** 底部元信息行和进度条（按屏，sc 从 0 开始） */
export const foot = (sc: number, of = 6) =>
  `<div class="s-foot"><span>林小川说学习 · 数据结构 2.1 线性表</span><i>${Array.from({ length: of }, (_, i) => `<b${i <= sc ? ' class="on"' : ''}></b>`).join('')}</i></div>`
