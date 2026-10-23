// 2.9 质感层分镜帧（npm run storyboard -- 2-9）。双栏稿 docs/course/2-9.md。
// 版面照 Harsha 链表引言课：左右两栏，右栏再分上下；第1–4屏只用这一种版面，内容只加不换。
// - 左栏 (40,86) 宽 196：上面是编辑器卡（全程不收），下面 (40,186) 是文字区（问题 → 命名 → 得失）；
// - 右栏 (252,86) 宽 348：上面是内存卡（12 格 100–111，共边格子 = 存储画法），下面 (252,198) 是箭头图卡（链表画法 .c-node）；
// - 两卡的对应靠同一结点在两处同时浅蓝底（hl）加地址数字，不填色；地址格里的数字用灰字（.c-cap），和数据字区分。
// 第5、6屏是填空练习，第7屏一拍过门。帧里不写色值，样式在 scripts/lib/clean.ts。
import { at, card, editor, cells, pause, ckick, ctitle, cchip, cbadge, cslot, cqpill, cblank, cquiz, cqchips, cqbar, cqex } from './kit'
import type { Frame } from '../../../scripts/lib/course'

export const quizSource = { file: 'book/chapters/ch02.md', section: '2.9' }
// 送去合成的念法（字幕仍显示原文）：O(n) 念"大O n"，n−1 念"n减1"
export const say: Record<number, string> = {
  5: '2.7节算过，这是大O n。',
  51: '取第i个，也就是Get，要从第一个结点出发，顺着地址走i步，最坏走n减1步，是大O n。',
  53: '改地址本身只要一步，找到要改的结点却要从头走。插得越靠后，走得越远，最坏也是大O n。',
  55: '另外两个操作，从定义就能看出来。一个链表只有结点和头指针，没有记长度。要知道有几个，只能从head出发数一遍，Length是大O n；顺序表记着长度，是大O 1。',
  56: 'Init只要让head等于NULL，一步就完成，大O 1。',
}

const ok = '<b class="okm">✓</b>'
const cap = (s: string, cls = '') => `<span class="c-cap ${cls}" style="white-space:nowrap">${s}</span>`
/** 地址格里的数字：灰字 */
const ad = (s: string) => `<span class="c-cap">${s}</span>`
const QTXT = '谁在谁后面，存到哪里？'
const qpill = (cls = '') => cqpill(1, QTXT, cls).replace('<b>1</b>', '<b>?</b>')

// ───────── 标题区 ─────────
const head = (title: string, o: { kick?: string; kcls?: string; tcls?: string } = {}) =>
  (o.kick ? at(40, 16, ckick(o.kick, o.kcls)) : '') + at(40, 44, ctitle(title).replace('c-title', `c-title ${o.tcls ?? ''}`))
const KICK = (done = false) => `问题 · ${QTXT}${done ? ` ${ok}` : ''}`

// ───────── 左栏 ─────────
/** 编辑器卡 (40,86) 196×84 */
const ED = (text = 'cat', cursor?: number, cls = '') =>
  at(40, 86, card(at(12, 6, cap('编辑器')) + at(12, 32, editor(text, { cursor, cls: `sm ${cls}` })), '', 'width:196px;height:84px;padding:0'))
/** 文字区 (40,186) 宽 196 */
const TXT = (html: string) => at(40, 186, `<div style="width:196px;display:flex;flex-direction:column;gap:8px;align-items:flex-start">${html}</div>`)
const ON27 = (cls = '') => cbadge('O(n) · 2.7', cls)
const ON27_OFF = (cls = '') => `<span class="dim ${cls}"><s>${ON27()}</s></span>`

// ───────── 右上：内存卡 ─────────
const N = 12
const ADDR = Array.from({ length: N }, (_, i) => String(100 + i))
const CELL = 28
/** 第 i 格中心的横坐标（卡内；共边格子每格占 27px） */
const cx = (i: number) => 6 + 27 * i + 14
/**
 * 格子上方的跳转弧线：从第 i 格到第 j 格。SVG 只包住弧线这一小块（分镜墙的 new 虚线才会贴着弧线）；
 * 跨度越大弧越高，两条弧不挤在一起；箭头头顺着弧线终点的切线方向画。
 */
function arc(i: number, j: number, cls = '') {
  const x1 = cx(i), x2 = cx(j), y = 44
  const top = y - Math.min(28, 8 + Math.abs(x2 - x1) * 0.08) // 二次曲线控制点的高度
  const mx = (x1 + x2) / 2
  const L = Math.min(x1, x2) - 8, T = 16, W = Math.abs(x2 - x1) + 16, H = 30
  const p = (x: number, yy: number) => `${(x - L).toFixed(1)} ${(yy - T).toFixed(1)}`
  // 终点切线方向：控制点 → 终点
  const dx = x2 - mx, dy = y - top, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len
  const wing = (a: number) => {
    const c = Math.cos(a), s = Math.sin(a)
    return [x2 - 6 * (ux * c - uy * s), y - 6 * (ux * s + uy * c)] as const
  }
  const [ax, ay] = wing(0.5), [bx, by] = wing(-0.5)
  const d = `M${p(x1, y)} Q${p(mx, top)} ${p(x2, y)}`
  const hd = `M${p(ax, ay)} L${p(x2, y)} L${p(bx, by)}`
  return at(L, T, `<span class="c-cap ${cls}" style="display:block"><svg width="${W}" height="${H}" style="display:block;overflow:visible"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="${hd}" fill="none" stroke="currentColor" stroke-width="1.3"/></svg></span>`)
}
/** 结点框：第 i、i+1 两格套一个虚线框 */
const box = (i: number, cls = '') => at(6 + 27 * i - 3, 41, `<div class="dash ${cls}" style="width:62px;height:34px"></div>`)
/** head 标签：在 100 号上方，带向下的小箭头 */
const HEAD = (cls = '', slot = false) =>
  slot ? at(4, 14, `<span class="${cls}">${cslot('head = ？')}</span>`)
    : at(4, 12, cap('head = 100', cls)) + at(16, 27, cap('↓', cls))
type MemOpt = { cells: Record<number, string>; cls?: Record<number, string>; head?: string | false; slot?: string; arcs?: string; boxes?: string; extra?: string; name?: string; ncls?: string }
function MEM(o: MemOpt) {
  const items = ADDR.map((_, i) => o.cells[i] ?? '')
  const cls = ADDR.map((_, i) => o.cls?.[i] ?? '')
  return at(252, 86, card(
    at(0, 4, `<div style="width:336px;text-align:right">${cap(o.name ?? '内存', o.ncls)}</div>`) +
      (o.head !== undefined && o.head !== false ? HEAD(o.head) : '') + (o.slot !== undefined ? HEAD(o.slot, true) : '') +
      (o.arcs ?? '') + at(6, 44, cells(items, { mem: true, size: CELL, idx: ADDR, cls })) + (o.boxes ?? '') + (o.extra ?? ''),
    '', 'width:348px;height:104px;padding:0'))
}
// 几种常用的内存状态
const SEQ = { 0: 'c', 1: 'a', 2: 't' }
const SCAT = { 0: 'c', 5: 't', 9: 'a' }
const LINKED = { ...SCAT, 1: ad('109'), 10: ad('105'), 6: ad('0') }
const WITHX = { ...LINKED, 2: 'x', 3: ad('105'), 10: ad('102') }
const BOXES = (cls = '') => box(0, cls) + box(9, cls) + box(5, cls)

// ───────── 右下：箭头图卡 ─────────
type Nd = { v: string; next: string; addr?: string; cls?: string; ncls?: string }
const node = (n: Nd) =>
  `<span class="c-node ${n.cls ?? ''}"><span style="width:26px;height:30px">${n.v}</span><span class="${n.ncls ?? ''}" style="width:32px;height:30px">${n.next}</span>${n.addr ? `<em>${n.addr}</em>` : ''}</span>`
const link = (show: boolean, cls = '') => show ? `<span class="c-link ${cls}" style="width:20px"></span>` : '<span style="display:inline-block;width:24px"></span>'
const C = (o: Partial<Nd> = {}): Nd => ({ v: 'c', next: '109', addr: '100', ...o })
const A = (o: Partial<Nd> = {}): Nd => ({ v: 'a', next: '105', addr: '109', ...o })
const T = (o: Partial<Nd> = {}): Nd => ({ v: 't', next: '0', addr: '105', ...o })
const X = (o: Partial<Nd> = {}): Nd => ({ v: 'x', next: '105', addr: '102', ...o })
function ARR(o: { nodes?: Nd[]; links?: boolean; lcls?: string[]; head?: string | false; extra?: string; cls?: string; name?: string; ncls?: string } = {}) {
  const ns = o.nodes ?? []
  const row = ns.map((n, i) => (i ? link(!!o.links, o.lcls?.[i - 1]) : '') + node(n)).join('')
  return at(252, 198, card(
    at(12, 4, cap(o.name ?? '箭头图', o.ncls)) +
      (o.head !== undefined && o.head !== false ? at(12, 22, cap('head = 100', o.head)) + at(26, 36, cap('↓', o.head)) : '') +
      (ns.length ? at(12, 54, `<div style="display:inline-flex;align-items:center;white-space:nowrap">${row}</div>`) : '') + (o.extra ?? ''),
    o.cls ?? '', 'width:348px;height:150px;padding:0'))
}

// ───────── 第1–4屏的整帧：标题 + 左栏 + 右栏 ─────────
type S = { title?: string; kick?: string; kcls?: string; tcls?: string; ed?: [string, number?, string?]; txt?: string; mem: MemOpt; arr?: Parameters<typeof ARR>[0] }
const F = (s: S) =>
  head(s.title ?? '链式存储与链表', { kick: s.kick, kcls: s.kcls, tcls: s.tcls }) +
  ED(...(s.ed ?? ['cat'])) + (s.txt ? TXT(s.txt) : '') + MEM(s.mem) + (s.arr ? ARR(s.arr) : '')

// 第2屏起标题上方的小标签
const K = KICK()
const KD = KICK(true)
// 第2屏的命名胶囊（依次出现）
const NAMES = ['链式存储', '结点', '链表', '头指针']
const chips = (n: number, fresh = -1) => `<div>${NAMES.slice(0, n).map((s, i) => cchip(s, i === fresh ? 'new' : '')).join(' ')}</div>`
const DEF = (cls = '') => `<div class="c-q ${cls}" style="font-size:14px">链表 = 一串用地址连起来的结点 + 头指针</div>`
// 第3屏的三个结点
const CAT3 = (o: { addr?: boolean; cls?: string[]; ncls?: string[] } = {}) =>
  [C(), A(), T()].map((n, i) => ({ ...n, addr: o.addr === false ? undefined : n.addr, cls: o.cls?.[i], ncls: o.ncls?.[i] }))
// 第4屏左栏"得 / 失"两行
const GAIN1 = 'Insert：不挪'
const GAIN = 'Insert、Delete：不挪'
const LOSS = 'Get：走 i 步 · O(n)'
/** 五行对照表（左栏文字区，宽 196）：操作 | 顺序表 | 链表；顺序表 Insert 那一格用徽章，回扣第1屏的 O(n) */
const TABLE = (cls = '') => {
  const rows: [string, string, string][] = [['Init', 'O(1)', 'O(1)'], ['Length', 'O(1)', 'O(n)'], ['Get', 'O(1)', 'O(n)'], ['Insert、Delete', cbadge('O(n)'), 'O(n)']]
  const td = (x: string) => `<span style="padding:3px 4px;border-top:1px solid var(--line);font-size:12px;white-space:nowrap">${x}</span>`
  return `<div class="${cls}" style="display:grid;grid-template-columns:92px 52px 52px;width:196px">` +
    td(cap('操作')) + td(cap('顺序表')) + td(cap('链表')) +
    rows.map(([a, b, c]) => td(a) + td(b) + td(c)).join('') + '</div>'
}
const ROWS = (o: { g?: string; l?: string; gs?: string; ls?: string; gcls?: string; lcls?: string; badge?: string } = {}) =>
  `<div style="white-space:nowrap">${cap('得 ')}${o.g ? `<span class="${o.gcls ?? ''}">${cbadge(o.g)}</span>` : cslot('？')}</div>` + (o.badge ? `<div>${o.badge}</div>` : '') +
  (o.gs ? `<div>${cap(o.gs, 'new')}</div>` : '') +
  `<div style="white-space:nowrap">${cap('失 ')}${o.l ? `<span class="${o.lcls ?? ''}">${cbadge(o.l)}</span>` : cslot('？')}</div>` +
  (o.ls ? `<div>${cap(o.ls, 'new')}</div>` : '')
const T4 = '链式存储的得失'
const CONC = (cls = '') => `<div class="c-q ${cls}" style="font-size:14px">省掉的是挪动，<br>付出的是走路</div>`

// ───────── 练习（练习卡就是作答界面：暂停时播放器给空位、选项块、按钮条接上作答） ─────────
const ADDR16 = Array.from({ length: 16 }, (_, i) => String(100 + i))
function quiz(o: { n: number; title: string; stem: string; body?: string; lines: [string, number[]][]; opts: string[]; tip?: string; cls?: string; dim?: boolean; extra?: string; y?: number }) {
  const c = `${o.cls ?? ''} ${o.dim ? 'dim' : ''}`
  const y = o.y ?? 148
  return cquiz(at(40, 16, ckick(`练习 ${o.n} · 填空`, o.cls)) + at(40, 44, ctitle(o.title).replace('c-title', `c-title ${c}`)) +
    (o.tip ? at(40, 78, cap(o.tip, 'new')) : '') +
    at(40, 102, `<div class="c-q ${c}" style="font-size:14px">${o.stem}</div>`) + (o.body ?? '') +
    o.lines.map(([s, ws], i) => at(40, y + 36 * i, `<span class="${c}">${s} ${ws.map((w) => cblank('', { w, quiz: true })).join(' ')}</span>`)).join('') +
    at(40, 270, cqchips(o.opts, c)) +
    // 解析位从最后一行空位下面到按钮条上面，答完盖住选项块
    (o.dim ? '' : at(40, y + 36 * o.lines.length - 6, cqex(320 - 6 - (y + 36 * o.lines.length - 6))) + at(40, 320, cqbar('fill'))) + (o.extra ?? ''))
}
// 练习1：题卡里放同一种内存卡（整屏宽，16 格）
const BOOK: Record<number, string> = { 2: 'o', 3: ad('112'), 4: 'k', 5: ad('0'), 8: 'b', 9: ad('102'), 12: 'o', 13: ad('104') }
const MEM16 = at(40, 126, card(
  at(10, 6, cap('head = 108')) +
    at(10, 30, cells(ADDR16.map((_, i) => BOOK[i] ?? ''), { mem: true, size: 34, idx: ADDR16 })),
  '', 'width:560px;height:90px;padding:0'))
const Q1 = (o: { tip?: boolean; cls?: string } = {}) => quiz({
  n: 1, title: '这一行是什么？', stem: '一个链表在内存里是这样的，head 等于 108。', body: MEM16, y: 224,
  lines: [['从 head 出发，依次经过的结点是', [44, 44, 44, 44]]],
  opts: ['108', '102', '112', '104', '103', '109', '113'],
  tip: o.tip ? '记住：谁在谁后面不再靠位置，而是存在每个结点的地址格里' : undefined, cls: o.cls,
})
const Q2 = (o: { cls?: string; dim?: boolean; extra?: string } = {}) => quiz({
  n: 2, title: '走几步，到哪个结点？', stem: 'cat 存成链表：c 在 100 号，a 在 109 号，t 在 105 号，head 等于 100。',
  lines: [['取第 2 个元素 t，从第一个结点出发要走', [44]], ['在第 2 个位置插入 x，要先从头走到', [44]]],
  opts: ['2', 'a', '1', '3', 't', 'c'], ...o,
})

export const frames: Frame[] = [
  // ───────── 第1屏　放弃"相邻"约定：问题屏。左栏编辑器，右栏内存卡；箭头图卡的位置先空着（第3屏才长出来） ─────────
  { beat: 1, html: F({ tcls: 'new', ed: ['cat', undefined, 'new'], mem: { cells: SEQ, cls: { 0: 'new', 1: 'new', 2: 'new' } } }) },
  { beat: 2, html: F({ mem: { cells: SEQ, arcs: arc(0, 1, 'new') + arc(1, 2, 'new') + at(30, 10, cap('下一格', 'new')) } }) },
  { beat: 3, html: F({ ed: ['cat', 0, 'new'], mem: { cells: SEQ, arcs: arc(0, 1) + arc(1, 2) + at(30, 10, cap('下一格')) } }) },
  // t、a、c 依次右挪一格，x 落进 100
  { beat: 4, reveal: 'spread', html: F({ ed: ['xcat', 1, 'new'], mem: { cells: { 0: 'x', 1: 'c', 2: 'a', 3: 't' }, cls: { 3: 'new', 2: 'new', 1: 'new', 0: 'new' } } }) },
  { beat: 5, html: F({ ed: ['xcat', 1], txt: ON27('new'), mem: { cells: { 0: 'x', 1: 'c', 2: 'a', 3: 't' } } }) },
  // 复原；"下一格"变灰加划线
  { beat: 6, html: F({ ed: ['cat', 0, 'new'], txt: ON27(), mem: { cells: SEQ, cls: { 0: 'new', 1: 'new', 2: 'new' }, arcs: arc(0, 1, 'dim new') + arc(1, 2, 'dim new') + at(30, 10, `<span class="dim new">${cap('<s>下一格</s>')}</span>`) } }) },
  // c、a、t 从格子里抬起（画成分开的方块，浮在格子上方）
  { beat: 7, html: F({ ed: ['cat', 0], txt: ON27(), mem: { cells: {}, extra: at(6, 8, `<span class="new">${cells(['c', 'a', 't'], { size: 28 })}</span>`) } }) },
  // 不同时候放进去：c → 100，t → 105，a → 109
  { beat: 8, reveal: 'spread', html: F({ ed: ['cat', 0], txt: ON27(), mem: { cells: SCAT, cls: { 0: 'new', 5: 'new', 9: 'new' } } }) },
  { beat: 9, html: F({ ed: ['cat', 0], txt: ON27(), mem: { cells: SCAT, cls: { 0: 'hl new', 5: 'hl new', 9: 'hl new' } } }) },
  { beat: 10, html: F({ ed: ['cat', 0], txt: ON27(), mem: { cells: SCAT, cls: { 1: 'hl new' }, extra: at(30, 14, cap('c 的下一格：空', 'new')) } }) },
  { beat: 12, html: F({ ed: ['cat', 0], txt: ON27() + `<span class="new">${cslot('c 的下一个是 ？')}</span><span class="new">${cslot('a 的下一个是 ？')}</span>`, mem: { cells: SCAT } }) },
  { beat: 13, html: F({ ed: ['cat', 0], txt: ON27() + qpill('on new'), mem: { cells: SCAT } }) },

  // ───────── 第2屏　什么是链式存储：版面不变，问题胶囊收进标题上方的小标签，文字区腾空 ─────────
  { beat: 14, html: F({ kick: K, kcls: 'new', mem: { cells: { ...SCAT, 1: ad('？'), 10: ad('？'), 6: ad('？') }, cls: { 1: 'new', 10: 'new', 6: 'new' } } }) },
  { beat: 15, reveal: 'spread', html: F({ kick: K, mem: { cells: LINKED, cls: { 1: 'new', 10: 'new', 6: 'new' } } }) },
  { beat: 16, html: F({ kick: K, mem: { cells: LINKED, cls: { 1: 'hl new', 10: 'hl new' }, extra: at(cx(1) - 12, 24, cap('地址', 'new')) + at(cx(10) - 12, 24, cap('地址', 'new')) } }) },
  { beat: 17, html: F({ kick: K, mem: { cells: LINKED, cls: { 1: 'hl' }, arcs: arc(1, 9, 'new') } }) },
  { beat: 18, html: F({ kick: K, mem: { cells: LINKED, cls: { 9: 'hl new' }, arcs: arc(1, 9) } }) },
  // 往左跳：110 → 105
  { beat: 19, html: F({ kick: K, mem: { cells: LINKED, cls: { 10: 'hl', 5: 'hl new' }, arcs: arc(1, 9) + arc(10, 5, 'new') } }) },
  { beat: 20, html: F({ kick: K, mem: { cells: LINKED, cls: { 6: 'hl new' }, arcs: arc(1, 9) + arc(10, 5) } }) },
  { beat: 22, html: F({ kick: K, mem: { cells: LINKED, slot: 'new' } }) },
  { beat: 23, html: F({ kick: K, mem: { cells: LINKED, head: 'new' } }) },
  // 起名字：胶囊依次加在左栏文字区
  { beat: 24, html: F({ kick: K, txt: cap('新的存法 → 起名字', 'new'), mem: { cells: LINKED, head: '' } }) },
  { beat: 25, html: F({ kick: K, txt: cap('新的存法 → 起名字') + chips(1, 0), mem: { cells: LINKED, head: '' } }) },
  { beat: 26, html: F({ kick: K, txt: cap('新的存法 → 起名字') + chips(2, 1), mem: { cells: LINKED, head: '', boxes: BOXES('new') } }) },
  { beat: 27, html: F({ kick: K, txt: cap('新的存法 → 起名字') + chips(3, 2), mem: { cells: LINKED, head: '', boxes: BOXES() } }) },
  { beat: 28, html: F({ kick: K, txt: cap('新的存法 → 起名字') + chips(4, 3), mem: { cells: LINKED, head: 'hl new', boxes: BOXES() } }) },
  { beat: 29, html: F({ kick: K, txt: DEF('new'), mem: { cells: LINKED, head: '', boxes: BOXES() } }) },
  // 元素是单格，结点是两格
  { beat: 30, reveal: 'spread', html: F({ kick: K, txt: DEF(), mem: { cells: LINKED, cls: { 0: 'hl new' }, head: '', boxes: box(0, 'new') + box(9) + box(5) } }) },
  { beat: 31, html: F({ kick: KD, kcls: 'new', txt: DEF(), mem: { cells: LINKED, head: '', boxes: BOXES() } }) },

  // ───────── 第3屏　箭头图：版面不变，右下的箭头图卡长出来 ─────────
  { beat: 32, html: F({ kick: KD, txt: DEF(), mem: { cells: LINKED, cls: { 5: 'hl new', 9: 'hl new' }, head: '', boxes: BOXES() } }) },
  { beat: 33, reveal: 'spread', html: F({ kick: KD, txt: DEF(), mem: { cells: LINKED, cls: { 0: 'hl', 1: 'hl', 9: 'hl', 10: 'hl', 5: 'hl', 6: 'hl' }, head: '', boxes: BOXES() }, arr: { nodes: CAT3({ addr: false, cls: ['new', 'new', 'new'] }), ncls: 'new' } }) },
  { beat: 34, html: F({ kick: KD, txt: DEF(), mem: { cells: LINKED, head: '', boxes: BOXES() }, arr: { nodes: CAT3({ cls: ['new', 'new', 'new'] }) } }) },
  { beat: 35, html: F({ kick: KD, txt: DEF(), mem: { cells: LINKED, head: '', boxes: BOXES() }, arr: { nodes: CAT3(), links: true, lcls: ['new', 'new'], head: 'new' } }) },
  { beat: 36, html: F({ kick: KD, txt: DEF(), mem: { cells: LINKED, head: '', boxes: BOXES(), name: '内存 · 格子图', ncls: 'new' }, arr: { nodes: CAT3(), links: true, head: '', name: '箭头图', ncls: 'new' } }) },
  // t：上面在 a 左边，下面在最后
  { beat: 37, html: F({ kick: KD, txt: DEF(), mem: { cells: LINKED, cls: { 5: 'hl new' }, head: '', boxes: BOXES(), name: '内存 · 格子图' }, arr: { nodes: CAT3({ cls: ['', '', 'hl new'] }), links: true, head: '' } }) },
  { beat: 38, html: F({ kick: KD, txt: DEF(), mem: { cells: LINKED, cls: { 1: 'hl new' }, head: '', boxes: BOXES(), name: '内存 · 格子图' }, arr: { nodes: CAT3({ ncls: ['hl new', '', ''] }), links: true, lcls: ['new'], head: '' } }) },
  { beat: 39, html: F({ kick: KD, txt: DEF(), mem: { cells: LINKED, cls: { 10: 'hl new' }, head: '', boxes: BOXES(), name: '内存 · 格子图' }, arr: { nodes: CAT3({ ncls: ['', 'hl new', ''] }), links: true, lcls: ['', 'new'], head: '' } }) },
  // 以后主要看箭头图；内存卡不变淡，第4屏还要用
  { beat: 41, html: F({ kick: KD, txt: DEF(), mem: { cells: LINKED, head: '', boxes: BOXES(), name: '内存 · 格子图' }, arr: { nodes: CAT3(), links: true, head: '', cls: 'hl new' } }) },

  // ───────── 第4屏　链式存储的得失：版面不变；插入、删除直接在左栏编辑器卡上演，全程用操作名说话 ─────────
  { beat: 42, html: F({ title: T4, kick: '链式存储与链表', tcls: 'new', txt: `<div class="new">${ROWS()}</div>`, mem: { cells: LINKED, head: '', name: '内存 · 格子图' }, arr: { nodes: CAT3(), links: true, head: '' } }) },
  { beat: 43, html: F({ title: T4, kick: '链式存储与链表', ed: ['cat', 2, 'new'], txt: ROWS(), mem: { cells: LINKED, cls: { 2: 'hl new' }, head: '', name: '内存 · 格子图' }, arr: { nodes: CAT3(), links: true, head: '' } }) },
  // x 落进 102，x 的地址格写 105；箭头图里 x 结点先放在 a、t 下方
  { beat: 44, html: F({ title: T4, kick: '链式存储与链表', ed: ['caxt', 3, 'new'], txt: ROWS(), mem: { cells: { ...LINKED, 2: 'x', 3: ad('105') }, cls: { 2: 'new', 3: 'new' }, head: '', name: '内存 · 格子图' }, arr: { nodes: CAT3(), links: true, head: '', extra: at(128, 100, `<span class="new" style="display:inline-flex;align-items:center">${node(X())}${cap('&nbsp;→ t')}</span>`) } }) },
  // 关键一拍：110 格 105→102、a 的地址格 105→102、a 的箭头改指 x，三处同一刻
  { beat: 45, html: F({ title: T4, kick: '链式存储与链表', ed: ['caxt', 3], txt: ROWS(), mem: { cells: WITHX, cls: { 10: 'hl new' }, head: '', name: '内存 · 格子图' }, arr: { nodes: [C(), A({ next: '102', ncls: 'hl new' }), X({ cls: 'new' }), T()], links: true, lcls: ['new', 'new', ''], head: '' } }) },
  { beat: 46, html: F({ title: T4, kick: '链式存储与链表', ed: ['caxt', 3], txt: ROWS({ g: GAIN1, gcls: 'new', badge: ON27_OFF('new') }), mem: { cells: WITHX, cls: { 0: 'new', 9: 'new', 5: 'new' }, head: '', name: '内存 · 格子图' }, arr: { nodes: [C(), A({ next: '102' }), X(), T()], links: true, head: '' } }) },
  // 删 x：第45拍的镜像，110 格 102→105、a 的地址格改回、a 的箭头改回指 t，三处同一刻
  { beat: 48, html: F({ title: T4, kick: '链式存储与链表', ed: ['cat', 2, 'new'], txt: ROWS({ g: GAIN, gcls: 'new', badge: ON27_OFF() }), mem: { cells: LINKED, cls: { 10: 'hl new', 2: 'new', 3: 'new' }, head: '', name: '内存 · 格子图' }, arr: { nodes: CAT3({ ncls: ['', 'hl new', ''] }), links: true, lcls: ['', 'new'], head: '' } }) },
  // 取 t：第 2 个在哪？
  { beat: 49, html: F({ title: T4, kick: '链式存储与链表', ed: ['cat', 2], txt: ROWS({ g: GAIN, badge: ON27_OFF() }), mem: { cells: LINKED, cls: { 5: 'hl new' }, head: '', name: '内存 · 格子图', extra: at(cx(5) - 30, 14, cap('第 2 个在哪？', 'new')) }, arr: { nodes: CAT3({ cls: ['', '', 'hl new'] }), links: true, head: '' } }) },
  // 从 head 出发一跳一跳
  { beat: 50, reveal: 'spread', html: F({ title: T4, kick: '链式存储与链表', ed: ['cat', 2], txt: ROWS({ g: GAIN, badge: ON27_OFF() }), mem: { cells: LINKED, cls: { 0: 'hl new', 9: 'hl new', 5: 'hl new' }, head: '', name: '内存 · 格子图', arcs: arc(1, 9, 'new') + arc(10, 5, 'new') }, arr: { nodes: CAT3({ cls: ['hl new', 'hl new', 'hl new'] }), links: true, head: '' } }) },
  { beat: 51, html: F({ title: T4, kick: '链式存储与链表', ed: ['cat', 2], txt: ROWS({ g: GAIN, l: LOSS, lcls: 'new', badge: ON27_OFF() }), mem: { cells: LINKED, head: '', name: '内存 · 格子图', arcs: arc(1, 9) + arc(10, 5) }, arr: { nodes: CAT3({ cls: ['', '', 'hl'] }), links: true, head: '' } }) },
  // 回到插入：要改 a 的地址格，得先从 head 走到 a
  { beat: 52, html: F({ title: T4, kick: '链式存储与链表', ed: ['caxt', 3, 'new'], txt: ROWS({ g: GAIN, l: LOSS, badge: ON27_OFF() }), mem: { cells: WITHX, cls: { 10: 'hl new' }, head: 'hl new', name: '内存 · 格子图', arcs: arc(1, 9, 'new') }, arr: { nodes: [C({ cls: 'hl new' }), A({ next: '102', cls: 'hl new', ncls: 'hl new' }), X(), T()], links: true, lcls: ['new'], head: 'hl new' } }) },
  { beat: 53, html: F({ title: T4, kick: '链式存储与链表', ed: ['caxt', 3], txt: ROWS({ g: GAIN, l: LOSS, gs: '改地址：一步', ls: '找结点：从头走', badge: ON27_OFF() }), mem: { cells: WITHX, head: '', name: '内存 · 格子图' }, arr: { nodes: [C(), A({ next: '102' }), X(), T()], links: true, head: '' } }) },
  // 结论；两张图回到 cat，给后面的 Length、Init 用
  { beat: 54, html: F({ title: T4, kick: '链式存储与链表', ed: ['cat', 2, 'new'], txt: ON27_OFF() + CONC('new'), mem: { cells: LINKED, cls: { 2: 'new', 3: 'new', 10: 'new' }, head: '', name: '内存 · 格子图' }, arr: { nodes: CAT3(), links: true, head: '' } }) },
  // Length：从 head 数一遍
  { beat: 55, reveal: 'spread', html: F({ title: T4, kick: '链式存储与链表', ed: ['cat', 2], txt: ON27_OFF() + CONC() + cap('Length：数一遍 · O(n)', 'new'), mem: { cells: LINKED, head: '', name: '内存 · 格子图' }, arr: { nodes: CAT3({ cls: ['hl new', 'hl new', 'hl new'] }), links: true, head: 'hl new' } }) },
  // Init：head = NULL（示意空表，下一拍复原）
  { beat: 56, html: F({ title: T4, kick: '链式存储与链表', ed: ['', 0, 'new'], txt: ON27_OFF() + CONC() + cap('Length：数一遍 · O(n)') + cap('Init：head = NULL · O(1)', 'new'), mem: { cells: {}, cls: { 0: 'new', 1: 'new', 5: 'new', 6: 'new', 9: 'new', 10: 'new' }, name: '内存 · 格子图', extra: at(4, 12, cap('head = NULL', 'new')) }, arr: { nodes: CAT3({ cls: ['dim new', 'dim new', 'dim new'] }), links: true, extra: at(12, 22, cap('head = NULL', 'new')) } }) },
  // 五个操作收成一张对照表；第1屏的 O(n) 收进"顺序表 Insert、Delete"那一格
  { beat: 57, html: F({ title: T4, kick: '链式存储与链表', ed: ['cat', 2, 'new'], txt: TABLE('new'), mem: { cells: LINKED, head: 'new', name: '内存 · 格子图' }, arr: { nodes: CAT3({ cls: ['new', 'new', 'new'] }), links: true, head: 'new' } }) },

  // ───────── 第5屏　练习1 ─────────
  { beat: 58, html: Q1({ cls: 'new' }) },
  { beat: 59, html: Q1({ tip: true }) },
  { after: 59, html: Q1({ tip: true }) + pause('等学生作答（点选项块再点空位）；作答后显示解析，不配旁白') },

  // ───────── 第6屏　练习2 ─────────
  { beat: 60, html: Q2({ cls: 'new' }) },
  { after: 60, html: Q2() + pause('等学生作答；作答后显示解析') },
  { beat: 61, html: Q2({ dim: true, extra: at(40, 314, cbadge('改地址：一步 · 找结点：从头走', 'new')) }) },

  // ───────── 第7屏　下一步：一拍过门 ─────────
  { beat: 62, html: at(40, 16, ckick('下一步')) + at(40, 44, ctitle('用C语言实现链表').replace('c-title', 'c-title new')) },
]
