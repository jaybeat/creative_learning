// 2.1 双栏稿（docs/course/2-1.md）的分镜帧。
// 每帧从 beat 这一拍开始，覆盖到下一帧之前的所有拍（双栏稿里画面写"同上"的拍）。
// after 表示双栏稿里"暂停，等学生作答"那一行，放在第 after 拍之后。
// reveal: 'spread'：这一帧新出现的元素（带 new 的）在整帧旁白里按顺序逐个出现，默认是一起出现。
import { at, title, tag, note, editor, cells, qcard, acc, SUM, checks, card, pause } from './kit'

export type Frame = { beat: number; html: string; reveal?: 'spread' } | { after: number; html: string }

/** 播放器里的练习题：按顺序对应双栏稿里的暂停行，题目直接从书稿这一节的 `::: quiz` 读 */
export const quizSource = { file: 'book/chapters/ch02.md', section: '2.1' }

/** 配音念法：按拍号覆盖旁白文字（只影响配音，不影响字幕） */
export const say: Record<number, string> = {}

const blank = ['', '', '', '…', '']
const nIdx = ['0', '1', '2', '', 'n−1']
const QC = qcard({ corner: true, hi: 0 }) // 第1屏起角落里的问题卡

// —— 第1屏用到的展开行内容 ——
const defRow = (inner: string) => `<div class="rel" style="height:132px">${inner}</div>`

// 只记得有哪几个字符时，能排出的几行（拍41）；记住先后后只剩 cat（拍42）
const candidates = (decided = false) =>
  `<div class="cands">${['cat', 'act', 'tca']
    .map((s, i) => {
      if (!decided) return `<div>${editor(s, { cursor: -1, cls: 'sm new' })}<b class="nom">?</b></div>`
      return i === 0
        ? `<div>${editor(s, { cursor: -1, cls: 'sm hl new' })}<b class="okm">✓</b></div>`
        : `<div class="dim strike">${editor(s, { cursor: -1, cls: 'sm' })}</div>`
    })
    .join('')}</div>`

// —— 第2屏：例题两张卡片 ——
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

export const frames: Frame[] = [
  // ───────── 第0屏　章首开场 ─────────
  {
    beat: 1,
    reveal: 'spread',
    html:
      at(170, 60, `<div class="inp new">🔍 搜索<span class="cur">|</span></div>`) +
      at(170, 130, `<div class="inp new">说点什么…<span class="cur">|</span></div>`) +
      at(170, 200, `<div class="inp new">新建文本文档<span class="cur">|</span>.txt</div>`) +
      at(470, 72, note('搜索框')) + at(470, 142, note('聊天框')) + at(470, 212, note('文件名框')),
  },
  { beat: 3, html: title('第2章 线性表') + at(170, 150, editor('', { cls: 'new big' })) + at(250, 210, note('← 光标', 'new')) },
  {
    beat: 5,
    reveal: 'spread',
    html:
      // 按一个键、出现一行，依次排：c → c|，a → ca|，t → cat|
      [['c', 'c', 60], ['a', 'ca', 230], ['t', 'cat', 400]]
        .map(([k, s, x]) => at((x as number) + 40, 90, `<div class="keys"><span class="key new">${k}</span></div>`) + at(x as number, 160, editor(s as string, { cls: 'new' })))
        .join(''),
  },
  { beat: 6, html: at(200, 150, editor('cat', { cursor: 2, cls: 'big new' })) + at(240, 220, note('← 光标左移一格')) },
  { beat: 7, html: at(200, 150, editor('caxt', { cursor: 3, cls: 'big', hi: [2] })) + at(240, 220, note('敲 x', 'new')) },
  { beat: 8, html: at(200, 150, editor('cat', { cursor: 2, cls: 'big new' })) + at(240, 220, note('退格：x 删掉')) },
  {
    beat: 9,
    reveal: 'spread',
    html:
      at(24, 40, note('每做一个动作，整行重新显示一次')) +
      at(24, 80, ['', 'c', 'ca', 'cat'].map((s) => editor(s, { cls: 'sm flash new' })).join('')) +
      at(24, 170, [['cat', 2], ['caxt', 3], ['cat', 2]].map(([s, c]) => editor(s as string, { cursor: c as number, cls: 'sm flash new' })).join('')),
  },
  { beat: 10, html: at(200, 140, `<div class="dash new">${editor('cat', { cursor: 2, cls: 'big' })}<span class="dl">记着</span></div>`) },
  { beat: 11, html: at(200, 60, editor('cat', { cursor: 2, cls: 'sm dim' })) + at(200, 150, cells(['c', 'a', 't'], { arrows: true, cls: ['new', 'new', 'new'] })) },
  { beat: 12, html: at(200, 60, editor('cat', { cursor: 2, cls: 'sm dim' })) + at(200, 150, cells(['c', 'a', 't'], { arrows: true })) + at(420, 158, tag('线性表', 'new big')) },
  { beat: 13, html: at(150, 120, card('<div class="goal">🎯 目标：用 C 亲手做出编辑器的第一版<br><b>编辑器1.0</b></div>', 'new', 'width:340px')) },
  { beat: 16, html: at(140, 150, editor('cat', { cursor: 2, cls: 'big' })) + at(400, 140, `<div class="gear new">⚙<div>程序</div></div>`) },
  { beat: 17, html: at(130, 90, qcard({ show: 1, cls: 'big', hi: 0 })) },
  { beat: 18, html: at(130, 90, qcard({ show: 2, cls: 'big', hi: 1 })) },
  { beat: 19, html: at(130, 90, qcard({ show: 3, cls: 'big', hi: 2 })) },
  { beat: 20, html: QC.replace('qc corner', 'qc corner new') + at(170, 160, note('先记住这三个问题，从第一个开始')) },

  // ───────── 第1屏　什么是线性表 ─────────
  { beat: 21, html: title('什么是线性表') + QC + at(24, 50, acc({ open: 0, cls: { 0: 'new' }, body: defRow(at(20, 40, cells(['c', 'a', 't']))) })) },
  { beat: 22, html: title('什么是线性表') + QC + at(24, 50, acc({ open: 0, body: defRow(at(20, 40, cells(blank, { cls: ['new', 'new', 'new', 'new', 'new'] })) + at(240, 52, note('n 个同类型的元素排成一列'))) })) },
  {
    beat: 24,
    html: title('什么是线性表') + QC + at(24, 50, acc({ open: 0, body: defRow(at(20, 40, cells(blank)) + at(20, 92, `<div class="brace new">└──── 长度 n ────┘</div>`)) })),
  },
  {
    beat: 25,
    html:
      title('什么是线性表') + QC +
      at(24, 50, acc({ open: 0, body: defRow(at(20, 30, cells(blank, { idx: nIdx, cls: ['new', 'new', 'new', '', 'new'] })) + at(20, 104, note('(a₀, a₁, …, aₙ₋₁)', 'new'))) })),
  },
  {
    beat: 26,
    html:
      title('什么是线性表') + QC +
      at(24, 50, acc({ open: 0, body: defRow(at(20, 30, cells(blank, { idx: nIdx, top: ['a₀', '', '', '', 'aₙ₋₁'], cls: ['hl new', '', '', '', 'hl new'] })) + at(20, 104, note('(a₀, a₁, …, aₙ₋₁)'))) })),
  },
  {
    beat: 27,
    html: title('什么是线性表') + QC + at(24, 50, acc({ open: 0, body: defRow(at(20, 30, cells(['c', 'a', 't'], { idx: ['0', '1', '2'], cls: ['new', 'new', 'new'] })) + at(20, 104, note('(c, a, t)', 'new'))) })),
  },
  {
    beat: 28,
    html: title('什么是线性表') + QC + at(24, 50, acc({ open: 0, body: defRow(at(20, 30, cells(['c', 'a', 't'], { idx: ['0', '1', '2'] })) + at(20, 104, note('(c, a, t)')) + at(170, 40, tag('长度 3', 'new'))) })),
  },
  { beat: 29, html: title('什么是线性表') + QC + at(24, 50, acc({ open: -1, sum: SUM.slice(0, 1), cls: { 0: 'new' } })) + at(24, 230, note('四个要点，逐条看')) },
  {
    beat: 30,
    html: title('什么是线性表') + QC + at(24, 50, acc({ open: 1, sum: SUM, cls: { 1: 'new' }, body: defRow(at(20, 30, cells(['c', 'a', 't'], { top: ['字符', '字符', '字符'] })) + at(200, 40, note('都是同一种东西'))) })),
  },
  {
    beat: 32,
    html:
      title('什么是线性表') + QC +
      at(24, 50, acc({ open: 1, sum: SUM, body: defRow(at(20, 30, cells(['c', 'a', 't'], { top: ['字符', '字符', '字符'] })) + at(200, 30, `<span class="bounce new">7 ✗</span><span class="bounce new">🖼 ✗</span>`) + at(200, 80, note('整数、图片：挤不进来'))) })),
  },
  {
    beat: 33,
    html: title('什么是线性表') + QC + at(24, 50, acc({ open: 1, sum: SUM, body: defRow(at(20, 40, cells(['', '', '', '', '', ''], { cls: Array(6).fill('new') })) + at(20, 100, note('只准备一种格子，专门放字符'))) })),
  },
  { beat: 34, html: title('什么是线性表') + QC + at(24, 50, acc({ open: 2, sum: SUM, cls: { 1: 'new', 2: 'new' }, body: defRow(at(20, 40, cells(['c', 'a', 't'], { arrows: true })))  })) },
  { beat: 35, html: title('什么是线性表') + QC + at(24, 50, acc({ open: 2, sum: SUM, body: defRow(at(20, 40, cells(['c', 'a', 't'], { arrows: true, top: ['前驱', '', ''], cls: ['new', 'hl', ''] })))  })) },
  { beat: 36, html: title('什么是线性表') + QC + at(24, 50, acc({ open: 2, sum: SUM, body: defRow(at(20, 40, cells(['c', 'a', 't'], { arrows: true, top: ['前驱', '', '后继'], cls: ['', 'hl', 'new'] })))  })) },
  { beat: 37, html: title('什么是线性表') + QC + at(24, 50, acc({ open: 2, sum: SUM, body: defRow(at(20, 40, cells(['c', 'a', 't'], { arrows: true, idx: ['无前驱', '', ''], cls: ['new', '', ''] })))  })) },
  { beat: 38, html: title('什么是线性表') + QC + at(24, 50, acc({ open: 2, sum: SUM, body: defRow(at(20, 40, cells(['c', 'a', 't'], { arrows: true, idx: ['无前驱', '', '无后继'], cls: ['', '', 'new'] })))  })) },
  { beat: 39, html: title('什么是线性表') + QC + at(24, 50, acc({ open: 2, sum: SUM, body: defRow(at(20, 40, editor('cat', { cursor: -1 }) + '<span class="neq new">≠</span>' + editor('act', { cursor: -1 }))) })) },
  {
    beat: 41,
    html:
      title('什么是线性表') + QC +
      at(24, 50, acc({ open: 2, sum: SUM, body: defRow(at(10, 14, card('<div class="mini">程序只记了</div>c、a、t 各一个', 'new', 'width:120px;font-size:13px')) + at(150, 34, '<span class="arr">→</span>') + at(206, 0, candidates()) + at(10, 108, note('三个字符能排出好几行，该显示哪一行？'))) })),
  },
  {
    beat: 42,
    html:
      title('什么是线性表') + QC +
      at(24, 50, acc({ open: 2, sum: SUM, body: defRow(at(10, 30, cells(['c', 'a', 't'], { arrows: true, size: 30, cls: ['new', 'new', 'new'] })) + at(10, 72, note('记住先后')) + at(206, 0, candidates(true)) + at(10, 108, note('还得记住谁在谁前面'))) })),
  },
  {
    beat: 43,
    html: title('什么是线性表') + QC + at(24, 50, acc({ open: 3, sum: SUM, cls: { 2: 'new', 3: 'new' }, body: defRow(at(20, 30, editor('', { cls: 'sm' })) + at(150, 36, tag('()　长度 0'))) })),
  },
  { beat: 45, html: title('什么是线性表') + QC + at(24, 50, acc({ open: 3, sum: SUM, body: defRow(at(20, 30, editor('', { cls: 'sm' })) + at(150, 36, tag('()　长度 0')) + at(270, 36, tag('空表', 'new'))) })) },
  {
    beat: 47,
    reveal: 'spread',
    html:
      title('什么是线性表') + QC +
      at(24, 50, acc({ open: 3, sum: SUM, body: defRow(at(20, 20, ['c', 'ca', 'cat'].map((s) => editor(s, { cls: 'sm new' })).join('')) + at(20, 80, `<div class="counter new">长度 0 → 1 → 2 → 3</div>`) + at(20, 106, note('显示到哪里为止，看长度'))) })),
  },
  {
    beat: 50,
    html: title('什么是线性表') + QC + at(24, 50, acc({ open: 4, sum: SUM, cls: { 3: 'new', 4: 'new' }, body: defRow(at(20, 40, cells(['b', 'o', 'o', 'k'], { cls: ['', 'hl', 'hl', ''] }))) })),
  },
  { beat: 52, html: title('什么是线性表') + QC + at(24, 50, acc({ open: 4, sum: SUM, body: defRow(at(20, 40, cells(['b', 'o', 'o', 'k'], { idx: ['', '第1个', '第2个', ''], cls: ['', 'hl new', 'hl new', ''] }))) })) },
  {
    beat: 54,
    html: title('什么是线性表') + at(24, 50, acc({ open: -1, sum: SUM, cls: { 4: 'new' } })) + at(400, 120, qcard({ show: 1, hi: 0, cls: 'new mid' })),
  },
  { beat: 57, html: title('什么是线性表') + at(24, 50, acc({ open: -1, sum: SUM, tick: [0, 2, 3], cls: { 0: 'new', 2: 'new', 3: 'new' } })) + at(400, 120, qcard({ show: 1, hi: 0, cls: 'mid' })) + at(400, 240, note('元素 · 先后 · 个数')) },
  { beat: 58, html: title('什么是线性表') + at(24, 50, acc({ open: -1, sum: SUM, tick: [0, 2, 3] })) + at(400, 120, qcard({ show: 1, done: [0], cls: 'new mid' })) },

  // ───────── 第2屏　例题 ─────────
  { beat: 59, html: exampleFrame({ lcard: 'new', rcard: 'new' }) },
  { beat: 60, html: exampleFrame({ left: callLog({ cls: 'new' }) }) },
  { beat: 61, html: exampleFrame({ right: tree({}).replace('class="tree ', 'class="tree new ') }) },
  { beat: 62, html: exampleFrame({ lcard: 'hl' }) },
  { beat: 63, html: exampleFrame({ lcard: 'hl', lm: ['✓'], lcls: ['new'] }) },
  { beat: 64, html: exampleFrame({ lcard: 'hl', left: callLog({ arrows: true }), lm: ['✓'] }) },
  { beat: 65, html: exampleFrame({ lcard: 'hl', left: callLog({ arrows: true, mark: true }), lm: ['✓'] }) },
  { beat: 66, html: exampleFrame({ lcard: 'hl', left: callLog({ arrows: true }), lm: ['✓', '✓'], lcls: ['', 'new'] }) },
  { beat: 67, html: exampleFrame({ lcard: 'hl', left: callLog({ arrows: true }), lm: ['✓', '✓', '✓'], lcls: ['', '', 'new'] }) },
  { beat: 68, html: exampleFrame({ rcard: 'hl', left: callLog({ arrows: true }), lm: ['✓', '✓', '✓'] }) },
  { beat: 69, html: exampleFrame({ rcard: 'hl', left: callLog({ arrows: true }), lm: ['✓', '✓', '✓'], rm: ['✓'], rcls: ['new'] }) },
  { beat: 70, html: exampleFrame({ rcard: 'hl', left: callLog({ arrows: true }), right: tree({ arrows: true }), lm: ['✓', '✓', '✓'], rm: ['✓'] }) },
  { beat: 71, html: exampleFrame({ rcard: 'hl', left: callLog({ arrows: true }), right: tree({ hi: true }), lm: ['✓', '✓', '✓'], rm: ['✓'] }) },
  { beat: 72, html: exampleFrame({ rcard: 'hl', left: callLog({ arrows: true }), right: tree({ hi: true }), lm: ['✓', '✓', '✓'], rm: ['✓', '✗'], rcls: ['', 'new'] }) },
  { beat: 73, html: exampleFrame({ rcard: 'hl', left: callLog({ arrows: true }), right: tree({ hi: true }), lm: ['✓', '✓', '✓'], rm: ['✓', '✗'], rcls: ['', '', 'dim'] }) },
  {
    beat: 74,
    html:
      exampleFrame({ left: callLog({ arrows: true }), right: tree({ hi: true }), lm: ['✓', '✓', '✓'], rm: ['✓', '✗'], rcls: ['', '', 'dim'] }) +
      at(130, 318, card('答案：通话记录 <b class="okm">✓</b> 线性表　　家谱 <b class="nom">✗</b> 不是一个接一个', 'new', 'padding:4px 12px')),
  },
  {
    beat: 76,
    html: exampleFrame({ left: callLog({ arrows: true }), right: tree({ hi: true }), lm: ['✓', '✓', '✓'], rm: ['✓', '✗'], lcls: ['dim', 'hl new', 'dim'], rcls: ['dim', 'hl new', 'dim'] }) + at(220, 322, note('差别只在：是不是一个接一个')),
  },

  // ───────── 第3屏　练习1 ─────────
  {
    beat: 77,
    html: at(24, 40, card('<b>判断的办法</b><br>· 是不是同一种东西<br>· 是不是一个接一个<br>· 个数是不是有限', 'new', 'width:170px;font-size:13px')) + at(230, 20, quiz1('new')),
  },
  { after: 79, html: at(24, 40, card('<b>判断的办法</b><br>· 是不是同一种东西<br>· 是不是一个接一个<br>· 个数是不是有限', '', 'width:170px;font-size:13px')) + at(230, 20, quiz1()) + pause('等学生作答；作答后每个选项下显示解析，不配旁白') },

  // ───────── 第4屏　练习2 ─────────
  { beat: 80, html: at(110, 50, quiz2('new')) },
  { after: 81, html: at(110, 50, quiz2()) + pause('等学生作答；作答后显示选项解析') },
  { beat: 82, html: at(150, 120, card('💡 有序 ≠ 排好序<br><span class="mini">有序：位置有先后　　不是：按大小排好</span>', 'new', 'width:320px;font-size:16px')) },
  {
    beat: 84,
    html: at(110, 140, cells(['c', 'a', 't'], { idx: ['0', '1', '2'] })) + at(228, 144, '<b class="okm big">✓</b>') + at(290, 136, '<span class="neq new">≠</span>') + at(360, 140, cells(['a', 'c', 't'], { idx: ['0', '1', '2'] })) + at(478, 144, '<b class="okm big">✓</b>') + at(170, 240, note('同样三个字符，位置不同，表就不同')),
  },

  // ───────── 第5屏　节尾 ─────────
  {
    beat: 87,
    html: at(120, 70, card('<div class="qz-h">到这里你有了</div>线性表的定义和四个要点：<div class="pts"><span class="tag new">同类型</span><span class="tag new">一个接一个</span><span class="tag new">个数有限</span><span class="tag new">可以重复</span></div>屏幕上的一行字，可以看成一个字符的线性表。', '', 'width:400px')),
  },
  { beat: 90, html: at(120, 110, card('<div class="qz-h">下一步</div>编辑器要对这一行字做哪些事？', 'new', 'width:300px')) + qcard({ corner: true, hi: 1, done: [0] }) },
]
