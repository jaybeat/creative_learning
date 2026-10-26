// 3.7 质感层分镜帧（npm run storyboard -- 3-7）。双栏稿 docs/course/3-7.md。
// 写法库第 17 条（一个例子从定义推到底）+ 第 13 条（左右对照，螺旋递进）。版面：
// - 第0屏问题屏：左卡 (40,86) 240×264 是计算器流水线，右卡 (300,86) 300×264 是式子对照 + 问题胶囊；
// - 第1–5屏转换机：右栏 (372,·) 宽 228 三张卡整节不动——输入卡 (372,86)、栈卡 (372,160)、输出卡 (372,290)，只换里面的字；
//   左栏 (40,86) 宽 308：第1–3屏是规定卡 + 四行列表（推导记录 → 收拢成三条），第4屏起换成伪代码卡（第5屏原位插进括号分支）；
// - 第6–7屏：左边代码卡 (40,86) 360×264（12px、行高 14，超过 15 行就像编辑器一样往上滚），右边 (412,86) 188 宽是伪代码面板 / 运行结果。
// 第32拍"放着"的虚线框原位变成实线的"栈"，是本节的关键时刻。帧里不写色值，样式在 scripts/lib/clean.ts（STACK_CSS、EDITOR_CSS）。
import path from 'node:path'
import { at, card, pause, ckick, ctitle, cchip, cslot, cbadge, cqpill, cblank, copt, cquiz, cqchips, cqbar, cqex, ctape, cstack } from './kit'
import { highlightC } from '../../../scripts/lib/code-hl'
import { parseScript, ROOT, type Frame } from '../../../scripts/lib/course'

export const quizSource = { file: 'book/chapters/ch03.md', section: '3.7' }

// ───────── 念法：旁白里反引号中的式子，数字一个一个念，运算符念成字（字幕仍显示原文） ─────────
const DIG = '零一二三四五六七八九'
const OPW: Record<string, string> = { '+': '加', '-': '减', '*': '乘', '/': '除', '(': '左括号', ')': '右括号', '=': '等于' }
function speakCode(s: string): string {
  if (s === "'\\0'") return '反斜杠零'
  const q = s.match(/^'(.)'$/)
  if (q) return q[1] === '+' ? '加号' : OPW[q[1]] ?? q[1]
  if (s === 'GetTop') return 'get top'
  if (/^[A-Za-z_]\w*$/.test(s) || !/[0-9+\-*/()]/.test(s)) return s
  return [...s].filter((c) => c !== ' ').map((c) => (/\d/.test(c) ? DIG[Number(c)] : OPW[c] ?? c)).join(' ')
}
export const say: Record<number, string> = Object.fromEntries(
  parseScript(path.join(ROOT, 'docs/course/3-7.md')).screens.flatMap((s) => s.beats)
    .filter((b) => b.text.includes('`'))
    .map((b) => [b.n, b.text.replace(/`([^`]+)`/g, (_, s: string) => speakCode(s)).replace(/\*\*/g, '')]),
)

const ok = '<b class="okm">✓</b>'
const cap = (s: string, cls = '') => `<span class="c-cap ${cls}" style="white-space:nowrap">${s}</span>`
const lines2 = (...ss: string[]) => `<div style="display:flex;flex-direction:column;gap:2px">${ss.map((s) => `<div>${s}</div>`).join('')}</div>`
const nw = (s: string) => `<span class="new">${s}</span>`
const hl = (s: string) => `<span class="hl new">${s}</span>`

// ───────── 标题区 ─────────
const Q = '每个运算符什么时候写出去'
const KQ = (done = false, cls = '') => ckick(`问题 · ${Q}${done ? ` ${ok}` : ''}`, cls)
const T0 = '中缀表达式转后缀表达式', T1 = '运算符什么时候写出去', T5 = '括号', T6 = '写成函数，接上Eval'
const head = (title: string, o: { kick?: string; tcls?: string } = {}) =>
  (o.kick ? at(40, 16, o.kick) : '') + at(40, 44, ctitle(title).replace('c-title', `c-title ${o.tcls ?? ''}`))

// ───────── 第0屏左卡：计算器流水线（输入 → 转换 → 后缀式 → Eval → 结果） ─────────
type PipeO = { inp?: string; icls?: string; conv?: string; ccls?: string; post?: string; pcls?: string; res?: string; rcls?: string; ecls?: string; cls?: string }
function PIPE(o: PipeO) {
  const down = (y: number, show: boolean) => (show ? at(112, y, '<div class="c-down">↓</div>') : '')
  const row = (y: number, name: string, v: string, cls = '') => at(14, y, cap(name)) + at(78, y - 4, `<span class="${cls}">${cchip(v, 'mono')}</span>`)
  return at(40, 86, card(
    (o.inp ? row(16, '计算器输入', o.inp, o.icls) : '') + down(46, !!o.inp) +
    (o.conv ? at(14, 62, `<div class="c-slot ${o.ccls ?? ''}" style="width:212px;height:44px;display:flex;align-items:center;justify-content:center;font-size:13px">${o.conv}</div>`) : '') +
    down(110, !!o.conv) +
    row(130, '后缀式', o.post ?? '', o.pcls) + down(160, true) +
    at(14, 176, card(`<b>Eval</b>　${cap('3.6节写的')}`, o.ecls ?? '', 'width:212px;height:34px;padding:6px 12px')) + down(214, true) +
    at(14, 232, cap('结果')) + at(78, 226, `<span class="tuple ${o.rcls ?? ''}" style="font-size:18px">${o.res ?? ''}</span>`),
    o.cls ?? '', 'width:240px;height:264px;padding:0'))
}

// ───────── 第0屏右卡：三对式子 + 3+4*2-1 这一行 + 问题胶囊 ─────────
const PAIRS: [string[], string[], [number, number][]][] = [
  [[...'3+4*2'], [...'342*+'], [[1, 4], [3, 3]]],
  [[...'(3+4)*2'], [...'34+2*'], [[2, 2], [5, 4]]],
  [[...'(5-2)*3'], [...'52-3*'], [[2, 2], [5, 4]]],
]
const isDigit = (c: string) => /\d/.test(c)
/** 弧线箭头：从 (x1,y) 到 (x2,y)，往上拱 rise；dashed 表示还不知道落在哪，末端打问号 */
function arc(x1: number, x2: number, y: number, rise: number, o: { dashed?: boolean; cls?: string } = {}) {
  const d = `M${x1} ${y} Q${(x1 + x2) / 2} ${y - rise} ${x2} ${y}`
  return `<path class="${o.cls ?? ''}" d="${d}" fill="none" stroke="var(--c1)" stroke-width="1.5"${o.dashed ? ' stroke-dasharray="3 3"' : ''}/>` +
    (o.dashed ? `<text x="${x2 - 3}" y="${y - 2}" font-size="13" fill="var(--c1)">？</text>` : `<path d="M${x2 - 4} ${y - 6} L${x2 + 4} ${y - 6} L${x2} ${y} Z" fill="var(--c1)"/>`)
}
const BIG_IN = [...'3+4*2-1'], BIG_OUT = [...'342*+1-']
type ExprO = { digits?: boolean; ops?: boolean; dimPairs?: boolean; big?: boolean; fill?: number[]; under?: [number, number]; bigDigits?: boolean; plus?: 'arc' | 'ask'; pill?: string; cls?: string }
function EXPR(o: ExprO) {
  const W = 16
  const pairRow = ([inf, post]: (typeof PAIRS)[number], y: number) => {
    const ic = inf.map((c) => (isDigit(c) && o.digits ? 'hl' : !isDigit(c) && o.ops ? ('()'.includes(c) ? 'off' : 'hl') : ''))
    const pc = post.map((c) => (isDigit(c) && o.digits ? 'hl' : !isDigit(c) && o.ops ? 'hl' : ''))
    return at(14, y, ctape(inf, { w: W, h: 24, cls: ic, tcls: 'bare' })) + at(128, y + 4, cap('→')) + at(150, y, ctape(post, { w: W, h: 24, cls: pc, tcls: 'bare' }))
  }
  // 三对式子行距只有 32，画弧线会压到上一行，所以这里只靠浅蓝底和划掉的括号；弧线只画在下面 3+4*2-1 那一行
  const pairs = `<div class="${o.dimPairs ? 'dim' : ''}">${PAIRS.map((p, r) => pairRow(p, 14 + r * 32)).join('')}</div>`
  // 3+4*2-1 这一行：一格 18，中缀从 x=14 起，后缀从 x=162 起，后缀的格子原位一格格填上
  const BW = 18, BP = BW - 1, BY = 136, BX = 162
  const big = o.big ? (() => {
    const ic = BIG_IN.map((c, i) => (o.bigDigits && isDigit(c) ? 'hl' : o.plus && i === 1 ? 'hl' : ''))
    const oc = BIG_OUT.map((c, i) => (!o.fill?.includes(i) ? 'slot' : o.bigDigits && isDigit(c) ? 'hl' : o.plus && i === 4 ? 'hl' : ''))
    const ochars = BIG_OUT.map((c, i) => (o.fill?.includes(i) ? c : ''))
    const plusArc = o.plus ? at(0, 0, `<svg width="300" height="200" style="overflow:visible">${arc(14 + 1 * BP + 9, BX + 4 * BP + 9, BY - 2, 40, { dashed: o.plus === 'ask' })}</svg>`) : ''
    return at(14, BY, ctape(BIG_IN, { w: BW, h: 26, cls: ic, tcls: 'bare', under: o.under, head: o.plus === 'ask' ? 1 : undefined })) +
      at(142, BY + 5, cap('→')) + at(BX, BY, ctape(ochars, { w: BW, h: 26, cls: oc })) + plusArc
  })() : ''
  return at(300, 86, card(pairs + big + (o.pill ? at(14, 222, o.pill) : ''), o.cls ?? '', 'width:300px;height:264px;padding:0'))
}

// ───────── 转换机：输入卡 + 栈卡 + 输出卡（右栏，第1–5屏不动） ─────────
const IN1 = [...'3+4*2-1'], IN2 = [...'8-2-1'], IN3 = [...'(3+4)*2']
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
  '    char *tests[] = {"3+4*2-1", …, "3++4"};',
  '    char post[MAXSIZE];',
  '    int v;',
  '    for (int i = 0; i < 8; i++) {',
  '        if (!ToPostfix(tests[i], post))',
  '            printf(… 括号不配对 …);',
  '        else if (!Eval(post, &v))',
  '            printf(… 写错了 …);',
  '        else',
  '            printf(… = %d …, v);',
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
  return at(40, 86, `<div class="c-editor ${o.cls ?? ''}" style="width:360px;height:264px"><div class="ce-bar"><span class="ce-tab">calc.c</span>${step ? ckick(step, o.scls) : ''}</div><div class="ce-body">${rows}</div></div>`)
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
const OUT = ['3+4*2-1 → 342*+1- = 10', '(3+4)*2 → 34+2* = 14', '8-2-1 → 82-1- = 5', '9/(1+2) → 912+/ = 3', '2*(3+4)-5 → 234+*5- = 9', '(3+4 括号不配对', '3+4) 括号不配对', '3++4 → 3+4+ 写错了']
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
const PIPE0: PipeO = { inp: '3+4*2', conv: '中缀式 → 后缀式', post: '3 4 2 * +', pcls: 'dim', res: '11' }
const PAIRS_DIM: ExprO = { dimPairs: true, big: true, fill: [0, 1, 2, 3, 4, 5, 6] }
const PILL = (cls = '') => cqpill(1, '每个运算符，什么时候写出去？', `on ${cls}`)
// 3+4*2-1 几个时刻的转换机
const OUT1 = [...'342*+1-']
const S_DONE: MO = { inp: IN1, head: 7, stk: [], out: OUT1, top: true }
const S_MINUS: MO = { inp: IN1, head: 5, stk: ['+', '*'], out: [...'342'], top: true }
const LOG4 = [R1b, R2, R3, R4]

export const frames: Frame[] = [
  // ───────── 第0屏　人写的是中缀式（问题屏）：左卡流水线不动，右卡在变 ─────────
  { beat: 1, html: head(T0, { tcls: 'new' }) + PIPE({ post: '3 4 2 * +', pcls: 'new', res: '11', rcls: 'new', ecls: 'new' }) },
  { beat: 2, html: H0 + PIPE({ inp: '3+4*2', icls: 'new', post: '<s>3 4 2 * +</s>', pcls: 'dim new', res: '11' }) },
  { beat: 3, html: H0 + PIPE({ ...PIPE0, ccls: 'new' }) },
  { beat: 4, html: H0 + PIPE(PIPE0) + EXPR({ cls: 'new' }) },
  { beat: 5, html: H0 + PIPE(PIPE0) + EXPR({ digits: true }) },
  { beat: 6, html: H0 + PIPE(PIPE0) + EXPR({ digits: true }) + at(300, 196, `<div class="new" style="width:300px;text-align:center">${cap('数字的顺序一点没变')}</div>`) },
  { beat: 7, html: H0 + PIPE(PIPE0) + EXPR({ ops: true }) },
  { beat: 8, html: H0 + PIPE(PIPE0) + EXPR({ dimPairs: true, big: true, fill: [] }) },
  { beat: 9, html: H0 + PIPE(PIPE0) + EXPR({ dimPairs: true, big: true, fill: [1, 2, 3], under: [2, 4] }) },
  { beat: 10, html: H0 + PIPE(PIPE0) + EXPR({ dimPairs: true, big: true, fill: [0, 1, 2, 3, 4], under: [0, 4] }) },
  { beat: 11, html: H0 + PIPE(PIPE0) + EXPR({ ...PAIRS_DIM, under: [0, 6] }) },
  { beat: 12, html: H0 + PIPE(PIPE0) + EXPR({ ...PAIRS_DIM, bigDigits: true }) },
  { beat: 13, html: H0 + PIPE(PIPE0) + EXPR({ ...PAIRS_DIM, plus: 'arc' }) },
  { beat: 14, html: H0 + PIPE(PIPE0) + EXPR({ ...PAIRS_DIM, plus: 'ask' }) },
  { beat: 15, html: H0 + PIPE({ ...PIPE0, conv: '写一个函数：中缀式 → 后缀式', ccls: 'hl new' }) + EXPR({ ...PAIRS_DIM, plus: 'ask' }) },
  { beat: 16, reveal: 'spread', html: H0 + PIPE({ inp: '(3+4)*2', icls: 'hl new', conv: '写一个函数：中缀式 → 后缀式', ccls: 'hl new', post: '3 4 + 2 *', pcls: 'hl new', ecls: 'hl new', res: '14', rcls: 'new' }) + EXPR({ ...PAIRS_DIM, plus: 'ask' }) },
  { beat: 17, html: H0 + PIPE({ inp: '(3+4)*2', conv: '写一个函数：中缀式 → 后缀式', post: '3 4 + 2 *', res: '14' }) + EXPR({ ...PAIRS_DIM, plus: 'ask', pill: PILL('new') }) },

  // ───────── 第1屏　运算符要等：推出栈（换版面：左栏规定卡 + 列表，右栏转换机） ─────────
  { beat: 18, html: head(T1, { kick: KQ(false, 'new'), tcls: 'new' }) + RULE('new') },
  { beat: 19, html: H1() + RULE() + M({ inp: IN1, head: -1, stk: [], dashed: true, cls: 'new' }) },
  { beat: 20, html: H1() + RULE() + M({ inp: IN1, head: 0, stk: [], dashed: true, out: ['3'], ocls: ['new'] }) },
  { beat: 21, html: H1() + RULE() + M({ inp: IN1, head: 1, icls: mark(7, [0], 'hl new'), stk: [], dashed: true, out: ['3'], side: nw(lines2(cap('+ 的左边：3'), cap(`+ 的右边：${cslot('？')}`))) }) },
  { beat: 22, html: H1() + RULE() + LOG([on(R1a, 'new')]) + M({ inp: IN1, head: 1, stk: ['+'], scls: ['new'], snotes: [`右边：${cslot('？')}`], dashed: true, out: ['3'] }) },
  { beat: 23, html: H1() + RULE() + LOG([R1a]) + M({ inp: IN1, head: 2, stk: ['+'], snotes: [`右边：${cslot('？')}`], dashed: true, out: [...'34'], ocls: ['', 'new'] }) },
  { beat: 24, html: H1() + RULE() + LOG([R1a]) + M({ inp: IN1, head: 2, stk: ['+'], snotes: [`右边：${nw('4？')}`], dashed: true, out: [...'34'] }) },
  { beat: 25, html: H1() + RULE() + LOG([R1a]) + M({ inp: IN1, head: 3, stk: ['+'], snotes: ['右边：4？'], dashed: true, out: [...'34'], side: nw(lines2(cap('* / 比 + - 先算'), cap('* / 的<b>优先级</b>高'))) }) },
  { beat: 26, html: H1() + RULE() + LOG([R1a]) + M({ inp: IN1, head: 3, under: [2, 4, 'new'], stk: ['+'], snotes: [`右边：${nw('4*2')}`], dashed: true, out: [...'34'] }) },
  { beat: 27, html: H1() + RULE() + LOG([{ ...R1b, rs: nw(R1b.rs!) }]) + M({ inp: IN1, head: 3, under: [2, 4], stk: ['+'], snotes: ['右边：4*2'], dashed: true, out: [...'34'] }) },
  { beat: 28, html: H1() + RULE() + LOG([R1b, on(R2, 'new')]) + M({ inp: IN1, head: 3, stk: ['+', '*'], scls: ['', 'new'], snotes: ['右边：4*2', `右边：${cslot('？')}`], dashed: true, out: [...'34'] }) },
  { beat: 29, html: H1() + RULE() + LOG([R1b, R2]) + M({ inp: IN1, head: 3, stk: ['+', '*'], snotes: [nw('先放下'), nw('后放下')], dashed: true, out: [...'34'] }) },
  { beat: 30, html: H1() + RULE() + LOG([R1b, R2]) + M({ inp: IN1, head: 3, stk: ['+', '*'], scls: ['', 'hl new'], snotes: ['先放下', `后放下 · ${nw('先写出去 ↓')}`], dashed: true, out: [...'34'] }) },
  { beat: 31, html: H1() + RULE() + LOG([R1b, R2]) + M({ inp: IN1, head: 3, stk: ['+', '*'], snotes: [`先放下 · 要用 ${hl('4*2')}`, '后放下 · 先写出去 ↓'], dashed: true, out: [...'34'] }) },
  // 关键时刻：虚线框原位变成实线，"放着"原位变成"栈"，同一帧
  { beat: 32, html: H1() + RULE() + LOG([R1b, R2]) + M({ inp: IN1, head: 3, stk: ['+', '*'], slabel: '栈', lcls: 'new', stcls: 'new', top: true, out: [...'34'] }) },

  // ───────── 第2屏　一样高也弹：连弹两个（版面不变） ─────────
  { beat: 33, html: H1() + RULE() + LOG([R1b, R2]) + M({ inp: IN1, head: 4, stk: ['+', '*'], top: true, out: [...'342'], ocls: ['', '', 'new'] }) },
  // 读到 -：先回答栈顶等着的 *（右边齐了没有），再回答 +；- 只和当前栈顶比，它自己的左边最后才说
  { beat: 34, html: H1() + RULE() + LOG([R1b, R2]) + M({ ...S_MINUS, ring: 1, snotes: [undefined, nw('等右边')] }) },
  { beat: 35, html: H1() + RULE() + LOG([R1b, R2]) + M({ ...S_MINUS, icls: mark(7, [4], 'hl new'), ring: 1, snotes: [undefined, nw('比 - 高，右边是 2')] }) },
  { beat: 36, html: H1() + RULE() + LOG([R1b, R2]) + M({ ...S_MINUS, stk: ['+'], out: [...'342*'], ocls: mark(4, [3], 'new') }) },
  { beat: 37, html: H1() + RULE() + LOG([R1b, R2]) + M({ ...S_MINUS, stk: ['+'], ring: 0, snotes: [nw('等 4*2')], out: [...'342*'] }) },
  { beat: 38, html: H1() + RULE() + LOG([R1b, R2]) + M({ ...S_MINUS, stk: ['+'], ring: 0, snotes: [nw('一样高，右边是 4*2')], out: [...'342*'] }) },
  { beat: 39, html: H1() + RULE() + LOG([R1b, R2]) + M({ ...S_MINUS, stk: [], out: [...'342*+'], ocls: mark(5, [4], 'new') }) },
  { beat: 40, html: H1() + RULE() + LOG([R1b, R2]) + M({ ...S_MINUS, under: [0, 4, 'new'], stk: [], out: [...'342*+'] }) },
  { beat: 41, html: H1() + RULE() + LOG([R1b, R2, on(R3, 'new')]) + M({ ...S_MINUS, stk: ['-'], scls: ['new'], out: [...'342*+'] }) },
  { beat: 42, html: H1() + RULE() + LOG([R1b, R2, R3]) + M({ inp: IN1, head: 6, stk: ['-'], top: true, out: [...'342*+1'], ocls: mark(6, [5], 'new') }) },
  { beat: 43, html: H1() + RULE() + LOG([R1b, R2, R3, on(R4, 'new')]) + M({ ...S_DONE, ocls: mark(7, [6], 'new') }) },
  { beat: 44, html: H1() + RULE() + LOG(LOG4) + M({ ...S_DONE, oval: ok, alt: OUT1, acls: all(7, 'new'), aval: cap('开头手写', 'new') }) },

  // ───────── 第3屏　收拢成三条（版面不变）：闪回、对照行、三条规则 ─────────
  { beat: 45, html: H1() + RULE() + LOG([R1b, R2, on(R3), R4]) + M(S_MINUS) },
  { beat: 46, html: H1() + RULE() + LOG([R1b, R2, on(R3), R4]) + M({ ...S_MINUS, scls: ['hl new', 'hl new'], snotes: [nw('和 - 比：一样高'), nw('和 - 比：高')], side: cap('一直比到栈空', 'new') }) },
  { beat: 47, html: H1() + RULE() + LOG([R1b, on(R2), R3, R4]) + M({ inp: IN1, head: 3, stk: ['+'], top: true, out: [...'34'], snotes: [nw('比 * 低 → 一个也不弹')] }) },
  { beat: 48, html: H1() + RULE() + LOG(LOG4) + M({ ...S_DONE, alt: [...'342*1-+'], acls: all(7, 'rd new'), side: nw(lines2(cap('第二行：+ 接着等'), cap('算的是 3+(8-1)'))) }) },
  { beat: 49, html: H1() + RULE() + LOG(LOG4) + M({ ...S_DONE, oval: cap('= 10', 'new'), alt: [...'342*1-+'], acls: all(7, 'rd'), aval: cap('= 10', 'new'), side: lines2(cap('第二行：+ 接着等'), cap('算的是 3+(8-1)')) }) },
  { beat: 50, html: H1() + RULE() + LOG(LOG4) + M({ inp: IN2, head: 5, icls: all(5, 'new'), stk: [], out: [...'82-1-'], oval: cap('= 5', 'new'), alt: [...'821--'], acls: all(5, 'off new'), aval: cap('<s>= 7</s>', 'new'), side: nw(lines2(cap('第二行算的是'), cap('8-(2-1) = 7'))) }) },
  { beat: 51, html: H1() + RULE() + LOG([on(G1, 'new')]) + M(S_DONE) },
  { beat: 52, html: H1() + RULE() + LOG([G1, on(G2, 'new')]) + M(S_DONE) },
  { beat: 53, html: H1() + RULE() + LOG([G1, G2, on(G3, 'new')]) + M(S_DONE) },
  { beat: 54, html: H1() + RULE() + LOG([G1, on(G2), G3]) + M({ ...S_MINUS, snotes: ['低', '高'], side: cap('↑ 从下往上越来越高', 'new') }) },
  { beat: 55, html: H1() + RULE() + LOG([G1, G2, G3]) + M({ ...S_MINUS, slabel: `栈 ${ok}`, lcls: 'new' }) },

  // ───────── 第4屏　写成伪代码（换版面：左栏换成伪代码卡） ─────────
  { beat: 56, html: H1() + PB({ cls: 'new' }) + M(S_DONE) },
  { beat: 57, html: H1() + PB({ hl: WHILE_LN }) + M(S_DONE) },
  { beat: 58, html: H1() + PB({ hl: WHILE_LN }) + M({ ...S_DONE, side: nw(lines2(cbadge('读到 *：弹 0 次'), cbadge('读到 -：弹 2 次'))) }) },
  { beat: 59, html: H1D('new') + PB() + M({ ...S_MINUS, side: nw(lines2(cap('这里：还没写出去的运算符'), cap('3.6 求值：还没用上的数'))) }) },

  // ───────── 第5屏　括号（版面不变）：输入换成 (3+4)*2 ─────────
  { beat: 60, html: H5('new') + PB({ cls: 'dim' }) + M({ inp: IN3, head: -1, icls: all(7, 'new'), stk: [] }) },
  { beat: 61, html: H5() + PB({ cls: 'dim' }) + M({ inp: IN3, head: -1, box: [1, 3, '小式子', 'new'], stk: [], out: [...'34+'], ocls: all(3, 'rd new') }) },
  { beat: 62, html: H5() + PB({ cls: 'dim' }) + M({ inp: IN3, head: -1, box: [1, 3, '小式子'], stk: [], out: [...'34+2*'], ocls: ['rd', 'rd', 'rd', 'rd new', 'rd new'] }) },
  { beat: 63, html: H5() + PB({ cls: 'dim' }) + M({ inp: IN3, head: -1, box: [1, 3, '小式子'], stk: [] }) },
  { beat: 64, html: H5() + PB({ cls: 'dim' }) + M({ inp: IN3, head: 0, box: [1, 3, '小式子'], stk: ['('], wall: 0, scls: ['new'], top: true }) },
  { beat: 65, html: H5() + PB({ cls: 'dim' }) + M({ inp: IN3, head: 0, box: [1, 3, '小式子'], stk: ['('], wall: 0, top: true, side: cap('墙上面：像一个空栈', 'new') }) },
  { beat: 66, reveal: 'spread', html: H5() + PB({ cls: 'dim' }) + M({ inp: IN3, head: 3, box: [1, 3, '小式子'], stk: ['(', '+'], wall: 0, scls: ['', 'new'], top: true, out: [...'34'], ocls: ['new', 'new'] }) },
  { beat: 67, html: H5() + PB({ cls: 'dim' }) + M({ inp: IN3, head: 4, box: [1, 3, '小式子读完了', 'new'], stk: ['(', '+'], wall: 0, top: true, out: [...'34'] }) },
  { beat: 68, html: H5() + PB({ hl: END_LN }) + M({ inp: IN3, head: 4, box: [1, 3, '小式子读完了'], stk: ['('], wall: 0, top: true, out: [...'34+'], ocls: ['', '', 'new'] }) },
  { beat: 69, html: H5() + PB() + M({ inp: IN3, head: 4, stk: [], out: [...'34+'], side: nw(`${cchip('(', 'mono off')} ${cap('弹掉，不写出去')}`) }) },
  { beat: 70, reveal: 'spread', html: H5() + PB() + M({ inp: IN3, head: 7, stk: [], out: [...'34+2*'], ocls: ['', '', '', 'new', 'new'] }) },
  { beat: 71, html: H5() + PB() + M({ inp: IN3, head: 7, under: [0, 4, 'new'], stk: [], out: [...'34+2*'], ocls: ['', '', 'hl new', '', 'hl new'] }) },
  { beat: 72, html: H5() + PB() + M({ inp: IN3, head: 7, stk: [], out: [...'34+2*'], side: nw(lines2(cap('读到 ) 找最近的 ('), cap('就是 3.5 括号匹配'))) }) },
  { beat: 73, html: H5() + PF() + M({ inp: IN3, head: 7, stk: [], out: [...'34+2*'] }) },

  // ───────── 第6屏　写成函数（换版面：左代码卡，右伪代码面板） ─────────
  { beat: 74, html: H6('new') + CODE('ToPostfix', [], { cls: 'new' }) + PANEL('栈', MINI(false, 'new'), 'new') },
  { beat: 75, html: H6() + CODE('ToPostfix', []) + PANEL('栈', MINI(true)) },
  { beat: 76, html: H6() + CODE('同一个 SeqStack', [], { scls: 'new' }) + PANEL('栈', MINI(true)) },
  { beat: 77, html: H6() + CODE('先写优先级', precRows('new'), { scls: 'new' }) + PANEL('栈', MINI(true, 'dim')) },
  // 代码只往下长：上一块讲完，原位折叠成一行（下面还没有东西，所以不会挤动别的行）；Prec 讲完就不再显示
  { beat: 78, html: H6() + CODE('照伪代码写', tp([{ b: 'head', cls: 'new' }, { b: 'decl', cls: 'new', cur: true }]), { scls: 'new' }) + PANEL('伪代码', plines(P_HEAD, { cls: 'new' })) },
  { beat: 79, html: H6() + CODE('① 数字', tp([{ b: 'head' }, { b: 'decl', fold: true }, { b: 'forh', cls: 'new' }, { b: 'dig', cls: 'new', cur: true }]), { scls: 'new' }) + PANEL('伪代码 · 1', plines(P_DIG, { cls: 'hl new' })) },
  { beat: 80, html: H6() + CODE('左括号', tp([...TOP6, { b: 'dig', fold: true }, { b: 'lp', cls: 'new', cur: true }]), { scls: 'new' }) + PANEL('伪代码', plines(P_LP, { cls: 'hl new' })) },
  { beat: 81, html: H6() + CODE('右括号', tp([...TOP6, ...DL, { b: 'rp', cls: 'new', cur: true }]), { scls: 'new' }) + PANEL('伪代码', plines(P_RP, { cls: 'hl new' })) },
  { beat: 82, html: H6() + CODE('② 运算符', tp([...TOP6, ...DL, { b: 'rp', fold: true }, { b: 'op', cls: 'new', cur: true }, { b: 'els', fold: true, cls: 'new' }]), { scls: 'new' }) + PANEL('伪代码 · 2', plines(P_OP, { cls: 'hl new' })) },
  { beat: 83, html: H6() + CODE('② 运算符', tp([...TOP6, ...DL, { b: 'rp', fold: true }, { b: 'op', marks: ['GetTop'] }, { b: 'els', fold: true }])) + PANEL('伪代码 · 2', plines(P_OP, { marks: ['栈不空', '栈顶'] })) },
  { beat: 84, html: H6() + CODE('③ 读完了', tp([...TOP6, ...DL, { b: 'rp', fold: true }, { b: 'op', fold: true }, { b: 'els', fold: true }, { b: 'fend', cls: 'new' }, { b: 'fin', cls: 'new' }, { b: 'nul', cls: 'new', cur: true }]), { scls: 'new' }) + PANEL('伪代码 · 3', plines(P_FIN, { cls: 'hl new' })) },
  // 右括号那块重新展开，代码超过 15 行，往上滚
  { beat: 85, html: H6() + CODE('括号不配对', tp([...TOP6, ...DL, { b: 'rp', hl: [15] }, { b: 'op', fold: true }, { b: 'els', fold: true }, { b: 'fend' }, { b: 'fin', hl: [28] }, { b: 'nul' }]), { scls: 'new' }) +
    PANEL('括号不配对', nw(lines2(cap(') 弹不到 ('), cap('→ 右括号多了'), '', cap('读完还剩 ('), cap('→ 左括号多了')))) },
  { beat: 86, html: H6() + CODE('括号不配对', tp([...TOP6, ...DL, { b: 'rp' }, { b: 'op', fold: true }, { b: 'els', fold: true }, { b: 'fend' }, { b: 'fin' }, { b: 'nul' }])) +
    PANEL('括号不配对', lines2(cap(') 弹不到 ('), cap('→ 右括号多了'), '', cap('读完还剩 ('), cap('→ 左括号多了'), '', nw(cap('运算符多了、数字多了')), nw(cap('→ 交给 Eval 去查')))) },

  // ───────── 第7屏　接上Eval（版面不变） ─────────
  { beat: 87, html: H6() + CODE('接上 Eval', [{ html: h(TP[0]) + DOTS, n: NT, fold: TP.length }, ...mainRows('new')], { scls: 'new' }) +
    PANEL('计算器', nw(lines2(cchip('ToPostfix', 'mono'), '<div class="c-down">↓ 后缀式</div>', cchip('Eval', 'mono'), '<div class="c-down">↓</div>', cap('结果')))) },
  { beat: 88, reveal: 'spread', html: H6() + CODE('接上 Eval', [{ html: h(TP[0]) + DOTS, n: NT, fold: TP.length }, ...mainRows()]) + TERM((i) => (i < 5 ? 'hl new' : 'new')) },
  { beat: 89, html: H6() + CODE('接上 Eval', [{ html: h(TP[0]) + DOTS, n: NT, fold: TP.length }, ...mainRows()]) + TERM((i) => (i === 7 ? 'hl new' : '')) },

  // ───────── 第8屏　练习1（填空） ─────────
  { beat: 90, html: quiz1({ cls: 'new' }) },
  { after: 90, html: quiz1() + pause('等学生作答（点选项块再点空位）；作答后显示解析') },

  // ───────── 第9屏　练习2（单选） ─────────
  { beat: 91, html: quiz2({ cls: 'new' }) },
  { after: 91, html: quiz2() + pause('等学生作答；作答后每个选项下显示解析，不配旁白') },

  // ───────── 第10屏　下一步：一拍过门 ─────────
  { beat: 92, html: at(40, 16, ckick('下一步')) + at(40, 44, ctitle('函数调用它自己：递归').replace('c-title', 'c-title new')) },
]
