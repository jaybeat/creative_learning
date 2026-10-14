// 2.1 工作台版分镜帧（npm run storyboard -- 2-1 --desk）。帧位和 2-1.paper.frames.ts 逐拍对应。
// 参考视频"一晚上做出 Clawd 动画"的定风格、分镜软木板、代码卡三段：纸墙 + 陶土桌面，内容都是纸做的东西。
// 规则：每屏一个焦点，用红笔圈出来、旁边贴便利贴解释；红色只给圈和勾；错误变灰、划线、灰叉；
// 道具只在桌面边缘，不加场景插画；不放吉祥物。帧里不写色值（色系 w1）。
// pic 是工作台版的画面说明（分镜墙显示它，不改双栏稿）。字幕不画在帧里，分镜墙由主题叠第一拍旁白。
import {
  pause, dframe, dcard, dbadge, dpinned, dcork, dcell, dcells, dsticky, dtag, dcheck, dstrike, dwin, dfield, dtext, dline, dcurve, dring, dwob, druled,
  type DCell,
} from './kit'
import type { Frame } from '../../../scripts/lib/course'

export { quizSource, say } from './2-1.frames'

const NEW = 'new'
const S0 = '第2章 · 开场'
const S1 = '01 · 什么是线性表'

// ───────── 第0屏用的画面块 ─────────

/** 三个输入框窗口卡 */
const threeBoxes = (cls = '') =>
  dwin(70, 70, 236, 84, dfield(84, 108, 208, '', 0, 20), '搜索', { rot: -3, cls }) +
  dwin(338, 60, 236, 84, dfield(352, 98, 150, '', 0, 20) + dcard(512, 100, 48, 30, dtext(536, 120, '发送', { z: 12, a: 'middle', c: 'paper' }), { fill: 'tag', r: 4 }), '聊天', { rot: 2.5, cls }) +
  dwin(196, 176, 260, 84, dfield(210, 214, 232, '新建文本文档.txt', 6, 18), '文件名', { rot: -1, cls })

/** 单行编辑器大窗口 */
const bigEditor = (txt: string, cur: number, cls = '') => dwin(150, 52, 340, 118, dfield(170, 94, 300, txt, cur, 30), '单行编辑器', { cls })
/** 光标在大编辑器里的 x（等宽字 0.5em） */
const curX = (n: number) => 183 + n * 15

/** 桌上的键盘：亮出前 n 个键的步号，hot 是红色的那一个 */
const KEYS = ['c', 'a', 't', '←', 'x', '⌫']
const keyboard = (n: number, hot = -1) =>
  dwob(150, 236, 340, 58, 6, 205, { fill: 'key' }) +
  KEYS.map((k, i) => dwob(162 + i * 54, 246, 44, 38, 5, 210 + i, { fill: 'paper' }) + dtext(184 + i * 54, 272, k, { f: 'm', z: 18, a: 'middle' }) + (i < n ? dbadge(184 + i * 54, 236, String(i + 1), i === hot) : '')).join('')

/** 六步回放软木板 */
const REPLAY: [string, number][] = [['c', 1], ['ca', 2], ['cat', 3], ['cat', 2], ['caxt', 3], ['cat', 2]]
const replayBoard = (cls = '') =>
  dcork(40, 50, 440, 236, '每一步，整行都要重新显示', 9) +
  REPLAY.map(([s, c], i) => {
    const x = 62 + (i % 3) * 136, y = 106 + Math.floor(i / 3) * 88
    return dcard(x, y, 120, 70, dbadge(x + 14, y + 16, String(i + 1)) + dfield(x + 12, y + 30, 96, s, c, 16), { rot: [-2, 1.5, -1, 2, -1.5, 1][i], pin: i, cls })
  }).join('')

/** 编辑器 → 一排格子 */
const toCells = (cls = '') =>
  dwin(40, 86, 190, 90, dfield(54, 122, 162, 'cat', -1, 24), '编辑器', { rot: -3 }) + dcurve(236, 130, 270, 108, 300, 130, 'mute') +
  dcard(310, 70, 300, 190, dcells(338, 112, ['c', 'a', 't'], { s: 64, g: 20, idx: ['0', '1', '2'] }) + dtext(338, 94, '一个字符接一个字符，排成一列', { z: 13, c: 'mute', f: 's' }), { tape: true, cls })

/** 目标卡：编辑器 1.0 */
const goal = (x: number, y: number, cls = '') =>
  dcard(x, y, 180, 190, dfield(x + 16, y + 34, 148, 'cat', 3, 22) + dtext(x + 16, y + 110, '编辑器 1.0', { z: 22 }) +
    dtext(x + 16, y + 136, '学完 2.1–2.6', { z: 13, c: 'mute', f: 's' }) + dtext(x + 16, y + 156, '用 C 亲手做出来', { z: 13, c: 'mute', f: 's' }), { rot: -2, tape: true, cls })

/** 三问软木板：显示前 n 张，fresh 是这一帧新钉上去的 */
const QS: [string, string][] = [['程序要记住', '这一行字的什么？'], ['要对它', '做哪些事？'], ['怎么把它', '放进内存？']]
const qboard = (n: number, fresh = -1) =>
  dcork(236, 46, 384, 240, '开工前，先回答三个问题', 13) +
  QS.slice(0, n).map((q, i) => dpinned(258 + (i % 2) * 176, 110 + Math.floor(i / 2) * 88, 160, 70, q[0], String(i + 1), i, { sub: q[1], z: 14, rot: [-1.5, 1.5, -1][i], cls: i === fresh ? NEW : '' })).join('')

// ───────── 第1屏用的画面块 ─────────

/** 大白卡（讲解主区），title 写在卡片左上 */
const board = (inner: string, title = '', cls = '') => dcard(36, 52, 568, 230, (title ? dtext(60, 86, title, { z: 18 }) : '') + inner, { tape: true, cls })
const half = (inner: string, title = '', cls = '') => dcard(36, 52, 380, 230, (title ? dtext(60, 86, title, { z: 18 }) : '') + inner, { tape: true, cls })

/** 定义行的五个格子 */
const BLANK = ['', '', '', '…', '']
const blanks = (o: { idx?: boolean; ends?: boolean; seed?: number } = {}) =>
  dcells(70, 110, BLANK, {
    s: 60, g: 22, seed: o.seed,
    st: (i): DCell => (i === 3 ? 'ghost' : o.ends && (i === 0 || i === 4) ? 'hi' : 'off'),
    idx: o.idx ? ['0', '1', '2', '', 'n−1'] : undefined, red: (i) => !!o.ends && (i === 0 || i === 4),
  })
const brace = (cls = '') => `<g class="${cls}">${dline(70, 206, 468, 206, 31)}${dline(70, 206, 70, 198, 32)}${dline(468, 206, 468, 198, 33)}${dtext(242, 228, '长度 n', { z: 15 })}</g>`

/** 四个要点软木板；ring 圈第几张，ticks 打勾到第几张 */
const POINTS = ['同类型', '一个接一个', '个数有限', '可以重复']
const pointsBoard = (o: { ring?: number; cls?: string } = {}) =>
  dcork(36, 46, 568, 244, '线性表的四个要点', 29) +
  POINTS.map((s, i) => dpinned(60 + i * 134, 112, 118, 92, s, String(i + 1), i, { z: 16, rot: [-2, 1.5, -1, 2][i], cls: o.cls })).join('') +
  (o.ring !== undefined ? dring(119 + o.ring * 134, 158, 74, 60, 290 + (o.ring ?? 0)) : '')

/** 同类型：c a t 上各贴一张"字符"标签 */
const typed = (cls = '') => dcells(70, 130, ['c', 'a', 't'], { s: 64, g: 22 }) + `<g class="${cls}">${[0, 1, 2].map((i) => dtag(76 + i * 86, 104, '字符', { z: 12 })).join('')}</g>`

/** 一个接一个：c → a → t（a 用浅红底） */
const seq = (hi: boolean) => dcells(130, 128, ['c', 'a', 't'], { s: 76, g: 56, arrows: true, st: (i) => (hi && i === 1 ? 'hi' : 'on') })
const SEQ_RING = dring(298, 166, 52, 48, 341)
const pred = (cls = '') => `<g class="${cls}">${dtext(168, 104, '前驱', { z: 16, a: 'middle' })}${dcurve(190, 100, 240, 84, 276, 120)}</g>`
const succ = (cls = '') => `<g class="${cls}">${dtext(468, 104, '后继', { z: 16, a: 'middle' })}${dcurve(446, 100, 396, 84, 358, 120)}</g>`
const noPred = (cls = '') => `<g class="${cls}">${dtext(168, 236, '无前驱', { z: 13, a: 'middle', c: 'mute', f: 's' })}</g>`
const noSucc = (cls = '') => `<g class="${cls}">${dtext(468, 236, '无后继', { z: 13, a: 'middle', c: 'mute', f: 's' })}</g>`

/** 三行候选 cat / act / tca；decided 后 cat 圈起来打勾，另外两行划掉 */
const cands = (decided: boolean, cls = '') =>
  dcard(270, 52, 334, 230,
    [['c', 'a', 't'], ['a', 'c', 't'], ['t', 'c', 'a']].map((r, j) => {
      const y = 74 + j * 66
      const row = dcells(296, y, r, { s: 48, g: 10, seed: 200 + j * 5 })
      if (!decided) return row + dtext(486, y + 32, '?', { z: 22, c: 'mute' })
      return j ? `<g style="opacity:.5">${row}</g>` + dstrike(292, y + 26, 164) : row + dring(372, y + 26, 92, 34, 420) + dcheck(486, y + 16, 'ok')
    }).join('') + (decided ? dtag(482, 232, '还得记住先后', { z: 13, cls }) : ''), { tape: true, cls })

/** 个数有限：四个状态 */
const counts = (cls = '') =>
  dcard(310, 52, 294, 230, dtext(334, 88, '每敲一个字符，长度加 1', { z: 15 }) +
    [[], ['c'], ['c', 'a'], ['c', 'a', 't']].map((r, j) => {
      const y = 106 + j * 40
      return (r.length ? dcells(334, y, r, { s: 30, g: 6, seed: 300 + j * 4 }) : dcell(334, y, '', 'ghost', 30, 300)) + dtext(470, y + 22, '长度 ' + j, { z: 14, c: j === 3 ? 'acc' : 'ink' })
    }).join(''), { tape: true, cls })
const emptyEditor = dwin(40, 62, 240, 96, dfield(56, 100, 208, '', 0, 22), '刚启动的编辑器')

/** 可以重复：b o o k */
const book = (o: { idx?: boolean } = {}) =>
  dcells(70, 116, ['b', 'o', 'o', 'k'], { s: 72, g: 26, st: (i) => (i === 1 || i === 2 ? 'hi' : 'on'), idx: o.idx ? ['0', '1', '2', '3'] : undefined, red: (i) => i === 1 || i === 2 })

/** 回到问题 1：四个要点打勾 + 问题卡 */
const answer = (o: { ticks?: boolean; done?: boolean; cls?: string } = {}) =>
  dcork(36, 46, 380, 244, '线性表的四个要点', 54) +
  POINTS.map((s, i) => {
    const x = 58 + (i % 2) * 176, y = 108 + Math.floor(i / 2) * 86
    return dpinned(x, y, 160, 70, s, String(i + 1), i, { z: 15, rot: [-1.5, 1.5, -1, 2][i] }) + dcheck(x + 134, y + 4, 'ok')
  }).join('') +
  dcard(436, 60, 180, 214, dtext(452, 92, '问题 1', { z: 13, c: 'badge' }) + dtext(452, 118, '程序要记住什么？', { z: 14 }) +
    (o.ticks ? ['有哪些元素', '它们的先后', '现在有几个'].map((s, i) => dcheck(452, 140 + i * 36, 'ok') + dtext(480, 155 + i * 36, s, { z: 14 })).join('') : '') +
    (o.done ? dring(500, 112, 70, 22, 580) : ''), { rot: 2, tape: true, cls: o.cls })

// ───────── 第2屏：例题两张卡 ─────────
type Ex = {
  lm?: ('ok' | 'no' | '')[]; rm?: ('ok' | 'no' | '')[]; lrow?: string[]; rrow?: string[]
  arrows?: boolean; mark?: boolean; tree?: '' | 'lines' | 'hi'; lcls?: string; rcls?: string; logCls?: string; treeCls?: string; verdict?: boolean; focus?: 'l' | 'r'
}
const CK = ['同类型', '一个接一个', '个数有限']
const checkRows = (x: number, y: number, marks: ('ok' | 'no' | '')[] = [], rows: string[] = []) =>
  CK.map((s, i) => {
    const yy = y + i * 30, m = marks[i] ?? '', st = rows[i] ?? ''
    const band = st === 'on' ? dwob(x - 6, yy - 4, 236, 26, 5, 700 + x + i, { fill: 'acc-soft', stroke: 'none' }) : ''
    const label = dtext(x + 26, yy + 14, s, { z: 13, c: m === 'no' ? 'wrong' : 'ink', f: 's' }) + (m === 'no' ? dstrike(x + 26, yy + 9, s.length * 13) : '')
    return `<g style="opacity:${st === 'dim' ? 0.4 : 1}">${band}${dcheck(x, yy, m)}${label}</g>`
  }).join('')
const callLog = (o: Ex) =>
  `<g class="${o.logCls ?? ''}">${['通话 4 · 刚刚', '通话 3 · 昨天', '通话 2 · 周一', '通话 1 · 上周']
    .map((s, i) => dwob(58, 96 + i * 26, 150, 20, 4, 600 + i, { fill: 'field', sw: 0.8 }) + dtext(66, 110 + i * 26, s, { z: 12, f: 's' }) +
      (o.arrows && i < 3 ? dtext(216, 122 + i * 26, '↓', { z: 13, c: 'acc' }) : '') +
      (o.mark && (i === 1 || i === 2) ? dtext(226, 110 + i * 26, '前驱 1 后继 1', { z: 12, c: 'acc', f: 's' }) : '')).join('')}</g>`
const tree = (o: Ex) => {
  const kids = [384, 450, 516]
  const lines = o.tree === 'lines' || o.tree === 'hi' ? kids.map((x) => dcurve(450, 116, x + (450 - x) * 0.3, 130, x, 148, o.tree === 'hi' ? 'acc' : 'ink')).join('') : ''
  return `<g class="${o.treeCls ?? ''}">${dwob(424, 94, 52, 22, 5, 640, { fill: 'off' })}${dtext(450, 110, '祖辈', { z: 12, a: 'middle', f: 's' })}${lines}${kids.map((x, i) => dwob(x - 24, 150, 48, 22, 5, 641 + i, { fill: 'off' }) + dtext(x, 166, '孩子', { z: 12, a: 'middle', f: 's' })).join('')}</g>`
}
const ex = (o: Ex, extra = '') =>
  dframe('例题',
    dcard(36, 52, 272, 236, dtext(56, 84, '通话记录', { z: 16 }) + dtext(132, 84, '从新到旧', { z: 12, c: 'mute', f: 's' }) + callLog(o) + checkRows(58, 208, o.lm, o.lrow), { rot: o.focus === 'l' ? -1.5 : -0.5, tape: true, cls: o.lcls }) +
    dcard(332, 52, 272, 236, dtext(352, 84, '家谱', { z: 16 }) + tree(o) + checkRows(352, 208, o.rm, o.rrow) +
      (o.rm?.[1] === 'no' ? dtext(470, 196, '后继不止一个', { z: 12, c: 'acc', f: 's' }) : ''), { rot: o.focus === 'r' ? 1.5 : 0.5, tape: true, cls: o.rcls }) + extra, 59)
const verdicts = (cls = '') => dtag(196, 40, '✓ 线性表', { z: 14, cls }) + dcard(486, 40, 104, 32, dtext(498, 61, '✗ 不是', { z: 14, c: 'paper' }), { fill: 'wrong', rot: 3, r: 3, cls })

// ───────── 第3、4屏：练习 ─────────
const OPTS1 = ['编辑器里的一行字 cat', '一周的七天', '按学号排好的花名册', '电脑里的文件夹目录', '城市的地铁线路网', '抽奖箱里的号码球', '全体正整数 1, 2, 3, …']
const quiz1 = (cls = '') =>
  dsticky(36, 70, 170, 150, ['判断的办法', '① 同一种东西？', '② 一个接一个？', '③ 个数有限？'], { rot: -3, cls }) +
  dcard(230, 46, 380, 244, druled(246, 100, 348, 8) + `<line x1="270" y1="52" x2="270" y2="284" style="stroke:var(--margin-line);stroke-width:1px"/>` +
    dtext(284, 80, '练习 1　哪些能看成线性表？', { z: 15 }) + OPTS1.map((s, i) => dcheck(284, 92 + i * 28, '') + dtext(310, 105 + i * 28, s, { z: 13, f: 's' })).join(''), { tape: true, cls })
const OPTS2 = ['不是，线性表要求元素按从小到大排好', '是，线性表只要求元素一个接一个，不要求按大小排', '不是，c、a、t 是三个不同的字符，不算同类型']
const quiz2 = (cls = '') =>
  dcard(110, 60, 420, 220, druled(126, 126, 388, 6, 30) + dtext(132, 92, '练习 2　c、a、t 没按字母顺序排，还是线性表吗？', { z: 15 }) +
    OPTS2.map((s, i) => dwob(132, 120 + i * 40, 18, 18, 9, 800 + i, { fill: 'paper', sw: 1.6 }) + dtext(160, 134 + i * 40, s, { z: 13, f: 's' })).join(''), { tape: true, cls })
const sorted = (cls = '') => dsticky(40, 62, 210, 96, ['有序 ≠ 排好序', '位置有先后，', '不是按大小排'], { rot: -2, z: 15, cls })

// ───────── 第5屏：小结笔记本 ─────────
const notebook = (next: boolean, cls = '') =>
  `<g class="${cls}"><rect x="94" y="48" width="452" height="242" rx="6" style="fill:var(--shadow)"/>` + dwob(90, 44, 452, 242, 6, 870, { fill: 'paper', sw: 2.2 }) + dline(316, 44, 316, 286, 871) +
  druled(106, 108, 198, 7) + druled(328, 108, 200, 7) + dtext(108, 84, '2.1 什么是线性表', { z: 18 }) +
  POINTS.map((s, i) => dcheck(110, 100 + i * 34, 'ok') + dtext(138, 115 + i * 34, s, { z: 15 })).join('') +
  dtext(110, 262, '一行字 = 一个字符的线性表', { z: 13, c: 'mute', f: 's' }) +
  (next ? dtext(334, 84, '下一步', { z: 14, c: 'badge' }) + dtext(334, 120, '问题 2：', { z: 16 }) + dtext(334, 148, '编辑器要对这一行字', { z: 15 }) + dtext(334, 174, '做哪些事？', { z: 15 }) + dring(372, 168, 48, 18, 880) : '') + '</g>'

export const frames: Frame[] = [
  // ───────── 第0屏　章首开场 ─────────
  {
    beat: 1, reveal: 'spread',
    pic: '墙上依次贴上三个窗口卡：搜索框、聊天框、文件名框；手写标签和弯箭头标名',
    html: dframe(S0, threeBoxes(NEW) + dcurve(118, 180, 100, 200, 128, 214) + dtext(60, 232, '搜索框', { z: 15 }) +
      dcurve(560, 160, 600, 190, 566, 214) + dtext(540, 232, '聊天框', { z: 15 }) + dtext(436, 292, '起名字的框', { z: 15 }) + dcurve(470, 278, 470, 266, 458, 262), 1),
  },
  {
    beat: 3,
    pic: '三个框收成一个"单行编辑器"大窗口，只有闪烁的光标；红笔弯箭头标"光标"；桌上放一把键盘',
    html: dframe(S0, bigEditor('', 0, NEW) + `<g class="${NEW}">${dtext(470, 196, '光标', { z: 16, c: 'acc' })}${dcurve(468, 190, 420, 180, curX(0) + 2, 142, 'acc')}</g>` + keyboard(0), 3),
  },
  {
    beat: 5, reveal: 'spread',
    pic: '键盘上 c、a、t 三个键依次标上步号 1、2、3，编辑器里依次出现 c、ca、cat',
    html: dframe(S0, bigEditor('cat', 3, NEW) + keyboard(3), 5),
  },
  { beat: 6, pic: '← 键标上步号 4，光标左移到 a 和 t 之间', html: dframe(S0, bigEditor('cat', 2, NEW) + keyboard(4), 6) },
  { beat: 7, pic: 'x 键的步号 5 是红色，x 插进 a 和 t 之间', html: dframe(S0, bigEditor('caxt', 3, NEW) + keyboard(5, 4), 7) },
  { beat: 8, pic: '退格键标上步号 6，x 消失', html: dframe(S0, bigEditor('cat', 2, NEW) + keyboard(6), 8) },
  { beat: 9, reveal: 'spread', pic: '软木板上依次钉上六张卡片，每张是做完一步之后的那一行', html: dframe(S0, replayBoard(NEW), 9) },
  {
    beat: 10,
    pic: '软木板右边贴一张便利贴"所以程序得一直记着这一行"',
    html: dframe(S0, replayBoard() + dsticky(496, 86, 124, 96, ['所以程序', '得一直', '记着这一行'], { rot: 3, z: 15, cls: NEW }), 10),
  },
  { beat: 11, pic: '编辑器窗口歪到左边，c、a、t 拆成三张纸卡格子贴在白卡上，下面蓝点编号 0 1 2', html: dframe(S0, toCells(NEW), 11) },
  {
    beat: 12,
    pic: '白卡右下角斜贴一张鲑鱼粉标签"线性表 LINEAR LIST"',
    html: dframe(S0, toCells() + dtag(400, 232, '线性表 LINEAR LIST', { rot: -3, z: 16, cls: NEW }), 12),
  },
  { beat: 13, pic: '目标卡贴在墙中间：编辑器小图 + "编辑器 1.0" + "学完 2.1–2.6，用 C 亲手做出来"', html: dframe(S0, goal(230, 70, NEW), 13) },
  {
    beat: 16,
    pic: '左边编辑器窗口，右边"程序"窗口卡写着它记着的东西：这一行 c a t、光标位置 2；两张卡之间一根虚线弯箭头',
    html: dframe(S0,
      dwin(44, 90, 230, 96, dfield(58, 128, 202, 'cat', 2, 24), '编辑器') + dcurve(280, 140, 320, 112, 360, 140, 'mute') +
      dwin(366, 70, 236, 160, dtext(386, 124, '记着：', { z: 15 }) + dcells(386, 136, ['c', 'a', 't'], { s: 34, g: 6 }) + dtext(386, 206, '光标在第 2 格后面', { z: 13, c: 'mute', f: 's' }), '程序', { cls: NEW }), 15),
  },
  { beat: 17, pic: '目标卡挪到左边；右边软木板钉上第 1 张问题卡', html: dframe(S0, goal(36, 70) + qboard(1, 0), 17) },
  { beat: 18, pic: '钉上第 2 张问题卡', html: dframe(S0, goal(36, 70) + qboard(2, 1), 18) },
  { beat: 19, pic: '钉上第 3 张问题卡', html: dframe(S0, goal(36, 70) + qboard(3, 2), 19) },
  {
    beat: 20,
    pic: '红笔圈住第 1 张问题卡；左边便利贴"先记住这三问，我们从第一个开始"，弯箭头指过去',
    html: dframe(S0, qboard(3) + dring(338, 145, 96, 50, 201, NEW) + dsticky(40, 90, 170, 118, ['先记住这三问，', '我们从', '第一个开始'], { rot: -3, z: 16, cls: NEW }) + dcurve(212, 150, 226, 146, 240, 145), 20),
  },

  // ───────── 第1屏　什么是线性表 ─────────
  { beat: 21, pic: '大白卡"这一行字，可以看成一个线性表"，c、a、t 三张格子', html: dframe(S1, board(dcells(70, 120, ['c', 'a', 't'], { s: 64, g: 22 }), '这一行字，可以看成一个线性表', NEW), 21) },
  { beat: 22, pic: '格子换成一串空格子 □□□…□，标题"n 个同类型的元素，排成一列"', html: dframe(S1, board(`<g class="${NEW}">${blanks()}</g>`, 'n 个同类型的元素，排成一列'), 22) },
  { beat: 24, pic: '格子下面手画一道括线，写"长度 n"', html: dframe(S1, board(blanks() + brace(NEW), 'n 个同类型的元素，排成一列'), 24) },
  {
    beat: 25,
    pic: '格子下面出现蓝点编号 0、1、2 … n−1；右下角斜贴标签"(a₀, a₁, …, aₙ₋₁)"',
    html: dframe(S1, board(`<g class="${NEW}">${blanks({ idx: true })}</g>` + brace() + dtag(396, 232, '(a₀, a₁, …, aₙ₋₁)', { rot: 2, cls: NEW }), 'n 个同类型的元素，排成一列'), 25),
  },
  {
    beat: 26,
    pic: '第 0 格和最后一格变成浅红底，编号点变红',
    html: dframe(S1, board(`<g class="${NEW}">${blanks({ idx: true, ends: true })}</g>` + brace() + dtag(396, 232, '(a₀, a₁, …, aₙ₋₁)', { rot: 2 }), '第 0 个是 a₀，最后一个是第 n−1 个'), 26),
  },
  {
    beat: 27,
    pic: '空格子换回 c、a、t，编号 0 1 2；下面写 (c, a, t)',
    html: dframe(S1, half(`<g class="${NEW}">${dcells(70, 116, ['c', 'a', 't'], { s: 72, g: 24, idx: ['0', '1', '2'] })}${dtext(70, 252, '(c, a, t)', { f: 'm', z: 20 })}</g>`, '屏幕上的 cat'), 27),
  },
  {
    beat: 28,
    pic: '右边贴一张便利贴，大大的红色"3"：长度是 3',
    html: dframe(S1, half(dcells(70, 116, ['c', 'a', 't'], { s: 72, g: 24, idx: ['0', '1', '2'] }) + dtext(70, 252, '(c, a, t)', { f: 'm', z: 20 }), '屏幕上的 cat') +
      dsticky(440, 80, 170, 150, ['长度'], { rot: 3, z: 16, cls: NEW }) + dtext(510, 200, '3', { f: 'm', z: 76, a: 'middle', c: 'acc' }), 28),
  },
  { beat: 29, pic: '软木板钉上四张要点卡；红笔圈住第 1 张；旁边标签"逐条看"', html: dframe(S1, pointsBoard({ ring: 0, cls: NEW }) + dtag(420, 228, '逐条看', { z: 16 }), 29) },
  { beat: 30, pic: '大白卡"表里的元素都是同一种东西"：c、a、t 上各贴一张"字符"小标签', html: dframe('要点 1 · 同类型', half(typed(NEW), '表里的元素都是同一种东西'), 30) },
  {
    beat: 32,
    pic: '右边一张写着 7 的卡片和一张图片卡被甩在一边、歪着，各打一个灰叉',
    html: dframe('要点 1 · 同类型',
      half(typed(), '表里的元素都是同一种东西') +
      `<g class="${NEW}">${dcard(450, 90, 64, 64, dtext(482, 132, '7', { f: 'm', z: 30, a: 'middle', c: 'wrong' }), { rot: 14 })}${dcheck(512, 84, 'no')}` +
      dcard(456, 164, 110, 74, `<rect x="468" y="174" width="86" height="54" rx="4" style="fill:var(--photo)"/><path d="M472 224 l26 -30 l18 22 l12 -10 l22 18" style="fill:var(--photo-hill);stroke:var(--ink);stroke-width:1px"/>`, { rot: -8 }) + dcheck(560, 160, 'no') + '</g>', 32),
  },
  {
    beat: 33,
    pic: '一排六张一模一样的空格子；便利贴"只准备一种格子，专门放字符"',
    html: dframe('要点 1 · 同类型', half(`<g class="${NEW}">${dcells(64, 130, Array(6).fill(''), { s: 46, g: 8 })}</g>`, '所以程序只需要一种格子') + dsticky(440, 90, 170, 100, ['只准备一种格子，', '专门放字符'], { rot: 3, cls: NEW }), 33),
  },
  { beat: 34, pic: '大白卡上 c → a → t，三张格子之间画手绘箭头', html: dframe('要点 2 · 一个接一个', board(`<g class="${NEW}">${seq(false)}</g>`), 34) },
  { beat: 35, pic: 'a 变成浅红底，红笔圈住；左上手写"前驱"，弯箭头指向 a 前面的 c', html: dframe('要点 2 · 一个接一个', board(seq(true) + `<g class="${NEW}">${SEQ_RING}</g>` + pred(NEW)), 35) },
  { beat: 36, pic: '右上手写"后继"，弯箭头', html: dframe('要点 2 · 一个接一个', board(seq(true) + SEQ_RING + pred() + succ(NEW)), 36) },
  { beat: 37, pic: 'c 下面灰字"无前驱"', html: dframe('要点 2 · 一个接一个', board(seq(true) + SEQ_RING + pred() + succ() + noPred(NEW)), 37) },
  { beat: 38, pic: 't 下面灰字"无后继"', html: dframe('要点 2 · 一个接一个', board(seq(true) + SEQ_RING + pred() + succ() + noPred() + noSucc(NEW)), 38) },
  {
    beat: 39,
    pic: '两个编辑器窗口并排：cat 和 act，中间一个红色 ≠',
    html: dframe('要点 2 · 一个接一个',
      dwin(60, 100, 220, 96, dfield(76, 138, 188, 'cat', -1, 26), '这一行', { rot: -2 }) + dtext(320, 168, '≠', { z: 40, c: 'acc', a: 'middle' }) +
      dwin(360, 100, 220, 96, dfield(376, 138, 188, 'act', -1, 26), '另一行', { rot: 2, cls: NEW }) + dtext(320, 240, '两行不同的字', { z: 15, a: 'middle' }), 39),
  },
  {
    beat: 41,
    pic: '左边便利贴"程序只记了：c、a、t 各一个"；右边白卡列出 cat、act、tca 三行，每行后面一个问号',
    html: dframe('要点 2 · 一个接一个', dsticky(40, 74, 170, 140, ['程序只记了：', 'c、a、t', '各一个'], { rot: -3, z: 16, cls: NEW }) + dcurve(214, 150, 240, 140, 262, 150, 'mute') + cands(false, NEW), 41),
  },
  {
    beat: 42,
    pic: 'cat 被红笔圈住、打勾；act、tca 变灰划掉；右下角标签"还得记住先后"',
    html: dframe('要点 2 · 一个接一个', dsticky(40, 74, 170, 140, ['程序只记了：', 'c、a、t', '各一个'], { rot: -3, z: 16 }) + dcurve(214, 150, 240, 140, 262, 150, 'mute') + cands(true, NEW), 42),
  },
  {
    beat: 43,
    pic: '左边"刚启动的编辑器"窗口，只有光标；下面标签"() 长度 0"',
    html: dframe('要点 3 · 个数有限', `<g class="${NEW}">${emptyEditor}</g>` + dtag(70, 172, '()　长度 0', { z: 15, cls: NEW }), 43),
  },
  {
    beat: 45,
    pic: '标签旁边贴一张便利贴"这叫空表：编辑器刚启动时就是"',
    html: dframe('要点 3 · 个数有限', emptyEditor + dtag(70, 172, '()　长度 0', { z: 15 }) + dsticky(300, 90, 210, 96, ['这叫空表', '编辑器刚启动时', '就是空表'], { rot: 2, cls: NEW }), 45),
  },
  {
    beat: 47, reveal: 'spread',
    pic: '右边白卡依次出现 4 行：空、c、ca、cat，后面写长度 0、1、2、3（3 是红字）；左下便利贴"显示到哪里为止？看长度"',
    html: dframe('要点 3 · 个数有限', emptyEditor + dtag(70, 172, '()　长度 0', { z: 15 }) + counts(NEW) + dsticky(64, 212, 200, 70, ['显示到哪里为止？', '看长度'], { rot: 2 }), 47),
  },
  { beat: 50, pic: '大白卡"敲 book 时有两个 o"：b o o k 四张格子，两个 o 是浅红底', html: dframe('要点 4 · 可以重复', board(`<g class="${NEW}">${book()}</g>`, '敲 book 时有两个 o'), 50) },
  {
    beat: 52,
    pic: '红笔把两个 o 一起圈住，编号 1、2 变红；右边便利贴"一样的字符，各占一个位置"',
    html: dframe('要点 4 · 可以重复', board(book({ idx: true }) + dring(254, 152, 104, 54, 520, NEW) + dsticky(462, 92, 124, 96, ['一样的字符，', '各占', '一个位置'], { rot: 3, z: 13, cls: NEW }), '敲 book 时有两个 o'), 52),
  },
  { beat: 54, pic: '四个要点卡全部打勾；右边贴上"问题 1：程序要记住什么？"卡片', html: dframe('回到问题 1', answer({ cls: NEW }), 54) },
  { beat: 57, pic: '问题卡上写出三样东西并打勾：有哪些元素、它们的先后、现在有几个', html: dframe('回到问题 1', answer({ ticks: true, cls: NEW }), 57) },
  { beat: 58, pic: '红笔圈住问题卡的标题：问题 1 答完了', html: dframe('回到问题 1', answer({ ticks: true, done: true }), 58) },

  // ───────── 第2屏　例题 ─────────
  { beat: 59, pic: '两张白卡贴上墙：左边通话记录、右边家谱，下面各三行空复选框', html: ex({ lcls: NEW, rcls: NEW }) },
  { beat: 60, pic: '左卡的通话记录列表"从新到旧"', html: ex({ logCls: NEW }) },
  { beat: 61, pic: '右卡的家谱：祖辈和三个孩子', html: ex({ treeCls: NEW }) },
  { beat: 62, pic: '左卡微微转正，开始检查', html: ex({ focus: 'l', lcls: NEW }) },
  { beat: 63, pic: '"同类型"打红勾，这一行垫浅红底', html: ex({ focus: 'l', lm: ['ok'], lrow: ['on'] }) },
  { beat: 64, pic: '记录之间出现红色小箭头', html: ex({ focus: 'l', lm: ['ok'], arrows: true, lrow: ['', 'on'], logCls: NEW }) },
  { beat: 65, pic: '中间两条记录旁写"前驱 1 后继 1"', html: ex({ focus: 'l', lm: ['ok'], arrows: true, mark: true, lrow: ['', 'on'], logCls: NEW }) },
  { beat: 66, pic: '"一个接一个"打勾', html: ex({ focus: 'l', lm: ['ok', 'ok'], arrows: true, lrow: ['', 'on'] }) },
  { beat: 67, pic: '"个数有限"打勾', html: ex({ focus: 'l', lm: ['ok', 'ok', 'ok'], arrows: true, lrow: ['', '', 'on'] }) },
  { beat: 68, pic: '右卡微微转正，开始检查', html: ex({ focus: 'r', lm: ['ok', 'ok', 'ok'], arrows: true, rcls: NEW }) },
  { beat: 69, pic: '右卡"同类型"打勾', html: ex({ focus: 'r', lm: ['ok', 'ok', 'ok'], arrows: true, rm: ['ok'], rrow: ['on'] }) },
  { beat: 70, pic: '祖辈到孩子画上连线', html: ex({ focus: 'r', lm: ['ok', 'ok', 'ok'], arrows: true, rm: ['ok'], tree: 'lines', rrow: ['', 'on'], treeCls: NEW }) },
  { beat: 71, pic: '三条连线一起变红', html: ex({ focus: 'r', lm: ['ok', 'ok', 'ok'], arrows: true, rm: ['ok'], tree: 'hi', rrow: ['', 'on'], treeCls: NEW }) },
  { beat: 72, pic: '"一个接一个"打灰叉、变灰划掉；旁边红字"后继不止一个"', html: ex({ focus: 'r', lm: ['ok', 'ok', 'ok'], arrows: true, rm: ['ok', 'no'], tree: 'hi', rrow: ['', 'on'] }) },
  { beat: 73, pic: '"个数有限"那行压暗：不用再看', html: ex({ focus: 'r', lm: ['ok', 'ok', 'ok'], arrows: true, rm: ['ok', 'no'], tree: 'hi', rrow: ['', '', 'dim'] }) },
  {
    beat: 74,
    pic: '两张卡顶上各贴一张结论标签：左"✓ 线性表"（鲑鱼粉），右"✗ 不是"（灰）',
    html: ex({ lm: ['ok', 'ok', 'ok'], arrows: true, rm: ['ok', 'no'], tree: 'hi', rrow: ['', '', 'dim'] }, verdicts(NEW)),
  },
  {
    beat: 76,
    pic: '两张卡的第二行都垫上浅红底，其余检查行压暗：差别只在"一个接一个"',
    html: ex({ lm: ['ok', 'ok', 'ok'], arrows: true, rm: ['ok', 'no'], tree: 'hi', lrow: ['dim', 'on', 'dim'], rrow: ['dim', 'on', 'dim'] }, verdicts()),
  },

  // ───────── 第3屏　练习1 ─────────
  { beat: 77, pic: '左边便利贴写判断的办法；右边横线本子纸上是练习 1 和七个空复选框', html: dframe('练习 1', quiz1(NEW), 77) },
  { after: 79, pic: '**暂停，等学生作答**；作答后每个选项下面显示解析，不配旁白', html: dframe('练习 1', quiz1(), 79) + pause('等学生作答；作答后每个选项下显示解析，不配旁白') },

  // ───────── 第4屏　练习2 ─────────
  { beat: 80, pic: '横线本子纸上是练习 2 和三个单选项', html: dframe('练习 2', quiz2(NEW), 80) },
  { after: 81, pic: '**暂停，等学生作答**；作答后显示选项解析', html: dframe('练习 2', quiz2(), 81) + pause('等学生作答；作答后显示选项解析') },
  { beat: 82, pic: '左上便利贴"有序 ≠ 排好序：位置有先后，不是按大小排"', html: dframe('练习 2', sorted(NEW), 82) },
  {
    beat: 84,
    pic: '右边白卡上 (c, a, t) 和 (a, c, t) 两排格子都打勾，中间红色 ≠；左下卡片"都是线性表，而且是两个不同的表"',
    html: dframe('练习 2', sorted() +
      dcard(274, 52, 330, 230, dcells(300, 84, ['c', 'a', 't'], { s: 52, g: 12, idx: ['0', '1', '2'] }) + dcheck(504, 100, 'ok') + dtext(568, 180, '≠', { z: 34, c: 'acc', a: 'middle' }) +
        dcells(300, 186, ['a', 'c', 't'], { s: 52, g: 12, idx: ['0', '1', '2'], seed: 400 }) + dcheck(504, 202, 'ok'), { tape: true, cls: NEW }) +
      dcard(40, 186, 210, 82, dtext(56, 216, '都是线性表，', { z: 14 }) + dtext(56, 240, '而且是两个不同的表', { z: 14 }), { rot: 1.5, cls: NEW }), 84),
  },

  // ───────── 第5屏　节尾 ─────────
  { beat: 87, pic: '桌上摊开笔记本"2.1 什么是线性表"，四个要点逐条打红勾', html: dframe('2.1 小结', notebook(false, NEW), 87) },
  { beat: 90, pic: '笔记本右页写"下一步 问题 2：编辑器要对这一行字做哪些事？"，红笔圈住"做哪些事"', html: dframe('2.1 小结', notebook(true), 90) },
]
