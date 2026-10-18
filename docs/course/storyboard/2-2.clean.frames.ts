// 2.2 质感层分镜帧（npm run storyboard -- 2-2；播放器 course:player -- 2-2）。双栏稿 docs/course/2-2.md。
// 结构照 Gauth 集合课第二节（交集/并集）：开头直接讲工具，编辑器只当演示；例题和练习同型（空位）。
// - 第1屏：左右对照。左边五行操作（签名 + 结果行），右边固定演示卡：编辑器、分开的方块（位置号在上方）、表和长度；
// - 第2屏：例题。版面 A 是题目卡 + 六行空位（cblanks）+ 窄演示卡；版面 B 讲抽象数据类型：等式卡、打勾清单、编辑器→操作名连线；
// - 第3、4屏：填空练习；第5屏：一拍过门（照 Gauth，练习完直接进下一小节，不做小结）。
// 开场照 Aho：先说给线性表定一组操作（关系 + 操作 = 抽象数据类型），常用操作很多、这里取最基本的五个，再逐个演示。
// 线性表用逻辑画法（分开的方块），不画内存、不画搬移；错误变灰加划线。帧里不写色值，样式在 scripts/lib/clean.ts。
// 2-2.frames.ts 原样转出本文件（播放器要求原版帧位一致）。
import { at, cells, editor, card, pause, Q, ckick, ctitle, cchip, cbadge, cblank, cblanks, cqpill } from './kit'
import type { Frame } from '../../../scripts/lib/course'

export const quizSource = { file: 'book/chapters/ch02.md', section: '2.2' }
export const say: Record<number, string> = {}

const ok = '<b class="okm">✓</b>'
const cap = (s: string, cls = '') => `<span class="c-cap ${cls}" style="white-space:nowrap">${s}</span>`
const tuple = (s: string, cls = '') => `<span class="tuple c-tuple ${cls}">${s}</span>`
/** 位置号：0 1 2 … */
const nums = (n: number) => Array.from({ length: n }, (_, i) => String(i))

// ───────── 第1屏：标题区 + 五行操作 + 演示卡 ─────────
const KICK = (done = false, cls = '') => ckick(`问题 2 · ${Q[1]}${done ? ` ${ok}` : ''}`, cls)
const head1 = (o: { done?: boolean; kcls?: string; cls?: string } = {}) => at(40, 16, KICK(o.done, o.kcls)) + at(40, 44, ctitle('线性表的基本操作').replace('c-title', `c-title ${o.cls ?? ''}`))

const OPS: [string, string, string][] = [
  ['Init', 'Init(L)', '建立一个空表'],
  ['Length', 'Length(L)', '返回长度 n'],
  ['Get', 'Get(L, i)', '返回第 i 个元素'],
  ['Insert', 'Insert(L, i, x)', '在第 i 个插入 x'],
  ['Delete', 'Delete(L, i)', '删除第 i 个元素'],
]
const RANGE = ['', '', '0≤i≤n−1', '0≤i≤n', '0≤i≤n−1']
/**
 * 左栏五行 (40,86)。open 是正在讲的行（5 = 都讲完、没有高亮）；讲到和讲过的行显示签名和结果行。
 * range 是已经出了 i 范围徽章的行，fresh 是这一帧刚出现的徽章，cls 给某一行加类（new 等）。
 */
function ops(o: { open: number; range?: number[]; fresh?: number; cls?: Record<number, string> }) {
  const rows = OPS.map(([short, sig, mean], i) => {
    const c = [o.cls?.[i] ?? '', i === o.open ? 'on' : ''].join(' ')
    if (i > o.open) return `<div class="c-li ${c}"><span class="rn">${short}</span></div>`
    const r = o.range?.includes(i) ? ` · <span class="${o.fresh === i ? 'new' : ''}">${RANGE[i]}</span>` : ''
    return `<div class="c-li ${c}"><span class="rn">${sig}</span><span class="rs">${mean}${r}</span></div>`
  })
  return at(40, 86, `<div class="c-list">${rows.join('')}</div>`)
}
/**
 * 右栏演示卡 (252,86) 348×244，内容用卡内坐标：
 * 编辑器 (0,22)；方块 (0,96)，位置号在方块上方；表 (0,150)、长度 (120,148)；底部 (0,190) 放调用徽章或说明。
 */
function demo(o: {
  ph?: string; text?: string; cursor?: number; ecls?: string; hi?: number[]
  chars?: string[]; top?: string[]; ccls?: string[]
  tup?: string; tcls?: string; len?: string; lcls?: string; foot?: string; extra?: string; cls?: string
}) {
  const ed = o.text === undefined ? '' : at(0, 22, editor(o.text, { cursor: o.cursor, cls: `sm ${o.ecls ?? ''}`, hi: o.hi }))
  const cs = o.chars ? at(0, 96, cells(o.chars, { top: o.top ?? nums(o.chars.length), cls: o.ccls })) : ''
  const tp = o.tup ? at(0, 150, tuple(o.tup, o.tcls)) : ''
  const ln = o.len ? at(120, 148, cbadge(`长度 ${o.len}`, o.lcls)) : ''
  const ft = o.foot ? at(0, 190, o.foot) : ''
  return at(252, 86, `<div class="c-panel ${o.cls ?? ''}"><div class="ph">${o.ph ?? '演示'}</div><div class="rel">${ed}${cs}${tp}${ln}${ft}${o.extra ?? ''}</div></div>`)
}
const CAT = { text: 'cat', chars: ['c', 'a', 't'], tup: '(c, a, t)', len: '3' }
const CAXT = { text: 'caxt', cursor: 3, chars: ['c', 'a', 'x', 't'], tup: '(c, a, x, t)', len: '4' }
const s1 = (l: Parameters<typeof ops>[0], d: Parameters<typeof demo>[0], h: Parameters<typeof head1>[0] = {}) => head1(h) + ops(l) + demo(d)

// ───────── 第2屏：例题 ─────────
const head2 = (cls = '') => at(40, 16, ckick('例题', cls)) + at(40, 44, ctitle('一串编辑动作对应哪些操作？').replace('c-title', `c-title ${cls}`))
// 题目卡压成一行（画面上的字可以比旁白简短），给下面六行空位留出高度
const STEM = '编辑器刚启动，依次敲 c、a、t，在 a、t 之间敲 x，再退格删掉 x。'
const ASK = '填出每一步的调用和表。'
/** 例题六行：[动作, 调用, 表] */
const ROWS = [
  ['启动', 'Init(L)', '()'],
  ['敲 c', 'Insert(L, 0, c)', '(c)'],
  ['敲 a', 'Insert(L, 1, a)', '(c, a)'],
  ['敲 t', 'Insert(L, 2, t)', '(c, a, t)'],
  ['a、t 之间敲 x', 'Insert(L, 2, x)', '(c, a, x, t)'],
  ['退格', 'Delete(L, 2)', '(c, a, t)'],
]
/** 拍33–38 各填一行；各帧传同一个 FILL */
const FILL: Record<number, number> = { 33: 1, 34: 2, 35: 3, 36: 4, 37: 5, 38: 6 }
/** 版面 A：题目卡 (40,92) 一行 + 六行空位 (40,136) + 右边窄演示卡 (436,136) 164×190 */
function exA(o: { ask?: boolean; rows?: boolean | string; mini?: string; extra?: string; cls?: string } = {}) {
  const q = card(`${STEM}${o.ask ? `<b>${ASK}</b>` : ''}`, o.cls ?? '', 'width:560px;padding:6px 14px;white-space:nowrap')
  const rows = o.rows ? at(40, 136, cblanks(ROWS, FILL, { w: [128, 92], cls: typeof o.rows === 'string' ? o.rows : '' })) : ''
  const mini = at(436, 136, `<div class="c-panel ${o.cls ?? ''}" style="width:164px;height:190px"><div class="ph">编辑器</div><div class="rel">${o.mini ?? ''}</div></div>`)
  return head2(o.cls) + at(40, 92, q) + rows + mini + (o.extra ?? '')
}
/** 窄演示卡里的内容：编辑器 + 小方块（位置号在上方）+ 表 */
const mini = (text: string, cursor: number | undefined, chars: string[], o: { top?: string[]; ccls?: string[]; tup?: string; tcls?: string; extra?: string } = {}) =>
  at(0, 14, editor(text, { cursor, cls: 'sm' })) +
  (chars.length ? at(0, 66, cells(chars, { size: 28, top: o.top ?? nums(chars.length), cls: o.ccls })) : '') +
  (o.tup ? at(0, 100, tuple(o.tup, o.tcls)) : '') + (o.extra ?? '')

/** 拍41–42：窄演示卡底部换成说明（六行下面没有空间） */
const MINI_END = (note: string) => mini('cat', 2, ['c', 'a', 't'], { tup: '(c, a, t)', extra: at(0, 128, note) })

/** 版面 B（拍43–47）：六行收成一行，下面是等式卡、打勾清单，右边是编辑器 → 操作名连线 */
const SUMLINE = card('Init · Insert ×4 · Delete ×1　→　(c, a, t)　<span class="c-cap">只有：哪个操作 + 第几个 + 什么元素</span>', 'dim', 'width:560px;padding:6px 14px')
function exB(o: { eq: 0 | 1 | 2; ecls?: string; check?: boolean; links?: boolean } = { eq: 1 }) {
  const EQ = ['', '逻辑关系 + 操作集 = 抽象数据类型', '线性表（2.1）+ 五个操作（2.2）= 线性表的抽象数据类型']
  const eq = o.eq ? at(40, 140, card(`<div class="c-q">${EQ[o.eq]}</div>${cbadge('1.3')}`, o.ecls ?? '', 'width:560px;padding:8px 14px')) : ''
  const ck = o.check
    ? at(40, 214, `<div>${cchip(`是什么（2.1） ${ok}`, 'new')} ${cchip(`能做什么（2.2） ${ok}`, 'new')}</div>`) +
      at(40, 256, cap('怎么存：不写', 'dim new'))
    : ''
  const lk = o.links
    ? at(330, 214, card(
        editor('cat', { cls: 'sm' }) +
          ['敲字 → Insert', '退格 → Delete', '显示 → Length + Get'].map((s) => `<div class="c-cap" style="font-family:inherit">${s}</div>`).join(''),
        'new', 'width:270px;padding:8px 14px'))
    : ''
  return head2() + at(40, 92, SUMLINE) + eq + ck + lk
}

// ───────── 第3、4屏：填空练习（暂停时播放器把真题盖在画面上，这里画出原样给分镜墙审） ─────────
function quiz(o: { n: number; title: string; stem: string; lines: [string, number][]; opts: string[]; tip?: string; cls?: string; dim?: boolean; extra?: string }) {
  const c = `${o.cls ?? ''} ${o.dim ? 'dim' : ''}`
  return at(40, 16, ckick(`练习 ${o.n} · 填空`, o.cls)) + at(40, 44, ctitle(o.title).replace('c-title', `c-title ${c}`)) +
    (o.tip ? at(40, 86, cap(o.tip, 'new')) : '') +
    at(40, 112, `<div class="c-q ${c}">${o.stem}</div>`) +
    o.lines.map(([s, w], i) => at(40, 148 + 40 * i, `<span class="${c}">${s} ${cblank('', { w })}</span>`)).join('') +
    at(40, 240, `<div class="${c}">${o.opts.map((s) => cchip(s)).join(' ')}</div>`) +
    (o.dim ? '' : at(40, 300, `<span class="c-btn">检查</span>`)) + (o.extra ?? '')
}
const Q1 = (o: { tip?: boolean; cls?: string } = {}) => quiz({
  n: 1, title: '每一步之后，表是什么？', stem: '表是 (c, a, t)。依次调用下面两个操作。',
  lines: [['Insert(L, 1, x) 之后，表是', 120], ['接着 Delete(L, 3) 之后，表是', 120]],
  opts: ['(c, a, t)', '(c, x, a)', '(c, x, t)', '(c, a, x, t)', '(c, x, a, t)'],
  tip: o.tip ? '记住：插入、删除之后，后面元素的位置都会变' : undefined, cls: o.cls,
})
const Q2 = (o: { cls?: string; dim?: boolean; extra?: string } = {}) => quiz({
  n: 2, title: '编辑动作对应哪个调用？', stem: '屏幕是 <code>cat|</code>。先敲 s，再按一次退格。',
  lines: [['敲 s，调用', 130], ['按退格，调用', 130]],
  opts: ['Insert(L, 3, s)', 'Delete(L, 4)', 'Delete(L, 3)', 'Insert(L, 4, s)'], ...o,
})

// ───────── 开场：演示卡里原位出现的等式卡（拍3–5），讲完换回 cat ─────────
const GOAL = (o: { mark?: boolean; more?: boolean; cls?: string } = {}) =>
  demo({
    ph: '先说目的',
    cls: o.cls,
    extra:
      at(0, 30, `<div class="c-q">逻辑关系 + 一组操作 = 抽象数据类型</div>`) + at(0, 62, cbadge('1.3')) +
      (o.mark ? at(0, 96, cap('↑ 逻辑关系：2.1 的线性表', o.more ? '' : 'new')) + at(0, 120, cap('↑ 一组操作：这一节来定', o.more ? '' : 'new')) : '') +
      (o.more ? at(0, 164, cap('常用操作很多，用途不同，要的不同', 'new')) : ''),
  })

export const frames: Frame[] = [
  // ───────── 第1屏　线性表的基本操作：左边五行、右边演示卡都固定，换操作只移动高亮、在演示卡里原位换内容 ─────────
  { beat: 1, html: head1({ kcls: 'new', cls: 'new' }) + demo({ ...CAT, cls: 'new' }) },
  // 开场照 Aho：等式卡在演示卡里原位出现
  { beat: 3, html: head1() + GOAL({ cls: 'new' }) },
  { beat: 4, reveal: 'spread', html: head1() + GOAL({ mark: true }) },
  { beat: 5, html: head1() + GOAL({ mark: true, more: true }) },
  { beat: 6, reveal: 'spread', html: s1({ open: -1, cls: { 0: 'new', 1: 'new', 2: 'new', 3: 'new', 4: 'new' } }, CAT) },
  {
    beat: 7,
    reveal: 'spread',
    html: s1({ open: -1 }, { ...CAT, extra: at(0, 176, cap('↑ 表 L', 'new')) + at(140, 74, cap('← 位置 i', 'new')) + at(236, 96, cells(['x'], { top: ['要插入的'], cls: ['new'] })) }),
  },
  // Init
  { beat: 8, html: s1({ open: 0, cls: { 0: 'new' } }, { ph: 'Init(L)', text: '', cursor: 0, tup: '()', len: '0', tcls: 'new', lcls: 'new' }) },
  // Length
  { beat: 11, html: s1({ open: 1, cls: { 1: 'new' } }, { ph: 'Length(L)', ...CAT }) },
  { beat: 12, html: s1({ open: 1 }, { ph: 'Length(L)', ...CAT, ecls: 'new', foot: cap('每一步都重新显示整行', 'new') }) },
  { beat: 13, html: s1({ open: 1 }, { ph: 'Length(L)', ...CAT, lcls: 'hl new', foot: cap('显示到哪里为止，看长度', 'new') }) },
  { beat: 14, html: s1({ open: 1 }, { ph: 'Length(L)', ...CAT, lcls: 'hl', foot: cap('上一节：现在有几个', 'new') }) },
  // Get（也叫按位查找）
  { beat: 15, html: s1({ open: 2, cls: { 2: 'new' } }, { ph: 'Get(L, i)　按位查找', ...CAT }) },
  { beat: 17, reveal: 'spread', html: s1({ open: 2 }, { ph: 'Get(L, i)　按位查找', ...CAT, ccls: ['hl new', 'hl new', 'hl new'], foot: cap('依次取第 0、1、2 个：c、a、t', 'new') }) },
  { beat: 18, html: s1({ open: 2, range: [2], fresh: 2 }, { ph: 'Get(L, i)　按位查找', ...CAT, foot: cap('i 只能是已有元素的位置', 'new') }) },
  // Insert：先一般形式，再编辑器例子
  { beat: 19, html: s1({ open: 3, range: [2], cls: { 3: 'new' } }, { ph: 'Insert(L, i, x)', ...CAT, cursor: 2, ecls: 'new' }) },
  { beat: 20, html: s1({ open: 3, range: [2] }, { ph: 'Insert(L, i, x)', ...CAT, cursor: 2, foot: cap('第 i 个及之后：位置都加 1', 'new') }) },
  { beat: 21, html: s1({ open: 3, range: [2] }, { ph: 'Insert(L, i, x)', ...CAT, cursor: 2, foot: tuple('(a₀, …, aᵢ₋₁, <b>x</b>, aᵢ, …, aₙ₋₁)　长度 n+1', 'new') }) },
  // x 落进第 2 位，t 头上暂时还是 2；下一拍才翻成 3
  { beat: 22, html: s1({ open: 3, range: [2] }, { ph: 'Insert(L, i, x)', ...CAXT, hi: [2], top: ['0', '1', '2', '2'], ccls: ['', '', 'new', ''], tup: '(c, a, t)', len: '3' }) },
  { beat: 23, html: s1({ open: 3, range: [2] }, { ph: 'Insert(L, i, x)', ...CAXT, top: ['0', '1', '2', '3'], ccls: ['', '', '', 'hl new'], tup: '(c, a, t)', len: '3' }) },
  { beat: 24, html: s1({ open: 3, range: [2] }, { ph: 'Insert(L, i, x)', ...CAXT, tcls: 'new', lcls: 'new', foot: cbadge('Insert(L, 2, x)', 'new') }) },
  // i 可以等于 n：末尾的虚线空位
  { beat: 25, html: s1({ open: 3, range: [2] }, { ph: 'Insert(L, i, x)', text: 'cat', chars: ['c', 'a', 't', ''], ccls: ['', '', '', 'dim new'], tup: '(c, a, t)', len: '3', foot: cap('i = n = 3', 'new') }) },
  { beat: 26, html: s1({ open: 3, range: [2] }, { ph: 'Insert(L, i, x)', text: 'cats', chars: ['c', 'a', 't', 's'], ccls: ['', '', '', 'new'], tup: '(c, a, t, s)', len: '4', foot: cbadge('Insert(L, 3, s)', 'new') }) },
  { beat: 27, html: s1({ open: 3, range: [2, 3], fresh: 3 }, { ph: 'Insert(L, i, x)', text: 'cats', chars: ['c', 'a', 't', 's'], tup: '(c, a, t, s)', len: '4', foot: cbadge('Insert(L, 3, s)') }) },
  // Delete：先一般形式，再编辑器例子
  { beat: 28, html: s1({ open: 4, range: [2, 3], cls: { 4: 'new' } }, { ph: 'Delete(L, i)', ...CAXT, ecls: 'new' }) },
  { beat: 29, html: s1({ open: 4, range: [2, 3] }, { ph: 'Delete(L, i)', ...CAXT, foot: cap('之后的元素：位置都减 1', 'new') }) },
  { beat: 30, html: s1({ open: 4, range: [2, 3] }, { ph: 'Delete(L, i)', ...CAXT, foot: tuple('(a₀, …, aᵢ₋₁, aᵢ₊₁, …, aₙ₋₁)　长度 n−1', 'new') }) },
  { beat: 31, html: s1({ open: 4, range: [2, 3] }, { ph: 'Delete(L, i)', ...CAXT, chars: ['c', 'a', '<s>x</s>', 't'], ccls: ['', '', 'dim new', ''] }) },
  { beat: 32, html: s1({ open: 4, range: [2, 3] }, { ph: 'Delete(L, i)', ...CAT, cursor: 2, ccls: ['', '', 'hl new'], tcls: 'new', lcls: 'new', foot: cbadge('Delete(L, 2)', 'new') }) },
  { beat: 33, html: s1({ open: 4, range: [2, 3] }, { ph: 'Delete(L, i)', ...CAT, cursor: 2, chars: ['c', 'a', 't', ''], ccls: ['', '', '', 'dim new'], foot: cap('第 3 个位置上没有元素', 'new') }) },
  { beat: 34, html: s1({ open: 4, range: [2, 3, 4], fresh: 4 }, { ph: 'Delete(L, i)', ...CAT, cursor: 2, chars: ['c', 'a', 't', ''], ccls: ['', '', '', 'dim'], foot: cap('第 3 个位置上没有元素') }) },
  // 移光标：表不变
  { beat: 35, reveal: 'spread', html: s1({ open: 5, range: [2, 3, 4] }, { ph: '移光标', ...CAT, cursor: 1, ecls: 'new', foot: cap('移光标：表不变，不需要操作', 'new') }) },
  // 小结：左边五行就是汇总表；还有别的常用操作；回扣第2问并打勾
  { beat: 36, html: s1({ open: 5, range: [2, 3, 4] }, { ph: '小结', extra: at(0, 40, cap('五个操作，汇总在左边这张表里', 'new')) }) },
  { beat: 37, html: s1({ open: 5, range: [2, 3, 4] }, { ph: '小结', extra: at(0, 40, cap('五个操作，汇总在左边这张表里')) + at(0, 72, cap('还有：按值查找 · 判空 · 销毁 …（用到时再加）', 'new')) }) },
  { beat: 39, html: s1({ open: 5, range: [2, 3, 4] }, { ph: '小结', extra: at(0, 40, cap('五个操作，汇总在左边这张表里')) + at(0, 72, cap('还有：按值查找 · 判空 · 销毁 …（用到时再加）')) + at(0, 120, cqpill(2, Q[1], 'on new')) }) },
  { beat: 40, html: s1({ open: 5, range: [2, 3, 4] }, { ph: '小结', extra: at(0, 40, cap('五个操作，汇总在左边这张表里')) + at(0, 72, cap('还有：按值查找 · 判空 · 销毁 …（用到时再加）')) + at(0, 120, cqpill(2, `${Q[1]} ${ok}`, 'on new')) }, { done: true, kcls: 'new' }) },

  // ───────── 第2屏　例题（版面 A：拍41–52） ─────────
  { beat: 41, html: exA({ cls: 'new', mini: mini('', 0, []) }) },
  { beat: 42, html: exA({ ask: true, rows: 'new', mini: mini('', 0, []) }) },
  { beat: 43, html: exA({ ask: true, rows: true, mini: mini('', 0, [], { tup: '()', tcls: 'new' }) }) },
  { beat: 44, html: exA({ ask: true, rows: true, mini: mini('c', undefined, ['c'], { ccls: ['new'], tup: '(c)', tcls: 'new' }) }) },
  { beat: 45, html: exA({ ask: true, rows: true, mini: mini('ca', undefined, ['c', 'a'], { ccls: ['', 'new'], tup: '(c, a)', tcls: 'new' }) }) },
  { beat: 46, html: exA({ ask: true, rows: true, mini: mini('cat', undefined, ['c', 'a', 't'], { ccls: ['', '', 'new'], tup: '(c, a, t)', tcls: 'new' }) }) },
  // x 落进第 2 位，t 的位置号翻成 3
  { beat: 47, html: exA({ ask: true, rows: true, mini: mini('caxt', 3, ['c', 'a', 'x', 't'], { ccls: ['', '', 'new', 'hl new'], tup: '(c, a, x, t)', tcls: 'new' }) }) },
  // x 删掉，t 的位置号翻回 2
  { beat: 48, html: exA({ ask: true, rows: true, mini: mini('cat', 2, ['c', 'a', 't'], { ccls: ['', '', 'hl new'], tup: '(c, a, t)', tcls: 'new' }) }) },
  { beat: 49, html: exA({ ask: true, rows: true, mini: mini('cat', 2, ['c', 'a', 't'], { tup: '(c, a, t)', tcls: 'hl new' }) }) },
  { beat: 50, html: exA({ ask: true, rows: true, mini: mini('cat', 2, ['c', 'a', 't'], { tup: '(c, a, t)', tcls: 'hl', extra: at(0, 128, cbadge('4 − 1 = 3', 'new')) }) }) },
  { beat: 51, reveal: 'spread', html: exA({ ask: true, rows: true, mini: MINI_END(cap('第 ' + ['0', '1', '2', '2', '2'].map((s) => `<span class="new">${s}</span>`).join('、') + ' 个', 'nw')) }) },
  { beat: 52, html: exA({ ask: true, rows: true, mini: MINI_END(cap('只有：操作 · 位置 · 元素', 'new')) }) },
  // ───────── 版面 B：抽象数据类型（拍53–56） ─────────
  { beat: 53, html: exB({ eq: 2, ecls: 'new' }) },
  { beat: 54, reveal: 'spread', html: exB({ eq: 2, check: true }) },
  { beat: 55, html: exB({ eq: 2, check: true, links: true }) },

  // ───────── 第3屏　练习1 ─────────
  { beat: 57, html: Q1({ cls: 'new' }) },
  { beat: 58, html: Q1({ tip: true }) },
  { after: 58, html: Q1({ tip: true }) + pause('等学生作答（点选项块再点空位）；作答后显示解析，不配旁白') },

  // ───────── 第4屏　练习2 ─────────
  { beat: 59, html: Q2({ cls: 'new' }) },
  { after: 59, html: Q2() + pause('等学生作答；作答后显示解析') },
  { beat: 60, html: Q2({ dim: true, extra: at(40, 300, cbadge('Insert：0 ≤ i ≤ <b>n</b>', 'new') + ' ' + cbadge('Delete：0 ≤ i ≤ <b>n−1</b>', 'new')) }) },

  // ───────── 第5屏　下一步：一拍过门（照 Gauth：练习完直接进下一小节，不做小结） ─────────
  {
    beat: 61,
    html: at(40, 16, ckick('下一步')) + at(40, 44, ctitle('把线性表放进内存')) +
      at(40, 110, cqpill(1, `${Q[0]} ${ok}`, 'dim')) + at(40, 150, cqpill(2, `${Q[1]} ${ok}`, 'dim new')) + at(40, 190, cqpill(3, Q[2], 'on new')),
  },
]
