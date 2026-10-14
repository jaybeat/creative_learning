// 2.1 贴纸版分镜帧（npm run storyboard -- 2-1 --sticker [--palette p0]）。帧位和 2-1.paper.frames.ts 逐拍对应。
// 参考原片"一部手机里藏着多少种元素"（贴纸风科普）：编辑器拆出 c、a、t 三个格子，后面每屏都用这三个格子；
// 收尾时整课缩进编辑器贴纸，暗场里出大数字。手风琴换成标题下的"要点进度"，问题卡缩成右上角三问小卡。
// 规则：强调色只给"正在讲的那个 / 对的那个"，每帧最多 2 处；错误不用颜色（wrong 灰 + 划线）；帧里不写色值。
// pic 是贴纸版的画面说明（分镜墙显示它，不改双栏稿）。
import {
  at, pause, kicker, head, lede, tile, tiles, stk, sed, key, lines, ln, arrow, path, callout, bignum, chip, chk, num, wrong, ring, qmini, foot,
  type TileState,
} from './kit'
import type { Frame } from '../../../scripts/lib/course'

export { quizSource, say } from './2-1.frames'

// ───────── 本节复用的画面块 ─────────

const K0 = kicker('第2章 · 开场', 'OPENING')
const K1 = kicker('01 · 什么是线性表', 'DEFINITION')
const K2 = kicker('例题', 'CAN IT BE A LIST?')
const K3 = kicker('练习 1', 'YOUR TURN')
const K4 = kicker('练习 2', 'ORDERED ≠ SORTED')
const K5 = kicker('2.1 小结', 'RECAP')

/** 每帧末尾加底部元信息行；sc 是第几屏 */
const F = (sc: number, html: string) => html + foot(sc)

const POINTS = ['定义', '同类型', '一个接一个', '个数有限', '可以重复']
/** 要点进度：cur 正在讲，之前的打勾 */
const steps = (cur: number, cls = '') =>
  `<div class="s-steps ${cls}">${POINTS.map((s, i) => chip(i < cur ? s + ' ✓' : s, 'tile', i === cur ? 'on' : i < cur ? 'done' : '')).join('')}</div>`

/** 第 1 屏的帧：kicker + 三问小卡 + 要点进度 */
const P1 = (cur: number, html: string, o: { qcls?: string } = {}) => F(1, K1 + qmini({ hi: 0, cls: o.qcls }) + steps(cur) + html)

// 第 0 屏：编辑器大贴纸的位置（光标 x = 169 + 15 × 光标左边字数，中线 y = 172）
const ED = (text: string, cursor: number, o: { hi?: number[]; cls?: string } = {}) => at(150, 140, sed(text, { cursor, s: 30, w: 340, ...o }))
const curX = (n: number) => 170 + 15 * n

/** 第 0 屏六步回放的小编辑器 */
const replay = (cls = '') =>
  (
    [['c', 1, '敲 c'], ['ca', 2, '敲 a'], ['cat', 3, '敲 t'], ['cat', 2, '左移'], ['caxt', 3, '敲 x'], ['cat', 2, '退格']] as [string, number, string][]
  )
    .map(([s, c, lab], i) => {
      const x = 44 + (i % 3) * 190, y = 116 + Math.floor(i / 3) * 96
      return at(x, y, sed(s, { cursor: c, s: 20, w: 168, cls })) + at(x + 4, y + 58, `<span class="s-step"><b>0${i + 1}</b> · ${lab}</span>`)
    })
    .join('')

const Q = ['程序要记住这一行字的什么？', '要对它做哪些事？', '怎么放进内存？']
/** 三问清单：显示前 n 行，cur 是正在念的那一行 */
const qlist = (n: number, cur: number) =>
  Q.slice(0, n)
    .map((q, i) => at(110, 128 + i * 60, `<div style="display:flex;align-items:center;gap:14px;width:420px;padding-bottom:12px;border-bottom:1px solid var(--off)">${num('0' + (i + 1), i === cur ? (i === n - 1 ? 'new' : '') : 'done')}<span style="font-size:19px;font-weight:700">${q}</span></div>`))
    .join('')

// 第 1 屏：定义行的五个格子
const BX = (i: number) => 70 + i * 82 // 格子 i 的左边
const blanks = (o: { st?: (i: number) => TileState; idx?: string[]; top?: string[]; cls?: string } = {}) =>
  at(70, 150, tiles(['', '', '', '…', ''], { s: 62, gap: 20, st: o.st ?? ((i) => (i === 3 ? 'ghost' : 'off')), idx: o.idx, top: o.top, cls: o.cls }))
const brace = (cls = '') => lines(path(`M70 240 v8 h390 v-8`)) + at(232, 254, `<b class="${cls}" style="font-size:14px">长度 n</b>`)
const formula = (s: string, cls = '') => at(484, 150, stk(`<div class="s-note"><span class="s-m">整个表写成</span><br><b class="s-mono">${s}</b></div>`, { rot: 2, cls }))
const cat3 = (o: { st?: (i: number) => TileState; idx?: string[]; top?: string[]; arrows?: boolean; s?: number; cls?: string } = {}) =>
  tiles(['c', 'a', 't'], { s: o.s ?? 66, gap: 14, st: o.st, idx: o.idx, top: o.top, arrows: o.arrows, cls: o.cls })

// 第 1 屏"一个接一个"：c → a → t（格子 72，c 在 x=110）
const seq = (o: { hi?: boolean; cls?: string } = {}) => at(110, 156, cat3({ s: 72, arrows: true, st: (i) => (o.hi && i === 1 ? 'hi' : 'on'), cls: o.cls }))
// c、a、t 三个格子的中心 x（格子 72 + 箭头 24 + 两边间距 6）
const SX = [146, 254, 362]

/** 候选的三行：decided 后只有 cat 圈起来打勾，另外两行划掉 */
const cands = (decided: boolean, cls = '') =>
  [['c', 'a', 't'], ['a', 'c', 't'], ['t', 'c', 'a']]
    .map((r, j) => {
      const y = 140 + j * 60
      const row = tiles(r, { s: 42, gap: 6 })
      if (!decided) return at(330, y, row) + at(486, y + 10, chip('?', 'soft', cls))
      return j ? at(330, y, wrong(row)) : at(330, y, row) + ring(322, y - 8, 160, 58, { cls }) + at(494, y + 11, chk('ok'))
    })
    .join('')

// 第 2 屏：例题两张卡
type ExOpt = {
  lm?: string[]; rm?: string[] // 检查行的结果：✓ / ✗ / ''
  lrow?: string[]; rrow?: string[] // 检查行的状态：on / dim / ''
  arrows?: boolean; mark?: boolean; tree?: 'plain' | 'lines' | 'hi'
  focus?: 'l' | 'r'; lcls?: string; rcls?: string; logCls?: string; treeCls?: string; verdict?: boolean; vcls?: string
}
const CK = ['同类型', '一个接一个', '个数有限']
const checks = (marks: string[] = [], rows: string[] = []) =>
  CK.map((n, i) => {
    const m = marks[i] ?? ''
    const body = `<span>${n}</span>${m === '✓' ? chk('ok') : m === '✗' ? chk('no') : chk('wait')}`
    return m === '✗' ? `<div class="s-ck ${rows[i] ?? ''}">${wrong(`<span>${n}</span>`)}${chk('no')}</div>` : `<div class="s-ck ${rows[i] ?? ''}">${body}</div>`
  }).join('')
const callLog = (o: ExOpt) =>
  `<div class="s-log ${o.arrows ? 'arrows' : ''} ${o.logCls ?? ''}">${['刚刚', '昨天', '周一', '上周']
    .map((s, i) => `<div class="s-lr">通话 ${4 - i}${o.mark && (i === 1 || i === 2) ? ' · 前驱 1 后继 1' : ''}<span>${s}</span></div>`)
    .join('')}</div>`
const tree = (o: ExOpt) => {
  const kids = [46, 120, 194]
  const ln3 = o.tree === 'lines' || o.tree === 'hi' ? `<g class="${o.tree === 'hi' ? 'hi' : ''}">${kids.map((x) => `<line x1="120" y1="30" x2="${x}" y2="74"/>`).join('')}${o.tree === 'hi' ? kids.map((x) => `<circle cx="${x}" cy="74" r="3.5"/>`).join('') : ''}</g>` : ''
  return `<svg class="s-tree ${o.treeCls ?? ''}" width="221" height="96" viewBox="0 0 240 104">${ln3}
<rect class="nd" x="94" y="6" width="52" height="24" rx="6"/><text x="120" y="23">祖辈</text>
${kids.map((x) => `<rect class="nd" x="${x - 26}" y="76" width="52" height="24" rx="6"/><text x="${x}" y="93">孩子</text>`).join('')}</svg>`
}
const ex = (o: ExOpt, html = '') =>
  F(2, K2 + head(o.verdict ? '差别只在：' : '这两样东西，', o.verdict ? '是不是一个接一个' : '能看成线性表吗？') +
    at(32, 96, stk(`<div class="s-ct">通话记录 <span style="font-size:12px;font-weight:400;color:var(--mute)">从新到旧</span></div><div style="height:96px">${callLog(o)}</div>${checks(o.lm, o.lrow)}`, { w: 280, h: 226, cls: o.lcls, rot: o.focus === 'l' ? -1 : 0 })) +
    at(328, 96, stk(`<div class="s-ct">家谱</div><div style="height:96px;display:flex;justify-content:center;align-items:center">${tree(o)}</div>${checks(o.rm, o.rrow)}`, { w: 280, h: 226, cls: o.rcls, rot: o.focus === 'r' ? 1 : 0 })) +
    html)

// 第 3、4 屏：练习卡
const rules = (cls = '') =>
  at(32, 104, stk(`<div class="s-note" style="width:170px"><span class="s-m">判断的办法</span>${['是不是同一种东西', '是不是一个接一个', '个数是不是有限'].map((s, i) => `<div style="display:flex;align-items:center;gap:8px;margin-top:8px">${num(String(i + 1))}<b style="font-size:14px">${s}</b></div>`).join('')}</div>`, { rot: -1.5, cls }))
const quiz1 = (cls = '') =>
  at(240, 72, stk(`<div class="s-ct">练习1　多选 <span style="font-size:12px;font-weight:400;color:var(--mute)">把成员当作元素，判断能不能看成线性表</span></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${['编辑器里的一行字 cat', '一周的七天', '按学号排好的花名册', '电脑里的文件夹目录', '城市的地铁线路网', '抽奖箱里的号码球', '全体正整数 1, 2, 3, …']
    .map((s) => `<div class="s-opt"><i></i>${s}</div>`).join('')}</div><div style="text-align:right;margin-top:8px"><span class="s-btn">检查</span></div>`, { w: 370, cls }))
const quiz2 = (cls = '') =>
  at(130, 100, stk(`<div class="s-ct">练习2　单选</div><div style="font-size:12px;color:var(--mute);margin-bottom:8px">屏幕上的 cat 看成线性表是 (c, a, t)。这三个字符没有按字母顺序排。</div>
${['不是，线性表要求元素按从小到大排好', '是，线性表只要求元素一个接一个，不要求按大小排', '不是，c、a、t 是三个不同的字符，不算同类型']
    .map((s) => `<div class="s-opt radio" style="margin-top:6px"><i></i>${s}</div>`).join('')}<div style="text-align:right;margin-top:8px"><span class="s-btn">检查</span></div>`, { w: 400, cls }))

// 第 5 屏：整课缩进编辑器贴纸（原片结尾"整条片子缩进手机屏幕"）
const shrunk = at(52, 64, `<div class="s-stk" style="--r:-6deg;width:196px;height:248px;border-radius:26px;padding:10px">
<div style="height:100%;border-radius:18px;background:var(--bg);padding:14px 12px;display:flex;flex-direction:column;gap:10px">
<b style="font-size:13px;color:var(--ink)">什么是线性表</b>${tiles(['c', 'a', 't'], { s: 30, gap: 4 })}${tiles(['b', 'o', 'o', 'k'], { s: 27, gap: 3, st: (i) => (i === 1 || i === 2 ? 'hi' : 'on') })}
<div style="display:flex;align-items:center;gap:6px">${tile('', 'ghost', 27)}<span style="font-size:12px;color:var(--mute)">空表</span></div>
<div style="height:5px;width:80%;border-radius:3px;background:var(--off)"></div><div style="height:5px;width:60%;border-radius:3px;background:var(--off)"></div></div></div>`)

export const frames: Frame[] = [
  // ───────── 第0屏　章首开场 ─────────
  {
    beat: 1,
    reveal: 'spread',
    pic: '三个输入框贴纸依次落在纸上（搜索框、聊天框、文件名框），各带一根引线标注',
    html: F(0,
      K0 + head('你每天都在', '一行里敲字') + lede('搜索框、聊天框、给文件起名字的框') +
      at(64, 122, sed('', { ph: '搜索…', icon: 'search', w: 230, rot: -4, cls: 'new' })) +
      at(338, 112, sed('', { ph: '说点什么…', icon: 'send', w: 252, rot: 3, cls: 'new' })) +
      at(176, 224, sed('新建文本文档.txt', { cursor: 6, s: 18, w: 260, rot: -1.5, cls: 'new' })) +
      callout(84, 180, 64, 204, '搜索框') + callout(574, 170, 600, 200, '聊天框', { end: true }) + callout(432, 268, 470, 296, '文件名框'),
    ),
  },
  {
    beat: 3,
    pic: '三张贴纸合成一个编辑器大贴纸，里面只有闪烁的光标；引线标注"光标"（主角登场）',
    html: F(0, K0 + head('我们自己做一个', '单行编辑器') + lede('它只管一行文字') + ED('', 0, { cls: 'new' }) + callout(curX(0), 160, 230, 118, '这是光标', { tone: 'acc' })),
  },
  {
    beat: 5,
    reveal: 'spread',
    pic: '三列：按键贴纸 c、a、t 依次落下，下面的小编辑器依次变成 c、ca、cat',
    html: F(0,
      K0 + head('依次敲入', 'c、a、t') +
      ([['c', 'c', 70], ['a', 'ca', 250], ['t', 'cat', 430]] as [string, string, number][])
        .map(([k, s, x], i) => at(x + 44, 112, key(k, 'new')) + at(x, 196, sed(s, { s: 22, w: 150, cls: 'new' })) + at(x + 6, 262, `<span class="s-step"><b>0${i + 1}</b> · 敲 ${k}</span>`))
        .join(''),
    ),
  },
  {
    beat: 6,
    pic: '编辑器大贴纸里光标左移到 a 和 t 之间；右边贴一个 ← 键；引线标注"左移一格"',
    html: F(0, K0 + head('把光标', '左移一格') + ED('cat', 2, { cls: 'new' }) + at(520, 148, key('←', 'new')) + callout(curX(2), 194, 240, 240, '左移一格', { tone: 'acc' })),
  },
  {
    beat: 7,
    pic: 'x 插进 a 和 t 之间（x 用浅强调底标出）；右边换成 x 键',
    html: F(0, K0 + head('敲', 'x') + ED('caxt', 3, { hi: [2] }) + at(520, 148, key('x', 'new')) + callout(curX(2) + 7, 194, 250, 240, '插在 a 和 t 之间', { tone: 'acc' })),
  },
  {
    beat: 8,
    pic: 'x 消失；右边换成退格键 ⌫；引线标注"退格，x 没了"',
    html: F(0, K0 + head('最后按一次', '退格') + ED('cat', 2, { cls: 'new' }) + at(520, 148, key('退格', 's-key-word new')) + callout(curX(2), 194, 240, 240, '退格，x 没了')),
  },
  {
    beat: 9,
    reveal: 'spread',
    pic: '六步回放：六个小编辑器依次闪一下，每个下面标步号和动作',
    html: F(0, K0 + head('每一步，整行都要', '重新显示') + replay('new')),
  },
  {
    beat: 10,
    pic: '六个小编辑器外面套一个强调色虚线框，右上角标签"程序得一直记着"',
    html: F(0, K0 + head('所以程序得', '一直记着这一行') + replay() + ring(32, 104, 576, 210, { dash: true, cls: 'new' }) + at(470, 92, chip('程序得一直记着', 'acc', 'new'))),
  },
  {
    beat: 11,
    pic: '编辑器缩小歪到左边，c、a、t 从里面拆出来，变成一排深炭格子（这三个格子贯穿全课）',
    html: F(0,
      K0 + head('一个字符接一个字符，', '排成一列') +
      at(44, 150, sed('cat', { cursor: -1, s: 26, w: 190, rot: -3 })) + lines(arrow(252, 182, 316, 182, 'mute', { dash: true })) +
      at(334, 146, tiles(['c', 'a', 't'], { s: 76, gap: 10, idx: ['0', '1', '2'], cls: 'new' })),
    ),
  },
  {
    beat: 12,
    pic: '标题换成"这样的数据叫线性表"，"线性表"下面画强调色下划线，后面小字 LINEAR LIST；格子上方小字"一个 / 接 / 一个"',
    html: F(0,
      K0 + head('这样的数据叫', '线性表', 'LINEAR LIST') +
      at(44, 150, sed('cat', { cursor: -1, s: 26, w: 190, rot: -3 })) + lines(arrow(252, 182, 316, 182, 'mute', { dash: true })) +
      at(334, 146, tiles(['c', 'a', 't'], { s: 76, gap: 10, idx: ['0', '1', '2'], top: ['<b>一个</b>', '<b>接</b>', '<b>一个</b>'] })),
    ),
  },
  {
    beat: 13,
    pic: '目标卡贴纸：编辑器小图 + "编辑器" + 强调色标签 v1.0 + "学完 2.1–2.6，用 C 亲手做出来"',
    html: F(0,
      K0 + head('学完接下来几节，', '做出编辑器 1.0') +
      at(150, 110, stk(`<div style="display:flex;gap:22px;align-items:center;padding:8px">${sed('cat', { cursor: 3, s: 24, w: 170 })}<div><div style="font-size:30px;font-weight:900;line-height:1.2">编辑器 ${chip('v1.0', 'acc')}</div><div style="font-size:13px;color:var(--mute);margin-top:6px">学完 2.1–2.6<br>用 C 亲手做出第一版</div></div></div>`, { rot: -1.5, cls: 'new' })),
    ),
  },
  {
    beat: 15,
    pic: '左边编辑器贴纸，右边一个"程序"齿轮贴纸，中间来回两根虚线箭头',
    html: F(0,
      K0 + head('屏幕每变一次，', '程序都在背后干活') +
      at(60, 150, sed('cat', { cursor: 2, s: 26, w: 220 })) +
      at(420, 126, stk(`<div style="width:96px;text-align:center"><div style="font-size:48px;line-height:1.1">⚙</div><b style="font-size:14px">程序</b></div>`, { rot: 3, cls: 'new' })) +
      lines(arrow(296, 170, 404, 160, 'mute', { dash: true }), arrow(404, 196, 296, 204, 'mute', { dash: true })) +
      at(318, 128, '<span class="s-step">显示</span>') + at(318, 214, '<span class="s-step">记着</span>'),
    ),
  },
  { beat: 17, pic: '三问清单第 1 行：编号方块 01 + 问题', html: F(0, K0 + head('要做出它，先回答', '三个问题') + qlist(1, 0)) },
  { beat: 18, pic: '第 2 行出现，01 变成深色（念过了），02 是强调色', html: F(0, K0 + head('要做出它，先回答', '三个问题') + qlist(2, 1)) },
  { beat: 19, pic: '第 3 行出现', html: F(0, K0 + head('要做出它，先回答', '三个问题') + qlist(3, 2)) },
  {
    beat: 20,
    pic: '三问缩成右上角小卡，第 1 问高亮；画面中间一个大数字"01"加第一问',
    html: F(0,
      K0 + qmini({ hi: 0, cls: 'new' }) +
      at(36, 96, bignum('01', '', 150)) +
      at(262, 140, `<div style="font-size:30px;font-weight:900;line-height:1.35">程序要记住<br><u style="text-decoration:none;background:linear-gradient(var(--acc),var(--acc)) 0 calc(100% - 3px)/100% 6px no-repeat">这一行字的什么？</u></div><div style="font-size:13px;color:var(--mute);margin-top:12px">先记住三个问题，我们从第一个开始</div>`),
    ),
  },

  // ───────── 第1屏　什么是线性表 ─────────
  {
    beat: 21,
    pic: '标题"这一行字，可以看成一个线性表"；标题下五个要点胶囊，"定义"亮起；c、a、t 三格；右上角三问小卡',
    html: P1(0, head('这一行字，可以看成', '一个线性表') + at(70, 150, cat3({ cls: 'new' })), { qcls: 'new' }),
  },
  {
    beat: 22,
    pic: 'c、a、t 换成一串没点亮的空格子 □□□…□',
    html: P1(0, head('n 个同类型的元素', '排成一列') + blanks({ cls: 'new' })),
  },
  {
    beat: 24,
    pic: '格子下方一道括线，标"长度 n"',
    html: P1(0, head('n 叫表的', '长度') + blanks() + brace('new')),
  },
  {
    beat: 25,
    pic: '格子下方依次出现编号 0、1、2 … n−1；右边小贴纸"整个表写成 (a₀, a₁, …, aₙ₋₁)"',
    html: P1(0, head('位置从', '0 开始编号') + blanks({ idx: ['0', '1', '2', '', 'n−1'] }) + brace() + formula('(a₀, a₁, …, aₙ₋₁)', 'new')),
  },
  {
    beat: 26,
    pic: '第 0 格和最后一格亮成强调色，上方标 a₀、aₙ₋₁',
    html: P1(0,
      head('首尾两个：', 'a₀ 和 aₙ₋₁') +
      blanks({ st: (i) => (i === 0 || i === 4 ? 'hi' : i === 3 ? 'ghost' : 'off'), idx: ['<b>0</b>', '1', '2', '', '<b>n−1</b>'], top: ['<b>a₀</b>', '', '', '', '<b>aₙ₋₁</b>'] }) +
      brace() + formula('(a₀, a₁, …, aₙ₋₁)'),
    ),
  },
  {
    beat: 27,
    pic: '空格子换回 c、a、t，编号 0、1、2；小贴纸变成 (c, a, t)',
    html: P1(0, head('屏幕上的 cat，', '就是一个表') + at(70, 150, cat3({ idx: ['0', '1', '2'], cls: 'new' })) + formula('(c, a, t)', 'new')),
  },
  {
    beat: 28,
    pic: '右边一个大数字"3 / 长度"',
    html: P1(0, head('屏幕上的 cat，', '长度是 3') + at(70, 150, cat3({ idx: ['0', '1', '2'] })) + at(330, 116, `<div class="new">${bignum('3', '/ 长度', 150)}</div>`)),
  },
  {
    beat: 29,
    pic: '定义打勾；四张编号贴纸并排：01 同类型、02 一个接一个、03 个数有限、04 可以重复',
    html: P1(1,
      head('这个定义里有', '四个要点') +
      POINTS.slice(1).map((s, i) => at(36 + i * 146, 150, stk(`<div style="width:110px">${num('0' + (i + 1))}<div style="font-size:17px;font-weight:900;margin-top:12px">${s}</div></div>`, { rot: [-2, 1.5, -1, 2][i], cls: 'new' }))).join(''),
    ),
  },
  {
    beat: 30,
    pic: '"同类型"亮起；c、a、t 三格上方各贴一个"字符"标签',
    html: P1(1, head('第一，', '同类型') + at(70, 164, cat3({ top: Array(3).fill(chip('字符', 'soft')), cls: 'new' }))),
  },
  {
    beat: 32,
    pic: '整数 7 的格子和一张图片贴纸想挤进来，被弹开、歪着停住，各贴一个灰色 ✗',
    html: P1(1,
      head('整数、图片：', '混不进来') + at(70, 164, cat3({ top: Array(3).fill(chip('字符', 'soft')) })) +
      at(372, 140, `<div class="new" style="transform:rotate(12deg)">${tile('7', 'off', 58)}</div>`) + at(428, 132, chk('no')) +
      at(474, 196, stk(`<svg width="76" height="56" viewBox="0 0 76 56"><rect width="76" height="56" rx="6" style="fill:var(--field)"/><polygon points="6,50 30,18 48,40 58,30 70,50" style="fill:var(--off)"/><circle cx="58" cy="16" r="6" style="fill:var(--off)"/></svg>`, { rot: -8, pad: 6, cls: 'new' })) + at(560, 190, chk('no')) +
      lines(arrow(366, 190, 312, 196, 'mute', { dash: true })),
    ),
  },
  {
    beat: 33,
    pic: '一排一模一样的空格子，旁边标签"只放字符"',
    html: P1(1, head('所以程序只需要', '准备一种格子') + at(70, 164, tiles(Array(6).fill(''), { s: 54, gap: 10, cls: 'new' })) + at(470, 180, chip('只放字符', 'soft', 'new'))),
  },
  {
    beat: 34,
    pic: '"同类型"打勾，"一个接一个"亮起；c → a → t 三格之间出现箭头',
    html: P1(2, head('第二，', '一个接一个') + seq({ cls: 'new' })),
  },
  { beat: 35, pic: 'a 亮成强调色；c 上方引线"a 的前驱"', html: P1(2, head('前面紧挨着的，', '叫前驱') + seq({ hi: true }) + callout(SX[0], 156, SX[0], 130, 'a 的前驱', { cls: 'new' })) },
  { beat: 36, pic: 't 上方引线"a 的后继"', html: P1(2, head('后面紧挨着的，', '叫后继') + seq({ hi: true }) + callout(SX[0], 156, SX[0], 130, 'a 的前驱') + callout(SX[2], 156, SX[2], 130, 'a 的后继', { cls: 'new' })) },
  {
    beat: 37,
    pic: 'c 下方灰色引线"无前驱 / 第一个"；右边小贴纸"中间的元素：前驱、后继各恰好 1 个"',
    html: P1(2,
      head('除了第一个，', '都有一个前驱') + seq({ hi: true }) + callout(SX[0], 156, SX[0], 130, 'a 的前驱') + callout(SX[2], 156, SX[2], 130, 'a 的后继') +
      callout(SX[0], 228, SX[0] + 24, 266, '无前驱', { tone: 'mute', sub: '第一个', cls: 'new' }) +
      at(472, 160, stk(`<div class="s-note" style="width:118px"><span class="s-m">中间的元素</span><br><b>前驱、后继<br>各恰好 1 个</b></div>`, { rot: 2 })),
    ),
  },
  {
    beat: 38,
    pic: 't 下方灰色引线"无后继 / 最后一个"',
    html: P1(2,
      head('除了最后一个，', '都有一个后继') + seq({ hi: true }) + callout(SX[0], 156, SX[0], 130, 'a 的前驱') + callout(SX[2], 156, SX[2], 130, 'a 的后继') +
      callout(SX[0], 228, SX[0] + 24, 266, '无前驱', { tone: 'mute', sub: '第一个' }) + callout(SX[2], 228, SX[2] + 24, 266, '无后继', { tone: 'mute', sub: '最后一个', cls: 'new' }) +
      at(472, 160, stk(`<div class="s-note" style="width:118px"><span class="s-m">中间的元素</span><br><b>前驱、后继<br>各恰好 1 个</b></div>`, { rot: 2 })),
    ),
  },
  {
    beat: 39,
    pic: 'cat 和 act 两个编辑器贴纸并排，中间一个强调色 ≠',
    html: P1(2, head('程序为什么要', '在乎先后？') + at(90, 160, sed('cat', { cursor: -1, s: 30, w: 170, rot: -2 })) + at(292, 168, '<span class="s-neq new">≠</span>') + at(360, 160, sed('act', { cursor: -1, s: 30, w: 170, rot: 2 })) + at(250, 250, '<span class="s-step">两行不同的字</span>')),
  },
  {
    beat: 41,
    pic: '左边贴纸"程序只记了"：c、a、t 三个格子歪着散在虚线圈里；右边三行候选 cat、act、tca，各贴一个"?"',
    html: P1(2,
      head('只记有哪些字，', '打印不出这一行') +
      at(40, 128, stk(`<div style="width:200px;height:170px;position:relative"><div style="text-align:center;font-size:12px;color:var(--mute)">程序只记了</div>
<div style="position:absolute;left:36px;top:30px;width:128px;height:128px;border:1.5px dashed var(--mute);border-radius:50%"></div>
<div style="position:absolute;left:52px;top:58px;transform:rotate(-14deg)">${tile('t', 'on', 40)}</div><div style="position:absolute;left:104px;top:50px;transform:rotate(9deg)">${tile('c', 'on', 40)}</div><div style="position:absolute;left:78px;top:104px;transform:rotate(4deg)">${tile('a', 'on', 40)}</div></div>`, { rot: -2, cls: 'new' })) +
      lines(arrow(266, 214, 312, 214, 'mute', { dash: true })) + cands(false, 'new'),
    ),
  },
  {
    beat: 42,
    pic: '左边换成 c → a → t；右边只剩 cat 被强调色框圈住、打勾，act、tca 变灰划掉',
    html: P1(2,
      head('它还得记住', '谁在谁前面') +
      at(40, 128, stk(`<div style="width:200px;height:170px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px"><div style="font-size:12px;color:var(--mute)">程序记住了先后</div>${tiles(['c', 'a', 't'], { s: 34, arrows: true })}</div>`, { rot: -2, cls: 'new' })) +
      lines(arrow(266, 214, 312, 214, 'mute', { dash: true })) + cands(true, 'new'),
    ),
  },
  {
    beat: 43,
    pic: '"一个接一个"打勾，"个数有限"亮起；一个只有光标的空编辑器，旁边虚线空格子 + "() 长度 0"',
    html: P1(3, head('第三，', '个数有限') + at(70, 160, sed('', { s: 26, w: 200, cls: 'new' })) + at(320, 164, `<div class="new" style="display:flex;align-items:center;gap:14px">${tile('', 'ghost', 48)}<b class="s-mono" style="font-size:22px">()</b><span style="font-size:16px;font-weight:700">长度 0</span></div>`)),
  },
  {
    beat: 45,
    pic: '"()" 旁贴一个强调色标签"空表"；小字"编辑器刚启动时就是空表"',
    html: P1(3,
      head('长度为 0 的表，', '叫空表') + at(70, 160, sed('', { s: 26, w: 200 })) + at(320, 164, `<div style="display:flex;align-items:center;gap:14px">${tile('', 'ghost', 48)}<b class="s-mono" style="font-size:22px">()</b><span style="font-size:16px;font-weight:700">长度 0</span></div>`) +
      at(330, 236, chip('空表', 'acc', 'new')) + at(392, 238, '<span class="s-step">编辑器刚启动时就是空表</span>'),
    ),
  },
  {
    beat: 47,
    reveal: 'spread',
    pic: '四个状态 ()、c、ca、cat 依次排开，下面"长度 0 → 1 → 2 → 3"；右边大数字 3；下方小贴纸"程序任何时候都要知道现在有几个字符"',
    html: P1(3,
      head('每敲一个字符，', '长度加 1') +
      ([[], ['c'], ['c', 'a'], ['c', 'a', 't']] as string[][])
        .map((r, j) => at(44 + j * 100, 136, `<div class="new">${r.length ? tiles(r, { s: 28, gap: 3 }) : tile('', 'ghost', 28)}</div>`) + at(44 + j * 100, 174, `<span class="s-step">${j === 3 ? '<b>长度 3</b>' : '长度 ' + j}</span>`) + (j < 3 ? lines(arrow(44 + j * 100 + 84, 149, 44 + j * 100 + 96, 149, 'mute')) : ''))
        .join('') +
      at(456, 104, bignum('3', '', 140)) +
      at(44, 220, stk(`<div class="s-note" style="width:330px"><b>程序任何时候都要知道现在有几个字符</b><br><span class="s-m">否则不知道显示到哪里为止</span></div>`, { rot: -1 })),
    ),
  },
  {
    beat: 50,
    pic: '"个数有限"打勾，"可以重复"亮起；b o o k 四格，两个 o 亮成强调色',
    html: P1(4, head('第四，', '可以重复') + at(80, 160, tiles(['b', 'o', 'o', 'k'], { s: 72, gap: 12, st: (i) => (i === 1 || i === 2 ? 'hi' : 'on'), cls: 'new' }))),
  },
  {
    beat: 52,
    pic: '四格下方编号 0 1 2 3，1 和 2 强调；括线引线"两个 o 都要记住"；右边小贴纸"位置不同，就是两个元素"',
    html: P1(4,
      head('两个 o，', '两个都要记住') +
      at(80, 160, tiles(['b', 'o', 'o', 'k'], { s: 72, gap: 12, st: (i) => (i === 1 || i === 2 ? 'hi' : 'on'), idx: ['0', '<b>1</b>', '<b>2</b>', '3'] })) +
      lines(path('M164 262 v8 h156 v-8', 'acc', 1.4)) + callout(242, 270, 268, 296, '第 1 个和第 2 个元素', { tone: 'acc', cls: 'new' }) +
      at(456, 160, stk(`<div class="s-note" style="width:130px"><span class="s-m">一样的字符</span><br><b>位置不同，<br>就是两个元素</b></div>`, { rot: 3 })),
    ),
  },
  {
    beat: 54,
    pic: '五个要点全部打勾；kicker 换成"回到问题 01"；三问小卡第 1 问放大高亮；画面中间"这一行字 = 一个线性表"',
    html: F(1,
      kicker('回到问题 01', 'ANSWER') + qmini({ hi: 0, cls: 'new' }) + steps(5) + head('程序要记住这一行字的', '什么？') +
      at(70, 160, cat3({ s: 70 })) + at(330, 178, `<span style="font-size:22px;font-weight:900">= 一个线性表</span>`),
    ),
  },
  {
    beat: 57,
    pic: '三行答案贴纸：01 有哪些元素（c a t）、02 它们的先后（c→a→t）、03 现在有几个（3），各打勾',
    html: F(1,
      kicker('回到问题 01', 'ANSWER') + qmini({ hi: 0 }) + steps(5) + head('所以程序得记住', '三样东西') +
      ['有哪些元素', '它们的先后', '现在有几个']
        .map((s, j) => at(36, 124 + j * 66, stk(`<div style="display:flex;align-items:center;gap:16px;width:540px;height:30px">${num('0' + (j + 1))}<b style="font-size:17px;width:120px">${s}</b>${j === 0 ? tiles(['c', 'a', 't'], { s: 30, gap: 4 }) : j === 1 ? tiles(['c', 'a', 't'], { s: 30, arrows: true }) : '<b class="s-mono" style="font-size:30px;color:var(--acc-line)">3</b>'}<span style="margin-left:auto">${chk('ok')}</span></div>`, { pad: 10, cls: 'new' })))
        .join(''),
    ),
  },
  {
    beat: 58,
    pic: '右上角三问小卡第 1 问打勾',
    html: F(1,
      kicker('回到问题 01', 'ANSWER') + qmini({ hi: 0, done: [0], cls: 'new' }) + steps(5) + head('所以程序得记住', '三样东西') +
      ['有哪些元素', '它们的先后', '现在有几个']
        .map((s, j) => at(36, 124 + j * 66, stk(`<div style="display:flex;align-items:center;gap:16px;width:540px;height:30px">${num('0' + (j + 1))}<b style="font-size:17px;width:120px">${s}</b>${j === 0 ? tiles(['c', 'a', 't'], { s: 30, gap: 4 }) : j === 1 ? tiles(['c', 'a', 't'], { s: 30, arrows: true }) : '<b class="s-mono" style="font-size:30px;color:var(--acc-line)">3</b>'}<span style="margin-left:auto">${chk('ok')}</span></div>`, { pad: 10 })))
        .join(''),
    ),
  },

  // ───────── 第2屏　例题 ─────────
  { beat: 59, pic: '两张贴纸卡落下：左边通话记录，右边家谱；下面各三行待检查', html: ex({ lcls: 'new', rcls: 'new' }) },
  { beat: 60, pic: '左卡：通话记录列表"从新到旧"', html: ex({ logCls: 'new', focus: 'l' }) },
  { beat: 61, pic: '右卡：家谱树', html: ex({ treeCls: 'new', focus: 'r' }) },
  { beat: 62, pic: '左卡微微抬起，开始检查', html: ex({ focus: 'l', lcls: 'new' }) },
  { beat: 63, pic: '左卡"同类型"打勾', html: ex({ focus: 'l', lm: ['✓'], lrow: ['on'] }) },
  { beat: 64, pic: '记录之间出现强调色小箭头', html: ex({ focus: 'l', lm: ['✓'], arrows: true, lrow: ['', 'on'] }) },
  { beat: 65, pic: '中间两条记录标"前驱 1 后继 1"', html: ex({ focus: 'l', lm: ['✓'], arrows: true, mark: true, lrow: ['', 'on'] }) },
  { beat: 66, pic: '"一个接一个"打勾', html: ex({ focus: 'l', lm: ['✓', '✓'], arrows: true, lrow: ['', 'on'] }) },
  { beat: 67, pic: '"个数有限"打勾', html: ex({ focus: 'l', lm: ['✓', '✓', '✓'], arrows: true, lrow: ['', '', 'on'] }) },
  { beat: 68, pic: '右卡微微抬起，开始检查', html: ex({ focus: 'r', lm: ['✓', '✓', '✓'], arrows: true, rcls: 'new' }) },
  { beat: 69, pic: '右卡"同类型"打勾', html: ex({ focus: 'r', lm: ['✓', '✓', '✓'], arrows: true, rm: ['✓'], rrow: ['on'] }) },
  { beat: 70, pic: '家谱上下两代之间出现连线', html: ex({ focus: 'r', lm: ['✓', '✓', '✓'], arrows: true, rm: ['✓'], tree: 'lines', rrow: ['', 'on'] }) },
  { beat: 71, pic: '一个人下面三条连线一起亮成强调色', html: ex({ focus: 'r', lm: ['✓', '✓', '✓'], arrows: true, rm: ['✓'], tree: 'hi', rrow: ['', 'on'] }) },
  { beat: 72, pic: '"一个接一个"变灰划掉，灰色 ✗', html: ex({ focus: 'r', lm: ['✓', '✓', '✓'], arrows: true, rm: ['✓', '✗'], tree: 'hi', rrow: ['', 'on'] }) },
  { beat: 73, pic: '"个数有限"那行压暗：不用再看', html: ex({ focus: 'r', lm: ['✓', '✓', '✓'], arrows: true, rm: ['✓', '✗'], tree: 'hi', rrow: ['', '', 'dim'] }) },
  {
    beat: 74,
    pic: '两张卡右上角各贴一个结论标签：左"✓ 线性表"（深色），右"✗ 不是线性表"（灰色）',
    html: ex({ lm: ['✓', '✓', '✓'], arrows: true, rm: ['✓', '✗'], tree: 'hi', rrow: ['', '', 'dim'] }, at(212, 88, chip('✓ 线性表', 'ok', 'new')) + at(494, 88, chip('✗ 不是线性表', 'wrong', 'new'))),
  },
  {
    beat: 76,
    pic: '标题换成"差别只在：是不是一个接一个"；两张卡的第二行都铺上浅强调底，其余检查行压暗',
    html: ex({ verdict: true, lm: ['✓', '✓', '✓'], arrows: true, rm: ['✓', '✗'], tree: 'hi', lrow: ['dim', 'on', 'dim'], rrow: ['dim', 'on', 'dim'] }, at(212, 88, chip('✓ 线性表', 'ok')) + at(494, 88, chip('✗ 不是线性表', 'wrong'))),
  },

  // ───────── 第3屏　练习1 ─────────
  { beat: 77, pic: '左边口诀贴纸（1/2/3）；右边练习卡和七个选项', html: F(3, K3 + head('轮到你了') + rules('new') + quiz1('new')) },
  { after: 79, pic: '**暂停，等学生作答**；作答后每个选项下面显示解析，不配旁白', html: F(3, K3 + head('轮到你了') + rules() + quiz1() + pause('等学生作答；作答后每个选项下显示解析，不配旁白')) },

  // ───────── 第4屏　练习2 ─────────
  { beat: 80, pic: '练习卡出现', html: F(4, K4 + head('再来一题') + quiz2('new')) },
  { after: 81, pic: '**暂停，等学生作答**；作答后显示选项解析', html: F(4, K4 + head('再来一题') + quiz2() + pause('等学生作答；作答后显示选项解析')) },
  {
    beat: 82,
    pic: '标题"有序 ≠ 排好序"；一张提示贴纸"有序：位置有先后 / 不是：按大小排好"',
    html: F(4,
      K4 + head('有序', '≠ 排好序') +
      at(150, 120, stk(`<div class="s-note" style="width:300px;padding:6px"><div style="display:flex;gap:12px;align-items:baseline"><b style="width:60px">有序</b><span>位置有先后</span></div><div style="display:flex;gap:12px;align-items:baseline;margin-top:10px"><b style="width:60px">不是</b>${wrong('<span>按字母或大小排好</span>')}</div></div>`, { rot: -1.5, cls: 'new' })),
    ),
  },
  {
    beat: 84,
    pic: '(c, a, t) 和 (a, c, t) 两排格子并排，都打勾，中间强调色 ≠；下方贴纸"都是线性表，而且是两个不同的表"',
    html: F(4,
      K4 + head('有序', '≠ 排好序') +
      at(64, 120, tiles(['c', 'a', 't'], { s: 58, gap: 8, idx: ['0', '1', '2'] })) + at(270, 136, chk('ok')) + at(304, 124, '<span class="s-neq new">≠</span>') +
      at(352, 120, tiles(['a', 'c', 't'], { s: 58, gap: 8, idx: ['0', '1', '2'] })) + at(558, 136, chk('ok')) +
      at(64, 222, stk(`<div class="s-note" style="width:480px"><b>都是线性表，而且是两个不同的表</b><br><span class="s-m">同样三个字符，位置不同，表就不同</span></div>`, { cls: 'new' })),
    ),
  },

  // ───────── 第5屏　节尾 ─────────
  {
    beat: 87,
    dark: true,
    pic: '【暗场】整课缩进左边歪着的编辑器贴纸；右边大数字"4 / 4 个要点"，下面四个要点一行，强调色细下划线',
    html: F(5,
      K5 + shrunk + at(290, 110, bignum('4', '/ 4 个要点', 140)) +
      at(294, 262, `<div style="font-size:15px;font-weight:700;color:var(--dark-ink);padding-bottom:6px;background:linear-gradient(var(--acc),var(--acc)) 0 100%/100% 3px no-repeat;display:inline-block">同类型 · 一个接一个 · 个数有限 · 可以重复</div>`),
    ),
  },
  {
    beat: 90,
    pic: '切回亮场：右上角三问小卡第 1 问已打勾、第 2 问高亮；中间大数字"02"加第二问',
    html: F(5,
      kicker('下一步', 'NEXT') + qmini({ hi: 1, done: [0], cls: 'new' }) +
      at(36, 96, bignum('02', '', 150)) +
      at(262, 140, `<div style="font-size:30px;font-weight:900;line-height:1.35">编辑器要对这一行字<br><u style="text-decoration:none;background:linear-gradient(var(--acc),var(--acc)) 0 calc(100% - 3px)/100% 6px no-repeat">做哪些事？</u></div>`),
    ),
  },
]
