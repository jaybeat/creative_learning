// 2.1 纸面版分镜帧（npm run storyboard -- 2-1 --paper）。从 2-1.frames.ts 复制后按纸面风改写，逐拍对应原帧。
// 两层分工：纸片层是印刷体（卡片、手风琴、格子、编辑器）；笔迹层只给老师的批注（ink 手写加箭头、circle 圈、
// 勾叉、图章 stamp、便利贴 sticky）。主角是编辑器光标：hero 停在"正在讲的东西"旁边。
// 暗场（dark / lead）只用在点名时刻：拍12 线性表、拍13 编辑器1.0、拍21 前半拍、拍87 前半拍。
// pic 是纸面版的画面说明（分镜墙显示它，不改双栏稿）。风格定稿后再合并回 2-1.frames.ts 和双栏稿。
import { at, title, tag, note, editor, cells, qcard, acc, SUM, checks, card, pause, ink, circle, stamp, sticky, hero, darkTitle } from './kit'
import type { Frame } from '../../../scripts/lib/course'

export { quizSource, say } from './2-1.frames'

const blank = ['', '', '', '…', '']
const nIdx = ['0', '1', '2', '', 'n−1']
const QC = qcard({ corner: true, hi: 0 })
const T = title('什么是线性表')

// 手风琴在 (24,50)；第 k 行展开时，主角光标停在这一行左边
const rowHero = (k: number) => hero(10, 57 + k * 28, 22)
// 角落问题卡第 i 行旁边
const qcHero = (i: number) => hero(412, 37 + i * 20, 16)

const defRow = (inner: string) => `<div class="rel" style="height:132px">${inner}</div>`
const candidates = (decided = false) =>
  `<div class="cands">${['cat', 'act', 'tca']
    .map((s, i) => {
      if (!decided) return `<div>${editor(s, { cursor: -1, cls: 'sm new' })}<b class="nom">?</b></div>`
      return i === 0
        ? `<div>${editor(s, { cursor: -1, cls: 'sm hl new' })}<b class="okm">✓</b></div>`
        : `<div class="dim strike">${editor(s, { cursor: -1, cls: 'sm' })}</div>`
    })
    .join('')}</div>`

const callLog = (o: { arrows?: boolean; mark?: boolean; cls?: string } = {}) =>
  `<div class="log ${o.cls ?? ''}">${['通话 4 · 刚刚', '通话 3 · 昨天', '通话 2 · 周一', '通话 1 · 上周']
    .map((s, i) => `<div class="lr">${s}${o.mark && (i === 1 || i === 2) ? ' <span class="mini">前驱/后继各一</span>' : ''}</div>${o.arrows && i < 3 ? '<div class="la">↓</div>' : ''}`)
    .join('')}</div>`

const tree = (o: { arrows?: boolean; hi?: boolean } = {}) => `
<svg width="240" height="120" viewBox="0 0 240 120" class="tree ${o.hi ? 'hi' : ''}">
  <rect x="95" y="6" width="50" height="24" rx="4" class="nd"/><text x="120" y="23">祖辈</text>
  ${o.arrows || o.hi ? `<g class="${o.hi ? 'hl' : ''}"><line x1="120" y1="30" x2="40" y2="78"/><line x1="120" y1="30" x2="120" y2="78"/><line x1="120" y1="30" x2="200" y2="78"/></g>` : ''}
  <rect x="15" y="78" width="50" height="24" rx="4" class="nd"/><text x="40" y="95">孩子</text>
  <rect x="95" y="78" width="50" height="24" rx="4" class="nd"/><text x="120" y="95">孩子</text>
  <rect x="175" y="78" width="50" height="24" rx="4" class="nd"/><text x="200" y="95">孩子</text>
</svg>`

function exampleFrame(o: {
  left?: string; right?: string; lm?: string[]; rm?: string[]; lcls?: string[]; rcls?: string[]
  lcard?: string; rcard?: string; extra?: string
}) {
  const L = card(`<div class="ch">通话记录（从新到旧）</div>${o.left ?? callLog()}${checks(o.lm ?? [], o.lcls)}`, o.lcard ?? '', 'width:272px;height:252px')
  const R = card(`<div class="ch">家谱</div>${o.right ?? tree()}${checks(o.rm ?? [], o.rcls)}`, o.rcard ?? '', 'width:272px;height:252px')
  return title('例题：通话记录和家谱能看成线性表吗？') + at(24, 60, L) + at(328, 60, R) + (o.extra ?? '')
}
// 例题卡检查行旁的主角光标：side 0 左卡、1 右卡；row -1 表示卡片标题
const exHero = (side: 0 | 1, row: number) => hero(side ? 318 : 14, row < 0 ? 70 : 236 + row * 23, 18)

const quiz1 = (cls = '') =>
  card(
    `<div class="qz-h">练习1　多选</div><div class="qz-s">把每样东西里的成员当作元素，判断能不能看成线性表。</div>` +
      ['编辑器里的一行字 cat', '一周的七天', '按学号排好的花名册', '电脑里的文件夹目录', '城市的地铁线路网', '抽奖箱里的号码球', '全体正整数 1, 2, 3, …']
        .map((s) => `<div class="opt">☐ ${s}</div>`)
        .join('') +
      `<div class="btns"><span class="btn">检查</span></div>`,
    cls,
    'width:360px',
  )

const quiz2 = (cls = '') =>
  card(
    `<div class="qz-h">练习2　单选</div><div class="qz-s">屏幕上的 cat 看成线性表是 (c, a, t)。这三个字符没有按字母顺序排。</div>` +
      ['不是，线性表要求元素按从小到大排好', '是，线性表只要求元素一个接一个，不要求按大小排', '不是，c、a、t 是三个不同的字符，不算同类型']
        .map((s) => `<div class="opt">○ ${s}</div>`)
        .join('') +
      `<div class="btns"><span class="btn">检查</span></div>`,
    cls,
    'width:420px',
  )

const rule = sticky('判断的办法<br>· 是不是同一种东西<br>· 是不是一个接一个<br>· 个数是不是有限', 'width:180px')

export const frames: Frame[] = [
  // ───────── 第0屏　章首开场 ─────────
  {
    beat: 1,
    reveal: 'spread',
    pic: '三个输入框像三张截图依次落在纸上；旁边手写"搜索框""聊天框""文件名框"。光标在框里闪',
    html:
      at(170, 60, `<div class="inp new">🔍 搜索<span class="cur">|</span></div>`) +
      at(170, 130, `<div class="inp new">说点什么…<span class="cur">|</span></div>`) +
      at(170, 200, `<div class="inp new">新建文本文档<span class="cur">|</span>.txt</div>`) +
      at(472, 66, ink('搜索框')) + at(472, 136, ink('聊天框')) + at(472, 206, ink('文件名框')),
  },
  {
    beat: 3,
    pic: '三张截图合成一个编辑器框，只有闪烁的光标（主角登场）；手写"光标"，弯箭头指向它',
    html: title('第2章 线性表') + at(170, 150, editor('', { cls: 'new big' })) + at(250, 222, ink('这是光标', { to: [190, 200] })),
  },
  {
    beat: 5,
    reveal: 'spread',
    pic: '依次按键，出现 c、ca、cat；光标跟着字往右走',
    html: [['c', 'c', 60], ['a', 'ca', 230], ['t', 'cat', 400]]
      .map(([k, s, x]) => at((x as number) + 40, 90, `<div class="keys"><span class="key new">${k}</span></div>`) + at(x as number, 160, editor(s as string, { cls: 'new' })))
      .join(''),
  },
  {
    beat: 6,
    pic: '光标左移到 a 和 t 之间；手写"左移一格"，箭头指向光标',
    html: at(200, 150, editor('cat', { cursor: 2, cls: 'big new' })) + at(280, 232, ink('左移一格', { to: [246, 206] })),
  },
  {
    beat: 7,
    pic: 'x 插进 a 和 t 之间（荧光笔标出 x）；手写"敲 x"',
    html: at(200, 150, editor('caxt', { cursor: 3, cls: 'big', hi: [2] })) + at(290, 232, ink('敲 x', { to: [252, 206] })),
  },
  {
    beat: 8,
    pic: 'x 消失；手写红字"退格，x 没了"',
    html: at(200, 150, editor('cat', { cursor: 2, cls: 'big new' })) + at(280, 232, ink('退格，x 没了', { c: 'red', to: [250, 206] })),
  },
  {
    beat: 9,
    reveal: 'spread',
    pic: '快速回放六步，每步整行闪一下；顶部手写"每做一个动作，整行重新显示一次"',
    html:
      at(24, 34, ink('每做一个动作，整行重新显示一次')) +
      at(24, 80, ['', 'c', 'ca', 'cat'].map((s) => editor(s, { cls: 'sm flash new' })).join('')) +
      at(24, 170, [['cat', 2], ['caxt', 3], ['cat', 2]].map(([s, c]) => editor(s as string, { cursor: c as number, cls: 'sm flash new' })).join('')),
  },
  {
    beat: 10,
    pic: '红笔圈住这一行，旁边手写红字"记着！"',
    html: at(200, 140, editor('cat', { cursor: 2, cls: 'big' })) + circle(184, 126, 254, 84) + at(470, 106, ink('记着！', { c: 'red', to: [434, 140] })),
  },
  {
    beat: 11,
    pic: 'c、a、t 从编辑器里落下来，变成一列印刷的格子；主角光标跳出编辑器，停在格子右端',
    html: at(200, 60, editor('cat', { cursor: 2, cls: 'sm dim' })) + at(200, 150, cells(['c', 'a', 't'], { arrows: true, cls: ['new', 'new', 'new'] })) + hero(384, 154, 30),
  },
  {
    beat: 12,
    dark: true,
    pic: '【暗场】硬切到深墨绿底：大字"线性表"，下面一排浅色格子 c → a → t；光标停在"线性表"后面',
    html: `<div class="dk"><div class="dk-big">线性表</div>${cells(['c', 'a', 't'], { arrows: true })}<div class="dk-sub">一个字符接一个字符，排成一列</div></div>` + hero(398, 104, 44),
  },
  {
    beat: 13,
    dark: true,
    pic: '【暗场】大字"编辑器 1.0"，下面小字"用 C 亲手做出编辑器的第一版"',
    html: darkTitle('编辑器 1.0', '目标：用 C 亲手做出编辑器的第一版'),
  },
  {
    beat: 16,
    pic: '切回纸面。编辑器旁一个"程序"齿轮转起来；手写"程序在背后干活"，箭头指向齿轮',
    html: at(140, 150, editor('cat', { cursor: 2, cls: 'big' })) + at(400, 140, `<div class="gear new">⚙<div>程序</div></div>`) + at(430, 240, ink('程序在背后干活', { to: [418, 196] })),
  },
  { beat: 17, pic: '问题卡（纸片）第1行；光标停在这一行前面', html: at(130, 90, qcard({ show: 1, cls: 'big', hi: 0 })) + hero(116, 124, 26) },
  { beat: 18, pic: '问题卡第2行；光标下移一行', html: at(130, 90, qcard({ show: 2, cls: 'big', hi: 1 })) + hero(116, 156, 26) },
  { beat: 19, pic: '问题卡第3行；光标下移一行', html: at(130, 90, qcard({ show: 3, cls: 'big', hi: 2 })) + hero(116, 188, 26) },
  {
    beat: 20,
    pic: '问题卡缩成一张纸条，用胶带贴到右上角，第1行荧光笔高亮；光标跟过去停在第1行；手写"先记住，从第一个开始"，箭头指向纸条',
    html: QC.replace('qc corner', 'qc corner new') + qcHero(0) + at(150, 170, ink('先记住这三个问题，从第一个开始', { to: [456, 47] })),
  },

  // ───────── 第1屏　什么是线性表 ─────────
  {
    beat: 21,
    lead: darkTitle('什么是线性表'),
    pic: '【前半拍暗场】大字"什么是线性表"，硬切回纸面：标题；手风琴纸片出现，展开"定义"行，里面是 c、a、t 三格；光标停在"定义"行左边',
    html: T + QC + at(24, 50, acc({ open: 0, cls: { 0: 'new' }, body: defRow(at(20, 40, cells(['c', 'a', 't']))) })) + rowHero(0),
  },
  {
    beat: 22,
    pic: 'c、a、t 三格变成一串空白格 □□□…□；右边手写"n 个，排成一列"，箭头指向格子',
    html: T + QC + at(24, 50, acc({ open: 0, body: defRow(at(20, 40, cells(blank, { cls: ['new', 'new', 'new', 'new', 'new'] }))) })) + rowHero(0) + at(430, 150, ink('n 个，排成一列', { to: [243, 141] })),
  },
  {
    beat: 24,
    pic: '格子下方出现大括号，标"长度 n"（印刷）',
    html: T + QC + at(24, 50, acc({ open: 0, body: defRow(at(20, 40, cells(blank)) + at(20, 92, `<div class="brace new">└──── 长度 n ────┘</div>`)) })) + rowHero(0),
  },
  {
    beat: 25,
    pic: '格子下方依次出现编号 0、1 … n−1；下面一行 (a₀, a₁, …, aₙ₋₁)',
    html: T + QC + at(24, 50, acc({ open: 0, body: defRow(at(20, 30, cells(blank, { idx: nIdx, cls: ['new', 'new', 'new', '', 'new'] })) + at(20, 104, note('(a₀, a₁, …, aₙ₋₁)', 'new'))) })) + rowHero(0),
  },
  {
    beat: 26,
    pic: 'a₀ 和 aₙ₋₁ 两格荧光笔高亮；右边手写"第一个和最后一个"，箭头指向末格',
    html:
      T + QC +
      at(24, 50, acc({ open: 0, body: defRow(at(20, 30, cells(blank, { idx: nIdx, top: ['a₀', '', '', '', 'aₙ₋₁'], cls: ['hl new', '', '', '', 'hl new'] })) + at(20, 104, note('(a₀, a₁, …, aₙ₋₁)'))) })) +
      rowHero(0) + at(430, 150, ink('第一个和最后一个', { to: [246, 131] })),
  },
  {
    beat: 27,
    pic: '空白格换回 c、a、t，下面一行变成 (c, a, t)',
    html: T + QC + at(24, 50, acc({ open: 0, body: defRow(at(20, 30, cells(['c', 'a', 't'], { idx: ['0', '1', '2'], cls: ['new', 'new', 'new'] })) + at(20, 104, note('(c, a, t)', 'new'))) })) + rowHero(0),
  },
  {
    beat: 28,
    pic: '格子旁出现印刷标签"长度 3"',
    html: T + QC + at(24, 50, acc({ open: 0, body: defRow(at(20, 30, cells(['c', 'a', 't'], { idx: ['0', '1', '2'] })) + at(20, 104, note('(c, a, t)')) + at(170, 40, tag('长度 3', 'new'))) })) + rowHero(0),
  },
  {
    beat: 29,
    pic: '"定义"行收起成"(c, a, t)　长度 3"；右边手写"四个要点，逐条看"，箭头指向下面四行；光标停在"同类型"行',
    html: T + QC + at(24, 50, acc({ open: -1, sum: SUM.slice(0, 1), cls: { 0: 'new' } })) + rowHero(1) + at(430, 150, ink('四个要点，逐条看', { to: [300, 100] })),
  },
  {
    beat: 30,
    pic: '展开"同类型"：c、a、t 三格上方印着"字符"；右边手写"都是同一种东西"',
    html: T + QC + at(24, 50, acc({ open: 1, sum: SUM, cls: { 1: 'new' }, body: defRow(at(20, 30, cells(['c', 'a', 't'], { top: ['字符', '字符', '字符'] }))) })) + rowHero(1) + at(430, 160, ink('都是同一种东西', { to: [174, 159] })),
  },
  {
    beat: 32,
    pic: '一张写着 7 的小纸片和一张图片纸片想挤进格子，被弹开、歪着停住，红笔打 ✗；右边手写红字"挤不进来"',
    html:
      T + QC +
      at(24, 50, acc({ open: 1, sum: SUM, body: defRow(at(20, 30, cells(['c', 'a', 't'], { top: ['字符', '字符', '字符'] }))) })) +
      at(250, 150, `<span class="chip new" style="--r:-9deg">7</span><span class="chip new" style="--r:7deg">🖼</span>`) +
      at(268, 186, ink('✗', { c: 'red' })) + at(318, 186, ink('✗', { c: 'red' })) +
      rowHero(1) + at(440, 200, ink('整数、图片：挤不进来', { c: 'red', to: [341, 166] })),
  },
  {
    beat: 33,
    pic: '一排一模一样的格子；右边手写"只放字符"',
    html: T + QC + at(24, 50, acc({ open: 1, sum: SUM, body: defRow(at(20, 40, cells(['', '', '', '', '', ''], { cls: Array(6).fill('new') }))) })) + rowHero(1) + at(430, 170, ink('只准备一种格子，只放字符', { to: [279, 169] })),
  },
  {
    beat: 34,
    pic: '"同类型"行收起；展开"一个接一个"：c → a → t 出现箭头；光标下移到这一行',
    html: T + QC + at(24, 50, acc({ open: 2, sum: SUM, cls: { 1: 'new', 2: 'new' }, body: defRow(at(20, 40, cells(['c', 'a', 't'], { arrows: true }))) })) + rowHero(2),
  },
  { beat: 35, pic: '高亮 a，c 上方印"前驱"', html: T + QC + at(24, 50, acc({ open: 2, sum: SUM, body: defRow(at(20, 40, cells(['c', 'a', 't'], { arrows: true, top: ['前驱', '', ''], cls: ['new', 'hl', ''] }))) })) + rowHero(2) },
  { beat: 36, pic: 't 上方印"后继"', html: T + QC + at(24, 50, acc({ open: 2, sum: SUM, body: defRow(at(20, 40, cells(['c', 'a', 't'], { arrows: true, top: ['前驱', '', '后继'], cls: ['', 'hl', 'new'] }))) })) + rowHero(2) },
  { beat: 37, pic: 'c 下方印"无前驱"', html: T + QC + at(24, 50, acc({ open: 2, sum: SUM, body: defRow(at(20, 40, cells(['c', 'a', 't'], { arrows: true, idx: ['无前驱', '', ''], cls: ['new', '', ''] }))) })) + rowHero(2) },
  { beat: 38, pic: 't 下方印"无后继"', html: T + QC + at(24, 50, acc({ open: 2, sum: SUM, body: defRow(at(20, 40, cells(['c', 'a', 't'], { arrows: true, idx: ['无前驱', '', '无后继'], cls: ['', '', 'new'] }))) })) + rowHero(2) },
  {
    beat: 39,
    pic: 'cat 和 act 并排，中间一个红色 ≠；红笔圈住 ≠',
    html: T + QC + at(24, 50, acc({ open: 2, sum: SUM, body: defRow(at(20, 40, editor('cat', { cursor: -1 }) + '<span class="neq new">≠</span>' + editor('act', { cursor: -1 }))) })) + rowHero(2) + circle(178, 146, 44, 44),
  },
  {
    beat: 41,
    pic: '左边一张小纸片"程序只记了：c、a、t 各一个"；右边列出 cat、act、tca，各打一个 ?；右边手写红字"该显示哪一行？"',
    html:
      T + QC +
      at(24, 50, acc({ open: 2, sum: SUM, body: defRow(at(10, 14, card('<div class="mini">程序只记了</div>c、a、t 各一个', 'new', 'width:120px;font-size:13px')) + at(150, 34, '<span class="arr">→</span>') + at(206, 0, candidates())) })) +
      rowHero(2) + at(440, 220, ink('该显示哪一行？', { c: 'red', to: [337, 182] })),
  },
  {
    beat: 42,
    pic: '左边换成 c → a → t；右边只剩 cat 打 ✓，act、tca 划掉；手写"还得记住谁在谁前面"',
    html:
      T + QC +
      at(24, 50, acc({ open: 2, sum: SUM, body: defRow(at(10, 30, cells(['c', 'a', 't'], { arrows: true, size: 30, cls: ['new', 'new', 'new'] })) + at(10, 72, note('记住先后')) + at(206, 0, candidates(true))) })) +
      rowHero(2) + at(430, 230, ink('还得记住谁在谁前面', { to: [190, 198] })),
  },
  {
    beat: 43,
    pic: '"一个接一个"行收起成"c → a → t"；展开"个数有限"：只有光标的编辑器，旁边印 ()、长度 0；光标下移',
    html: T + QC + at(24, 50, acc({ open: 3, sum: SUM, cls: { 2: 'new', 3: 'new' }, body: defRow(at(20, 30, editor('', { cls: 'sm' })) + at(150, 36, tag('()　长度 0'))) })) + rowHero(3),
  },
  {
    beat: 45,
    pic: '() 旁手写蓝字"空表"，箭头指向 ()',
    html: T + QC + at(24, 50, acc({ open: 3, sum: SUM, body: defRow(at(20, 30, editor('', { cls: 'sm' })) + at(150, 36, tag('()　长度 0'))) })) + rowHero(3) + at(440, 210, ink('这叫空表', { c: 'blue', to: [268, 214] })),
  },
  {
    beat: 47,
    reveal: 'spread',
    pic: '依次敲 c、a、t，长度计数从 0 变到 1、2、3；手写"看长度！"，箭头指向计数',
    html:
      T + QC +
      at(24, 50, acc({ open: 3, sum: SUM, body: defRow(at(20, 20, ['c', 'ca', 'cat'].map((s) => editor(s, { cls: 'sm new' })).join('')) + at(20, 80, `<div class="counter new">长度 0 → 1 → 2 → 3</div>`)) })) +
      rowHero(3) + at(440, 250, ink('显示到哪里为止，看长度', { to: [224, 258] })),
  },
  {
    beat: 50,
    pic: '"个数有限"行收起成"长度 0 → 3"；展开"可以重复"：book 四格，两个 o 荧光笔高亮；光标下移',
    html: T + QC + at(24, 50, acc({ open: 4, sum: SUM, cls: { 3: 'new', 4: 'new' }, body: defRow(at(20, 40, cells(['b', 'o', 'o', 'k'], { cls: ['', 'hl', 'hl', ''] }))) })) + rowHero(4),
  },
  {
    beat: 52,
    pic: '两个 o 下方印"第1个""第2个"；右边手写"一样的字符，各占一个位置"',
    html: T + QC + at(24, 50, acc({ open: 4, sum: SUM, body: defRow(at(20, 40, cells(['b', 'o', 'o', 'k'], { idx: ['', '第1个', '第2个', ''], cls: ['', 'hl new', 'hl new', ''] }))) })) + rowHero(4) + at(430, 200, ink('一样的字符，各占一个位置', { to: [140, 270] })),
  },
  {
    beat: 54,
    pic: '"可以重复"行收起；五行全部收起，成为总结图；问题卡第1行放大成纸片摆在右边；光标停在它前面',
    html: T + at(24, 50, acc({ open: -1, sum: SUM, cls: { 4: 'new' } })) + at(400, 120, qcard({ show: 1, hi: 0, cls: 'new mid' })) + hero(388, 150, 20),
  },
  {
    beat: 57,
    pic: '总结图里"定义""一个接一个""个数有限"三行手写打勾；手写"元素 · 先后 · 个数"，箭头指向问题卡',
    html: T + at(24, 50, acc({ open: -1, sum: SUM, tick: [0, 2, 3], cls: { 0: 'new', 2: 'new', 3: 'new' } })) + at(400, 120, qcard({ show: 1, hi: 0, cls: 'mid' })) + hero(388, 150, 20) + at(404, 236, ink('元素 · 先后 · 个数', { to: [500, 180] })),
  },
  { beat: 58, pic: '问题卡第1行手写打勾', html: T + at(24, 50, acc({ open: -1, sum: SUM, tick: [0, 2, 3] })) + at(400, 120, qcard({ show: 1, done: [0], cls: 'new mid' })) + hero(388, 150, 20) },

  // ───────── 第2屏　例题 ─────────
  { beat: 59, pic: '标题；两张纸片落下；光标停在标题前', html: exampleFrame({ lcard: 'new', rcard: 'new' }) + hero(12, 16, 26) },
  { beat: 60, pic: '左卡：通话记录列表，印"从新到旧"；光标移到左卡', html: exampleFrame({ left: callLog({ cls: 'new' }) }) + exHero(0, -1) },
  { beat: 61, pic: '右卡：一棵家谱树；光标移到右卡', html: exampleFrame({ right: tree({}).replace('class="tree ', 'class="tree new ') }) + exHero(1, -1) },
  { beat: 62, pic: '左卡荧光笔高亮，开始检查', html: exampleFrame({ lcard: 'hl' }) + exHero(0, -1) },
  { beat: 63, pic: '左卡第一行"同类型"手写 ✓；光标停在这一行', html: exampleFrame({ lcard: 'hl', lm: ['✓'], lcls: ['new'] }) + exHero(0, 0) },
  { beat: 64, pic: '记录之间出现箭头；光标移到第二行', html: exampleFrame({ lcard: 'hl', left: callLog({ arrows: true }), lm: ['✓'] }) + exHero(0, 1) },
  { beat: 65, pic: '中间两条记录旁印"前驱/后继各一"', html: exampleFrame({ lcard: 'hl', left: callLog({ arrows: true, mark: true }), lm: ['✓'] }) + exHero(0, 1) },
  { beat: 66, pic: '第二行"一个接一个"手写 ✓', html: exampleFrame({ lcard: 'hl', left: callLog({ arrows: true }), lm: ['✓', '✓'], lcls: ['', 'new'] }) + exHero(0, 1) },
  { beat: 67, pic: '第三行"个数有限"手写 ✓；光标下移', html: exampleFrame({ lcard: 'hl', left: callLog({ arrows: true }), lm: ['✓', '✓', '✓'], lcls: ['', '', 'new'] }) + exHero(0, 2) },
  { beat: 68, pic: '右卡荧光笔高亮；光标移到右卡', html: exampleFrame({ rcard: 'hl', left: callLog({ arrows: true }), lm: ['✓', '✓', '✓'] }) + exHero(1, -1) },
  { beat: 69, pic: '右卡第一行"同类型"手写 ✓', html: exampleFrame({ rcard: 'hl', left: callLog({ arrows: true }), lm: ['✓', '✓', '✓'], rm: ['✓'], rcls: ['new'] }) + exHero(1, 0) },
  { beat: 70, pic: '家谱上下两代之间出现连线；光标移到第二行', html: exampleFrame({ rcard: 'hl', left: callLog({ arrows: true }), right: tree({ arrows: true }), lm: ['✓', '✓', '✓'], rm: ['✓'] }) + exHero(1, 1) },
  { beat: 71, pic: '一个人下面分出三个孩子，三条连线一起变红', html: exampleFrame({ rcard: 'hl', left: callLog({ arrows: true }), right: tree({ hi: true }), lm: ['✓', '✓', '✓'], rm: ['✓'] }) + exHero(1, 1) },
  { beat: 72, pic: '第二行"一个接一个"手写红 ✗', html: exampleFrame({ rcard: 'hl', left: callLog({ arrows: true }), right: tree({ hi: true }), lm: ['✓', '✓', '✓'], rm: ['✓', '✗'], rcls: ['', 'new'] }) + exHero(1, 1) },
  { beat: 73, pic: '第三行变灰；光标下移', html: exampleFrame({ rcard: 'hl', left: callLog({ arrows: true }), right: tree({ hi: true }), lm: ['✓', '✓', '✓'], rm: ['✓', '✗'], rcls: ['', '', 'dim'] }) + exHero(1, 2) },
  {
    beat: 74,
    pic: '两张卡的右上角各盖一枚图章：左卡绿章"✓ 线性表"，右卡红章"✗ 不是线性表"',
    html:
      exampleFrame({ left: callLog({ arrows: true }), right: tree({ hi: true }), lm: ['✓', '✓', '✓'], rm: ['✓', '✗'], rcls: ['', '', 'dim'] }) +
      at(196, 58, stamp('✓ 线性表')) + at(452, 58, stamp('✗ 不是线性表', false)),
  },
  {
    beat: 76,
    pic: '两张卡的第二行荧光笔高亮，其余变灰；底部手写红字"差别只在这一行"，箭头指向两卡之间',
    html:
      exampleFrame({ left: callLog({ arrows: true }), right: tree({ hi: true }), lm: ['✓', '✓', '✓'], rm: ['✓', '✗'], lcls: ['dim', 'hl new', 'dim'], rcls: ['dim', 'hl new', 'dim'] }) +
      at(196, 58, stamp('✓ 线性表')) + at(452, 58, stamp('✗ 不是线性表', false)) +
      at(220, 326, ink('差别只在：是不是一个接一个', { c: 'red', to: [282, 262] })),
  },

  // ───────── 第3屏　练习1 ─────────
  { beat: 77, pic: '左边贴一张便利贴"判断的办法"；右边练习纸片和七个选项；光标停在"检查"按钮旁', html: at(24, 50, rule.replace('class="sticky"', 'class="sticky new"')) + at(230, 20, quiz1('new')) + hero(530, 247, 20) },
  { after: 79, pic: '**暂停，等学生作答**；作答后每个选项下面显示解析，不配旁白', html: at(24, 50, rule) + at(230, 20, quiz1()) + hero(530, 247, 20) + pause('等学生作答；作答后每个选项下显示解析，不配旁白') },

  // ───────── 第4屏　练习2 ─────────
  { beat: 80, pic: '练习纸片出现；光标停在"检查"按钮旁', html: at(110, 50, quiz2('new')) + hero(470, 192, 20) },
  { after: 81, pic: '**暂停，等学生作答**；作答后显示选项解析', html: at(110, 50, quiz2()) + hero(470, 192, 20) + pause('等学生作答；作答后显示选项解析') },
  {
    beat: 82,
    pic: '一张便利贴"有序 ≠ 排好序"贴上来，红笔圈住 ≠',
    html: at(170, 110, sticky('💡 有序 ≠ 排好序<br><span style="font-size:14px">有序：位置有先后　不是：按大小排好</span>', 'width:300px;font-size:22px').replace('class="sticky"', 'class="sticky new"')) + circle(262, 112, 40, 40),
  },
  {
    beat: 84,
    pic: '(c, a, t) 和 (a, c, t) 两排格子并排，都手写 ✓，中间一个 ≠；手写红字"位置不同，表就不同"',
    html:
      at(110, 140, cells(['c', 'a', 't'], { idx: ['0', '1', '2'] })) + at(228, 144, '<b class="okm big">✓</b>') + at(290, 136, '<span class="neq new">≠</span>') +
      at(360, 140, cells(['a', 'c', 't'], { idx: ['0', '1', '2'] })) + at(478, 144, '<b class="okm big">✓</b>') +
      at(200, 250, ink('同样三个字符，位置不同，表就不同', { c: 'red', to: [311, 181] })),
  },

  // ───────── 第5屏　节尾 ─────────
  {
    beat: 87,
    lead: darkTitle('线性表', '同类型 · 一个接一个 · 个数有限 · 可以重复'),
    pic: '【前半拍暗场】大字"线性表"和四个要点，硬切回纸面："到这里你有了"纸片，四个要点各手写一个 ✓；光标停在纸片标题前',
    html:
      at(120, 70, card('<div class="qz-h">到这里你有了</div>线性表的定义和四个要点：<div class="pts">' +
        ['同类型', '一个接一个', '个数有限', '可以重复'].map((s) => `<span class="tag new">${s}</span><b class="okm">✓</b>`).join(' ') +
        '</div>屏幕上的一行字，可以看成一个字符的线性表。', '', 'width:440px')) + hero(106, 78, 22),
  },
  {
    beat: 90,
    pic: '"下一步"纸片；角落纸条的第1行已打勾，第2行荧光笔高亮；光标移到第2行前',
    html: at(120, 110, card('<div class="qz-h">下一步</div>编辑器要对这一行字做哪些事？', 'new', 'width:300px')) + qcard({ corner: true, hi: 1, done: [0] }) + qcHero(1),
  },
]
