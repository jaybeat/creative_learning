// 3.6 质感层分镜帧（npm run storyboard -- 3-6）。双栏稿 docs/course/3-6.md。
// 痛点 → 后缀式 → 加括号法（人看得见整个式子）→ 程序从左往右扫（写法库第 17 条 + 第 13 条）。版面：
// - 第0屏问题屏：左卡 (40,86) 272×212"人"（式子 + 三条括线），右卡 (328,86) 272×212"程序"（字符带 + 读头），胶囊在 (40,312)；
// - 第1–2屏：左卡"写法"（中缀 → 后缀，后缀格子原位填上），右卡"读法"（一行一步化简到 10），胶囊位 (40,316)；
// - 第3–4屏：左栏目标卡 (40,86) 248 宽 + 三步列表（第4屏才出现），右卡 (304,86) 296×264 演示：一行式子原位长括号，下面一行行挪运算符；
// - 第5–10屏转换机：右栏 (372,·) 宽 228 三张卡不动——输入卡 (372,86)、栈卡 (372,160)、输出卡 (372,290)，只换里面的字；
//   左栏 (40,86) 宽 308：第6–8屏是规定卡 + 四行列表（推导记录 → 收拢成三条），第9屏起换成伪代码卡（第10屏原位插进括号分支）；
// - 第11–12屏：左边代码卡 (40,86) 360×264（12px、行高 14，超过 15 行就像编辑器一样往上滚），右边 (412,86) 188 宽是伪代码面板 / 运行结果。
// 第68拍"放着"的虚线框原位变成实线的"栈"，是转换机部分的关键时刻。帧里不写色值，样式在 scripts/lib/clean.ts（STACK_CSS、EDITOR_CSS）。
import path from 'node:path'
import { at, card, pause, ckick, ctitle, cchip, cslot, cbadge, cqpill, cblank, copt, cquiz, cqchips, cqbar, cqex, ctape, cstack } from './kit'
import { highlightC } from '../../../scripts/lib/code-hl'
import { parseScript, ROOT, type Frame } from '../../../scripts/lib/course'

export const quizSource = { file: 'book/chapters/ch03.md', section: '3.6' }

// ───────── 念法：旁白里反引号中的式子，数字一个一个念，运算符念成字（字幕仍显示原文） ─────────
const DIG = '零一二三四五六七八九'
const OPW: Record<string, string> = { '+': '加', '-': '减', '*': '乘', '/': '除', '(': '左括号', ')': '右括号', '=': '等于' }
function speakCode(s: string): string {
  if (s === "'\\0'") return '反斜杠零'
  const q = s.match(/^'(.)'$/)
  if (q) return q[1] === '+' ? '加号' : OPW[q[1]] ?? q[1]
  if (s === 'GetTop') return 'get top'
  // 单独一个运算符念"乘号""减号"（"乘号在等它的右边"），式子里的才念"乘""减"
  const one: Record<string, string> = { '+': '加号', '-': '减号', '*': '乘号', '/': '除号', '(': '左括号', ')': '右括号' }
  if (one[s]) return one[s]
  if (/^[A-Za-z_]\w*$/.test(s) || !/[0-9+\-*/()]/.test(s)) return s
  // 式子里的括号照口语念："(3+4)*2"念"括号 三 加 四，乘 二"：左括号念"括号"，右括号念成一个停顿
  return [...s].filter((c) => c !== ' ').map((c) => (/\d/.test(c) ? DIG[Number(c)] : c === '(' ? '括号' : c === ')' ? '，' : OPW[c] ?? c)).join(' ').replace(/ ，( ，)*/g, '，').replace(/，$/, '')
}
// 这几拍的式子画面上已经写出来了，括号一层层念出来又长又绕，送合成的文字单独写（字幕仍是原文）
const SAY_FIX: Record<number, string> = {
  34: '先找最先算的乘号。它的两个运算对象是4和2，圈起来。',
  35: '再找加号。它左边是3，右边是刚圈好的四乘二，圈起来。',
  36: '最后找减号。它左边是整个三加四乘二，右边是1，圈起来。',
  44: '再做括号三加四，乘二。原来的括号已经管住了三加四，再给乘法加一对括号；',
  45: '挪运算符，再去掉括号，得三 四 加 二 乘。',
  114: '这样后缀式里不用空格分开，三四二乘加一减连着写就行。',
}
export const say: Record<number, string> = {
  ...Object.fromEntries(
    parseScript(path.join(ROOT, 'docs/course/3-6.md')).screens.flatMap((s) => s.beats)
      .filter((b) => b.text.includes('`') || b.text.includes('**')) // 加粗记号也不能送去合成
      .map((b) => [b.n, b.text.replace(/`([^`]+)`/g, (_, s: string) => speakCode(s)).replace(/\*\*/g, '')]),
  ),
  ...SAY_FIX,
}

const ok = '<b class="okm">✓</b>'
const cap = (s: string, cls = '') => `<span class="c-cap ${cls}" style="white-space:nowrap">${s}</span>`
const lines2 = (...ss: string[]) => `<div style="display:flex;flex-direction:column;gap:2px">${ss.map((s) => `<div>${s}</div>`).join('')}</div>`
const nw = (s: string) => `<span class="new">${s}</span>`
const hl = (s: string) => `<span class="hl new">${s}</span>`
const isDigit = (c: string) => /\d/.test(c)

// ───────── 标题区：两枚问题胶囊 ─────────
const Q1 = '能不能让书写的顺序就是计算的顺序？', Q2 = '怎么把中缀式变成后缀式？'
const KQ1 = (done = false, cls = '') => ckick(`问题 ① · ${Q1}${done ? ` ${ok}` : ''}`, cls)
const KQ = (done = false, cls = '') => ckick(`问题 ② · ${Q2}${done ? ` ${ok}` : ''}`, cls)
const T0 = '中缀表达式转后缀表达式', TW = '把运算符写在后面', TB = '加括号法', T1 = '运算符什么时候写出去', T5 = '括号', T6 = '写成函数'
const head = (title: string, o: { kick?: string; tcls?: string } = {}) =>
  (o.kick ? at(40, 16, o.kick) : '') + at(40, 44, ctitle(title).replace('c-title', `c-title ${o.tcls ?? ''}`))
const PILL1 = (cls = '') => at(40, 312, cqpill(1, Q1, `on ${cls}`))
const PILL2 = (cls = '') => at(40, 316, cqpill(2, Q2, `on ${cls}`))

// ───────── 第0屏左卡：人——式子下面三条括线 ─────────
const IN1 = [...'3+4*2-1'], IN2 = [...'8-2-1'], IN3 = [...'(3+4)*2']
const BRACES: [number, number, string][] = [[2, 4, '第1步：4*2 = 8'], [0, 4, '第2步：3+8 = 11'], [0, 6, '第3步：11-1 = 10']]
function HUMAN(o: { braces?: number; bcls?: string; cls?: string } = {}) {
  const P = 19, X = 24
  const br = BRACES.slice(0, o.braces ?? 0).map(([i, j, label], k) =>
    at(X + i * P + 3, 74 + 34 * k, `<div class="c-brace ${o.bcls ?? ''}" style="width:${(j - i + 1) * P - 6}px"><span style="white-space:nowrap">${label}</span></div>`)).join('')
  return at(40, 86, card(at(14, 10, cap('人：一眼看出先算哪一步')) + at(X, 38, ctape(IN1, { w: 20, h: 28, tcls: 'bare' })) + br,
    o.cls ?? '', 'width:272px;height:212px;padding:0'))
}

// ───────── 第0屏右卡：程序——字符带 + 读头 ─────────
type ProgO = { head?: number; cls1?: string[]; under?: [number, number, string?]; note?: string; paren?: boolean; pcls?: string[]; pbox?: string; concl?: string; cls?: string }
function PROG(o: ProgO = {}) {
  return at(328, 86, card(
    at(14, 10, cap('程序：从左往右一个一个读')) +
      at(14, 34, ctape(IN1, { head: o.head, rd: Math.max(0, o.head ?? 0), cls: o.cls1, under: o.under })) +
      (o.note ? at(14, 84, o.note) : '') +
      (o.paren ? at(14, 124, ctape(IN3, { cls: o.pcls, box: o.pbox ? [1, 3, '先算这里', o.pbox] : undefined })) : '') +
      (o.concl !== undefined ? at(14, 172, `<div class="c-q ${o.concl}" style="font-size:15px">计算的顺序 ≠ 书写的顺序</div>`) : ''),
    o.cls ?? '', 'width:272px;height:212px;padding:0'))
}
const OPS1 = [1, 3, 5]

// ───────── 第1–2屏左卡：写法——中缀式 → 后缀式，后缀格子原位填上 ─────────
const POST1 = [...'342*+1-'], POST3 = [...'34+2*']
type WriteO = { opn?: boolean; f1?: number[]; u1?: [number, number, string?]; row2?: boolean; f2?: number[]; u2?: [number, number, string?]; off2?: string; labels?: number; lcls?: string; f1cls?: string; f2cls?: string; cls?: string }
function WRITE(o: WriteO) {
  const tape = (post: string[], fill: number[] | undefined, fcls = '') =>
    ctape(post.map((c, i) => (fill?.includes(i) ? c : '')), { w: 16, h: 24, cls: post.map((_, i) => (fill?.includes(i) ? fcls : 'slot')) })
  const row1 = at(14, 52, ctape(IN1, { w: 16, h: 24, tcls: 'bare', cls: o.opn ? IN1.map((c) => (isDigit(c) ? 'hl new' : '')) : undefined, under: o.u1 })) +
    (o.f1 ? at(124, 56, cap('→')) + at(146, 52, tape(POST1, o.f1, o.f1cls)) : '')
  const row2 = o.row2 ? at(14, 112, ctape(IN3, { w: 16, h: 24, tcls: 'bare', under: o.u2, cls: o.off2 ? IN3.map((c) => ('()'.includes(c) ? o.off2! : '')) : undefined })) +
    at(124, 116, cap('→')) + at(146, 112, tape(POST3, o.f2, o.f2cls)) : ''
  const labels = ((o.labels ?? 0) >= 1 ? at(146, 28, `<span class="${(o.labels === 1 && o.lcls) || ''}">${cap('后缀式')}</span>`) : '') +
    ((o.labels ?? 0) >= 2 ? at(14, 28, `<span class="${(o.labels === 2 && o.lcls) || ''}">${cap('中缀式')}</span>`) : '')
  return at(40, 86, card(at(230, 8, cap('写法')) + labels + row1 + row2, o.cls ?? '', 'width:272px;height:220px;padding:0'))
}
const ALL1 = [0, 1, 2, 3, 4, 5, 6], ALL2 = [0, 1, 2, 3, 4]

// ───────── 第2屏右卡：读法——后缀式一行一步往下化简 ─────────
const READ_ROWS: string[][] = [[...'342*+1-'], ['3', '8', '+', '1', '-'], ['11', '1', '-'], ['10']]
type ReadO = { rows?: number; hl?: [number, number[]][]; nw?: [number, number[]][]; check?: string; concl?: string; to37?: string; cls?: string }
function READ(o: ReadO) {
  const rows = READ_ROWS.slice(0, o.rows ?? 1).map((r, k) => {
    const cls = r.map((_, i) => {
      const h = o.hl?.find(([kk]) => kk === k)?.[1].includes(i) ? 'hl' : ''
      const n = o.nw?.find(([kk]) => kk === k)?.[1].includes(i) ? 'new' : ''
      return `${h} ${n}`
    })
    return at(14, 34 + 38 * k, ctape(r, { w: 24, h: 28, cls }))
  }).join('')
  return at(328, 86, card(at(14, 8, cap('读法')) + rows +
    (o.check !== undefined ? at(70, 34 + 38 * 3 + 6, `<span class="${o.check}">${cap(`= 3+4*2-1 ${ok}`)}</span>`) : '') +
    (o.concl !== undefined ? at(14, 188, `<div class="c-q ${o.concl}" style="font-size:14px">运算符出现的顺序 = 计算的顺序</div>`) : '') +
    (o.to37 !== undefined ? at(120, 8, `<span class="${o.to37}">${cap('怎么扫一遍就算出来 → 3.7')}</span>`) : ''),
    o.cls ?? '', 'width:272px;height:220px;padding:0'))
}

// ───────── 第3–4屏：左栏目标卡 + 三步列表；右卡演示 ─────────
const STEPS3: { rn: string; rs?: string }[] = [
  { rn: '1  逐个找两个运算对象，加括号', rs: '先乘除后加减，一样高从左往右' },
  { rn: '2  运算符挪到右括号后面' },
  { rn: '3  去掉所有括号' },
]
function GOAL(o: { note?: string; steps?: number; scls?: string; on?: number[]; cls?: string } = {}) {
  return at(40, 86, card('<div class="c-q" style="font-size:14px;line-height:21px">目标：给每个运算符找到它的两个运算对象</div>', o.cls ?? '', 'width:248px;height:64px;padding:10px 12px')) +
    (o.note !== undefined ? at(40, 158, `<span class="${o.note}">${cap('找到一个，就圈一对括号')}</span>`) : '') +
    STEPS3.slice(0, o.steps ?? 0).map((s, k) => at(40, 182 + 50 * k,
      `<div class="c-li ${o.on?.includes(k) ? 'on' : ''} ${k === (o.steps ?? 0) - 1 ? o.scls ?? '' : ''}" style="width:248px"><span class="rn">${s.rn}</span>${s.rs ? `<span class="rs">${s.rs}</span>` : ''}</div>`)).join('')
}
// 括号原位长出来：按最后的样子 ((3+(4*2))-1) 先留好格子，还没加的括号是空格，字符不挪位置
const E_FULL = [...'((3+(4*2))-1)']
const E_SHOWN = [[2, 3, 5, 6, 7, 10, 11], [2, 3, 4, 5, 6, 7, 8, 10, 11], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], E_FULL.map((_, i) => i)]
const E_STEPS = E_SHOWN.map((shown) => E_FULL.map((c, i) => (shown.includes(i) ? c : '')))
const E_OPS = [3, 6, 10]
const MOVES = ['((3 + (4 2)*) - 1)', '((3 (4 2)*)+ - 1)', '((3 (4 2)*)+ 1)-']
const MOVE_TAG = ['挪 *', '挪 +', '挪 -']
const mono = (s: string, cls = '') => `<span class="tuple ${cls}" style="font-size:15px;white-space:pre">${s}</span>`
type DemoO = { e?: number; ehl?: number[]; moves?: number; mcls?: string; result?: string; cls?: string; body?: string }
function DEMO(o: DemoO) {
  const body = o.body ?? (
    at(14, 24, ctape(E_STEPS[o.e ?? 0], { w: 16, h: 26, tcls: 'bare', cls: E_STEPS[o.e ?? 0].map((_, i) => (o.ehl?.includes(i) ? 'hl new' : '')) })) +
    MOVES.slice(0, o.moves ?? 0).map((m, k) => at(14, 66 + 28 * k, `<span class="${o.mcls ?? ''}">${mono(m)}　${cap(MOVE_TAG[k])}</span>`)).join('') +
    (o.result !== undefined ? at(14, 162, `<span class="${o.result}">${ctape(POST1, { w: 20, h: 28 })}</span>`) : ''))
  return at(304, 86, card(body, o.cls ?? '', 'width:296px;height:264px;padding:0'))
}
// 第5屏左栏：人和程序的对照（第6屏起换成规定卡和列表）
const CMP = (cls = '') =>
  at(40, 86, `<div class="c-li ${cls}" style="width:308px"><span class="rn">人：看得见整个式子</span><span class="rs">先找 *，再回头处理 +，加括号</span></div>`) +
  at(40, 136, `<div class="c-li on ${cls}" style="width:308px"><span class="rn">程序：只能从左往右读</span><span class="rs">读到 + 时，后面还看不到</span></div>`)
// 第4屏右卡：(3+4)*2 三行 + 验算 + 程序的对照
type Demo2O = { rows?: number; rcls?: string; check?: string; prog?: 'num' | 'read'; pcls?: string }
const DEMO2 = (o: Demo2O) => DEMO({
  body:
    ((o.rows ?? 0) >= 1 ? at(14, 24, `<span class="${o.rows === 1 ? o.rcls ?? '' : ''}">${mono('((3+4)*2)')}</span>`) : '') +
    ((o.rows ?? 0) >= 2 ? at(14, 54, `<span class="${o.rows === 3 ? o.rcls ?? '' : ''}">${mono('((3 4)+ 2)*')}</span>`) : '') +
    ((o.rows ?? 0) >= 3 ? at(14, 84, `<span class="${o.rows === 3 ? o.rcls ?? '' : ''}">${ctape(POST3, { w: 20, h: 28 })}</span>`) : '') +
    (o.check !== undefined ? at(14, 124, `<span class="${o.check}">${cap(`+ 算 3 和 4 得 7，* 算 7 和 2 得 14　= (3+4)*2 ${ok}`)}</span>`) : '') +
    (o.prog === 'num' ? at(14, 168, `<span class="${o.pcls ?? ''}">${cap('人：先 *（1），再 +（2），最后 -（3）')}</span>`) + at(14, 192, ctape(IN1, { w: 22, h: 28, tcls: 'bare', cls: IN1.map((_, i) => (OPS1.includes(i) ? 'hl' : '')) })) : '') +
    (o.prog === 'read' ? at(14, 168, `<span class="${o.pcls ?? ''}">${cap('程序：读到 + 时，后面还没读到')}</span>`) + at(14, 192, ctape(IN1, { w: 22, h: 28, head: 1, cls: IN1.map((_, i) => (i > 1 ? 'rd' : '')) })) + at(180, 196, cap('？？', 'new')) : ''),
})

// ───────── 转换机：输入卡 + 栈卡 + 输出卡（右栏，第1–5屏不动） ─────────
type MO = {
  inp: string[]; head?: number; icls?: string[]; under?: [number, number, string?]; box?: [number, number, string, string?]
  stk?: string[]; dashed?: boolean; slabel?: string; lcls?: string; wall?: number; ring?: number; scls?: string[]; snotes?: (string | undefined)[]; side?: string; top?: boolean; stcls?: string
  out?: string[]; ocls?: string[]; oval?: string; alt?: string[]; acls?: string[]; aval?: string
  cls?: string
}
function M(o: MO) {
  const rd = o.head === undefined ? 0 : Math.max(0, o.head)
  const inpCard = at(372, 86, card(
    at(176, 4, cap('中缀式')) + at(14, 24, ctape(o.inp, { head: o.head, rd, cls: o.icls, under: o.under, box: o.box })),
    o.cls ?? '', 'width:228px;height:68px;padding:0'))
  const stkCard = at(372, 160, card(
    at(34, 8, cstack(o.stk ?? [], { dashed: o.dashed, label: o.slabel ?? (o.dashed ? '放着' : '栈'), lcls: o.lcls, wall: o.wall, ring: o.ring, cls: o.scls, notes: o.snotes, top: o.top, scls: o.stcls })) +
      (o.side ? at(90, 8, o.side) : ''),
    o.cls ?? '', 'width:228px;height:124px;padding:0'))
  const row = (toks: string[], cls: string[] | undefined, val: string | undefined, y: number) =>
    at(12, y, ctape(toks, { w: 24, h: 22, cls })) + (val ? at(182, y + 2, val) : '')
  const outCard = at(372, 290, card(
    (o.out?.length ? row(o.out, o.ocls, o.oval, 5) : at(12, 8, cslot('后缀式'))) + (o.alt ? row(o.alt, o.acls, o.aval, 32) : ''),
    o.cls ?? '', 'width:228px;height:60px;padding:0'))
  return inpCard + stkCard + outCard
}
const all = (n: number, c: string) => Array.from({ length: n }, () => c)
/** 把下标 ks 的格子标成 c，其余空着 */
const mark = (n: number, ks: number[], c: string) => Array.from({ length: n }, (_, i) => (ks.includes(i) ? c : ''))

// ───────── 左栏：规定卡 + 四行列表（推导记录 → 三条规则） ─────────
const RULE = (cls = '') => at(40, 86, card('<div class="c-q" style="font-size:14px;line-height:22px">规定：运算符写在它的两个运算对象后面</div>', cls, 'width:308px;height:40px;padding:8px 12px'))
type Row = { rn: string; rs?: string; cls?: string }
const LOG = (rows: (Row | null)[]) =>
  rows.map((r, k) => (r ? at(40, 136 + 50 * k, `<div class="c-li ${r.cls ?? ''}" style="width:308px"><span class="rn">${r.rn}</span>${r.rs ? `<span class="rs">${r.rs}</span>` : ''}</div>`) : '')).join('')
const R1a: Row = { rn: '+　右边还没读到 → 放着' }
const R1b: Row = { rn: '+　右边还没读到 → 放着', rs: '要写在 4 2 * 后面，接着等' }
const R2: Row = { rn: '*　右边还没读到 → 也放着' }
const R3: Row = { rn: '-　先弹出 * 和 +，再放着', rs: '* 比它高，+ 和它一样高' }
const R4: Row = { rn: '读完　弹出 -' }
const G1: Row = { rn: '① 读到数字：直接写出去' }
const G2: Row = { rn: '② 读到运算符：栈顶高或一样高就弹出', rs: '直到栈空或栈顶比它低，再入栈' }
const G3: Row = { rn: '③ 读完了：栈里剩下的依次弹出' }
const on = (r: Row, cls = 'on'): Row => ({ ...r, cls })

// ───────── 伪代码卡（第4–5屏左栏）：不写注释，左边槽里的编号对着三条规则 ─────────
const escp = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const DOTS = '<span class="ce-dots">⋯</span>'
type PL = { t: string; g?: string; cls?: string; fold?: boolean; ins?: string }
function PSEUDO(ls: PL[], cls = '') {
  const rows = ls.map((l) => {
    let t = escp(l.t)
    if (l.ins) t = t.replace(escp(l.ins), `<span class="hl new">${escp(l.ins)}</span>`)
    return `<div class="ce-ln ${l.cls ?? ''} ${l.fold ? 'fold' : ''}" style="height:14px;line-height:14px;font-size:12px"><i></i><b>${l.g ?? ''}</b><code>${t}${l.fold ? DOTS : ''}</code></div>`
  }).join('')
  return at(40, 86, `<div class="c-editor ${cls}" style="width:308px;height:264px"><div class="ce-bar"><span class="ce-tab">伪代码</span></div><div class="ce-body">${rows}</div></div>`)
}
/** 没有括号的伪代码；hl 是要浅蓝底的行号（从 0 数） */
const PB = (o: { hl?: number[]; cls?: string } = {}) => PSEUDO([
  { t: 'InitStack(S)' },
  { t: 'for 中缀式里的每个字符 c:' },
  { t: '    if c 是数字:', g: '1' },
  { t: '        输出 c' },
  { t: '    else:', g: '2' },
  { t: '        while 栈不空 且' },
  { t: '              栈顶优先级 >= c 的优先级:' },
  { t: '            Pop(S, &t); 输出 t' },
  { t: '        Push(S, c)' },
  { t: 'while not StackEmpty(S):', g: '3' },
  { t: '    Pop(S, &t); 输出 t' },
].map((l, i) => (o.hl?.includes(i) ? { ...l, cls: 'hl new' } : l)), o.cls)
const WHILE_LN = [5, 6, 7], END_LN = [9, 10]
/** 加上括号的伪代码：数字分支和末尾的 while 折叠成一行，新加的行带 new */
const PF = () => PSEUDO([
  { t: 'InitStack(S)' },
  { t: 'for 中缀式里的每个字符 c:' },
  { t: '    if c 是数字: ', g: '1', fold: true },
  { t: "    else if c 是 '(':", cls: 'new' },
  { t: '        Push(S, c)', cls: 'new' },
  { t: "    else if c 是 ')':", cls: 'new' },
  { t: "        while 栈顶不是 '(':", cls: 'new' },
  { t: '            Pop(S, &t); 输出 t', cls: 'new' },
  { t: '        Pop(S, &t)', cls: 'new' },
  { t: '    else:', g: '2' },
  { t: "        while 栈不空 且 栈顶不是 '(' 且", ins: "栈顶不是 '(' 且" },
  { t: '              栈顶优先级 >= c 的优先级:' },
  { t: '            Pop(S, &t); 输出 t' },
  { t: '        Push(S, c)' },
  { t: 'while not StackEmpty(S): ', g: '3', fold: true },
])

// ───────── 第6–7屏：代码卡（左）+ 伪代码面板 / 运行结果（右） ─────────
const PREC = ['int Prec(int op) {', "    if (op == '*' || op == '/') return 2;", "    if (op == '+' || op == '-') return 1;", '    return 0;', '}']
// ToPostfix 照书稿；最长的 while 行在 && 处折成两行（卡宽放不下）
const TP = [
  'int ToPostfix(char *in, char *out) {',
  '    SeqStack S;',
  '    int t, k = 0;',
  '    InitStack(&S);',
  "    for (int i = 0; in[i] != '\\0'; i++) {",
  '        char c = in[i];',
  "        if (c >= '0' && c <= '9') {",
  '            out[k++] = c;',
  "        } else if (c == '(') {",
  '            if (!Push(&S, c)) return 0;',
  "        } else if (c == ')') {",
  "            while (GetTop(&S, &t) && t != '(') {",
  '                Pop(&S, &t);',
  '                out[k++] = t;',
  '            }',
  '            if (!Pop(&S, &t)) return 0;',
  '        } else if (Prec(c) > 0) {',
  "            while (GetTop(&S, &t) && t != '('",
  '                   && Prec(t) >= Prec(c)) {',
  '                Pop(&S, &t);',
  '                out[k++] = t;',
  '            }',
  '            if (!Push(&S, c)) return 0;',
  '        } else {',
  '            return 0;',
  '        }',
  '    }',
  '    while (Pop(&S, &t)) {',
  "        if (t == '(') return 0;",
  '        out[k++] = t;',
  '    }',
  "    out[k] = '\\0';",
  '    return 1;',
  '}',
]
// main 太宽，测试串和 printf 的参数用 … 省掉（完整的在文字版）
const MAIN = [
  'int main(void) {',
  '    char *tests[] = {"3+4*2-1", …, "3+4)"};',
  '    char post[MAXSIZE];',
  '    for (int i = 0; i < 7; i++) {',
  '        if (ToPostfix(tests[i], post))',
  '            printf(… → %s …, post);',
  '        else',
  '            printf(… 括号不配对 …);',
  '    }',
  '    return 0;',
  '}',
]
const ALL = [...PREC, '', ...TP, '', ...MAIN]
const HLS = await highlightC(ALL)
const HL = new Map(ALL.map((s, i) => [s, HLS[i]]))
const h = (s: string) => { const v = HL.get(s); if (v === undefined) throw new Error(`代码没有预先高亮：${s}`); return v }
// 行号：Prec 1–5，空一行，ToPostfix 从 7 起，main 从 42 起
const NP = 1, NT = 7, NM = 7 + TP.length + 1
type Ln = { html: string; n: number; fold?: number; cls?: string; cur?: boolean }
// ToPostfix 按块组织：一块要么展开，要么折叠成一行（首行 + ⋯）
const BLK = { head: [0, 0], decl: [1, 3], forh: [4, 5], dig: [6, 7], lp: [8, 9], rp: [10, 15], op: [16, 22], els: [23, 25], fend: [26, 26], fin: [27, 30], nul: [31, 31], tail: [31, 33], loop: [4, 26], all: [0, 33] } as const
type BK = keyof typeof BLK
type BS = { b: BK; fold?: boolean; cls?: string; hl?: number[]; marks?: string[]; cur?: boolean }
function tp(specs: BS[]): Ln[] {
  return specs.flatMap((s) => {
    const [a, z] = BLK[s.b]
    if (s.fold) return [{ html: h(TP[a]) + DOTS, n: NT + a, fold: z - a + 1, cls: s.cls }]
    return TP.slice(a, z + 1).map((t, i) => {
      let html = h(t)
      for (const m of s.marks ?? []) html = html.split(m).join(`<span class="hl new">${m}</span>`)
      const k = a + i
      return { html, n: NT + k, cls: `${s.cls ?? ''} ${s.hl?.includes(k) ? 'hl new' : ''}`, cur: s.cur && k === z }
    })
  })
}
const precRows = (cls = '', n = PREC.length): Ln[] => PREC.slice(0, n).map((t, i) => ({ html: h(t), n: NP + i, cls, cur: cls === 'new' && i === n - 1 }))
// 第6屏代码卡开头几行：签名、声明（折叠）、for 头；数字和左括号分支讲完后各折叠成一行
const TOP6: BS[] = [{ b: 'head' }, { b: 'decl', fold: true }, { b: 'forh' }]
const DL: BS[] = [{ b: 'dig', fold: true }, { b: 'lp', fold: true }]
const mainRows = (cls = ''): Ln[] => MAIN.map((t, i) => ({ html: h(t), n: NM + i, cls }))
const ROWS_MAX = 15
function CODE(step: string, ls: Ln[], o: { scls?: string; cls?: string } = {}) {
  const shown = ls.length > ROWS_MAX ? ls.slice(ls.length - ROWS_MAX) : ls // 超过 15 行像编辑器一样往上滚
  const rows = shown.map((l) =>
    `<div class="ce-ln ${l.cls ?? ''} ${l.cur ? 'cur' : ''} ${l.fold ? 'fold' : ''}" style="height:14px;line-height:14px;font-size:12px"><i>${l.n}</i><b>${l.fold ? '▸' : ''}</b><code>${l.html}</code></div>`).join('')
  return at(40, 86, `<div class="c-editor ${o.cls ?? ''}" style="width:360px;height:264px"><div class="ce-bar"><span class="ce-tab">topostfix.c</span>${step ? ckick(step, o.scls) : ''}</div><div class="ce-body">${rows}</div></div>`)
}
/** 右边面板 (412,86) 188×264：tab 写标题，内容是伪代码的当前分支或别的东西 */
function PANEL(tab: string, body: string, cls = '') {
  return at(412, 86, `<div class="c-editor ${cls}" style="width:188px;height:264px"><div class="ce-bar"><span class="ce-tab">${tab}</span></div><div style="position:relative;padding:8px 10px">${body}</div></div>`)
}
const plines = (ls: string[], o: { marks?: string[]; cls?: string } = {}) =>
  `<div class="${o.cls ?? ''}">${ls.map((t) => {
    let s = escp(t)
    for (const m of o.marks ?? []) s = s.split(m).join(`<span class="hl new">${m}</span>`)
    return `<div class="ce-ln" style="height:16px;line-height:16px;font-size:12px"><code>${s}</code></div>`
  }).join('')}</div>`
const P_HEAD = ['InitStack(S)', 'for 中缀式里的每个字符 c:']
const P_DIG = ['if c 是数字:', '    输出 c']
const P_LP = ["else if c 是 '(':", '    Push(S, c)']
const P_RP = ["else if c 是 ')':", "    while 栈顶不是 '(':", '        Pop(S, &t); 输出 t', '    Pop(S, &t)']
const P_OP = ['else:', '    while 栈不空 且', "      栈顶不是 '(' 且", '      栈顶优先级 >=', '      c 的优先级:', '        Pop(S, &t); 输出 t', '    Push(S, c)']
const P_FIN = ['while not StackEmpty(S):', '    Pop(S, &t); 输出 t']
const MINI = (notes = false, cls = '') => at(36, 26, `<div class="${cls}">${cstack(['(', '+'], { label: '栈里是字符', notes: notes ? [undefined, `<span class="new">'+' 是 43</span>`] : undefined })}</div>`)
const OUT = ['3+4*2-1 → 342*+1-', '(3+4)*2 → 34+2*', '8-2-1 → 82-1-', '9/(1+2) → 912+/', '2*(3+4)-5 → 234+*5-', '(3+4 括号不配对', '3+4) 括号不配对']
const TERM = (cls: (i: number) => string) => PANEL('运行结果', OUT.map((s, i) => `<div class="tuple ${cls(i)}" style="font-size:12px;line-height:22px;white-space:nowrap">${s}</div>`).join(''))

// ───────── 练习 ─────────
const quiz1 = (o: { cls?: string; dim?: boolean } = {}) => {
  const k = `${o.cls ?? ''} ${o.dim ? 'dim' : ''}`
  const rows = ['读完 <code>)</code> 之后，已经输出的是', '这时栈里只剩一个运算符', '最后得到的后缀式是']
  return cquiz(at(40, 16, ckick('练习 1 · 填空', o.cls)) + at(40, 44, ctitle('栈里是什么？').replace('c-title', `c-title ${o.cls ?? ''}`)) +
    at(40, 92, `<div class="c-q ${k}" style="font-size:14px">把中缀式 <code>2*(3+4)-5</code> 转成后缀式，从左往右读。</div>`) +
    rows.map((s, i) => at(40, 130 + 36 * i, `<span class="${k}">${s} ${cblank('', { w: 72, quiz: true })}</span>`)).join('') +
    at(40, 250, cqchips(['234+', '*', '234+*5-', '23+4', '+', '234*+5-'], k)) +
    (o.dim ? '' : at(40, 242, cqex(44)) + at(40, 314, cqbar('fill'))))
}
const OPTS2 = ['9 4 2 / - 1 +', '9 4 2 / 1 + -', '9 4 - 2 / 1 +']
const quiz2 = (o: { cls?: string; dim?: boolean } = {}) => cquiz(
  at(40, 16, ckick('练习 2 · 单选', o.cls)) + at(40, 44, ctitle('哪个是它的后缀式？').replace('c-title', `c-title ${o.cls ?? ''}`)) +
  at(40, 92, `<div class="c-q ${o.cls ?? ''} ${o.dim ? 'dim' : ''}" style="font-size:14px">中缀式 <code>9-4/2+1</code> 写成后缀式是哪一个？</div>`) +
  at(40, 124, `<div class="c-opts1 ${o.dim ? 'dim' : ''}">${OPTS2.map((s, i) => copt('ABC'[i], `<code>${s}</code>`, o.cls)).join('')}</div>`) +
  (o.dim ? '' : at(40, 236, cqex(70)) + at(40, 314, cqbar('choice'))))

// ───────── 常用组合 ─────────
const H0 = head(T0)
const H1 = (cls = '') => head(T1, { kick: KQ(false, cls) })
const H1D = (cls = '') => head(T1, { kick: KQ(true, cls) })
const H5 = (tcls = '') => head(T5, { kick: KQ(true), tcls })
const H6 = (tcls = '') => head(T6, { kick: KQ(true), tcls })
// 3+4*2-1 几个时刻的转换机
const OUT1 = [...'342*+1-']
const S_DONE: MO = { inp: IN1, head: 7, stk: [], out: OUT1, top: true }
const S_MINUS: MO = { inp: IN1, head: 5, stk: ['+', '*'], out: [...'342'], top: true }
const LOG4 = [R1b, R2, R3, R4]

export const frames: Frame[] = [
  // ───────── 第0屏　算一个式子（问题屏）：左卡人一眼看出顺序，右卡程序只能往右读 ─────────
  { beat: 1, html: head(T0, { tcls: 'new' }) + HUMAN({ cls: 'new' }) },
  { beat: 2, reveal: 'spread', html: H0 + HUMAN({ braces: 3, bcls: 'new' }) },
  { beat: 3, html: H0 + HUMAN({ braces: 3 }) + PROG({ head: -1, cls: 'new' }) },
  { beat: 4, html: H0 + HUMAN({ braces: 3 }) + PROG({ head: 2, note: cap('能算出 7 吗？', 'new') }) },
  { beat: 5, html: H0 + HUMAN({ braces: 3 }) + PROG({ head: 2, cls1: mark(7, [3], 'hl new'), note: cap('后面有 *，4 要先给 * 用', 'new') }) },
  { beat: 6, html: H0 + HUMAN({ braces: 3 }) + PROG({ head: 4, under: [2, 4, 'new'], note: cap('能先算 4*2 吗？', 'new') }) },
  { beat: 7, html: H0 + HUMAN({ braces: 3 }) + PROG({ head: 4, under: [2, 4], cls1: mark(7, [5], 'hl new'), note: cap('读到 - 才知道没有更先算的', 'new') }) },
  { beat: 8, html: H0 + HUMAN({ braces: 3 }) + PROG({ head: 4, paren: true, pbox: 'new' }) },
  { beat: 9, html: H0 + HUMAN({ braces: 3 }) + PROG({ head: 4, cls1: mark(7, OPS1, 'hl new'), paren: true, pcls: IN3.map((c) => (isDigit(c) ? '' : 'hl new')) }) },
  { beat: 10, html: H0 + HUMAN({ braces: 3 }) + PROG({ head: 4, paren: true, concl: 'new' }) },
  { beat: 12, html: H0 + HUMAN({ braces: 3 }) + PROG({ head: 4, paren: true, concl: '' }) + PILL1('new') },

  // ───────── 第1屏　把运算符写在后面（换版面：写法 ↔ 读法） ─────────
  { beat: 13, html: head(TW, { kick: KQ1(false, 'new'), tcls: 'new' }) + WRITE({ opn: true, cls: 'new' }) },
  { beat: 14, html: head(TW, { kick: KQ1() }) + WRITE({ f1: [], f1cls: 'new' }) },
  { beat: 16, html: head(TW, { kick: KQ1() }) + WRITE({ f1: [1, 2, 3], f1cls: 'new', u1: [2, 4, 'new'] }) },
  { beat: 17, html: head(TW, { kick: KQ1() }) + WRITE({ f1: [0, 1, 2, 3, 4], u1: [0, 4, 'new'] }) },
  { beat: 18, html: head(TW, { kick: KQ1() }) + WRITE({ f1: ALL1, u1: [0, 6, 'new'] }) },
  { beat: 19, html: head(TW, { kick: KQ1() }) + WRITE({ f1: ALL1, row2: true, f2: [0, 1, 2], u2: [1, 3, 'new'] }) },
  { beat: 20, html: head(TW, { kick: KQ1() }) + WRITE({ f1: ALL1, row2: true, f2: ALL2, f2cls: 'new' }) },
  { beat: 21, html: head(TW, { kick: KQ1() }) + WRITE({ f1: ALL1, row2: true, f2: ALL2, off2: 'off new' }) },
  { beat: 22, html: head(TW, { kick: KQ1() }) + WRITE({ f1: ALL1, row2: true, f2: ALL2, off2: 'off', labels: 1, lcls: 'new' }) },
  { beat: 23, html: head(TW, { kick: KQ1() }) + WRITE({ f1: ALL1, row2: true, f2: ALL2, off2: 'off', labels: 2, lcls: 'new' }) },

  // ───────── 第2屏　后缀式怎么读（版面不变）：右卡一行一步往下化简 ─────────
  { beat: 24, html: head(TW, { kick: KQ1() }) + WRITE({ f1: ALL1, row2: true, f2: ALL2, off2: 'off', labels: 2 }) + READ({ rows: 1, cls: 'new' }) },
  { beat: 25, html: head(TW, { kick: KQ1() }) + WRITE({ f1: ALL1, row2: true, f2: ALL2, off2: 'off', labels: 2 }) + READ({ rows: 2, hl: [[0, [1, 2, 3]], [1, [1]]], nw: [[0, [1, 2, 3]], [1, [0, 1, 2, 3, 4]]] }) },
  { beat: 26, html: head(TW, { kick: KQ1() }) + WRITE({ f1: ALL1, row2: true, f2: ALL2, off2: 'off', labels: 2 }) + READ({ rows: 3, hl: [[1, [0, 1, 2]]], nw: [[1, [0, 1, 2]], [2, [0, 1, 2]]] }) },
  { beat: 27, html: head(TW, { kick: KQ1() }) + WRITE({ f1: ALL1, row2: true, f2: ALL2, off2: 'off', labels: 2 }) + READ({ rows: 4, hl: [[2, [0, 1, 2]]], nw: [[2, [0, 1, 2]], [3, [0]]], check: 'new' }) },
  { beat: 28, html: head(TW, { kick: KQ1(true, 'new') }) + WRITE({ f1: ALL1, row2: true, f2: ALL2, off2: 'off', labels: 2 }) + READ({ rows: 4, check: '', concl: 'new' }) },
  { beat: 29, html: head(TW, { kick: KQ1(true) }) + WRITE({ f1: ALL1, row2: true, f2: ALL2, off2: 'off', labels: 2 }) + READ({ rows: 4, check: '', concl: '', to37: 'new' }) },
  { beat: 30, html: head(TW, { kick: KQ1(true) }) + WRITE({ f1: ALL1, row2: true, f2: ALL2, off2: 'off', labels: 2 }) + READ({ rows: 4, check: '', concl: '', to37: '' }) + PILL2('new') },

  // ───────── 第3屏　加括号法（换版面：左栏目标卡，右卡演示）：括号原位一对对长出来 ─────────
  { beat: 31, html: head(TB, { kick: KQ(false, 'new'), tcls: 'new' }) + GOAL({ cls: 'new' }) },
  { beat: 32, html: head(TB, { kick: KQ() }) + GOAL({ note: 'new' }) + DEMO({ e: 0, cls: 'new' }) },
  { beat: 33, reveal: 'spread', html: head(TB, { kick: KQ() }) + GOAL({ note: '' }) + DEMO({ e: 0, ehl: E_OPS }) },
  { beat: 34, html: head(TB, { kick: KQ() }) + GOAL({ note: '' }) + DEMO({ e: 1, ehl: [4, 5, 7, 8] }) },
  { beat: 35, html: head(TB, { kick: KQ() }) + GOAL({ note: '' }) + DEMO({ e: 2, ehl: [1, 2, 4, 5, 6, 7, 8, 9] }) },
  { beat: 36, html: head(TB, { kick: KQ() }) + GOAL({ note: '' }) + DEMO({ e: 3, ehl: [0, 11, 12] }) },
  { beat: 37, html: head(TB, { kick: KQ() }) + GOAL({ note: '' }) + DEMO({ e: 3, ehl: [0, 1, 4, 8, 9, 12] }) },
  { beat: 38, html: head(TB, { kick: KQ() }) + GOAL({ note: '' }) + DEMO({ e: 3, ehl: E_OPS }) },
  { beat: 39, reveal: 'spread', html: head(TB, { kick: KQ() }) + GOAL({ note: '' }) + DEMO({ e: 3, moves: 3, mcls: 'new' }) },
  { beat: 40, html: head(TB, { kick: KQ() }) + GOAL({ note: '' }) + DEMO({ e: 3, moves: 3, result: 'new' }) },

  // ───────── 第4屏　收拢成三步，再做一个（版面不变） ─────────
  { beat: 41, html: head(TB, { kick: KQ() }) + GOAL({ note: '', steps: 1, scls: 'new' }) + DEMO({ e: 3, moves: 3, result: '' }) },
  { beat: 42, html: head(TB, { kick: KQ() }) + GOAL({ note: '', steps: 2, scls: 'new' }) + DEMO({ e: 3, moves: 3, result: '' }) },
  { beat: 43, html: head(TB, { kick: KQ() }) + GOAL({ note: '', steps: 3, scls: 'new' }) + DEMO({ e: 3, moves: 3, result: '' }) },
  { beat: 44, html: head(TB, { kick: KQ() }) + GOAL({ note: '', steps: 3, on: [0] }) + DEMO2({ rows: 1, rcls: 'new' }) },
  { beat: 45, reveal: 'spread', html: head(TB, { kick: KQ() }) + GOAL({ note: '', steps: 3, on: [1, 2] }) + DEMO2({ rows: 3, rcls: 'new' }) },
  { beat: 46, html: head(TB, { kick: KQ() }) + GOAL({ note: '', steps: 3 }) + DEMO2({ rows: 3, check: 'new' }) },
  { beat: 47, html: head(TB, { kick: KQ() }) + GOAL({ note: '', steps: 3 }) + DEMO2({ rows: 3, check: '', prog: 'num', pcls: 'new' }) },
  { beat: 48, html: head(TB, { kick: KQ() }) + GOAL({ note: '', steps: 3 }) + DEMO2({ rows: 3, check: '', prog: 'read', pcls: 'new' }) },

  // ───────── 第5屏　程序也在找运算对象（换版面：转换机） ─────────
  { beat: 49, html: head(T1, { kick: KQ(), tcls: 'new' }) + CMP('new') + M({ inp: IN1, stk: [], dashed: true, cls: 'new' }) },
  { beat: 50, html: H1() + CMP() + M({ inp: IN1, icls: IN1.map((c) => (isDigit(c) ? 'hl new' : '')), stk: [], dashed: true, out: POST1, ocls: POST1.map((c) => (isDigit(c) ? 'hl new' : 'rd new')) }) },
  { beat: 52, html: H1() + CMP() + M({ inp: IN1, icls: mark(7, [1], 'hl new'), stk: [], dashed: true, out: POST1, ocls: POST1.map((c, i) => (i === 4 ? 'hl new' : 'rd')) }) },
  { beat: 53, html: H1() + CMP() + M({ inp: IN1, head: 1, icls: mark(7, [1], 'hl'), stk: [], dashed: true }) },

  // ───────── 第6屏　运算符要等：推出栈（版面不变：左栏出现规定卡和列表） ─────────
  { beat: 54, html: H1() + RULE('new') + M({ inp: IN1, head: 1, stk: [], dashed: true }) },
  { beat: 55, html: H1() + RULE() + M({ inp: IN1, head: -1, stk: [], dashed: true }) },
  { beat: 56, html: H1() + RULE() + M({ inp: IN1, head: 0, stk: [], dashed: true, out: ['3'], ocls: ['new'] }) },
  { beat: 57, html: H1() + RULE() + M({ inp: IN1, head: 1, icls: mark(7, [0], 'hl new'), stk: [], dashed: true, out: ['3'], side: nw(lines2(cap('+ 的左边：3'), cap(`+ 的右边：${cslot('？')}`))) }) },
  { beat: 58, html: H1() + RULE() + LOG([on(R1a, 'new')]) + M({ inp: IN1, head: 1, stk: ['+'], scls: ['new'], snotes: [`右边：${cslot('？')}`], dashed: true, out: ['3'] }) },
  { beat: 59, html: H1() + RULE() + LOG([R1a]) + M({ inp: IN1, head: 2, stk: ['+'], snotes: [`右边：${cslot('？')}`], dashed: true, out: [...'34'], ocls: ['', 'new'] }) },
  { beat: 60, html: H1() + RULE() + LOG([R1a]) + M({ inp: IN1, head: 2, stk: ['+'], snotes: [`右边：${nw('4？')}`], dashed: true, out: [...'34'] }) },
  { beat: 61, html: H1() + RULE() + LOG([R1a]) + M({ inp: IN1, head: 3, stk: ['+'], snotes: ['右边：4？'], dashed: true, out: [...'34'], side: nw(lines2(cap('* / 比 + - 先算'), cap('* / 的<b>优先级</b>高'))) }) },
  { beat: 62, html: H1() + RULE() + LOG([R1a]) + M({ inp: IN1, head: 3, under: [2, 4, 'new'], stk: ['+'], snotes: [`右边：${nw('4*2')}`], dashed: true, out: [...'34'] }) },
  { beat: 63, html: H1() + RULE() + LOG([{ ...R1b, rs: nw(R1b.rs!) }]) + M({ inp: IN1, head: 3, under: [2, 4], stk: ['+'], snotes: ['右边：4*2'], dashed: true, out: [...'34'] }) },
  { beat: 64, html: H1() + RULE() + LOG([R1b, on(R2, 'new')]) + M({ inp: IN1, head: 3, stk: ['+', '*'], scls: ['', 'new'], snotes: ['右边：4*2', `右边：${cslot('？')}`], dashed: true, out: [...'34'] }) },
  { beat: 65, html: H1() + RULE() + LOG([R1b, R2]) + M({ inp: IN1, head: 3, stk: ['+', '*'], snotes: [nw('先放下'), nw('后放下')], dashed: true, out: [...'34'] }) },
  { beat: 66, html: H1() + RULE() + LOG([R1b, R2]) + M({ inp: IN1, head: 3, stk: ['+', '*'], scls: ['', 'hl new'], snotes: ['先放下', `后放下 · ${nw('先写出去 ↓')}`], dashed: true, out: [...'34'] }) },
  { beat: 67, html: H1() + RULE() + LOG([R1b, R2]) + M({ inp: IN1, head: 3, stk: ['+', '*'], snotes: [`先放下 · 要用 ${hl('4*2')}`, '后放下 · 先写出去 ↓'], dashed: true, out: [...'34'] }) },
  // 关键时刻：虚线框原位变成实线，"放着"原位变成"栈"，同一帧
  { beat: 68, html: H1() + RULE() + LOG([R1b, R2]) + M({ inp: IN1, head: 3, stk: ['+', '*'], slabel: '栈', lcls: 'new', stcls: 'new', top: true, out: [...'34'] }) },

  // ───────── 第7屏　一样高也弹：连弹两个（版面不变） ─────────
  { beat: 69, html: H1() + RULE() + LOG([R1b, R2]) + M({ inp: IN1, head: 4, stk: ['+', '*'], top: true, out: [...'342'], ocls: ['', '', 'new'] }) },
  // 读到 -：先回答栈顶等着的 *（右边齐了没有），再回答 +；- 只和当前栈顶比，它自己的左边最后才说
  { beat: 70, html: H1() + RULE() + LOG([R1b, R2]) + M({ ...S_MINUS, ring: 1, snotes: [undefined, nw('等右边')] }) },
  { beat: 71, html: H1() + RULE() + LOG([R1b, R2]) + M({ ...S_MINUS, icls: mark(7, [4], 'hl new'), ring: 1, snotes: [undefined, nw('比 - 高，右边是 2')] }) },
  { beat: 72, html: H1() + RULE() + LOG([R1b, R2]) + M({ ...S_MINUS, stk: ['+'], out: [...'342*'], ocls: mark(4, [3], 'new') }) },
  { beat: 73, html: H1() + RULE() + LOG([R1b, R2]) + M({ ...S_MINUS, stk: ['+'], ring: 0, snotes: [nw('等 4*2')], out: [...'342*'] }) },
  { beat: 74, html: H1() + RULE() + LOG([R1b, R2]) + M({ ...S_MINUS, stk: ['+'], ring: 0, snotes: [nw('一样高，右边是 4*2')], out: [...'342*'] }) },
  { beat: 75, html: H1() + RULE() + LOG([R1b, R2]) + M({ ...S_MINUS, stk: [], out: [...'342*+'], ocls: mark(5, [4], 'new') }) },
  { beat: 76, html: H1() + RULE() + LOG([R1b, R2]) + M({ ...S_MINUS, under: [0, 4, 'new'], stk: [], out: [...'342*+'] }) },
  { beat: 77, html: H1() + RULE() + LOG([R1b, R2, on(R3, 'new')]) + M({ ...S_MINUS, stk: ['-'], scls: ['new'], out: [...'342*+'] }) },
  { beat: 78, html: H1() + RULE() + LOG([R1b, R2, R3]) + M({ inp: IN1, head: 6, stk: ['-'], top: true, out: [...'342*+1'], ocls: mark(6, [5], 'new') }) },
  { beat: 79, html: H1() + RULE() + LOG([R1b, R2, R3, on(R4, 'new')]) + M({ ...S_DONE, ocls: mark(7, [6], 'new') }) },
  { beat: 80, html: H1() + RULE() + LOG(LOG4) + M({ ...S_DONE, oval: ok, alt: OUT1, acls: all(7, 'new'), aval: cap('开头手写', 'new') }) },

  // ───────── 第8屏　收拢成三条（版面不变）：闪回、对照行、三条规则 ─────────
  { beat: 81, html: H1() + RULE() + LOG([R1b, R2, on(R3), R4]) + M(S_MINUS) },
  { beat: 82, html: H1() + RULE() + LOG([R1b, R2, on(R3), R4]) + M({ ...S_MINUS, scls: ['hl new', 'hl new'], snotes: [nw('和 - 比：一样高'), nw('和 - 比：高')], side: cap('一直比到栈空', 'new') }) },
  { beat: 83, html: H1() + RULE() + LOG([R1b, on(R2), R3, R4]) + M({ inp: IN1, head: 3, stk: ['+'], top: true, out: [...'34'], snotes: [nw('比 * 低 → 一个也不弹')] }) },
  { beat: 84, html: H1() + RULE() + LOG(LOG4) + M({ ...S_DONE, alt: [...'342*1-+'], acls: all(7, 'rd new'), side: nw(lines2(cap('第二行：+ 接着等'), cap('算的是 3+(8-1)'))) }) },
  { beat: 85, html: H1() + RULE() + LOG(LOG4) + M({ ...S_DONE, oval: cap('= 10', 'new'), alt: [...'342*1-+'], acls: all(7, 'rd'), aval: cap('= 10', 'new'), side: lines2(cap('第二行：+ 接着等'), cap('算的是 3+(8-1)')) }) },
  { beat: 86, html: H1() + RULE() + LOG(LOG4) + M({ inp: IN2, head: 5, icls: all(5, 'new'), stk: [], out: [...'82-1-'], oval: cap('= 5', 'new'), alt: [...'821--'], acls: all(5, 'off new'), aval: cap('<s>= 7</s>', 'new'), side: nw(lines2(cap('第二行算的是'), cap('8-(2-1) = 7'))) }) },
  { beat: 87, html: H1() + RULE() + LOG([on(G1, 'new')]) + M(S_DONE) },
  { beat: 88, html: H1() + RULE() + LOG([G1, on(G2, 'new')]) + M(S_DONE) },
  { beat: 89, html: H1() + RULE() + LOG([G1, G2, on(G3, 'new')]) + M(S_DONE) },
  { beat: 90, html: H1() + RULE() + LOG([G1, on(G2), G3]) + M({ ...S_MINUS, snotes: ['低', '高'], side: cap('↑ 从下往上越来越高', 'new') }) },
  { beat: 91, html: H1() + RULE() + LOG([G1, G2, G3]) + M({ ...S_MINUS, slabel: `栈 ${ok}`, lcls: 'new' }) },

  // ───────── 第9屏　写成伪代码（换版面：左栏换成伪代码卡） ─────────
  { beat: 92, html: H1() + PB({ cls: 'new' }) + M(S_DONE) },
  { beat: 93, html: H1() + PB({ hl: WHILE_LN }) + M(S_DONE) },
  { beat: 94, html: H1() + PB({ hl: WHILE_LN }) + M({ ...S_DONE, side: nw(lines2(cbadge('读到 *：弹 0 次'), cbadge('读到 -：弹 2 次'))) }) },
  { beat: 95, html: H1D('new') + PB() + M({ ...S_MINUS, side: nw(lines2(cap('这里：还没写出去的运算符'), cap('3.6 求值：还没用上的数'))) }) },

  // ───────── 第10屏　括号（版面不变）：输入换成 (3+4)*2 ─────────
  { beat: 96, html: H5('new') + PB({ cls: 'dim' }) + M({ inp: IN3, head: -1, icls: all(7, 'new'), stk: [] }) },
  { beat: 97, html: H5() + PB({ cls: 'dim' }) + M({ inp: IN3, head: -1, box: [1, 3, '小式子', 'new'], stk: [], out: [...'34+'], ocls: all(3, 'rd new') }) },
  { beat: 98, html: H5() + PB({ cls: 'dim' }) + M({ inp: IN3, head: -1, box: [1, 3, '小式子'], stk: [], out: [...'34+2*'], ocls: ['rd', 'rd', 'rd', 'rd new', 'rd new'] }) },
  { beat: 99, html: H5() + PB({ cls: 'dim' }) + M({ inp: IN3, head: -1, box: [1, 3, '小式子'], stk: [] }) },
  { beat: 100, html: H5() + PB({ cls: 'dim' }) + M({ inp: IN3, head: 0, box: [1, 3, '小式子'], stk: ['('], wall: 0, scls: ['new'], top: true }) },
  { beat: 101, html: H5() + PB({ cls: 'dim' }) + M({ inp: IN3, head: 0, box: [1, 3, '小式子'], stk: ['('], wall: 0, top: true, side: cap('墙上面：像一个空栈', 'new') }) },
  { beat: 102, reveal: 'spread', html: H5() + PB({ cls: 'dim' }) + M({ inp: IN3, head: 3, box: [1, 3, '小式子'], stk: ['(', '+'], wall: 0, scls: ['', 'new'], top: true, out: [...'34'], ocls: ['new', 'new'] }) },
  { beat: 103, html: H5() + PB({ cls: 'dim' }) + M({ inp: IN3, head: 4, box: [1, 3, '小式子读完了', 'new'], stk: ['(', '+'], wall: 0, top: true, out: [...'34'] }) },
  { beat: 104, html: H5() + PB({ hl: END_LN }) + M({ inp: IN3, head: 4, box: [1, 3, '小式子读完了'], stk: ['('], wall: 0, top: true, out: [...'34+'], ocls: ['', '', 'new'] }) },
  { beat: 105, html: H5() + PB() + M({ inp: IN3, head: 4, stk: [], out: [...'34+'], side: nw(`${cchip('(', 'mono off')} ${cap('弹掉，不写出去')}`) }) },
  { beat: 106, reveal: 'spread', html: H5() + PB() + M({ inp: IN3, head: 7, stk: [], out: [...'34+2*'], ocls: ['', '', '', 'new', 'new'] }) },
  { beat: 107, html: H5() + PB() + M({ inp: IN3, head: 7, under: [0, 4, 'new'], stk: [], out: [...'34+2*'], ocls: ['', '', 'hl new', '', 'hl new'] }) },
  { beat: 108, html: H5() + PB() + M({ inp: IN3, head: 7, stk: [], out: [...'34+2*'], side: nw(lines2(cap('读到 ) 找最近的 ('), cap('就是 3.5 括号匹配'))) }) },
  { beat: 109, html: H5() + PF() + M({ inp: IN3, head: 7, stk: [], out: [...'34+2*'] }) },

  // ───────── 第11屏　写成函数（换版面：左代码卡，右伪代码面板） ─────────
  { beat: 110, html: H6('new') + CODE('ToPostfix', [], { cls: 'new' }) + PANEL('栈', MINI(false, 'new'), 'new') },
  { beat: 111, html: H6() + CODE('ToPostfix', []) + PANEL('栈', MINI(true)) },
  { beat: 112, html: H6() + CODE('3.3节的顺序栈', [], { scls: 'new' }) + PANEL('栈', MINI(true)) },
  // 每个数只有一位：写在面板的小栈下面
  { beat: 113, html: H6() + CODE('3.3节的顺序栈', []) + PANEL('栈', MINI(true) + at(0, 150, cap('每个数只有一位：0–9', 'new'))) },
  { beat: 114, html: H6() + CODE('3.3节的顺序栈', []) + PANEL('栈', MINI(true) + at(0, 150, cap('每个数只有一位：0–9')) + at(0, 176, `<span class="new">${cap('342*+1- 就是')}<br>${cap('3 4 2 * + 1 -')}</span>`)) },
  { beat: 115, html: H6() + CODE('先写优先级', precRows('new'), { scls: 'new' }) + PANEL('栈', MINI(true, 'dim')) },
  // 代码只往下长：上一块讲完，原位折叠成一行（下面还没有东西，所以不会挤动别的行）；Prec 讲完就不再显示
  { beat: 116, html: H6() + CODE('照伪代码写', tp([{ b: 'head', cls: 'new' }, { b: 'decl', cls: 'new', cur: true }]), { scls: 'new' }) + PANEL('伪代码', plines(P_HEAD, { cls: 'new' })) },
  { beat: 117, html: H6() + CODE('① 数字', tp([{ b: 'head' }, { b: 'decl', fold: true }, { b: 'forh', cls: 'new' }, { b: 'dig', cls: 'new', cur: true }]), { scls: 'new' }) + PANEL('伪代码 · 1', plines(P_DIG, { cls: 'hl new' })) },
  { beat: 118, html: H6() + CODE('左括号', tp([...TOP6, { b: 'dig', fold: true }, { b: 'lp', cls: 'new', cur: true }]), { scls: 'new' }) + PANEL('伪代码', plines(P_LP, { cls: 'hl new' })) },
  { beat: 119, html: H6() + CODE('右括号', tp([...TOP6, ...DL, { b: 'rp', cls: 'new', cur: true }]), { scls: 'new' }) + PANEL('伪代码', plines(P_RP, { cls: 'hl new' })) },
  { beat: 120, html: H6() + CODE('② 运算符', tp([...TOP6, ...DL, { b: 'rp', fold: true }, { b: 'op', cls: 'new', cur: true }, { b: 'els', fold: true, cls: 'new' }]), { scls: 'new' }) + PANEL('伪代码 · 2', plines(P_OP, { cls: 'hl new' })) },
  { beat: 121, html: H6() + CODE('② 运算符', tp([...TOP6, ...DL, { b: 'rp', fold: true }, { b: 'op', marks: ['GetTop'] }, { b: 'els', fold: true }])) + PANEL('伪代码 · 2', plines(P_OP, { marks: ['栈不空', '栈顶'] })) },
  { beat: 122, html: H6() + CODE('③ 读完了', tp([...TOP6, ...DL, { b: 'rp', fold: true }, { b: 'op', fold: true }, { b: 'els', fold: true }, { b: 'fend', cls: 'new' }, { b: 'fin', cls: 'new' }, { b: 'nul', cls: 'new', cur: true }]), { scls: 'new' }) + PANEL('伪代码 · 3', plines(P_FIN, { cls: 'hl new' })) },
  // 右括号那块重新展开，代码超过 15 行，往上滚
  { beat: 123, html: H6() + CODE('括号不配对', tp([...TOP6, ...DL, { b: 'rp', hl: [15] }, { b: 'op', fold: true }, { b: 'els', fold: true }, { b: 'fend' }, { b: 'fin', hl: [28] }, { b: 'nul' }]), { scls: 'new' }) +
    PANEL('括号不配对', nw(lines2(cap(') 弹不到 ('), cap('→ 右括号多了'), '', cap('读完还剩 ('), cap('→ 左括号多了')))) },
  { beat: 124, html: H6() + CODE('括号不配对', tp([...TOP6, ...DL, { b: 'rp' }, { b: 'op', fold: true }, { b: 'els', fold: true }, { b: 'fend' }, { b: 'fin' }, { b: 'nul' }])) +
    PANEL('括号不配对', lines2(cap(') 弹不到 ('), cap('→ 右括号多了'), '', cap('读完还剩 ('), cap('→ 左括号多了'), '', nw(cap('运算符多了、数字多了')), nw(cap('→ 3.7 求值时才查得出')))) },

  // ───────── 第12屏　试一试（版面不变）：main 只调 ToPostfix，面板放运行结果 ─────────
  { beat: 125, html: H6() + CODE('试一试', [{ html: h(TP[0]) + DOTS, n: NT, fold: TP.length }, ...mainRows('new')], { scls: 'new' }) + PANEL('运行结果', '') },
  { beat: 126, reveal: 'spread', html: H6() + CODE('试一试', [{ html: h(TP[0]) + DOTS, n: NT, fold: TP.length }, ...mainRows()]) + TERM((i) => (i < 5 ? 'hl new' : 'new')) },

  // ───────── 第13屏　练习1（填空） ─────────
  { beat: 127, html: quiz1({ cls: 'new' }) },
  { after: 127, html: quiz1() + pause('等学生作答（点选项块再点空位）；作答后显示解析') },

  // ───────── 第14屏　练习2（单选） ─────────
  { beat: 128, html: quiz2({ cls: 'new' }) },
  { after: 128, html: quiz2() + pause('等学生作答；作答后每个选项下显示解析，不配旁白') },

  // ───────── 第15屏　下一步：一拍过门 ─────────
  { beat: 129, html: at(40, 16, ckick('下一步')) + at(40, 44, ctitle('程序怎么算后缀式').replace('c-title', 'c-title new')) },
]
