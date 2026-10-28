// 3.6 质感层分镜帧（npm run storyboard -- 3-6）。双栏稿 docs/course/3-6.md。
// 痛点 → 后缀式的定义 → 中缀式对照 → 加括号法（演绎）（人看得见整个式子）→ 程序从左往右扫（写法库第 17 条 + 第 13 条）。版面：
// - 第0屏问题屏：左卡 (40,86) 272×212"人"（式子 + 三条括线），右卡 (328,86) 272×212"程序"（字符带 + 读头），胶囊在 (40,312)；
// - 第1–2屏：左卡"定义"（定义、名字、3+4*2-1 → 后缀式，逐个划出运算对象），右卡"读法"（一行一步化简到 10）；第2屏两卡原位换成对照表和一对式子；胶囊位 (40,316)；
// - 第3–4屏：左栏思路卡 (40,86) 248 宽 + 小注 + 三步列表（先列出，代入到哪一步哪一步浅蓝），右卡 (304,86) 296×264 演示：一行式子原位长括号，下面一行行挪运算符；
// - 第5–10屏转换机：右栏 (372,·) 宽 228 三张卡不动——输入卡 (372,86)、栈卡 (372,160)、输出卡 (372,290)，只换里面的字；
//   左栏 (40,86) 宽 308：第6–8屏是规定卡 + 四行列表（推导记录 → 收拢成三条），第9屏起换成伪代码卡（第10屏原位插进括号分支）；
// - 第11–12屏：左边代码卡 (40,86) 360×264（12px、行高 14，超过 15 行就像编辑器一样往上滚），右边 (412,86) 188 宽是伪代码面板 / 运行结果。
// 第70拍"放着"的虚线框原位变成实线的"栈"，是转换机部分的关键时刻。帧里不写色值，样式在 scripts/lib/clean.ts（STACK_CSS、EDITOR_CSS）。
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
  39: '第1步，加括号。乘号最先算，它的两个运算对象是4和2，圈起来。',
  40: '接着是加号，它左边是3，右边是刚圈好的四乘二，圈起来。',
  41: '最后是减号，它左边是整个三加四乘二，右边是1，圈起来。',
  46: '再做括号三加四，乘二。第1步，原来的括号已经管住了三加四，再给乘法加一对括号；',
  47: '第2步，挪运算符；第3步，去掉括号，得三 四 加 二 乘。',
  116: '这样后缀式里不用空格分开，三四二乘加一减连着写就行。',
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
const Q1 = '能不能让读的顺序就是计算的顺序？', Q2 = '怎么把中缀式变成后缀式？'
const KQ1 = (done = false, cls = '') => ckick(`问题 ① · ${Q1}${done ? ` ${ok}` : ''}`, cls)
const KQ = (done = false, cls = '') => ckick(`问题 ② · ${Q2}${done ? ` ${ok}` : ''}`, cls)
const T0 = '算一个式子', TPF = '后缀表达式', TI = '中缀式和后缀式', TB = '手工转换：加括号法', T1 = '程序转换：从左往右读', T5 = '程序转换：括号', T6 = '写成程序'
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
      at(14, 34, ctape(IN1, { head: o.head, rd: Math.max(0, o.head ?? 0), cls: o.cls1, under: o.under, k: 'p1' })) +
      (o.note ? at(14, 84, o.note) : '') +
      (o.paren ? at(14, 124, ctape(IN3, { cls: o.pcls, box: o.pbox ? [1, 3, '先算这里', o.pbox] : undefined, k: 'p3' })) : '') +
      (o.concl !== undefined ? at(14, 172, `<div class="c-q ${o.concl}" data-k="concl" style="font-size:15px">计算的顺序 ≠ 读的顺序</div>`) : ''),
    o.cls ?? '', 'width:272px;height:212px;padding:0'))
}
const OPS1 = [1, 3, 5]

// ───────── 第1屏左卡：定义——宋体定义、名字、3+4*2-1 → 后缀式，逐个运算符划出它的两个运算对象 ─────────
const POST1 = [...'342*+1-'], POST3 = [...'34+2*']
// [运算符在后缀式里的下标, 两个运算对象连成的一段, 小注]
const OPND: [number, [number, number], string][] = [
  [3, [1, 2], '* 的两个运算对象：4 和 2'],
  [4, [0, 3], '+ 的两个运算对象：3 和 4 2 *'],
  [6, [0, 5], '- 的两个运算对象：3 4 2 * + 和 1'],
]
type DefO = { name?: string; row?: string; op?: number; marks?: number; cls?: string }
function DEF(o: DefO) {
  const cur = o.op === undefined ? undefined : OPND[o.op]
  const rc = o.row ?? ''
  const row = o.row === undefined ? '' :
    at(14, 76, `<span class="${rc}">${ctape(IN1, { w: 16, h: 24, tcls: 'bare', k: 'd1' })}</span>`) + at(124, 80, `<span class="${rc}">${cap('→')}</span>`) +
    at(146, 76, `<span class="${rc}">${ctape(POST1, { w: 16, h: 24, cls: POST1.map((_, i) => (i === cur?.[0] ? 'hl new' : '')), under: cur ? [cur[1][0], cur[1][1], 'new'] : undefined, k: 'dp' })}</span>`)
  const marks = OPND.slice(0, o.marks ?? 0).map(([, , s], k) =>
    at(14, 124 + 26 * k, `<span class="${k === (o.marks ?? 0) - 1 ? 'new' : ''}" data-k="mk-${k}">${cap(s)}</span>`)).join('')
  return at(40, 86, card(
      at(14, 10, '<div class="c-q" style="font-size:14px;line-height:21px">运算符写在它的两个运算对象后面</div>') +
      (o.name !== undefined ? at(14, 40, `<span class="${o.name}"><b class="c-q" style="font-size:15px">后缀表达式</b>　${cap('简称后缀式')}</span>`) : '') +
      row + marks,
    o.cls ?? '', 'width:272px;height:220px;padding:0'))
}

// ───────── 第2屏左卡：中缀式和后缀式三行对照 ─────────
const VS: [string, string, string][] = [
  ['运算符写在', '中间', '后面'],
  ['先算谁，靠', '优先级和括号', '出现的顺序'],
  ['读的顺序<br>= 计算的顺序', '不是', '是'],
]
function VSC(o: { rows: number; cls?: string }) {
  const cell = (x: number, y: number, s: string, w: number, cls: string, kk: string, b = false) =>
    at(x, y, `<div class="${cls}" data-k="${kk}" style="width:${w}px;font-size:13px;line-height:19px;${b ? 'font-weight:600' : ''}">${s}</div>`)
  return at(40, 86, card(
    at(104, 16, cap('中缀式')) + at(196, 16, cap('后缀式')) +
      VS.slice(0, o.rows).map(([a, b, c], k) => {
        const cls = k === o.rows - 1 ? 'new' : ''
        const y = 48 + 52 * k
        return cell(14, y, a, 86, cls, `vs${k}-a`, true) + cell(104, y, b, 88, cls, `vs${k}-b`) + cell(196, y, c, 72, cls, `vs${k}-c`)
      }).join(''),
    o.cls ?? '', 'width:272px;height:220px;padding:0'))
}

// ───────── 第2屏右卡：一对式子 3+4*2、(3+4)*2 ─────────
const IN4 = [...'3+4*2'], POST4 = [...'342*+']
function PAIR(o: { brk?: string; first?: string; cls?: string }) {
  const row = (inp: string[], post: string[], y: number, fi: number, k: string) =>
    at(14, y, ctape(inp, { w: 16, h: 24, tcls: 'bare', cls: o.brk ? inp.map((c) => ('()'.includes(c) ? o.brk! : '')) : undefined, k: k + 'i' })) +
    at(124, y + 4, cap('→')) +
    at(146, y, ctape(post, { w: 16, h: 24, cls: o.first !== undefined ? post.map((_, i) => (i === fi ? `hl ${o.first}` : '')) : undefined, k: k + 'p' }))
  return at(328, 86, card(at(14, 8, cap('例子')) + row(IN4, POST4, 50, 3, 'pa') + row(IN3, POST3, 104, 2, 'pb'),
    o.cls ?? '', 'width:272px;height:220px;padding:0'))
}

// ───────── 第1屏右卡：读法——后缀式一行一步往下化简 ─────────
const READ_ROWS: string[][] = [[...'342*+1-'], ['3', '8', '+', '1', '-'], ['11', '1', '-'], ['10']]
type ReadO = { rows?: number; hl?: [number, number[]][]; nw?: [number, number[]][]; check?: string; concl?: string; cls?: string }
function READ(o: ReadO) {
  const rows = READ_ROWS.slice(0, o.rows ?? 1).map((r, k) => {
    const cls = r.map((_, i) => {
      const h = o.hl?.find(([kk]) => kk === k)?.[1].includes(i) ? 'hl' : ''
      const n = o.nw?.find(([kk]) => kk === k)?.[1].includes(i) ? 'new' : ''
      return `${h} ${n}`
    })
    return at(14, 34 + 38 * k, ctape(r, { w: 24, h: 28, cls, k: `r${k}` }))
  }).join('')
  return at(328, 86, card(at(14, 8, cap('读法')) + rows +
    (o.check !== undefined ? at(70, 34 + 38 * 3 + 6, `<span class="${o.check}" data-k="rchk">${cap(`= 3+4*2-1 ${ok}`)}</span>`) : '') +
    (o.concl !== undefined ? at(14, 188, `<div class="c-q ${o.concl}" data-k="rconcl" style="font-size:14px">运算符出现的顺序 = 计算的顺序</div>`) : ''),
    o.cls ?? '', 'width:272px;height:220px;padding:0'))
}

// ───────── 第3–4屏：左栏思路卡 + 小注 + 加括号法三步（先列出，代入到哪一步哪一步浅蓝）；右卡演示 ─────────
const STEPS3: { rn: string; rs?: string }[] = [
  { rn: '1  给每个运算符加一对括号', rs: '先乘除后加减，一样高从左往右' },
  { rn: '2  运算符挪到右括号后面' },
  { rn: '3  去掉所有括号' },
]
function IDEA(o: { note?: string; name?: string; steps?: number; scls?: string; on?: number[]; cls?: string } = {}) {
  return at(40, 86, card('<div class="c-q" style="font-size:14px;line-height:21px">中缀 → 后缀<br>运算符从中间挪到后面</div>', o.cls ?? '', 'width:248px;height:64px;padding:10px 12px')) +
    (o.note !== undefined ? at(40, 158, `<span class="${o.note}">${cap('关键：按优先级分清两个运算对象')}</span>`) : '') +
    (o.name !== undefined ? at(40, 180, `<span class="${o.name}"><b style="font-size:13px">加括号法</b>　${cap('分三步')}</span>`) : '') +
    STEPS3.slice(0, o.steps ?? 0).map((s, k) => at(40, 204 + 48 * k,
      `<div class="c-li ${o.on?.includes(k) ? 'on' : ''} ${k === (o.steps ?? 0) - 1 ? o.scls ?? '' : ''}" data-k="st-${k}" style="width:248px"><span class="rn">${s.rn}</span>${s.rs ? `<span class="rs">${s.rs}</span>` : ''}</div>`)).join('')
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
    at(14, 24, ctape(E_STEPS[o.e ?? 0], { w: 16, h: 26, tcls: 'bare', cls: E_STEPS[o.e ?? 0].map((_, i) => (o.ehl?.includes(i) ? 'hl new' : '')), k: 'e' })) +
    MOVES.slice(0, o.moves ?? 0).map((m, k) => at(14, 66 + 28 * k, `<span class="${o.mcls ?? ''}" data-k="mv-${k}">${mono(m)}　${cap(MOVE_TAG[k])}</span>`)).join('') +
    (o.result !== undefined ? at(14, 162, `<span class="${o.result}">${ctape(POST1, { w: 20, h: 28, k: 'res' })}</span>`) : ''))
  return at(304, 86, card(body, o.cls ?? '', 'width:296px;height:264px;padding:0'))
}
// 第6屏左栏：手工转换和程序转换的异同（第7屏起换成规定卡和列表）
const CMP = (cls = '') =>
  at(40, 86, `<div class="c-li ${cls}" data-k="cmp-0" style="width:308px"><span class="rn">人：看得见整个式子</span><span class="rs">先找 *，再回头处理 +，加括号</span></div>`) +
  at(40, 136, `<div class="c-li on ${cls}" data-k="cmp-1" style="width:308px"><span class="rn">程序：只能从左往右读</span><span class="rs">读到 + 时，后面还看不到</span></div>`) +
  at(40, 186, `<div class="c-li ${cls}" data-k="cmp-2" style="width:308px"><span class="rn">相同：数字顺序不变</span><span class="rs">运算符写到两个运算对象后面</span></div>`)
// 第4屏右卡：(3+4)*2 三行 + 验算 + 程序的对照
type Demo2O = { rows?: number; rcls?: string; check?: string; prog?: 'num' | 'read'; pcls?: string }
const DEMO2 = (o: Demo2O) => DEMO({
  body:
    ((o.rows ?? 0) >= 1 ? at(14, 24, `<span class="${o.rows === 1 ? o.rcls ?? '' : ''}">${mono('((3+4)*2)')}</span>`) : '') +
    ((o.rows ?? 0) >= 2 ? at(14, 54, `<span class="${o.rows === 3 ? o.rcls ?? '' : ''}">${mono('((3 4)+ 2)*')}</span>`) : '') +
    ((o.rows ?? 0) >= 3 ? at(14, 84, `<span class="${o.rows === 3 ? o.rcls ?? '' : ''}">${ctape(POST3, { w: 20, h: 28, k: 'd2p' })}</span>`) : '') +
    (o.check !== undefined ? at(14, 124, `<span class="${o.check}" data-k="d2chk">${cap(`+ 算 3 和 4 得 7，* 算 7 和 2 得 14　= (3+4)*2 ${ok}`)}</span>`) : '') +
    (o.prog === 'num' ? at(14, 168, `<span class="${o.pcls ?? ''}">${cap('人：先 *（1），再 +（2），最后 -（3）')}</span>`) + at(14, 192, ctape(IN1, { w: 22, h: 28, tcls: 'bare', cls: IN1.map((_, i) => (OPS1.includes(i) ? 'hl' : '')), k: 'd2n' })) : '') +
    (o.prog === 'read' ? at(14, 168, `<span class="${o.pcls ?? ''}">${cap('程序：读到 + 时，后面还没读到')}</span>`) + at(14, 192, ctape(IN1, { w: 22, h: 28, head: 1, cls: IN1.map((_, i) => (i > 1 ? 'rd' : '')), k: 'd2r' })) : ''),
})

// ───────── 转换机：输入卡 + 栈卡 + 输出卡（右栏，第1–5屏不动） ─────────
type MO = {
  inp: string[]; head?: number; icls?: string[]; under?: [number, number, string?]; box?: [number, number, string, string?]
  stk?: string[]; dashed?: boolean; slabel?: string; lcls?: string; wall?: number; ring?: number; scls?: string[]; snotes?: (string | undefined)[]; side?: string; top?: boolean; stcls?: string
  out?: string[]; ocls?: string[]; oval?: string; alt?: string[]; acls?: string[]; aval?: string
  cls?: string
  // 给元素起名（播放器的移动和聚焦用）：输入格 in-i、读头 in-head；运算符按字起名 op+ op* …（入栈、出栈到输出带时滑过去）；
  // 输出带的数字 out-i，新写出去的数字从读头下那一格滑过来
  k?: boolean
}
function M(o: MO) {
  const rd = o.head === undefined ? 0 : Math.max(0, o.head)
  const from = o.k && o.head !== undefined && o.head >= 0 ? `in-${o.head}` : undefined
  const fresh = (cls: string[] | undefined, ok: (i: number) => boolean) =>
    from ? Object.fromEntries((cls ?? []).flatMap((c, i) => (/\bnew\b/.test(c) && ok(i) ? [[i, from]] : []))) : undefined
  const stkK = o.k ? { names: (o.stk ?? []).map((c) => `op${c}`), src: fresh(o.scls, () => true) } : {}
  const outK = o.k && o.out ? { names: o.out.map((c, i) => (isDigit(c) ? `out-${i}` : `op${c}`)), src: fresh(o.ocls, (i) => isDigit(o.out![i])) } : {}
  const inpCard = at(372, 86, card(
    at(176, 4, cap('中缀式')) + at(14, 24, ctape(o.inp, { head: o.head, rd, cls: o.icls, under: o.under, box: o.box, ...(o.k ? { k: 'in' } : {}) })),
    o.cls ?? '', 'width:228px;height:68px;padding:0'))
  const stkCard = at(372, 160, card(
    at(34, 8, cstack(o.stk ?? [], { dashed: o.dashed, label: o.slabel ?? (o.dashed ? '放着' : '栈'), lcls: o.lcls, wall: o.wall, ring: o.ring, cls: o.scls, notes: o.snotes, top: o.top, scls: o.stcls, ...stkK })) +
      (o.side ? at(90, 8, `<div data-k="side">${o.side}</div>`) : ''),
    o.cls ?? '', 'width:228px;height:124px;padding:0'))
  const row = (toks: string[], cls: string[] | undefined, val: string | undefined, y: number, kk = {}) =>
    at(12, y, ctape(toks, { w: 24, h: 22, cls, ...kk })) + (val ? at(182, y + 2, val) : '')
  const outCard = at(372, 290, card(
    (o.out?.length ? row(o.out, o.ocls, o.oval, 5, outK) : at(12, 8, cslot('后缀式'))) + (o.alt ? row(o.alt, o.acls, o.aval, 32, o.k ? { k: 'alt' } : {}) : ''),
    o.cls ?? '', 'width:228px;height:60px;padding:0'))
  return inpCard + stkCard + outCard
}
const all = (n: number, c: string) => Array.from({ length: n }, () => c)
/** 把下标 ks 的格子标成 c，其余空着 */
const mark = (n: number, ks: number[], c: string) => Array.from({ length: n }, (_, i) => (ks.includes(i) ? c : ''))

// ───────── 左栏：规定卡 + 四行列表（推导记录 → 三条规则） ─────────
const RULE = (cls = '') => at(40, 86, card('<div class="c-q" data-k="rule" style="font-size:14px;line-height:22px">规定：运算符写在它的两个运算对象后面</div>', cls, 'width:308px;height:40px;padding:8px 12px'))
type Row = { rn: string; rs?: string; cls?: string }
const LOG = (rows: (Row | null)[]) =>
  rows.map((r, k) => (r ? at(40, 136 + 50 * k, `<div class="c-li ${r.cls ?? ''}" data-k="log-${k}" style="width:308px"><span class="rn">${r.rn}</span>${r.rs ? `<span class="rs">${r.rs}</span>` : ''}</div>`) : '')).join('')
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
  const rows = ls.map((l, i) => {
    let t = escp(l.t)
    if (l.ins) t = t.replace(escp(l.ins), `<span class="hl new">${escp(l.ins)}</span>`)
    return `<div class="ce-ln ${l.cls ?? ''} ${l.fold ? 'fold' : ''}" data-k="pl-${i}" style="height:14px;line-height:14px;font-size:12px"><i></i><b>${l.g ?? ''}</b><code>${t}${l.fold ? DOTS : ''}</code></div>`
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

// ───────── 第12–13屏：代码卡（左）+ 伪代码面板 / 运行结果（右） ─────────
const PREC = ['int Prec(int op) {', "    if (op == '*' || op == '/') return 2;", "    if (op == '+' || op == '-') return 1;", '    return 0;', '}']
// 转换直接写在 main 里，照书稿；最长的 while 行在 && 处折成两行（卡宽放不下）
const MAIN = [
  'int main(void) {',
  '    char in[] = "3+4*2-1";',
  '    SeqStack S;',
  '    int t;',
  '    InitStack(&S);',
  "    for (int i = 0; in[i] != '\\0'; i++) {",
  '        char c = in[i];',
  "        if (c >= '0' && c <= '9') {",
  '            printf("%c", c);',
  "        } else if (c == '(') {",
  '            Push(&S, c);',
  "        } else if (c == ')') {",
  "            while (GetTop(&S, &t) && t != '(') {",
  '                Pop(&S, &t);',
  '                printf("%c", t);',
  '            }',
  '            Pop(&S, &t);',
  '        } else {',
  "            while (GetTop(&S, &t) && t != '('",
  '                   && Prec(t) >= Prec(c)) {',
  '                Pop(&S, &t);',
  '                printf("%c", t);',
  '            }',
  '            Push(&S, c);',
  '        }',
  '    }',
  '    while (Pop(&S, &t))',
  '        printf("%c", t);',
  '    printf("\\n");',
  '    return 0;',
  '}',
]
const IN_B = '    char in[] = "(3+4)*2";'
const ALL = [...PREC, '', ...MAIN, IN_B]
const HLS = await highlightC(ALL)
const HL = new Map(ALL.map((s, i) => [s, HLS[i]]))
const h = (s: string) => { const v = HL.get(s); if (v === undefined) throw new Error(`代码没有预先高亮：${s}`); return v }
// 行号：Prec 1–5，空一行，main 从 7 起
const NP = 1, NM = 7
type Ln = { html: string; n: number; fold?: number; cls?: string; cur?: boolean }
// main 按块组织：一块要么展开，要么折叠成一行（首行 + ⋯）
const BLK = { head: [0, 0], decl: [1, 4], forh: [5, 6], dig: [7, 8], lp: [9, 10], rp: [11, 16], op: [17, 23], fend: [24, 25], loop: [5, 25], fin: [26, 27], tail: [28, 30] } as const
type BK = keyof typeof BLK
type BS = { b: BK; fold?: boolean; cls?: string; marks?: string[]; cur?: boolean; swap?: [number, string, string] }
function tp(specs: BS[]): Ln[] {
  return specs.flatMap((s) => {
    const [a, z] = BLK[s.b]
    if (s.fold) return [{ html: h(MAIN[a]) + DOTS, n: NM + a, fold: z - a + 1, cls: s.cls }]
    return MAIN.slice(a, z + 1).map((t, i) => {
      const k = a + i
      // swap：把第 k 行原位换成另一行（试一试时换输入）
      let html = s.swap && s.swap[0] === k ? h(s.swap[1]) : h(t)
      for (const m of s.marks ?? []) html = html.split(m).join(`<span class="hl new">${m}</span>`)
      const cls = `${s.cls ?? ''} ${s.swap && s.swap[0] === k ? s.swap[2] : ''}`
      return { html, n: NM + k, cls, cur: s.cur && k === z }
    })
  })
}
const precRows = (cls = '', n = PREC.length): Ln[] => PREC.slice(0, n).map((t, i) => ({ html: h(t), n: NP + i, cls, cur: cls === 'new' && i === n - 1 }))
// 第12屏代码卡开头几行：main 头、声明（折叠）、for 头；数字和左括号分支讲完后各折叠成一行
const TOP6: BS[] = [{ b: 'head' }, { b: 'decl', fold: true }, { b: 'forh' }]
const DL: BS[] = [{ b: 'dig', fold: true }, { b: 'lp', fold: true }]
const ROWS_MAX = 15
function CODE(step: string, ls: Ln[], o: { scls?: string; cls?: string } = {}) {
  const shown = ls.length > ROWS_MAX ? ls.slice(ls.length - ROWS_MAX) : ls // 超过 15 行像编辑器一样往上滚
  const rows = shown.map((l) =>
    `<div class="ce-ln ${l.cls ?? ''} ${l.cur ? 'cur' : ''} ${l.fold ? 'fold' : ''}" data-k="ln-${l.n}" style="height:14px;line-height:14px;font-size:12px"><i>${l.n}</i><b>${l.fold ? '▸' : ''}</b><code>${l.html}</code></div>`).join('')
  return at(40, 86, `<div class="c-editor ${o.cls ?? ''}" style="width:360px;height:264px"><div class="ce-bar"><span class="ce-tab">topostfix.c</span>${step ? ckick(step, o.scls) : ''}</div><div class="ce-body">${rows}</div></div>`)
}
/** 右边面板 (412,86) 188×264：tab 写标题，内容是伪代码的当前分支或别的东西 */
function PANEL(tab: string, body: string, cls = '') {
  return at(412, 86, `<div class="c-editor ${cls}" style="width:188px;height:264px"><div class="ce-bar"><span class="ce-tab">${tab}</span></div><div style="position:relative;padding:8px 10px">${body}</div></div>`)
}
const plines = (ls: string[], o: { marks?: string[]; cls?: string } = {}) =>
  `<div class="${o.cls ?? ''}">${ls.map((t, i) => {
    let s = escp(t)
    for (const m of o.marks ?? []) s = s.split(m).join(`<span class="hl new">${m}</span>`)
    return `<div class="ce-ln" data-k="pp-${i}" style="height:16px;line-height:16px;font-size:12px"><code>${s}</code></div>`
  }).join('')}</div>`
const P_HEAD = ['InitStack(S)', 'for 中缀式里的每个字符 c:']
const P_DIG = ['if c 是数字:', '    输出 c']
const P_LP = ["else if c 是 '(':", '    Push(S, c)']
const P_RP = ["else if c 是 ')':", "    while 栈顶不是 '(':", '        Pop(S, &t); 输出 t', '    Pop(S, &t)']
const P_OP = ['else:', '    while 栈不空 且', "      栈顶不是 '(' 且", '      栈顶优先级 >=', '      c 的优先级:', '        Pop(S, &t); 输出 t', '    Push(S, c)']
const P_FIN = ['while not StackEmpty(S):', '    Pop(S, &t); 输出 t']
const MINI = (notes = false, cls = '') => at(36, 26, `<div class="${cls}">${cstack(['(', '+'], { label: '栈里是字符', k: 'mini' })}</div>`)
const TERM = (out: string[], cls: (i: number) => string) => PANEL('运行结果', out.map((s, i) => `<div class="tuple ${cls(i)}" data-k="term-${i}" style="font-size:14px;line-height:24px;white-space:nowrap">${s}</div>`).join(''))

// ───────── 练习 ─────────
const quiz1 = (o: { cls?: string; dim?: boolean } = {}) => {
  const k = `${o.cls ?? ''} ${o.dim ? 'dim' : ''}`
  const rows = ['读完 <code>)</code> 之后，已经输出的是', '这时栈里只剩一个运算符', '最后得到的后缀式是']
  return cquiz(at(40, 16, ckick('练习 2 · 填空', o.cls)) + at(40, 44, ctitle('栈里是什么？').replace('c-title', `c-title ${o.cls ?? ''}`)) +
    at(40, 92, `<div class="c-q ${k}" style="font-size:14px">把中缀式 <code>2*(3+4)-5</code> 转成后缀式，从左往右读。</div>`) +
    rows.map((s, i) => at(40, 130 + 36 * i, `<span class="${k}">${s} ${cblank('', { w: 72, quiz: true })}</span>`)).join('') +
    at(40, 250, cqchips(['234+', '*', '234+*5-', '23+4', '+', '234*+5-'], k)) +
    (o.dim ? '' : at(40, 242, cqex(44)) + at(40, 314, cqbar('fill'))))
}
const OPTS2 = ['9 4 2 / - 1 +', '9 4 2 / 1 + -', '9 4 - 2 / 1 +']
const quiz2 = (o: { cls?: string; dim?: boolean } = {}) => cquiz(
  at(40, 16, ckick('练习 1 · 单选', o.cls)) + at(40, 44, ctitle('哪个是它的后缀式？').replace('c-title', `c-title ${o.cls ?? ''}`)) +
  at(40, 92, `<div class="c-q ${o.cls ?? ''} ${o.dim ? 'dim' : ''}" style="font-size:14px">中缀式 <code>9-4/2+1</code> 写成后缀式是哪一个？</div>`) +
  at(40, 124, `<div class="c-opts1 ${o.dim ? 'dim' : ''}">${OPTS2.map((s, i) => copt('ABC'[i], `<code>${s}</code>`, o.cls)).join('')}</div>`) +
  (o.dim ? '' : at(40, 236, cqex(70)) + at(40, 314, cqbar('choice'))))

// ───────── 常用组合 ─────────
const H0 = head(T0)
const HP = () => head(TPF, { kick: KQ1() })
const HI = () => head(TI, { kick: KQ1(true) })
const HB = head(TB, { kick: KQ() })
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
  // 念到"一个字符一个字符读"：读头一格格往右走，正好走到 4（下一拍读到 3+4）
  { beat: 3, html: H0 + HUMAN({ braces: 3 }) + PROG({ head: -1, cls: 'new' }), cues: [{ at: '一个字符一个字符读', steps: [0, 1, 2].map((h) => H0 + HUMAN({ braces: 3 }) + PROG({ head: h })) }] },
  { beat: 4, html: H0 + HUMAN({ braces: 3 }) + PROG({ head: 2 }), cues: [{ at: '读到`3+4`', focus: 'p1-0,p1-1,p1-2', note: '能算出 7 吗？', side: 'b' }] },
  { beat: 5, html: H0 + HUMAN({ braces: 3 }) + PROG({ head: 2, cls1: mark(7, [3], 'hl new') }), cues: [{ at: '后面还有一个`*`', focus: 'p1-3', note: '* 比 + 先算', side: 'b' }, { at: '4要先给`*`用', focus: 'p1-2,p1-3', note: '4 先给 *', side: 'b' }] },
  { beat: 6, html: H0 + HUMAN({ braces: 3 }) + PROG({ head: 4, under: [2, 4, 'new'] }), cues: [{ at: '能先算`4*2`吗', focus: 'p1-2,p1-3,p1-4', note: '能先算吗？', side: 'b' }] },
  { beat: 7, html: H0 + HUMAN({ braces: 3 }) + PROG({ head: 4, under: [2, 4], cls1: mark(7, [5], 'hl new') }), cues: [{ at: '后面的`-`', focus: 'p1-5', note: '读到 - 才知道', side: 'b' }] },
  { beat: 8, html: H0 + HUMAN({ braces: 3 }) + PROG({ head: 4, paren: true }), cues: [{ at: '先算`3+4`', focus: 'p3-1,p3-2,p3-3', note: '先算这里', side: 'b' }] },
  { beat: 9, html: H0 + HUMAN({ braces: 3 }) + PROG({ head: 4, cls1: mark(7, OPS1, 'hl new'), paren: true, pcls: IN3.map((c) => (isDigit(c) ? '' : 'hl new')) }), cues: [{ at: '后面还有什么运算符', focus: 'p1-1,p1-3,p1-5' }, { at: '有没有括号', focus: 'p3-0,p3-4' }] },
  { beat: 10, html: H0 + HUMAN({ braces: 3 }) + PROG({ head: 4, paren: true, concl: 'new' }), cues: [{ at: '计算的顺序和读的顺序不一样', focus: 'concl' }] },
  { beat: 12, html: H0 + HUMAN({ braces: 3 }) + PROG({ head: 4, paren: true, concl: '' }) + PILL1('new') },

  // ───────── 第1屏　后缀表达式（换版面：定义 ↔ 读法）：点名加定义，实例里逐个划出运算对象，右卡读到哪算到哪 ─────────
  { beat: 13, html: head(TPF, { kick: KQ1(false, 'new'), tcls: 'new' }) + DEF({ cls: 'new' }) },
  { beat: 14, html: HP() + DEF({ name: 'new' }) },
  { beat: 15, html: HP() + DEF({ name: '', row: 'new' }), cues: [{ at: '写成后缀式是', focus: 'dp-0,dp-1,dp-2,dp-3,dp-4,dp-5,dp-6' }] },
  { beat: 16, html: HP() + DEF({ name: '', row: '', op: 0, marks: 1 }), cues: [{ at: '`*`的两个运算对象是4和2', focus: 'dp-1,dp-2,dp-3' }] },
  { beat: 17, html: HP() + DEF({ name: '', row: '', op: 1, marks: 2 }), cues: [{ at: '`+`的两个运算对象', focus: 'dp-0,dp-1,dp-2,dp-3,dp-4' }] },
  { beat: 18, html: HP() + DEF({ name: '', row: '', op: 2, marks: 3 }), cues: [{ at: '`-`的两个运算对象', focus: 'dp-0,dp-1,dp-2,dp-3,dp-4,dp-5,dp-6' }] },
  { beat: 19, html: HP() + DEF({ name: '', row: '', marks: 3 }) + READ({ rows: 1, cls: 'new' }), cues: [{ at: '每读到一个运算符', focus: 'r0-3' }, { at: '前面最近的两个数', focus: 'r0-1,r0-2' }, { at: '替换掉它们', focus: 'r0-1,r0-2,r0-3' }] },
  { beat: 21, html: HP() + DEF({ name: '', row: '', marks: 3 }) + READ({ rows: 2, hl: [[0, [1, 2, 3]], [1, [1]]], nw: [[0, [1, 2, 3]], [1, [0, 1, 2, 3, 4]]] }), cues: [{ at: '`*`前面最近的是4和2', focus: 'r0-1,r0-2,r0-3' }, { at: '式子变成', focus: 'r1-0,r1-1,r1-2,r1-3,r1-4' }] },
  { beat: 22, html: HP() + DEF({ name: '', row: '', marks: 3 }) + READ({ rows: 3, hl: [[1, [0, 1, 2]]], nw: [[1, [0, 1, 2]], [2, [0, 1, 2]]] }), cues: [{ at: '`+`算3和8', focus: 'r1-0,r1-1,r1-2' }, { at: '得11', focus: 'r2-0' }] },
  { beat: 23, html: HP() + DEF({ name: '', row: '', marks: 3 }) + READ({ rows: 4, hl: [[2, [0, 1, 2]]], nw: [[2, [0, 1, 2]], [3, [0]]], check: 'new' }), cues: [{ at: '`-`算11和1', focus: 'r2-0,r2-1,r2-2' }, { at: '得10', focus: 'r3-0' }, { at: '一样', focus: 'rchk' }] },
  { beat: 24, html: head(TPF, { kick: KQ1(true, 'new') }) + DEF({ name: '', row: '', marks: 3 }) + READ({ rows: 4, check: '', concl: 'new' }), cues: [{ at: '运算符出现的顺序', focus: 'rconcl' }] },

  // ───────── 第2屏　中缀式和后缀式（版面不变）：两张卡原位换内容——左卡三行对照，右卡一对式子 ─────────
  { beat: 25, html: head(TI, { kick: KQ1(true), tcls: 'new' }) + VSC({ rows: 1, cls: 'new' }), cues: [{ at: '运算符夹在两个运算对象中间', focus: 'vs0-b' }] },
  { beat: 26, html: HI() + VSC({ rows: 2 }), cues: [{ at: '中缀式靠优先级和括号', focus: 'vs1-b' }, { at: '后缀式靠运算符出现的顺序', focus: 'vs1-c' }] },
  { beat: 27, html: HI() + VSC({ rows: 3 }), cues: [{ at: '中缀式读的顺序不是', focus: 'vs2-b' }, { at: '后缀式是', focus: 'vs2-c' }] },
  { beat: 28, html: HI() + VSC({ rows: 3 }) + PAIR({ cls: 'new' }), cues: [{ at: '拿`3+4*2`', focus: 'pai-0,pai-1,pai-2,pai-3,pai-4' }, { at: '和`(3+4)*2`', focus: 'pbi-0,pbi-1,pbi-2,pbi-3,pbi-4,pbi-5,pbi-6' }] },
  { beat: 29, html: HI() + VSC({ rows: 3 }) + PAIR({ brk: 'hl new' }), cues: [{ at: '靠括号', focus: 'pbi-0,pbi-4' }] },
  { beat: 30, html: HI() + VSC({ rows: 3 }) + PAIR({ first: 'new' }), cues: [{ at: '`*`排在前面的', focus: 'pap-3', note: '先算乘' }, { at: '`+`排在前面的', focus: 'pbp-2', note: '先算加' }] },
  { beat: 31, html: HI() + VSC({ rows: 3 }) + PAIR({ first: '' }) + PILL2('new') },

  // ───────── 第3屏　加括号法（换版面：思路 + 三步 + 演示）：先说三步，再一步步代入，括号原位一对对长出来 ─────────
  { beat: 32, html: head(TB, { kick: KQ(false, 'new'), tcls: 'new' }) + IDEA({ cls: 'new' }) },
  { beat: 33, html: HB + IDEA({ note: 'new' }) },
  { beat: 34, html: HB + IDEA({ note: '', name: 'new' }) },
  { beat: 35, html: HB + IDEA({ note: '', name: '', steps: 1, scls: 'new' }) },
  { beat: 36, html: HB + IDEA({ note: '', name: '', steps: 2, scls: 'new' }) },
  { beat: 37, html: HB + IDEA({ note: '', name: '', steps: 3, scls: 'new' }) },
  { beat: 38, html: HB + IDEA({ note: '', name: '', steps: 3 }) + DEMO({ e: 0, cls: 'new' }) },
  { beat: 39, html: HB + IDEA({ note: '', name: '', steps: 3, on: [0] }) + DEMO({ e: 0 }),
    cues: [{ at: '`*`最先算', focus: 'e-6' }, { at: '它的两个运算对象是4和2', focus: 'e-5,e-7' }, { at: '圈起来', steps: [HB + IDEA({ note: '', name: '', steps: 3, on: [0] }) + DEMO({ e: 1, ehl: [4, 5, 7, 8] })], focus: 'e-4,e-5,e-6,e-7,e-8' }] },
  { beat: 40, html: HB + IDEA({ note: '', name: '', steps: 3, on: [0] }) + DEMO({ e: 1 }),
    cues: [{ at: '接着是`+`', focus: 'e-3' }, { at: '它左边是3', focus: 'e-2' }, { at: '右边是刚圈好的', focus: 'e-4,e-5,e-6,e-7,e-8' }, { at: '圈起来', steps: [HB + IDEA({ note: '', name: '', steps: 3, on: [0] }) + DEMO({ e: 2, ehl: [1, 2, 4, 5, 6, 7, 8, 9] })], focus: 'e-1,e-2,e-3,e-4,e-5,e-6,e-7,e-8,e-9' }] },
  { beat: 41, html: HB + IDEA({ note: '', name: '', steps: 3, on: [0] }) + DEMO({ e: 2 }),
    cues: [{ at: '最后是`-`', focus: 'e-10' }, { at: '它左边是整个', focus: 'e-1,e-2,e-3,e-4,e-5,e-6,e-7,e-8,e-9' }, { at: '右边是1', focus: 'e-11' }, { at: '圈起来', steps: [HB + IDEA({ note: '', name: '', steps: 3, on: [0] }) + DEMO({ e: 3, ehl: [0, 11, 12] })], focus: 'e-0,e-1,e-2,e-3,e-4,e-5,e-6,e-7,e-8,e-9,e-10,e-11,e-12' }] },
  { beat: 42, html: HB + IDEA({ note: '', name: '', steps: 3, on: [0] }) + DEMO({ e: 3, ehl: [0, 1, 4, 8, 9, 12] }), cues: [{ at: '每对括号里', focus: 'e-0,e-1,e-2,e-3,e-4,e-5,e-6,e-7,e-8,e-9,e-10,e-11,e-12' }] },
  { beat: 43, html: HB + IDEA({ note: '', name: '', steps: 3, on: [1] }) + DEMO({ e: 3, ehl: E_OPS }) },
  { beat: 44, reveal: 'spread', html: HB + IDEA({ note: '', name: '', steps: 3, on: [1] }) + DEMO({ e: 3, moves: 3, mcls: 'new' }) },
  { beat: 45, html: HB + IDEA({ note: '', name: '', steps: 3, on: [2] }) + DEMO({ e: 3, moves: 3, result: 'new' }), cues: [{ at: '和前面写的一样', focus: 'res-0,res-1,res-2,res-3,res-4,res-5,res-6' }] },

  // ───────── 第4屏　再做一个（版面不变） ─────────
  { beat: 46, html: HB + IDEA({ note: '', name: '', steps: 3, on: [0] }) + DEMO2({ rows: 1, rcls: 'new' }) },
  { beat: 47, reveal: 'spread', html: HB + IDEA({ note: '', name: '', steps: 3, on: [1, 2] }) + DEMO2({ rows: 3, rcls: 'new' }) },
  { beat: 48, html: HB + IDEA({ note: '', name: '', steps: 3 }) + DEMO2({ rows: 3, check: 'new' }), cues: [{ at: '`+`算3和4得7', focus: 'd2p-0,d2p-1,d2p-2' }, { at: '`*`算7和2得14', focus: 'd2p-3,d2p-4' }, { at: '也是14', focus: 'd2chk' }] },
  { beat: 49, html: HB + IDEA({ note: '', name: '', steps: 3 }) + DEMO2({ rows: 3, check: '', prog: 'num', pcls: 'new' }), cues: [{ at: '先找到`*`', focus: 'd2n-3' }, { at: '再回头处理`+`', focus: 'd2n-1' }, { at: '最后才轮到`-`', focus: 'd2n-5' }] },
  { beat: 50, html: HB + IDEA({ note: '', name: '', steps: 3 }) + DEMO2({ rows: 3, check: '', prog: 'read', pcls: 'new' }), cues: [{ at: '读到`+`时', focus: 'd2r-1' }, { at: '后面有没有`*`', focus: 'd2r-3', note: '后面还看不到', side: 'b' }] },

  // ───────── 第5屏　练习1（单选）：手工转换讲完马上练 ─────────
  { beat: 51, html: quiz2({ cls: 'new' }) },
  { after: 51, html: quiz2() + pause('等学生作答；作答后每个选项下显示解析，不配旁白') },

  // ───────── 第6屏　程序也在找运算对象（换版面：转换机）：先说和手工转换的异同 ─────────
  { beat: 52, html: head(T1, { kick: KQ(), tcls: 'new' }) + CMP('new') + M({ k: true, inp: IN1, stk: [], dashed: true, cls: 'new' }), cues: [{ at: '程序只能从左往右', focus: 'cmp-1' }, { at: '相同的是要做的事', focus: 'cmp-2' }] },
  { beat: 53, html: H1() + CMP() + M({ k: true, inp: IN1, icls: IN1.map((c) => (isDigit(c) ? 'hl new' : '')), stk: [], dashed: true, out: POST1, ocls: POST1.map((c) => (isDigit(c) ? 'hl new' : 'rd new')) }), cues: [{ at: '的数字是3、4、2、1', focus: 'in-0,in-2,in-4,in-6' }, { at: '里还是3、4、2、1', focus: 'out-0,out-1,out-2,out-5' }, { at: '读到就能写出去', focus: 'in-0,in-2,in-4,in-6' }] },
  { beat: 55, html: H1() + CMP() + M({ k: true, inp: IN1, icls: mark(7, [1], 'hl new'), stk: [], dashed: true, out: POST1, ocls: POST1.map((c, i) => (i === 4 ? 'hl new' : 'rd')) }), cues: [{ at: '`+`在中缀式里是第一个', focus: 'in-1' }, { at: '却排在`*`后面', focus: 'op*,op+' }] },
  { beat: 56, html: H1() + CMP() + M({ k: true, inp: IN1, head: 1, icls: mark(7, [1], 'hl'), stk: [], dashed: true }), cues: [{ at: '程序读到`+`的时候', focus: 'in-1' }] },

  // ───────── 第7屏　运算符要等：推出栈（版面不变：左栏出现规定卡和列表）；直接读例子 ─────────
  { beat: 57, html: H1() + RULE('new') + M({ k: true, inp: IN1, head: -1, stk: [], dashed: true }) },
  { beat: 58, html: H1() + RULE() + M({ k: true, inp: IN1, head: 0, stk: [], dashed: true, out: ['3'], ocls: ['new'] }) },
  { beat: 59, html: H1() + RULE() + M({ k: true, inp: IN1, head: 1, icls: mark(7, [0], 'hl new'), stk: [], dashed: true, out: ['3'] }), cues: [{ at: '左边是3', focus: 'in-0', note: '+ 的左边：3', side: 'b' }, { at: '右边还没读到', focus: 'in-2', note: '+ 的右边：？', side: 'b' }] },
  { beat: 60, html: H1() + RULE() + LOG([on(R1a, 'new')]) + M({ k: true, inp: IN1, head: 1, stk: ['+'], scls: ['new'], snotes: [`右边：${cslot('？')}`], dashed: true, out: ['3'] }), cues: [{ at: '先放着', focus: 'op+' }] },
  { beat: 61, html: H1() + RULE() + LOG([R1a]) + M({ k: true, inp: IN1, head: 2, stk: ['+'], snotes: [`右边：${cslot('？')}`], dashed: true, out: [...'34'], ocls: ['', 'new'] }) },
  { beat: 62, html: H1() + RULE() + LOG([R1a]) + M({ k: true, inp: IN1, head: 2, stk: ['+'], snotes: [`右边：${cslot('？')}`], dashed: true, out: [...'34'] }), cues: [{ at: '第二个运算对象是4吗', focus: 'in-2', note: '是 4 吗？', side: 'b' }, { at: '4后面跟的是什么', focus: 'in-3', note: '还不知道', side: 'b' }] },
  { beat: 63, html: H1() + RULE() + LOG([R1a]) + M({ k: true, inp: IN1, head: 3, stk: ['+'], snotes: [`右边：${cslot('？')}`], dashed: true, out: [...'34'], side: nw(lines2(cap('* / 比 + - 先算'), cap('* / 的<b>优先级</b>高'))) }), cues: [{ at: '读到`*`', focus: 'in-3' }, { at: '优先级', focus: 'side' }] },
  { beat: 64, html: H1() + RULE() + LOG([R1a]) + M({ k: true, inp: IN1, head: 3, under: [2, 4, 'new'], stk: ['+'], snotes: [`右边：${nw('4*2')}`], dashed: true, out: [...'34'] }), cues: [{ at: '4要先给`*`用', focus: 'in-2,in-3' }, { at: '`4*2`算出来的数', focus: 'in-2,in-3,in-4' }] },
  { beat: 65, html: H1() + RULE() + LOG([{ ...R1b, rs: nw(R1b.rs!) }]) + M({ k: true, inp: IN1, head: 3, under: [2, 4], stk: ['+'], snotes: ['右边：4*2'], dashed: true, out: [...'34'] }), cues: [{ at: '`+`要写在`4 2 *`后面', focus: 'log-0' }] },
  { beat: 66, html: H1() + RULE() + LOG([R1b, on(R2, 'new')]) + M({ k: true, inp: IN1, head: 3, stk: ['+', '*'], scls: ['', 'new'], snotes: ['右边：4*2', `右边：${cslot('？')}`], dashed: true, out: [...'34'] }), cues: [{ at: '左边是4', focus: 'in-2' }, { at: '也放着', focus: 'op*' }] },
  { beat: 67, html: H1() + RULE() + LOG([R1b, R2]) + M({ k: true, inp: IN1, head: 3, stk: ['+', '*'], dashed: true, out: [...'34'] }), cues: [{ at: '先放下的`+`', focus: 'op+', note: '先放下' }, { at: '后放下的`*`', focus: 'op*', note: '后放下' }] },
  { beat: 68, html: H1() + RULE() + LOG([R1b, R2]) + M({ k: true, inp: IN1, head: 3, stk: ['+', '*'], dashed: true, out: [...'34'] }), cues: [{ at: '写出去`*`', focus: 'op*', note: '先写出去' }] },
  { beat: 69, html: H1() + RULE() + LOG([R1b, R2]) + M({ k: true, inp: IN1, head: 3, stk: ['+', '*'], dashed: true, out: [...'34'] }), cues: [{ at: '`+`要用`*`算出来的数', focus: 'op+', note: '要用 4*2 的结果' }, { at: '`+`的运算对象就不齐', focus: 'op+' }] },
  // 关键时刻：虚线框原位变成实线，"放着"原位变成"栈"，同一帧
  { beat: 70, html: H1() + RULE() + LOG([R1b, R2]) + M({ k: true, inp: IN1, head: 3, stk: ['+', '*'], slabel: '栈', lcls: 'new', stcls: 'new', top: true, out: [...'34'] }) },

  // ───────── 第8屏　一样高也弹：连弹两个（版面不变）；元素带名字，念到"弹出""入栈"时滑过去 ─────────
  { beat: 71, html: H1() + RULE() + LOG([R1b, R2]) + M({ k: true, inp: IN1, head: 4, stk: ['+', '*'], top: true, out: [...'342'], ocls: ['', '', 'new'] }), cues: [{ at: '输出是`3 4 2`', focus: 'out-0,out-1,out-2' }] },
  // 读到 -：先回答栈顶等着的 *（右边齐了没有），再回答 +；- 只和当前栈顶比，它自己的左边最后才说
  { beat: 72, html: H1() + RULE() + LOG([R1b, R2]) + M({ k: true, ...S_MINUS }), cues: [{ at: '读到`-`', focus: 'in-5' }, { at: '`*`在等它的右边', focus: 'op*', note: '等右边' }] },
  { beat: 73, html: H1() + RULE() + LOG([R1b, R2]) + M({ k: true, ...S_MINUS, icls: mark(7, [4], 'hl new') }), cues: [{ at: '`*`比`-`高', focus: 'op*,in-5', note: '* 比 - 高' }, { at: '2要先给`*`用', focus: 'in-4', note: '* 的右边是 2', side: 'b' }] },
  { beat: 74, html: H1() + RULE() + LOG([R1b, R2]) + M({ k: true, ...S_MINUS }),
    cues: [{ at: '4和2都齐了', focus: 'out-1,out-2' }, { at: '弹出', steps: [H1() + RULE() + LOG([R1b, R2]) + M({ k: true, ...S_MINUS, stk: ['+'], out: [...'342*'], ocls: mark(4, [3], 'new') })] }, { at: '写出去', focus: 'op*' }] },
  { beat: 75, html: H1() + RULE() + LOG([R1b, R2]) + M({ k: true, ...S_MINUS, stk: ['+'], out: [...'342*'] }), cues: [{ at: '新的栈顶是`+`', focus: 'op+', note: '等 4*2' }] },
  { beat: 76, html: H1() + RULE() + LOG([R1b, R2]) + M({ k: true, ...S_MINUS, stk: ['+'], out: [...'342*'] }), cues: [{ at: '`+`和`-`一样高', focus: 'op+,in-5', note: '一样高 → 也弹' }] },
  { beat: 77, html: H1() + RULE() + LOG([R1b, R2]) + M({ k: true, ...S_MINUS, stk: [], out: [...'342*+'], ocls: mark(5, [4], 'new') }) },
  { beat: 78, html: H1() + RULE() + LOG([R1b, R2]) + M({ k: true, ...S_MINUS, under: [0, 4, 'new'], stk: [], out: [...'342*+'] }), cues: [{ at: '`-`的左边', focus: 'in-0,in-1,in-2,in-3,in-4' }] },
  { beat: 79, html: H1() + RULE() + LOG([R1b, R2]) + M({ k: true, ...S_MINUS, stk: [], out: [...'342*+'] }),
    cues: [{ at: '右边还没读到', focus: 'in-6' }, { at: '入栈', steps: [H1() + RULE() + LOG([R1b, R2, on(R3, 'new')]) + M({ k: true, ...S_MINUS, stk: ['-'], scls: ['new'], out: [...'342*+'] })] }] },
  { beat: 80, html: H1() + RULE() + LOG([R1b, R2, R3]) + M({ k: true, inp: IN1, head: 6, stk: ['-'], top: true, out: [...'342*+1'], ocls: mark(6, [5], 'new') }) },
  { beat: 81, html: H1() + RULE() + LOG([R1b, R2, R3]) + M({ k: true, inp: IN1, head: 7, stk: ['-'], top: true, out: [...'342*+1'] }),
    cues: [{ at: '`-`的两个运算对象都齐了', focus: 'op-' }, { at: '弹出', steps: [H1() + RULE() + LOG([R1b, R2, R3, on(R4, 'new')]) + M({ k: true, ...S_DONE, ocls: mark(7, [6], 'new') })] }] },
  { beat: 82, html: H1() + RULE() + LOG(LOG4) + M({ k: true, ...S_DONE, oval: ok, alt: OUT1, acls: all(7, 'new'), aval: cap('开头手写', 'new') }) },

  // ───────── 第9屏　收拢成三条（版面不变）：闪回、对照行、三条规则 ─────────
  { beat: 83, cut: true, html: H1() + RULE() + LOG([R1b, R2, on(R3), R4]) + M({ k: true, ...S_MINUS }), cues: [{ at: '注意读到`-`这一步', focus: 'log-2' }] },
  { beat: 84, cut: true, html: H1() + RULE() + LOG([R1b, R2, on(R3), R4]) + M({ k: true, ...S_MINUS }), cues: [{ at: '弹完`*`', focus: 'op*' }, { at: '新的栈顶`+`', focus: 'op+', note: '接着比，比到栈空' }] },
  { beat: 85, cut: true, html: H1() + RULE() + LOG([R1b, on(R2), R3, R4]) + M({ k: true, inp: IN1, head: 3, stk: ['+'], top: true, out: [...'34'] }), cues: [{ at: '比如读到`*`时', focus: 'op+', note: '比 * 低 → 不弹' }] },
  { beat: 86, cut: true, html: H1() + RULE() + LOG(LOG4) + M({ k: true, ...S_DONE, alt: [...'342*1-+'], acls: all(7, 'rd new'), side: nw(lines2(cap('第二行：+ 接着等'), cap('算的是 3+(8-1)'))) }) },
  { beat: 87, cut: true, html: H1() + RULE() + LOG(LOG4) + M({ k: true, ...S_DONE, oval: cap('= 10', 'new'), alt: [...'342*1-+'], acls: all(7, 'rd'), aval: cap('= 10', 'new'), side: lines2(cap('第二行：+ 接着等'), cap('算的是 3+(8-1)')) }) },
  { beat: 88, cut: true, html: H1() + RULE() + LOG(LOG4) + M({ k: true, inp: IN2, head: 5, icls: all(5, 'new'), stk: [], out: [...'82-1-'], oval: cap('= 5', 'new'), alt: [...'821--'], acls: all(5, 'off new'), aval: cap('<s>= 7</s>', 'new'), side: nw(lines2(cap('第二行算的是'), cap('8-(2-1) = 7'))) }) },
  { beat: 89, cut: true, html: H1() + RULE() + LOG([on(G1, 'new')]) + M({ k: true, ...S_DONE }), cues: [{ at: '读到数字', focus: 'log-0' }] },
  { beat: 90, cut: true, html: H1() + RULE() + LOG([G1, on(G2, 'new')]) + M({ k: true, ...S_DONE }), cues: [{ at: '读到运算符', focus: 'log-1' }] },
  { beat: 91, cut: true, html: H1() + RULE() + LOG([G1, G2, on(G3, 'new')]) + M({ k: true, ...S_DONE }), cues: [{ at: '读完了', focus: 'log-2' }] },
  { beat: 92, cut: true, html: H1() + RULE() + LOG([G1, on(G2), G3]) + M({ k: true, ...S_MINUS }), cues: [{ at: '第2条保证了', focus: 'log-1' }, { at: '栈里从下往上', focus: 'op+,op*', note: '从下往上越来越高' }] },
  { beat: 93, cut: true, html: H1() + RULE() + LOG([G1, G2, G3]) + M({ k: true, ...S_MINUS, slabel: `栈 ${ok}`, lcls: 'new' }) },

  // ───────── 第10屏　写成伪代码（换版面：左栏换成伪代码卡） ─────────
  { beat: 94, html: H1() + PB({ cls: 'new' }) + M(S_DONE), cues: [{ at: '输出就是写到后缀式的末尾', focus: 'pl-3,pl-7,pl-10' }] },
  { beat: 95, html: H1() + PB({ hl: WHILE_LN }) + M(S_DONE), cues: [{ at: '`while`也是循环', focus: 'pl-5,pl-6' }] },
  { beat: 96, html: H1() + PB({ hl: WHILE_LN }) + M({ ...S_DONE, side: nw(lines2(cbadge('读到 *：弹 0 次'), cbadge('读到 -：弹 2 次'))) }), cues: [{ at: '读到`-`时弹了两次', focus: 'side' }] },
  { beat: 97, html: H1D('new') + PB() + M({ ...S_MINUS, side: nw(lines2(cap('这里：还没写出去的运算符'), cap('3.5：还没配上的左括号'))) }) },

  // ───────── 第11屏　括号（版面不变）：输入换成 (3+4)*2 ─────────
  { beat: 98, html: H5('new') + PB({ cls: 'dim' }) + M({ k: true, inp: IN3, head: -1, icls: all(7, 'new'), stk: [] }) },
  { beat: 99, html: H5() + PB({ cls: 'dim' }) + M({ k: true, inp: IN3, head: -1, box: [1, 3, '小式子', 'new'], stk: [], out: [...'34+'], ocls: all(3, 'rd new') }), cues: [{ at: '得`3 4 +`', focus: 'out-0,out-1,op+' }] },
  { beat: 100, html: H5() + PB({ cls: 'dim' }) + M({ k: true, inp: IN3, head: -1, box: [1, 3, '小式子'], stk: [], out: [...'34+2*'], ocls: ['rd', 'rd', 'rd', 'rd new', 'rd new'] }), cues: [{ at: '写成`3 4 + 2 *`', focus: 'out-0,out-1,op+,out-3,op*' }] },
  { beat: 101, html: H5() + PB({ cls: 'dim' }) + M({ k: true, inp: IN3, head: -1, box: [1, 3, '小式子'], stk: [] }), cues: [{ at: '小式子单独转一遍', focus: 'in-box' }] },
  { beat: 102, html: H5() + PB({ cls: 'dim' }) + M({ k: true, inp: IN3, head: 0, box: [1, 3, '小式子'], stk: ['('], wall: 0, scls: ['new'], top: true }), cues: [{ at: '当一堵墙', focus: 'op(' }] },
  { beat: 103, html: H5() + PB({ cls: 'dim' }) + M({ k: true, inp: IN3, head: 0, box: [1, 3, '小式子'], stk: ['('], wall: 0, top: true }), cues: [{ at: '墙上面就像一个新的空栈', focus: 'op(', note: '墙上面像空栈' }, { at: '只和墙上面的比', focus: 'op(', note: '碰到 ( 就停' }] },
  { beat: 104, html: H5() + PB({ cls: 'dim' }) + M({ k: true, inp: IN3, head: 1, box: [1, 3, '小式子'], stk: ['('], wall: 0, top: true, out: ['3'], ocls: ['new'] }),
    cues: [{ at: '读到`+`', steps: [H5() + PB({ cls: 'dim' }) + M({ k: true, inp: IN3, head: 2, box: [1, 3, '小式子'], stk: ['(', '+'], wall: 0, scls: ['', 'new'], top: true, out: ['3'] })] }, { at: '栈顶是`(`', focus: 'op(' },
      { at: '读到4', steps: [H5() + PB({ cls: 'dim' }) + M({ k: true, inp: IN3, head: 3, box: [1, 3, '小式子'], stk: ['(', '+'], wall: 0, top: true, out: [...'34'], ocls: ['', 'new'] })] }] },
  { beat: 105, html: H5() + PB({ cls: 'dim' }) + M({ k: true, inp: IN3, head: 4, box: [1, 3, '小式子读完了', 'new'], stk: ['(', '+'], wall: 0, top: true, out: [...'34'] }), cues: [{ at: '小式子读完了', focus: 'in-box' }] },
  { beat: 106, html: H5() + PB({ hl: END_LN }) + M({ k: true, inp: IN3, head: 4, box: [1, 3, '小式子读完了'], stk: ['(', '+'], wall: 0, top: true, out: [...'34'] }),
    cues: [{ at: '依次弹出写出去', steps: [H5() + PB({ hl: END_LN }) + M({ k: true, inp: IN3, head: 4, box: [1, 3, '小式子读完了'], stk: ['('], wall: 0, top: true, out: [...'34+'], ocls: ['', '', 'new'] })] }, { at: '只弹到墙为止', focus: 'op(' }] },
  { beat: 107, html: H5() + PB() + M({ k: true, inp: IN3, head: 4, stk: [], out: [...'34+'], side: nw(`${cchip('(', 'mono off')} ${cap('弹掉，不写出去')}`) }) },
  { beat: 108, html: H5() + PB() + M({ k: true, inp: IN3, head: 5, stk: ['*'], scls: ['new'], top: true, out: [...'34+'] }),
    cues: [{ at: '读到2', steps: [H5() + PB() + M({ k: true, inp: IN3, head: 6, stk: ['*'], top: true, out: [...'34+2'], ocls: ['', '', '', 'new'] })] },
      { at: '弹出`*`', steps: [H5() + PB() + M({ k: true, inp: IN3, head: 7, stk: [], out: [...'34+2*'], ocls: ['', '', '', '', 'new'] })] }] },
  { beat: 109, html: H5() + PB() + M({ k: true, inp: IN3, head: 7, under: [0, 4, 'new'], stk: [], out: [...'34+2*'], ocls: ['', '', 'hl new', '', 'hl new'] }), cues: [{ at: '`*`的左边是`(3+4)`整个', focus: 'in-0,in-1,in-2,in-3,in-4' }, { at: '读到`)`时弹出`+`', focus: 'op+' }] },
  { beat: 110, html: H5() + PB() + M({ k: true, inp: IN3, head: 7, stk: [], out: [...'34+2*'] }), cues: [{ at: '最近的那个`(`', focus: 'in-0,in-4', note: '就是 3.5 括号匹配', side: 'b' }] },
  { beat: 111, html: H5() + PF() + M({ k: true, inp: IN3, head: 7, stk: [], out: [...'34+2*'] }) },

  // ───────── 第12屏　写成程序（换版面：左代码卡，右伪代码面板）：直接写在 main 里 ─────────
  { beat: 112, html: H6('new') + CODE('main', [], { cls: 'new' }) + PANEL('栈', MINI(false, 'new'), 'new') },
  { beat: 113, html: H6() + CODE('main', []) + PANEL('栈', MINI(true)), cues: [{ at: "`'+'`是43", focus: 'mini-1', note: "'+' 是 43" }] },
  { beat: 114, html: H6() + CODE('3.3节的顺序栈', [], { scls: 'new' }) + PANEL('栈', MINI(true)) },
  // 每个数只有一位：写在面板的小栈下面
  { beat: 115, html: H6() + CODE('3.3节的顺序栈', []) + PANEL('栈', MINI(true) + at(0, 150, cap('每个数只有一位：0–9', 'new'))) },
  { beat: 116, html: H6() + CODE('3.3节的顺序栈', []) + PANEL('栈', MINI(true) + at(0, 150, cap('每个数只有一位：0–9')) + at(0, 176, `<span class="new">${cap('342*+1- 就是')}<br>${cap('3 4 2 * + 1 -')}</span>`)) },
  { beat: 117, html: H6() + CODE('先写优先级', precRows('new'), { scls: 'new' }) + PANEL('栈', MINI(true, 'dim')) },
  // 代码只往下长：上一块讲完，原位折叠成一行（下面还没有东西，所以不会挤动别的行）；Prec 讲完就不再显示
  { beat: 118, html: H6() + CODE('照伪代码写', tp([{ b: 'head', cls: 'new' }, { b: 'decl', cls: 'new', cur: true }]), { scls: 'new' }) + PANEL('伪代码', plines(P_HEAD, { cls: 'new' }) + at(0, 60, `<span data-k="pn">${cap('输出 c → printf("%c", c)', 'new')}</span>`)), cues: [{ at: '在main里把`3+4*2-1`转一遍', focus: 'ln-8' }, { at: '用`printf`打印一个字符', focus: 'pn' }] },
  { beat: 119, html: H6() + CODE('① 数字', tp([{ b: 'head' }, { b: 'decl', fold: true }, { b: 'forh', cls: 'new' }, { b: 'dig', cls: 'new', cur: true }]), { scls: 'new' }) + PANEL('伪代码 · 1', plines(P_DIG, { cls: 'hl new' })) },
  { beat: 120, html: H6() + CODE('左括号', tp([...TOP6, { b: 'dig', fold: true }, { b: 'lp', cls: 'new', cur: true }]), { scls: 'new' }) + PANEL('伪代码', plines(P_LP, { cls: 'hl new' })) },
  { beat: 121, html: H6() + CODE('右括号', tp([...TOP6, ...DL, { b: 'rp', cls: 'new', cur: true }]), { scls: 'new' }) + PANEL('伪代码', plines(P_RP, { cls: 'hl new' })), cues: [{ at: '再弹出左括号', focus: 'ln-23' }] },
  { beat: 122, html: H6() + CODE('② 运算符', tp([...TOP6, ...DL, { b: 'rp', fold: true }, { b: 'op', cls: 'new', cur: true }]), { scls: 'new' }) + PANEL('伪代码 · 2', plines(P_OP, { cls: 'hl new' })) },
  { beat: 123, html: H6() + CODE('② 运算符', tp([...TOP6, ...DL, { b: 'rp', fold: true }, { b: 'op', marks: ['GetTop'] }])) + PANEL('伪代码 · 2', plines(P_OP, { marks: ['栈不空', '栈顶'] })), cues: [{ at: '栈不空和栈顶', focus: 'pp-1,pp-2' }, { at: '用一个`GetTop`就都有了', focus: 'ln-25' }] },
  { beat: 124, html: H6() + CODE('③ 读完了', tp([...TOP6, ...DL, { b: 'rp', fold: true }, { b: 'op', fold: true }, { b: 'fend', cls: 'new' }, { b: 'fin', cls: 'new' }, { b: 'tail', cls: 'new', cur: true }]), { scls: 'new' }) + PANEL('伪代码 · 3', plines(P_FIN, { cls: 'hl new' })) },

  // ───────── 第13屏　试一试（版面不变）：for 循环折叠，面板放运行结果；再换一个输入 ─────────
  { beat: 125, html: H6() + CODE('试一试', tp([{ b: 'head' }, { b: 'decl' }, { b: 'loop', fold: true }, { b: 'fin' }, { b: 'tail' }]), { scls: 'new' }) + TERM(['342*+1-'], () => 'hl new'), cues: [{ at: '运行结果是', focus: 'term-0' }] },
  { beat: 126, html: H6() + CODE('试一试', tp([{ b: 'head' }, { b: 'decl', swap: [1, IN_B, 'hl new'] }, { b: 'loop', fold: true }, { b: 'fin' }, { b: 'tail' }])) + TERM(['342*+1-', '34+2*'], (i) => (i === 1 ? 'hl new' : '')), cues: [{ at: '把`in`换成', focus: 'ln-8' }, { at: '输出`34+2*`', focus: 'term-1' }] },

  // ───────── 第14屏　练习2（填空） ─────────
  { beat: 127, html: quiz1({ cls: 'new' }) },
  { after: 127, html: quiz1() + pause('等学生作答（点选项块再点空位）；作答后显示解析') },

  // ───────── 第15屏　下一步：一拍过门 ─────────
  { beat: 128, html: at(40, 16, ckick('下一步')) + at(40, 44, ctitle('程序怎么算后缀式').replace('c-title', 'c-title new')) },
]
