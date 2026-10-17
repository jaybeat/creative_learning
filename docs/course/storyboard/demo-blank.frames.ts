// 空位演示（docs/course/demo-blank.md，不是课程）：例题的空位按拍填上，练习是填空题。
// 质感版和"原版"共用这一套帧（demo-blank.clean.frames.ts 直接转出），播放器要求两套帧位一致。
import { at, card, pause, ckick, ctitle, cbadge, cblanks } from './kit'
import type { Frame } from '../../../scripts/lib/course'

export const quizSource = { file: 'book/chapters/ch02.md', section: '2.2' }
export const say: Record<number, string> = {}

/** 例题三行：[动作, 调用, 表] */
const ROWS = [
  ['启动', 'Init(L)', '()'],
  ['敲 c', 'Insert(L, 0, c)', '(c)'],
  ['敲 a', 'Insert(L, 1, a)', '(c, a)'],
]
/** 第2拍填第1行，第3拍填第2行；第4拍逐个写，演示"第几行第几个空" */
const FILL: Record<number, number | [number, number][]> = { 2: 1, 3: 2, 4: [[3, 1], [3, 2]] }

const head = (kick: string, t: string) => at(40, 16, ckick(kick)) + at(40, 44, ctitle(t))
const example = (o: { rows?: string; extra?: string } = {}) =>
  head('例题', '一串编辑动作对应哪些操作？') +
  at(40, 92, card('编辑器刚启动，依次敲 c、a。填出每一步调用的操作，和调用之后的表。', '', 'width:560px;padding:10px 14px')) +
  at(40, 156, cblanks(ROWS, FILL, { w: [150, 90], cls: o.rows })) +
  (o.extra ?? '')

export const frames: Frame[] = [
  // 双栏稿一拍一个画面，所以一拍一帧；各帧传同一个 FILL：已经过去的拍画成填好的，这一拍的空在拍首淡入
  { beat: 1, html: example({ rows: 'new' }) },
  { beat: 2, html: example() },
  { beat: 3, html: example() },
  { beat: 4, html: example({ extra: at(470, 156, cbadge('长度 2', 'new')) }) },

  { beat: 5, html: head('练习 1 · 填空', '每一步之后，表是什么？') },
  { after: 5, html: head('练习 1 · 填空', '每一步之后，表是什么？') + pause('等学生作答；作答后显示解析') },
  { beat: 6, html: head('练习 2 · 填空', '编辑动作对应哪个调用？') },
  { after: 6, html: head('练习 2 · 填空', '编辑动作对应哪个调用？') + pause('等学生作答；作答后显示解析') },
  { beat: 7, html: head('练习 2 · 填空', '编辑动作对应哪个调用？') + at(40, 110, cbadge('Insert：0 ≤ i ≤ n', 'new')) + at(220, 110, cbadge('Delete：0 ≤ i ≤ n−1', 'new')) },
]
