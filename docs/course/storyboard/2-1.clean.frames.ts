// 2.1 质感层分镜帧（npm run storyboard -- 2-1 --clean；播放器 --style clean）。帧位和原版 2-1.frames.ts 逐拍对应。
// 骨架照原版：五行定义表、左右例题卡、检查行；改的是版面和画法（规则见 docs/course/visual-spec.md"质感层"一节）：
// - 边距 40，内容沿左边线对齐；问题小标签在标题上方，代替角落问题卡；
// - 线性表用逻辑画法：分开的方块，位置标在上方（a₀ a₁ a₂），不用共边格子（那是 2.3 顺序表的画法）；
// - 箭头只在讲"一个接一个"时画；没有先后的一袋字符用胶囊；
// - 例题检查行改成行内胶囊，还没检查的先画虚线空位；错误变灰加划线。
// 帧里不写色值，样式在 scripts/lib/clean.ts。
import { at, cells, editor, card, tag, pause, Q, ckick, ctitle, cchip, clabel, cbadge, cslot, copt, cscreen, ccover, chist, cqpill } from './kit'
import type { Frame } from '../../../scripts/lib/course'

export { quizSource, say } from './2-1.frames'

const blank = ['', '', '', '…', '']
const nTop = ['a₀', 'a₁', 'a₂', '', 'aₙ₋₁']
const cat3 = ['c', 'a', 't']
const aTop = ['a₀', 'a₁', 'a₂']
const ok = '<b class="okm">✓</b>'
const no = '<b class="nom">✗</b>'
const cap = (s: string, cls = '') => `<span class="c-cap ${cls}">${s}</span>`
const tuple = (s: string, cls = '') => `<span class="tuple c-tuple ${cls}">${s}</span>`
const key = (k: string, cls = 'new') => `<div class="keys"><span class="key ${cls}" style="width:48px;font-size:24px;line-height:1.5">${k}</span></div>`

// ───────── 第0屏：封面屏和问题屏的固定部分 ─────────
/** 封面标题（照 Gauth 封面：居中，从第一帧就在）；sub 为 true 时显示"一个想法"副标题（拍12 出现） */
const COVER = (sub = false) =>
  at(0, 12, ccover('第2章', '线性表：从一个单行编辑器说起', sub ? '一个想法：一行字，就是一个接一个排成一列的数据' : '', 'new'))
/** 封面右边的"一行字"数据卡：(340,96) 260×160，内容用卡内坐标 */
/** "一行字"数据卡：封面在右边 (340,96)；问题屏搬到左栏 (40,110)，外观不变，只是高一些 */
const line = (inner: string, cls = '', x = 340, y = 96, h = 160) =>
  at(x, y, card(`<div class="c-cap" style="position:absolute;left:14px;top:8px">一行字</div>${inner}`, cls, `width:260px;height:${h}px;padding:0`))
/** 历史条：敲 c、a、t，左移，敲 x，退格之后的每一屏 */
const HIST: [string, number][] = [['', 0], ['c', 1], ['ca', 2], ['cat', 3], ['cat', 2], ['caxt', 3], ['cat', 2]]
/** 问题屏：左上小标签 + 宋体屏标题（和第1屏同一位置），下面一行小字和小编辑器 */
/** 封面最后一帧（拍12）里"一行字"卡的内容，问题屏原样搬到左栏 */
const LINE_END = at(14, 34, editor('cat', { cursor: 2, cls: 'big' })) + at(14, 104, cells(cat3, { arrows: true, size: 32 })) + at(172, 106, tag('线性表', 'big'))
/** 问题卡里的三枚问题胶囊：n 是已经出现几枚，hi 是高亮哪一枚（其余变淡） */
const pills = (n: number, o: { fresh?: number; hi?: number } = {}) =>
  [0, 1, 2].slice(0, n).map((i) => at(14, 40 + 40 * i, cqpill(i + 1, Q[i], [o.fresh === i ? 'new' : '', o.hi === undefined ? '' : o.hi === i ? 'on new' : 'dim'].join(' ')))).join('')
/**
 * 问题屏（照 Gauth"Two Best Sellers"）：左上标题和后面各屏同一位置；左栏是封面那张"一行字"卡，
 * 右栏是问题卡 (316,110) 284×200，卡头和问题胶囊在卡里依次出现。head 是卡头文字，body 是卡里的胶囊。
 */
const GOAL = ['判断', '操作', '用 C 放进内存']
/** 目标小字：前 lit 个词亮，其余变淡；fresh 里的词是这一帧刚亮的 */
const goal = (lit = 3, fresh: number[] = []) =>
  GOAL.map((w, i) => {
    const t = `${i ? ' · ' : ''}${w}`
    if (i >= lit) return `<span class="dim">${t}</span>`
    // 刚亮的词：播放器从 data-from 的透明度原地亮到 1（由淡变亮）
    if (fresh.includes(i)) return `<span class="new" data-from=".4">${t}</span>`
    return `<span>${t}</span>`
  }).join('')
const B = (o: { cls?: string; head?: string; headCls?: string; body?: string; lit?: number; fresh?: number[] } = {}) =>
  at(40, 16, ckick('第2章 · 线性表')) + at(40, 44, ctitle('目标：学会线性表').replace('c-title', `c-title ${o.cls ?? ''}`)) +
  at(40, 80, cap(goal(o.lit, o.fresh), o.cls)) +
  line(LINE_END, o.cls, 40, 110, 200) +
  at(316, 110, card((o.head ? `<div class="c-cap ${o.headCls ?? ''}" style="position:absolute;left:14px;top:10px">${o.head}</div>` : '') + (o.body ?? ''), o.cls, 'width:284px;height:200px;padding:0'))

// ───────── 第1屏：标题区 + 五行定义表 ─────────
const Q1 = ckick('问题 1 · 程序要记住这一行字的什么？')
const head = () => at(40, 16, Q1) + at(40, 44, ctitle('什么是线性表'))
const ACC = ['定义', '同类型', '一个接一个', '个数有限', '可以重复']
const SUM = ['(c, a, t)　长度 3', 'c a t 都是字符', 'c → a → t', '长度 0 → 3', 'b o o k']
/**
 * 左右两栏：左边五行要点 (40,86)，每行高度固定，讲到的行高亮、讲过的行在第二行显示结果；
 * 右边演示卡 (252,86) 348×244，body 用卡内坐标（内宽 316）。open 是正在讲的行（-1 是小结）。
 */
function cpane(o: { open: number; body?: string; sum?: string[]; tick?: number[]; cls?: Record<number, string> }) {
  const rows = ACC.map((name, i) => {
    const c = [o.cls?.[i] ?? '', i === o.open ? 'on' : ''].join(' ')
    const s = (o.open === -1 || i < o.open) && o.sum?.[i] ? `<span class="rs">${o.sum[i]}</span>` : ''
    const t = o.tick?.includes(i) ? '<b class="okm c-tick">✓</b>' : ''
    return `<div class="c-li ${c}"><span class="rn">${name}</span>${s}${t}</div>`
  })
  const ph = o.open >= 0 ? ACC[o.open] : '小结'
  return at(40, 86, `<div class="c-list">${rows.join('')}</div>`) + at(252, 86, `<div class="c-panel"><div class="ph">${ph}</div><div class="rel">${o.body ?? ''}</div></div>`)
}
const s1 = (o: Parameters<typeof cpane>[0]) => head() + cpane(o)

// 拍41–42：一袋字符 → 记住先后
const bag = (cls = '') => `<div class="c-bag ${cls}">${cat3.map((s) => cchip(s, 'mono')).join('')}</div>`
const cands = (decided: boolean) =>
  `<div class="cands-row">${['cat', 'act', 'tca']
    .map((s, i) =>
      !decided
        ? `<span>${editor(s, { cursor: -1, cls: 'sm new' })}<b class="qm">?</b></span>`
        : i === 0
          ? `<span>${editor(s, { cursor: -1, cls: 'sm hl new' })}${ok}</span>`
          : `<span class="strike">${editor(s, { cursor: -1, cls: 'sm' })}</span>`,
    )
    .join('')}</div>`

// ───────── 第2屏：例题两张卡 ─────────
const log = (o: { arrows?: boolean; mark?: boolean; cls?: string } = {}) =>
  `<div class="log ${o.cls ?? ''}">${['通话 4 · 刚刚', '通话 3 · 昨天', '通话 2 · 周一', '通话 1 · 上周']
    .map((s, i) => `<div class="lr">${s}${o.mark && (i === 1 || i === 2) ? ' <span class="mini">前驱/后继各一</span>' : ''}</div>${o.arrows && i < 3 ? '<div class="c-down">↓</div>' : ''}`)
    .join('')}</div>`
const tree = (o: { arrows?: boolean; hi?: boolean; cls?: string } = {}) => `<div class="c-tree ${o.cls ?? ''}">
<svg width="240" height="120" viewBox="0 0 240 120" class="tree">
  <rect x="95" y="6" width="50" height="24" rx="6" class="nd"/><text x="120" y="23">祖辈</text>
  ${o.arrows || o.hi ? `<g class="${o.hi ? 'hl' : ''}"><line x1="120" y1="30" x2="40" y2="78"/><line x1="120" y1="30" x2="120" y2="78"/><line x1="120" y1="30" x2="200" y2="78"/></g>` : ''}
  <rect x="15" y="78" width="50" height="24" rx="6" class="nd"/><text x="40" y="95">孩子</text>
  <rect x="95" y="78" width="50" height="24" rx="6" class="nd"/><text x="120" y="95">孩子</text>
  <rect x="175" y="78" width="50" height="24" rx="6" class="nd"/><text x="200" y="95">孩子</text>
</svg></div>`
/** 三项检查：打了勾叉的是胶囊（✗ 变灰加划线），还没检查的是虚线空位 */
function checks(marks: string[], cls: string[] = []) {
  const names = ['同类型', '一个接一个', '个数有限']
  return `<div class="c-checks">${names
    .map((n, i) => {
      const m = marks[i] ?? '', c = cls[i] ?? ''
      if (m === '✓') return cchip(`${n} ${ok}`, c)
      if (m === '✗') return cchip(`${n} ${no}`, `off ${c}`)
      return cslot(`${n} ?`, c)
    })
    .join('')}</div>`
}
function example(o: {
  left?: string; right?: string; lm?: string[]; rm?: string[]; lcls?: string[]; rcls?: string[]
  lcard?: string; rcard?: string; extra?: string
}) {
  const L = card(clabel('通话记录（从新到旧）', 'c1') + (o.left ?? log()) + checks(o.lm ?? [], o.lcls), o.lcard ?? '', 'width:274px;height:240px')
  const R = card(clabel('家谱', 'c2') + (o.right ?? tree()) + checks(o.rm ?? [], o.rcls), o.rcard ?? '', 'width:274px;height:240px')
  return at(40, 20, ctitle('例题：通话记录和家谱能看成线性表吗？')) + at(40, 64, L) + at(326, 64, R) + (o.extra ?? '')
}
const LOGA = log({ arrows: true })
const LM3 = ['✓', '✓', '✓']

// ───────── 第3、4屏：练习 ─────────
const OPTS1 = ['编辑器里的一行字 cat', '一周的七天', '按学号排好的花名册', '电脑里的文件夹目录', '城市的地铁线路网', '抽奖箱里的号码球', '全体正整数 1, 2, 3, …']
const quiz1 = (cls = '') =>
  at(40, 16, ckick('练习 1 · 多选', cls)) +
  at(40, 44, `<div class="c-q ${cls}">把每样东西里的成员当作元素，判断能不能看成线性表。</div>`) +
  at(40, 88, `<div class="c-opts">${OPTS1.map((s, i) => copt('ABCDEFG'[i], s, cls)).join('')}</div>`) +
  at(40, 246, cap('判断的办法', cls)) +
  at(40, 268, cchip('是不是同一种东西', cls) + cchip('是不是一个接一个', cls) + cchip('个数是不是有限', cls)) +
  at(196, 314, `<span class="c-btn">检查</span>`) + at(372, 314, `<span class="c-btn ghost">提示</span>`)
const OPTS2 = ['不是，线性表要求元素按从小到大排好', '是，线性表只要求元素一个接一个，不要求按大小排', '不是，c、a、t 是三个不同的字符，不算同类型']
const quiz2 = (cls = '') =>
  at(40, 16, ckick('练习 2 · 单选', cls)) +
  at(40, 44, `<div class="c-q ${cls}">屏幕上的 cat 看成线性表是 (c, a, t)。这三个字符没有按字母顺序排。</div>`) +
  at(40, 92, `<div class="c-opts1">${OPTS2.map((s, i) => copt('ABC'[i], s, cls)).join('')}</div>`) +
  at(196, 314, `<span class="c-btn">检查</span>`) + at(372, 314, `<span class="c-btn ghost">提示</span>`)

// ───────── 第4屏后半、第5屏 ─────────
const TIP = (cls = '') => at(40, 40, card(`<div class="c-cap">💡 提示</div><div class="c-q">有序 ≠ 排好序</div><div class="c-cap">有序：位置有先后　　不是：按大小排好</div>`, cls, 'width:360px;padding:12px 18px'))
const END = () => at(40, 24, card(
  `<div class="c-q">到这里你有了</div><div>线性表的定义和四个要点：</div><div class="pts">${['同类型', '一个接一个', '个数有限', '可以重复'].map((s) => cchip(s)).join('')}</div><div>屏幕上的一行字，可以看成一个字符的线性表。</div>`,
  '', 'width:420px;padding:12px 18px'))

export const frames: Frame[] = [
  // ───────── 第0屏　章首开场 ─────────
  // 封面屏（拍1–12，照 Gauth 封面）：居中课程标题从第一帧就在；左边场景图、右边"一行字"数据卡，整屏只有数据卡里在变
  { beat: 1, reveal: 'spread', html: COVER() + at(40, 96, cscreen({ reveal: true })) },
  { beat: 3, html: COVER() + at(40, 96, cscreen()) + line(at(14, 34, editor('', { cls: 'big new' })) + at(14, 104, cap('↑ 光标：下一个字出现在这里', 'new')), 'new') },
  {
    beat: 5,
    reveal: 'spread',
    // 同一个编辑器、同一个键帽位：c → ca → cat 叠在原位依次出现
    html: COVER() + at(40, 96, cscreen()) + line([['c', 'c'], ['a', 'ca'], ['t', 'cat']].map(([k, s]) => at(14, 96, key(k)) + at(14, 34, editor(s, { cls: 'big new' }))).join('')),
  },
  { beat: 6, html: COVER() + at(40, 96, cscreen()) + line(at(14, 34, editor('cat', { cursor: 2, cls: 'big new' })) + at(14, 96, key('←')) + at(78, 108, cap('光标左移一格', 'new'))) },
  { beat: 7, html: COVER() + at(40, 96, cscreen()) + line(at(14, 34, editor('caxt', { cursor: 3, cls: 'big', hi: [2] })) + at(14, 96, key('x')) + at(78, 108, cap('敲 x', 'new'))) },
  { beat: 8, html: COVER() + at(40, 96, cscreen()) + line(at(14, 34, editor('cat', { cursor: 2, cls: 'big new' })) + at(14, 96, key('⌫')) + at(78, 108, cap('退格：x 删掉', 'new'))) },
  {
    beat: 9,
    reveal: 'spread',
    html: COVER() + at(40, 96, cscreen()) + line(at(14, 34, editor('cat', { cursor: 2, cls: 'big' })) + at(14, 108, cap('每做一个动作，整行重新显示一次'))) + at(40, 276, chist(HIST, 'flash new')),
  },
  {
    beat: 10,
    html: COVER() + at(40, 96, cscreen()) + line(at(8, 28, `<div class="dash new" style="padding:5px">${editor('cat', { cursor: 2, cls: 'big' })}</div>`) + at(214, 8, cap('记着', 'new'))) + at(40, 276, chist(HIST)),
  },
  { beat: 11, html: COVER() + at(40, 96, cscreen()) + line(at(14, 34, editor('cat', { cursor: 2, cls: 'big' })) + at(14, 104, cells(cat3, { arrows: true, size: 32, cls: ['new', 'new', 'new'] }))) },
  // 拍12："这样的数据叫线性表"——数据卡里出现标签，标题下面出现"一个想法"副标题
  {
    beat: 12,
    html: COVER(true) + at(40, 96, cscreen()) + line(at(14, 34, editor('cat', { cursor: 2, cls: 'big' })) + at(14, 104, cells(cat3, { arrows: true, size: 32 })) + at(172, 106, tag('线性表', 'new big'))),
  },

  // 问题屏（拍13–20，照 Gauth"Two Best Sellers"）：左上小标签 + 宋体屏标题，和后面各屏同一位置；问题胶囊挂在下面
  // 目标小字随旁白逐个亮：拍13"判断"，拍14"操作""放进内存"（spread 摊在这一拍的旁白里）
  { beat: 13, html: B({ cls: 'new', lit: 1 }) },
  { beat: 14, reveal: 'spread', html: B({ lit: 3, fresh: [1, 2] }) },
  { beat: 16, html: B({ head: '要让它跑起来，先回答三个问题：', headCls: 'new' }) },
  { beat: 17, html: B({ head: '要让它跑起来，先回答三个问题：', body: pills(1, { fresh: 0 }) }) },
  { beat: 18, html: B({ head: '要让它跑起来，先回答三个问题：', body: pills(2, { fresh: 1 }) }) },
  { beat: 19, html: B({ head: '要让它跑起来，先回答三个问题：', body: pills(3, { fresh: 2 }) }) },
  // 第 1 枚高亮（就是第1屏标题上方的"问题 1"小标签），另外两枚变淡
  { beat: 20, html: B({ head: '先记住这三个问题，从第一个开始', headCls: 'new', body: pills(3, { hi: 0 }) }) },

  // ───────── 第1屏　什么是线性表：左边五行要点固定，右边演示卡固定，换要点只移动高亮、在演示卡里原位换内容 ─────────
  { beat: 21, html: s1({ open: 0, cls: { 0: 'new' }, body: at(0, 60, cells(cat3)) }) },
  { beat: 22, html: s1({ open: 0, body: at(0, 60, cells(blank, { cls: ['new', 'new', 'new', 'new', 'new'] })) + at(0, 120, cap('n 个同类型的元素排成一列')) }) },
  { beat: 24, html: s1({ open: 0, body: at(0, 60, cells(blank)) + at(0, 102, `<div class="c-brace new" style="width:222px"><span>长度 n</span></div>`) }) },
  { beat: 25, html: s1({ open: 0, body: at(0, 70, cells(blank, { top: nTop, cls: ['new', 'new', 'new', '', 'new'] })) + at(0, 130, tuple('(a₀, a₁, …, aₙ₋₁)', 'new')) }) },
  { beat: 26, html: s1({ open: 0, body: at(0, 70, cells(blank, { top: nTop, cls: ['hl new', '', '', '', 'hl new'] })) + at(0, 130, tuple('(a₀, a₁, …, aₙ₋₁)')) }) },
  { beat: 27, html: s1({ open: 0, body: at(0, 70, cells(cat3, { top: aTop, cls: ['new', 'new', 'new'] })) + at(0, 130, tuple('(c, a, t)', 'new')) }) },
  { beat: 28, html: s1({ open: 0, body: at(0, 70, cells(cat3, { top: aTop })) + at(0, 130, tuple('(c, a, t)')) + at(100, 128, cbadge('长度 3', 'new')) }) },
  { beat: 29, html: s1({ open: -1, sum: SUM.slice(0, 1), cls: { 0: 'new' }, body: at(0, 60, cap('四个要点，逐条看', 'new')) }) },
  { beat: 30, html: s1({ open: 1, sum: SUM, cls: { 1: 'new' }, body: at(0, 70, cells(cat3, { top: ['字符', '字符', '字符'] })) + at(0, 130, cap('都是同一种东西')) }) },
  {
    beat: 32,
    html: s1({ open: 1, sum: SUM, body: at(0, 70, cells(cat3, { top: ['字符', '字符', '字符'] })) + at(0, 128, `<span class="bounce new">7 ✗</span><span class="bounce new">🖼 ✗</span>`) + at(0, 164, cap('整数、图片：挤不进来')) }),
  },
  { beat: 33, html: s1({ open: 1, sum: SUM, body: at(0, 70, cells(['', '', '', '', '', ''], { size: 32, cls: Array(6).fill('new') })) + at(0, 120, cap('只准备一种格子，专门放字符')) }) },
  { beat: 34, html: s1({ open: 2, sum: SUM, cls: { 1: 'new', 2: 'new' }, body: at(0, 70, cells(cat3, { arrows: true })) }) },
  { beat: 35, html: s1({ open: 2, sum: SUM, body: at(0, 70, cells(cat3, { arrows: true, top: ['前驱', '', ''], cls: ['new', 'hl', ''] })) }) },
  { beat: 36, html: s1({ open: 2, sum: SUM, body: at(0, 70, cells(cat3, { arrows: true, top: ['前驱', '', '后继'], cls: ['', 'hl', 'new'] })) }) },
  { beat: 37, html: s1({ open: 2, sum: SUM, body: at(0, 70, cells(cat3, { arrows: true, idx: ['无前驱', '', ''], cls: ['new', '', ''] })) }) },
  { beat: 38, html: s1({ open: 2, sum: SUM, body: at(0, 70, cells(cat3, { arrows: true, idx: ['无前驱', '', '无后继'], cls: ['', '', 'new'] })) }) },
  { beat: 39, html: s1({ open: 2, sum: SUM, body: at(0, 66, editor('cat', { cursor: -1, cls: 'sm' }) + '<span class="neq new">≠</span>' + editor('act', { cursor: -1, cls: 'sm' })) }) },
  {
    beat: 41,
    html: s1({
      open: 2, sum: SUM,
      body: at(0, 28, cap('程序只记了')) + at(0, 50, bag('new')) + at(54, 92, '<span class="c-down">↓</span>') + at(0, 112, cands(false)) + at(0, 152, cap('三个字符能排出好几行，该显示哪一行？', 'new')),
    }),
  },
  {
    beat: 42,
    html: s1({
      open: 2, sum: SUM,
      body: at(0, 28, cap('记住先后')) + at(0, 52, cells(cat3, { arrows: true, size: 30, cls: ['new', 'new', 'new'] })) + at(54, 92, '<span class="c-down">↓</span>') + at(0, 112, cands(true)) + at(0, 152, cap('还得记住谁在谁前面', 'new')),
    }),
  },
  { beat: 43, html: s1({ open: 3, sum: SUM, cls: { 2: 'new', 3: 'new' }, body: at(0, 66, editor('', { cls: 'sm' })) + at(100, 70, tuple('()')) + at(140, 68, cbadge('长度 0')) }) },
  { beat: 45, html: s1({ open: 3, sum: SUM, body: at(0, 66, editor('', { cls: 'sm' })) + at(100, 70, tuple('()')) + at(140, 68, cbadge('长度 0')) + at(214, 66, tag('空表', 'new')) }) },
  {
    beat: 47,
    reveal: 'spread',
    html: s1({
      open: 3, sum: SUM,
      body: at(0, 66, ['c', 'ca', 'cat'].map((s) => editor(s, { cls: 'sm new' })).join('')) + at(0, 112, `<span class="counter new">长度 0 → 1 → 2 → 3</span>`) + at(0, 150, cap('显示到哪里为止，看长度')),
    }),
  },
  { beat: 50, html: s1({ open: 4, sum: SUM, cls: { 3: 'new', 4: 'new' }, body: at(0, 70, cells(['b', 'o', 'o', 'k'], { cls: ['', 'hl', 'hl', ''] })) }) },
  { beat: 52, html: s1({ open: 4, sum: SUM, body: at(0, 70, cells(['b', 'o', 'o', 'k'], { top: ['', '第1个', '第2个', ''], cls: ['', 'hl new', 'hl new', ''] })) }) },
  // 小结：左边五行就是总结图；右边放开场那枚问题胶囊
  { beat: 54, html: s1({ open: -1, sum: SUM, cls: { 4: 'new' }, body: at(0, 40, cqpill(1, Q[0], 'on new')) }) },
  { beat: 57, html: s1({ open: -1, sum: SUM, tick: [0, 2, 3], cls: { 0: 'new', 2: 'new', 3: 'new' }, body: at(0, 40, cqpill(1, Q[0], 'on')) + at(0, 96, cap('元素 · 先后 · 个数', 'new')) }) },
  { beat: 58, html: s1({ open: -1, sum: SUM, tick: [0, 2, 3], body: at(0, 40, cqpill(1, `${Q[0]} ${ok}`, 'on new')) + at(0, 96, cap('元素 · 先后 · 个数')) }) },

  // ───────── 第2屏　例题 ─────────
  { beat: 59, html: example({ lcard: 'new', rcard: 'new' }) },
  { beat: 60, html: example({ left: log({ cls: 'new' }) }) },
  { beat: 61, html: example({ right: tree({ cls: 'new' }) }) },
  { beat: 62, html: example({ lcard: 'hl' }) },
  { beat: 63, html: example({ lcard: 'hl', lm: ['✓'], lcls: ['new'] }) },
  { beat: 64, html: example({ lcard: 'hl', left: LOGA, lm: ['✓'] }) },
  { beat: 65, html: example({ lcard: 'hl', left: log({ arrows: true, mark: true }), lm: ['✓'] }) },
  { beat: 66, html: example({ lcard: 'hl', left: LOGA, lm: ['✓', '✓'], lcls: ['', 'new'] }) },
  { beat: 67, html: example({ lcard: 'hl', left: LOGA, lm: LM3, lcls: ['', '', 'new'] }) },
  { beat: 68, html: example({ rcard: 'hl', left: LOGA, lm: LM3 }) },
  { beat: 69, html: example({ rcard: 'hl', left: LOGA, lm: LM3, rm: ['✓'], rcls: ['new'] }) },
  { beat: 70, html: example({ rcard: 'hl', left: LOGA, right: tree({ arrows: true }), lm: LM3, rm: ['✓'] }) },
  { beat: 71, html: example({ rcard: 'hl', left: LOGA, right: tree({ hi: true }), lm: LM3, rm: ['✓'] }) },
  { beat: 72, html: example({ rcard: 'hl', left: LOGA, right: tree({ hi: true }), lm: LM3, rm: ['✓', '✗'], rcls: ['', 'new'] }) },
  { beat: 73, html: example({ rcard: 'hl', left: LOGA, right: tree({ hi: true }), lm: LM3, rm: ['✓', '✗'], rcls: ['', '', 'dim'] }) },
  {
    beat: 74,
    html:
      example({ left: LOGA, right: tree({ hi: true }), lm: LM3, rm: ['✓', '✗'], rcls: ['', '', 'dim'] }) +
      at(40, 314, card(`答案：通话记录 ${ok} 线性表　　家谱 ${no} 不是一个接一个`, 'new', 'width:560px;padding:3px 14px')),
  },
  {
    beat: 76,
    html: example({ left: LOGA, right: tree({ hi: true }), lm: LM3, rm: ['✓', '✗'], lcls: ['dim', 'hl new', 'dim'], rcls: ['dim', 'hl new', 'dim'] }) + at(40, 318, cap('差别只在：是不是一个接一个')),
  },

  // ───────── 第3屏　练习1 ─────────
  { beat: 77, html: quiz1('new') },
  { after: 79, html: quiz1() + pause('等学生作答；作答后每个选项下显示解析，不配旁白') },

  // ───────── 第4屏　练习2 ─────────
  { beat: 80, html: quiz2('new') },
  { after: 81, html: quiz2() + pause('等学生作答；作答后显示选项解析') },
  // 提示和对比同一个版面：拍82 上方提示卡，拍84 下方出现对比
  { beat: 82, html: TIP('new') },
  {
    beat: 84,
    html:
      TIP() +
      at(40, 170, cells(cat3, { top: aTop })) + at(182, 176, '<b class="okm big">✓</b>') + at(222, 168, '<span class="neq new">≠</span>') +
      at(280, 170, cells(['a', 'c', 't'], { top: aTop })) + at(422, 176, '<b class="okm big">✓</b>') +
      at(40, 224, tuple('(c, a, t)')) + at(280, 224, tuple('(a, c, t)')) + at(40, 270, cap('同样三个字符，位置不同，表就不同')),
  },

  // ───────── 第5屏　节尾：一个版面；拍90 下方出现开场那三枚问题胶囊，1 打勾、2 高亮，问题线索闭合 ─────────
  { beat: 87, html: END() },
  {
    beat: 90,
    html: END() + at(40, 214, cqpill(1, `${Q[0]} ${ok}`, 'dim')) + at(40, 254, cqpill(2, Q[1], 'on new')) + at(40, 294, cqpill(3, Q[2], 'dim')),
  },
]

// ───────── 对比页（scripts/style-compare.ts）挑出来的几拍 ─────────
export const compare: { beat: number; name: string }[] = [
  { beat: 6, name: '章首：光标左移一格' },
  { beat: 28, name: '定义行：c a t、位置、长度 3' },
  { beat: 41, name: '一个接一个（上）：只记了有哪几个字符' },
  { beat: 42, name: '一个接一个（下）：还得记住先后' },
  { beat: 72, name: '例题：通话记录 ✓、家谱 ✗' },
  { beat: 77, name: '练习 1：多选' },
]

// ───────── 示意：线性表的三层画法（逻辑 → 顺序表 → 链表），整章固定 ─────────
/** 示意行：不对应拍号，三栏各是一张画面 */
export type DemoRow = { name: string; note: string; cols: { cap: string; html: string }[] }
const node = (v: string, next: string, addr: string) => `<span class="c-node"><span>${v}</span><span>${next}</span><em>${addr}</em></span>`
const link = '<span class="c-link"></span>'
export const demo: DemoRow = {
  name: '示意：线性表的三层画法',
  note: '2.1 只画逻辑：分开的方块，不说怎么放。2.3 方块合拢成共边格子、下面出现地址，合拢本身就是"顺序存储"；2.9 方块散开、长出地址格、用箭头连起来（箭头图照书稿 2.9）。',
  cols: [
    {
      cap: '逻辑（2.1–2.2）',
      html:
        at(40, 16, ckick('线性表')) + at(40, 44, ctitle('只说谁在第几个')) +
        at(40, 140, cells(cat3, { top: aTop, size: 44 })) +
        at(230, 148, tuple('(c, a, t)')) +
        at(40, 230, cap('不说放在哪里，也不说怎么连')),
    },
    {
      cap: '顺序存储（2.3 起）',
      html:
        at(40, 16, ckick('2.3 顺序表')) + at(40, 44, ctitle('挨着放：关系藏在位置里')) +
        at(40, 140, cells(['…', 'c', 'a', 't', '', '…'], { mem: true, size: 44, idx: ['', '100', '101', '102', '103', ''], cls: ['dim', '', '', '', '', 'dim'] })) +
        at(330, 150, cbadge('长度 3')) +
        at(40, 230, cap('a 在 101 号，紧挨着 100 号的 c')),
    },
    {
      cap: '链式存储（2.9 起）',
      html:
        at(40, 16, ckick('2.9 链表')) + at(40, 44, ctitle('关系存在地址格里')) +
        at(40, 100, cap('head = 100', 'tuple')) + at(52, 118, `<span class="c-down">↓</span>`) +
        at(40, 140, node('c', '109', '100') + link + node('a', '105', '109') + link + node('t', '0', '105')) +
        at(40, 230, cap('按逻辑顺序从左往右摆，方框下面是结点的地址')),
    },
  ],
}
