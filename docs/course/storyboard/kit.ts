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
  mem?: boolean // 存储画法（顺序表）：共边连续格子；质感层里不带 mem 的格子画成分开的方块（逻辑画法）
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
  return `<div class="cells ${o.arrows ? 'gap' : ''}${o.mem ? ' mem' : ''}">${parts.join(o.arrows ? '<span class="arr">→</span>' : '')}</div>`
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

// ───────── 工作台版元素（只在 <id>.desk.frames.ts 里用，样式在 scripts/lib/desk.ts） ─────────
// 参考视频"一晚上做出 Clawd 动画"的定风格、分镜软木板、代码卡三段：纸墙 + 陶土桌面，内容都是"纸做的东西"
// （白卡、软木板钉卡、便利贴、标签、窗口卡），微抖的深棕描边 + 实色错位阴影；红色只给手画圈和勾。
// 整帧是一张 640×360 的 SVG；颜色全部用 var(--xxx)（色系 w1，scripts/lib/palettes.ts），不写色值。
// 抖线用种子随机数生成，种子取自位置和尺寸，所以同一个元素逐帧、逐次生成都一样。

const drng = (seed: number) => {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const f1 = (n: number) => n.toFixed(1)
/** 粗估文字宽度：汉字 1em，其余 0.58em（工作台版标签都是短语，够用） */
export const dW = (s: string, z: number) => [...s].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? z : z * 0.58), 0)

type DPaint = { fill?: string; stroke?: string; sw?: number; dash?: boolean; op?: number }
const paint = (o: DPaint) =>
  `style="fill:${o.fill ? `var(--${o.fill})` : 'none'};stroke:${o.stroke === 'none' ? 'none' : `var(--${o.stroke ?? 'ink'})`};stroke-width:${o.sw ?? 1.8}px${o.dash ? ';stroke-dasharray:5 4' : ''}${o.op !== undefined ? `;opacity:${o.op}` : ''}"`

/** 微抖的圆角矩形 */
export function dwob(x: number, y: number, w: number, h: number, r: number, seed: number, o: DPaint & { j?: number } = {}) {
  const R = drng(seed), p: number[][] = []
  const seg = (a: number, b: number, c: number, d: number) => {
    const n = Math.max(2, Math.round(Math.hypot(c - a, d - b) / 10))
    for (let i = 0; i < n; i++) p.push([a + ((c - a) * i) / n, b + ((d - b) * i) / n])
  }
  const arc = (cx: number, cy: number, a0: number) => { for (let i = 0; i < 4; i++) { const a = a0 + (i * Math.PI) / 8; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]) } }
  seg(x + r, y, x + w - r, y); arc(x + w - r, y + r, -Math.PI / 2); seg(x + w, y + r, x + w, y + h - r); arc(x + w - r, y + h - r, 0)
  seg(x + w - r, y + h, x + r, y + h); arc(x + r, y + h - r, Math.PI / 2); seg(x, y + h - r, x, y + r); arc(x + r, y + r, Math.PI)
  const j = o.j ?? 0.9
  return `<path d="M${p.map(([a, b]) => f1(a + (R() - 0.5) * j) + ' ' + f1(b + (R() - 0.5) * j)).join('L')}Z" ${paint(o)} stroke-linejoin="round"/>`
}
/** 微抖的线 */
export function dline(x1: number, y1: number, x2: number, y2: number, seed: number, o: { c?: string; sw?: number } = {}) {
  const R = drng(seed), p: number[][] = []
  for (let i = 0; i <= 6; i++) { const t = i / 6, k = i % 6 ? 1 : 0; p.push([x1 + (x2 - x1) * t + (R() - 0.5) * k, y1 + (y2 - y1) * t + (R() - 0.5) * k]) }
  return `<path d="M${p.map((q) => f1(q[0]) + ' ' + f1(q[1])).join('L')}" ${paint({ stroke: o.c ?? 'ink', sw: o.sw })} stroke-linecap="round"/>`
}
/** 弯箭头：从 (x1,y1) 经控制点 (cx,cy) 到 (x2,y2) */
export function dcurve(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, c = 'ink', sw = 1.8) {
  const a = Math.atan2(y2 - cy, x2 - cx), L = 8, st = paint({ stroke: c, sw })
  return `<path d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}" ${st} stroke-linecap="round"/><path d="M${f1(x2 - L * Math.cos(a + 0.5))} ${f1(y2 - L * Math.sin(a + 0.5))} L${x2} ${y2} L${f1(x2 - L * Math.cos(a - 0.5))} ${f1(y2 - L * Math.sin(a - 0.5))}" ${st} stroke-linecap="round" stroke-linejoin="round"/>`
}
/** 红笔手画圈：一笔绕一圈多一点 */
export function dring(cx: number, cy: number, rx: number, ry: number, seed: number, cls = '') {
  const R = drng(seed), N = 40, a0 = -2.4 + R() * 0.4, p: number[][] = []
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), a = a0 + (Math.PI * 2 + 0.4) * t, k = 1 + 0.04 * Math.sin(a * 3 + R()) + (t > 0.9 ? 0.08 * (t - 0.9) * 10 : 0)
    p.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k])
  }
  return `<path class="${cls}" d="M${p.map((q) => f1(q[0]) + ' ' + f1(q[1])).join('L')}" ${paint({ stroke: 'acc', sw: 2.4 })} stroke-linecap="round"/>`
}
type DFont = 'h' | 's' | 'm' // h 手写（漫黑）、s 黑体、m 等宽
/** 文字。c 是色系令牌名 */
export const dtext = (x: number, y: number, s: string, o: { z?: number; w?: number; c?: string; a?: 'start' | 'middle' | 'end'; f?: DFont } = {}) =>
  `<text class="d${o.f ?? 'h'}" x="${x}" y="${y}" text-anchor="${o.a ?? 'start'}" style="font-size:${o.z ?? 14}px;font-weight:${o.w ?? 400};fill:var(--${o.c ?? 'ink'})">${s}</text>`
const dtape = (cx: number, y: number, rot = -3) => `<rect x="${cx - 22}" y="${y - 7}" width="44" height="14" transform="rotate(${rot} ${cx} ${y})" ${paint({ fill: 'paper', stroke: 'none', op: 0.6 })}/>`
const dpin = (x: number, y: number, i: number) =>
  `<circle cx="${x}" cy="${y}" r="4.5" ${paint({ fill: `pin-${(i % 4) + 1}`, sw: 1 })}/><circle cx="${f1(x - 1.4)}" cy="${f1(y - 1.4)}" r="1.3" ${paint({ fill: 'paper', stroke: 'none', op: 0.7 })}/>`

type DCardOpt = { rot?: number; fill?: string; tape?: boolean; pin?: number; r?: number; seed?: number; cls?: string }
/** 纸卡片：实色错位阴影 + 微抖描边，可以斜一点、贴胶带、钉图钉 */
export function dcard(x: number, y: number, w: number, h: number, inner = '', o: DCardOpt = {}) {
  const r = o.r ?? 6, seed = o.seed ?? Math.round(x * 7 + y * 3 + w)
  return `<g class="${o.cls ?? ''}" transform="rotate(${o.rot ?? 0} ${x + w / 2} ${y + h / 2})"><rect x="${x + 3}" y="${y + 4}" width="${w}" height="${h}" rx="${r}" ${paint({ fill: 'shadow', stroke: 'none' })}/>${dwob(x, y, w, h, r, seed, { fill: o.fill ?? 'paper' })}${inner}${o.tape ? dtape(x + w / 2, y) : ''}${o.pin !== undefined ? dpin(x + w / 2, y + 8, o.pin) : ''}</g>`
}
/** 编号圆点（蓝）；red 时用红色；多位数自动变成胶囊 */
export function dbadge(x: number, y: number, n: string, red = false) {
  const w = [...n].length > 1 ? dW(n, 12) + 12 : 18
  return `<rect x="${f1(x - w / 2)}" y="${y - 9}" width="${f1(w)}" height="18" rx="9" ${paint({ fill: red ? 'acc' : 'badge', sw: 1 })}/>` + dtext(x, y + 4, n, { z: 12, a: 'middle', c: 'paper', f: 'm', w: 700 })
}
/** 软木板上的编号卡片 */
export const dpinned = (x: number, y: number, w: number, h: number, txt: string, n: string, i: number, o: { sub?: string; z?: number; rot?: number; cls?: string } = {}) =>
  dcard(x, y, w, h, dbadge(x + 14, y + 16, n) + dtext(x + w / 2, y + h / 2 + (o.sub ? 0 : 8), txt, { z: o.z ?? 15, a: 'middle' }) + (o.sub ? dtext(x + w / 2, y + h / 2 + 20, o.sub, { z: 12, a: 'middle', c: 'mute', f: 's' }) : ''), { rot: o.rot, pin: i, cls: o.cls })
/** 软木板 */
export const dcork = (x: number, y: number, w: number, h: number, title: string, seed: number) =>
  `<rect x="${x + 4}" y="${y + 5}" width="${w}" height="${h}" rx="6" ${paint({ fill: 'shadow', stroke: 'none' })}/>` +
  dwob(x, y, w, h, 6, seed, { fill: 'cork-frame', sw: 2 }) + dwob(x + 10, y + 10, w - 20, h - 20, 3, seed + 1, { fill: 'cork', sw: 1.4 }) + (title ? dtext(x + 26, y + 40, title, { z: 18 }) : '')

export type DCell = 'on' | 'hi' | 'off' | 'ghost'
/** 纸卡格子：on 白、hi 浅红底（正在讲的）、off 空格、ghost 虚线空位 */
export function dcell(x: number, y: number, ch: string, st: DCell = 'on', s = 56, seed?: number) {
  const fill = { on: 'paper', hi: 'acc-soft', off: 'off', ghost: '' }[st]
  return (st === 'ghost' ? '' : `<rect x="${x + 2}" y="${y + 3}" width="${s}" height="${s}" rx="7" ${paint({ fill: 'shadow', stroke: 'none' })}/>`) +
    dwob(x, y, s, s, 7, seed ?? Math.round(x + y), { fill: fill || undefined, dash: st === 'ghost', stroke: st === 'ghost' ? 'mute' : 'ink' }) +
    (ch ? dtext(x + s / 2, y + s * 0.66, ch, { f: 'm', z: s * 0.46, a: 'middle', c: st === 'ghost' ? 'mute' : 'ink', w: 700 }) : '')
}
/** 一排格子；idx 是下方编号，red(i) 为真时编号用红色；arrows 时格子之间画箭头 */
export function dcells(x: number, y: number, chs: string[], o: { s?: number; g?: number; st?: (i: number) => DCell; idx?: string[]; red?: (i: number) => boolean; arrows?: boolean; seed?: number } = {}) {
  const s = o.s ?? 56, g = o.g ?? 14
  return chs.map((ch, i) => {
    const xx = x + i * (s + g)
    let out = dcell(xx, y, ch, o.st?.(i) ?? 'on', s, o.seed !== undefined ? o.seed + i : undefined)
    if (o.idx && o.idx[i] !== '') out += dbadge(xx + s / 2, y + s + 16, o.idx[i], o.red?.(i) ?? false)
    if (o.arrows && i < chs.length - 1)
      out += dline(xx + s + 3, y + s / 2, xx + s + g - 3, y + s / 2, i + 40) + `<path d="M${xx + s + g - 9} ${y + s / 2 - 4} L${xx + s + g - 3} ${y + s / 2} L${xx + s + g - 9} ${y + s / 2 + 4}" ${paint({ stroke: 'ink' })} stroke-linecap="round"/>`
    return out
  }).join('')
}
/** 黄色便利贴，上沿贴胶带 */
export const dsticky = (x: number, y: number, w: number, h: number, lines: string[], o: { rot?: number; z?: number; cls?: string } = {}) =>
  dcard(x, y, w, h, lines.map((s, i) => dtext(x + 14, y + 30 + i * ((o.z ?? 14) + 8), s, { z: o.z ?? 14 })).join(''), { fill: 'sticky', rot: o.rot ?? 2, tape: true, r: 2, cls: o.cls })
/** 鲑鱼粉小标签 */
export const dtag = (x: number, y: number, s: string, o: { rot?: number; z?: number; cls?: string } = {}) => {
  const z = o.z ?? 14
  return dcard(x, y, dW(s, z) + 24, z + 18, dtext(x + 12, y + z + 5, s, { z }), { fill: 'tag', rot: o.rot ?? -2, r: 3, cls: o.cls })
}
/** 手画复选框：ok 红勾，no 灰叉（错误不用颜色），'' 空框 */
export function dcheck(x: number, y: number, k: 'ok' | 'no' | '' = 'ok') {
  const box = dwob(x, y, 18, 18, 3, Math.round(x * 3 + y), { fill: 'paper', sw: 1.6 })
  if (k === 'ok') return box + `<path d="M${x + 3} ${y + 9} l5 6 l11 -14" ${paint({ stroke: 'acc', sw: 2.6 })} stroke-linecap="round" stroke-linejoin="round"/>`
  if (k === 'no') return box + `<path d="M${x + 4} ${y + 4} l10 10 M${x + 14} ${y + 4} l-10 10" ${paint({ stroke: 'wrong', sw: 2.4 })} stroke-linecap="round"/>`
  return box
}
/** 错误项的灰色划线 */
export const dstrike = (x: number, y: number, w: number) => dline(x - 4, y, x + w + 4, y, Math.round(x + y), { c: 'wrong', sw: 2.2 })
/** 窗口卡：三色点标题栏 */
export const dwin = (x: number, y: number, w: number, h: number, inner: string, title = '', o: { rot?: number; cls?: string } = {}) =>
  dcard(x, y, w, h,
    `<line x1="${x}" y1="${y + 26}" x2="${x + w}" y2="${y + 26}" ${paint({ stroke: 'ink', sw: 1.4 })}/>` +
    [1, 2, 3].map((k, i) => `<circle cx="${x + 14 + i * 13}" cy="${y + 13}" r="4" ${paint({ fill: `win-${k}`, sw: 0.8 })}/>`).join('') +
    (title ? dtext(x + 58, y + 18, title, { z: 12, c: 'mute', f: 's' }) : '') + inner, { rot: o.rot, cls: o.cls })
/** 输入框（编辑器的一行）。cur 是光标左边的字符数，-1 不画 */
export function dfield(x: number, y: number, w: number, txt: string, cur: number, z = 26) {
  const cx = x + 13 + [...txt].slice(0, Math.max(cur, 0)).reduce((a, c) => a + (c.charCodeAt(0) > 255 ? z : z * 0.5), 0)
  return `<rect x="${x}" y="${y}" width="${w}" height="${f1(z * 1.7)}" rx="6" ${paint({ fill: 'field', sw: 1.2 })}/>` + dtext(x + 14, y + z * 1.18, txt, { f: 'm', z }) +
    (cur >= 0 ? `<rect x="${f1(cx)}" y="${f1(y + z * 0.3)}" width="2.6" height="${f1(z * 1.1)}" ${paint({ fill: 'acc', stroke: 'none' })}/>` : '')
}
/** 横线本子纸（练习卡、小结笔记本用） */
export const druled = (x: number, y: number, w: number, rows: number, gap = 24) =>
  Array.from({ length: rows }, (_, i) => `<line x1="${x}" y1="${y + i * gap}" x2="${x + w}" y2="${y + i * gap}" ${paint({ stroke: 'note-line', sw: 1 })}/>`).join('')

/** 左上角黄胶带步骤标签 */
function dstep(s: string, seed: number) {
  const w = dW(s, 14) + 26
  return `<g transform="rotate(-2 ${20 + w / 2} 26)"><rect x="22" y="15" width="${w}" height="26" ${paint({ fill: 'shadow', stroke: 'none' })}/>${dwob(18, 12, w, 26, 2, seed + 90, { fill: 'tape', sw: 1.6 })}${dtext(31, 30, s, { z: 14 })}${dtape(18 + w / 2, 12, 4)}</g>`
}
/** 桌面条 + 边上的小道具（盆栽、笔筒、马克杯），每帧一样 */
function ddesk() {
  const plant = `<path d="M24 300 l3 -24 M30 300 l6 -30 M34 300 l12 -20" ${paint({ stroke: 'plant', sw: 3 })} stroke-linecap="round"/>` + dwob(18, 286, 30, 24, 3, 18, { fill: 'pot' })
  const pencils = ([[558, 'pin-3', -2], [564, 'pin-2', 0], [570, 'pin-3', 2]] as [number, string, number][])
    .map(([x, c, d]) => `<line x1="${x}" y1="262" x2="${x + d}" y2="242" ${paint({ stroke: c, sw: 3 })} stroke-linecap="round"/>`).join('')
  const cup = dwob(552, 262, 26, 40, 3, 552, { fill: 'cup' }) + pencils + dwob(592, 276, 24, 26, 4, 553, { fill: 'paper' }) + `<path d="M616 283 q8 0 8 7 q0 6 -8 6" ${paint({ stroke: 'ink', sw: 1.6 })}/>`
  return `<rect x="0" y="300" width="640" height="60" ${paint({ fill: 'desk', stroke: 'none' })}/>` + dline(0, 300, 640, 300, 7, { sw: 2 }) +
    dline(60, 318, 140, 318, 8, { c: 'desk-line', sw: 2 }) + dline(420, 334, 500, 334, 9, { c: 'desk-line', sw: 2 }) + plant + cup
}
/** 一整帧：纸墙 + 桌面 + 内容 + 步骤标签。字幕不画在帧里（分镜墙和播放器各自叠字幕层） */
export const dframe = (step: string, body: string, seed = 1) =>
  `<svg class="dk" viewBox="0 0 640 360" width="640" height="360"><rect width="640" height="360" ${paint({ fill: 'bg', stroke: 'none' })}/>${ddesk()}${body}${dstep(step, seed)}</svg>`

// ───────── 质感层重排版元素（只在 <id>.clean.frames.ts 里用，样式在 scripts/lib/clean.ts） ─────────
// Gauth 式：发丝框、胶囊、类别色标签、虚线占位。帧里不写色值。

/** 标题上方的小标签（"问题 1 · …""练习 1 · 多选"） */
export const ckick = (s: string, cls = '') => `<span class="c-kick ${cls}">${s}</span>`
/** 宋体屏标题（对比页的开关可以切成黑体） */
export const ctitle = (s: string) => `<div class="c-title">${s}</div>`
/** 胶囊：一袋没有先后的东西里的一个；mono 用于字符元素，off 是错的（变灰加划线） */
export const cchip = (s: string, cls = '') => `<span class="c-chip ${cls}">${s}</span>`
/** 类别色标签：c1 蓝、c2 绿 */
export const clabel = (s: string, c: 'c1' | 'c2' = 'c1') => `<span class="c-label ${c}">${s}</span>`
/** 小徽章（"长度 3"） */
export const cbadge = (s: string, cls = '') => `<span class="c-badge ${cls}">${s}</span>`
/** 虚线占位：讲到之前先留好的空位 */
export const cslot = (s: string, cls = '') => `<span class="c-slot ${cls}">${s}</span>`
/** 定义表：rows 是 [行名, 内容]；open 是展开那一行的下标，展开行内容写在 body 里 */
export function ctable(rows: [string, string][], o: { open?: number; body?: string; w?: number; cls?: Record<number, string> } = {}) {
  const r = rows.map(([name, sum], i) => {
    const c = o.cls?.[i] ?? ''
    if (i === o.open) return `<div class="c-row open ${c}"><div class="rn">${name}</div>${o.body ?? ''}</div>`
    return `<div class="c-row ${c}"><span class="rn">${name}</span>${sum ? `<span class="rs">${sum}</span>` : ''}</div>`
  })
  return `<div class="c-tbl" style="width:${o.w ?? 560}px">${r.join('')}</div>`
}
/** 练习选项行："字母 | 内容"。data-opt 是第几个选项（A 是 0），播放器暂停时按它把选项接上作答 */
export const copt = (letter: string, s: string, cls = '') =>
  `<div class="c-opt ${cls}" data-opt="${letter.charCodeAt(0) - 65}"><b>${letter}</b>${s}</div>`
/**
 * 练习卡外层：帧里画的练习卡就是作答界面。播放器暂停时在这张卡里找选项（data-opt）、空位（data-blank）、
 * 选项块（data-chip）、按钮条（data-qbar）和解析位（data-ex），接上作答，不另盖一层
 */
export const cquiz = (html: string) => `<div data-quiz style="position:absolute;left:0;top:0;width:640px;height:360px">${html}</div>`
/** 填空练习的选项块：顺序就是画面上的顺序，文字要和书稿的选项一一对上（生成播放器时核对） */
export const cqchips = (opts: string[], cls = '') => `<div class="${cls}" data-chips>${opts.map((s) => `<span class="c-chip" data-chip>${s}</span>`).join(' ')}</div>`
/** 练习卡的按钮条：和作答时一样。选择题：检查、看答案、继续；填空题多两个平时藏着的：再试一次、重做 */
export const cqbar = (kind: 'choice' | 'fill') =>
  `<div class="c-qbar" data-qbar><span class="fb" role="status"></span><button type="button" class="ck" disabled>检查</button>` +
  (kind === 'fill'
    ? '<button type="button" class="retry" hidden>再试一次</button><button type="button" class="ans" hidden>看答案</button><button type="button" class="redo" hidden>重做</button>'
    : '<button type="button" class="ans">看答案</button>') +
  '<button type="button" class="go">继续 ▶</button></div>'
/** 解析位：作答后才有字，盖在它下面的东西上（填空题一般放在选项块那一行：答完选项块就用不上了）；h 是高度，字多了在框里滚动 */
export const cqex = (h: number) => `<div class="c-qex" data-ex style="height:${h}px"></div>`
/**
 * 场景图"屏幕拼贴"（封面屏左边）：上面一条浏览器搜索栏，下面左边聊天、右边文件，各有一个单行输入框。
 * 直接按 280×160 排版，不缩放，字号都是 12px 真字号。reveal 时三个输入框带 new，播放器逐个点亮。
 */
export function cscreen(o: { reveal?: boolean } = {}) {
  const n = o.reveal ? ' new' : ''
  const cur = '<span class="cur">|</span>'
  return `<div class="c-scr">
<div class="bar"><i></i><i></i><i></i></div>
<div class="ui${n}" style="left:12px;top:22px"><div class="in" style="width:180px">🔍 搜索${cur}</div></div>
<div class="ui pane" style="left:12px;top:52px;width:124px;height:100px">
  <div class="ui hd" style="left:8px;top:3px">聊天</div>
  <div class="ui bub" style="left:8px;top:24px">几点见？</div><div class="ui bub me" style="left:70px;top:48px">八点</div>
  <div class="ui${n}" style="left:6px;top:72px"><div class="in" style="width:110px">说点什么…${cur}</div></div>
</div>
<div class="ui pane" style="left:144px;top:52px;width:124px;height:100px">
  <div class="ui hd" style="left:8px;top:3px">文件</div>
  <div class="ui doc" style="left:48px;top:22px"></div>
  <div class="ui${n}" style="left:4px;top:72px"><div class="in sq" style="width:116px">新建文本文档${cur}.txt</div></div>
</div>
</div>`
}
/** 封面标题区（只用在封面屏）：居中的小字、宋体课程标题，sub 是"一个想法"副标题 */
export const ccover = (kick: string, title: string, sub = '', subCls = '') =>
  `<div class="c-cover"><span class="c-kick">${kick}</span><div class="c-title">${title}</div>${sub ? `<div class="c-sub ${subCls}">${sub}</div>` : ''}</div>`
/** 历史条：一排小编辑器，每个是 [文字, 光标位置] */
export const chist = (states: [string, number][], cls = '') =>
  `<div class="c-hist">${states.map(([s, c]) => editor(s, { cursor: c, cls: `sm ${cls}` })).join('')}</div>`
/** 挂在场景上的问题胶囊：编号 + 问题 */
export const cqpill = (n: number, s: string, cls = '') => `<span class="c-qp ${cls}"><b>${n}</b>${s}</span>`
/**
 * 空位（例题和填空练习同型，照 Gauth）：灰底虚线框，样式和播放器里学生作答的空位一样。
 * s 是填进去的内容（画成选项块），不给就一直空着。beat 是第几拍填上：播放器到这一拍开头按 0.25 秒淡入，
 * 之前是空的；分镜墙上画成填好的样子，在这一拍所在的帧里带 new 描边。不给 beat 就一开始就是填好的。w 是空位的最小宽度
 */
export const cblank = (s = '', o: { beat?: number; w?: number; cls?: string; quiz?: boolean } = {}) =>
  `<span class="c-blank ${o.cls ?? ''}"${o.quiz ? ' data-blank' : ''}${o.w ? ` style="min-width:${o.w}px"` : ''}>${
    s ? `<span class="c-fill"${o.beat ? ` data-beat="${o.beat}"` : ''}>${s}</span>` : ''
  }</span>`
/**
 * 例题的空位表：一行一步，左边写动作，右边几个空位。rows 每行是 [动作, 第1个空的答案, 第2个空的答案…]。
 * fill 写"这一拍填第几行第几个空"，行和空都从 1 数（和双栏稿"第1行两个空位"的说法一样）：
 *   { 34: [[1, 1], [1, 2]], 35: [[2, 1], [2, 2]] }，整行一起填可以简写成行号：{ 34: 1, 35: 2 }。
 * 没写到的空一直空着。同一屏的各帧传同一个 fill 就行：已经过去的拍画成填好的，没到的拍空着，到了才淡入。
 * w 是每一列空位的最小宽度
 */
export function cblanks(rows: string[][], fill: Record<number, number | [number, number][]> = {}, o: { w?: number[]; cls?: string } = {}) {
  const at = new Map<string, number>()
  for (const [beat, v] of Object.entries(fill)) {
    const cells: [number, number][] = typeof v === 'number' ? rows[v - 1].slice(1).map((_, k) => [v, k + 1]) : v
    for (const [r, k] of cells) {
      if (!rows[r - 1]?.[k]) throw new Error(`cblanks：第${beat}拍要填第${r}行第${k}个空，但没有这个空`)
      at.set(`${r},${k}`, Number(beat))
    }
  }
  const html = rows.map(([act, ...ans], r) =>
    `<span class="sa">${act}</span>` +
    ans.map((a, k) => { const b = at.get(`${r + 1},${k + 1}`); return cblank(b ? a : '', { beat: b, w: o.w?.[k] }) }).join(''),
  )
  return `<div class="c-steps ${o.cls ?? ''}" style="grid-template-columns:auto${' auto'.repeat(Math.max(...rows.map((r) => r.length - 1)))}">${html.join('')}</div>`
}
/**
 * 字符带（3.7 起）：一个字符一格，共边排开；输入带、输出带都用它。chars 是每格的字。
 * - head：读头在第几格下面（-1 是还没开始，等于格数是"读完"）；不给就没有读头
 * - rd：前几格已经读过（变淡）；cls：每格另加的类（hl、off、new、slot 虚线空位）
 * - under：[i, j] 第 i–j 格下面画一条下划线；box：[i, j, 标签] 第 i–j 格套虚线框，标签写在框上方
 * - w、h：格子宽高（默认 26×30）
 * - k：给元素起名（播放器的移动和聚焦用）：第 i 格 data-k="k-i"，读头 "k-head"，下划线 "k-u"，虚线框 "k-box"；
 *   names：第 i 格单独起的名字（覆盖 "k-i"，比如运算符按字起名，出栈时能从栈里滑到输出带）；
 *   src：第 i 格是新出现的、要从哪个元素的位置滑过来（{ i: 那个元素的 data-k }）
 */
export const dk = (k: string | undefined, name: string | number, src?: string, full?: string) =>
  (full !== undefined ? ` data-k="${full}"` : k === undefined ? '' : ` data-k="${k}-${name}"`) + (src ? ` data-src="${src}"` : '')
export function ctape(chars: string[], o: { head?: number; rd?: number; cls?: string[]; under?: [number, number, string?]; box?: [number, number, string, string?]; w?: number; h?: number; tcls?: string; k?: string; names?: (string | undefined)[]; src?: Record<number, string> } = {}) {
  const w = o.w ?? 26, h = o.h ?? 30, pitch = w - 1
  const cells = chars.map((c, i) => `<span class="tc ${i < (o.rd ?? 0) ? 'rd' : ''} ${o.cls?.[i] ?? ''}"${dk(o.k, i, o.src?.[i], o.names?.[i])} style="width:${w}px;height:${h}px">${c}</span>`).join('')
  const x = (i: number) => i * pitch
  const under = o.under ? `<i class="tu ${o.under[2] ?? ''}"${dk(o.k, 'u')} style="left:${x(o.under[0]) + 3}px;width:${x(o.under[1] + 1) - x(o.under[0]) - 5}px;top:${h + 1}px"></i>` : ''
  const box = o.box ? `<i class="tb ${o.box[3] ?? ''}"${dk(o.k, 'box')} style="left:${x(o.box[0]) - 3}px;width:${x(o.box[1] + 1) - x(o.box[0]) + 7}px;height:${h + 6}px"><em>${o.box[2]}</em></i>` : ''
  const head = o.head === undefined ? '' : o.head >= chars.length
    ? `<i class="th end"${dk(o.k, 'end')} style="left:${x(chars.length) + 6}px;top:${h / 2 - 9}px">读完</i>`
    : `<i class="th"${dk(o.k, 'head')} style="left:${o.head < 0 ? -8 : x(o.head) + w / 2}px;top:${h + 6}px"></i>`
  return `<div class="c-tape ${o.tcls ?? ''}">${cells}${under}${box}${head}</div>`
}
/**
 * 竖栈（3.7 起）：items 从栈底到栈顶，栈顶在上，和书稿 StackFigure 同一个朝向。
 * - slots：槽位数（默认 3），决定栈的高度；dashed：还没命名时画虚线（"放着"）；label：栈下面的名字
 * - wall：第几个元素是墙（"("，画成一道粗横线，墙下面的元素变淡）；ring：第几个元素套框（正在比的栈顶）
 * - cls：每个元素另加的类；notes：每个元素右边的小注；top：栈顶标记
 * - k：给元素起名（播放器用）：第 i 个元素 data-k="k-i"，它的小注 "k-ni"，栈顶标记 "k-top"；names、src：同 ctape
 */
export function cstack(items: string[], o: { slots?: number; dashed?: boolean; label?: string; lcls?: string; wall?: number; ring?: number; cls?: string[]; notes?: (string | undefined)[]; top?: boolean; scls?: string; k?: string; names?: (string | undefined)[]; src?: Record<number, string> } = {}) {
  const n = o.slots ?? 3, H = n * 30 + 4
  const y = (k: number) => H - 30 - k * 30
  const els = items.map((s, k) => {
    const below = o.wall !== undefined && k < o.wall ? 'below' : ''
    const kind = k === o.wall ? 'wall' : ''
    return `<span class="si ${kind} ${below} ${k === o.ring ? 'ring' : ''} ${o.cls?.[k] ?? ''}"${dk(o.k, k, o.src?.[k], o.names?.[k])} style="top:${y(k)}px">${kind ? '<em>(</em>' : s}</span>` +
      (o.notes?.[k] ? `<span class="sn"${dk(o.k, 'n' + k)} style="top:${y(k)}px">${o.notes[k]}</span>` : '')
  }).join('')
  const top = o.top && items.length ? `<span class="stp"${dk(o.k, 'top')} style="top:${y(items.length - 1)}px">top</span>` : ''
  return `<div class="c-stack ${o.dashed ? 'dashed' : ''} ${o.scls ?? ''}" style="height:${H}px">${els}${top}${o.label ? `<span class="sl ${o.lcls ?? ''}">${o.label}</span>` : ''}</div>`
}
