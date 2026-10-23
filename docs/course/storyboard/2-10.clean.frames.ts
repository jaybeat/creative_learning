// 2.10 质感层分镜帧（npm run storyboard -- 2-10）。双栏稿 docs/course/2-10.md。
// 版面照 Harsha 链表实现课：目标图钉在右上，左边一行行写代码，右下的"现在"图跟着一格格变。只用箭头图，不回到格子图（2.9 讲过对应）。
// - 第1屏第1–4拍是问题屏：左栏编辑器卡 + 问题胶囊，右上目标卡；第5拍起换成左右对照，第1–5屏不再换版面；
// - 左栏 (40,86) 宽 320：代码卡，做成浅色代码编辑器 c-editor（标签栏 cat.c + 步骤名、行号槽、语法高亮、当前行、折叠行）；
//   高亮用 shiki，和网站正文代码块同一套（scripts/lib/code-hl.ts），帧里只有 var(--shiki-*)；
// - 右栏 (372,86) 宽 228：上面是目标卡（位置全程不动，标签在原位变字），下面 (372,234) 是现在卡（第2屏起从 L = NULL 长成 cat）。
// 三问一问一答：①第4拍、②第11拍、③第29拍才出现。先讲结点（标注 → typedef），再讲头指针（标注 → Node *L;）。第6、7屏练习，第8屏一拍过门。帧里不写色值，样式在 scripts/lib/clean.ts。
import { at, card, editor, pause, ckick, ctitle, cchip, cslot, cqpill, cblank, clabel, copt, cquiz, cqchips, cqbar, cqex } from './kit'
import { highlightC } from '../../../scripts/lib/code-hl'
import type { Frame } from '../../../scripts/lib/course'

export const quizSource = { file: 'book/chapters/ch02.md', section: '2.10' }
// 送去合成的念法（字幕仍显示原文）
export const say: Record<number, string> = {
  10: '它存的也是一个结点的地址，所以它和next是同一种类型：Node星。',
  18: 'size of Node 是一个结点占的字节数。',
}

const ok = '<b class="okm">✓</b>'
const cap = (s: string, cls = '') => `<span class="c-cap ${cls}" style="white-space:nowrap">${s}</span>`
/** 图上的小标签：类别色胶囊，外面包一层好带 new / hl */
const lab = (s: string, cls = '') => `<span class="${cls}">${clabel(s)}</span>`

// ───────── 标题区：小标签是当前的问题 ─────────
const Q = ['结点怎么定义？', '怎么一个个申请、接起来？', '怎么按顺序读出来？']
const kick = (n: number, done = false) => `问题 ${n} · ${Q[n - 1]}${done ? ` ${ok}` : ''}`
const head = (o: { kick?: string; kcls?: string; tcls?: string } = {}) =>
  (o.kick ? at(40, 16, ckick(o.kick, o.kcls)) : '') + at(40, 44, ctitle('链表的C语言实现').replace('c-title', `c-title ${o.tcls ?? ''}`))

// ───────── 左栏：第1–5拍是编辑器卡 + 问题胶囊 ─────────
const ED = (o: { hi?: boolean; cls?: string } = {}) =>
  at(40, 86, card(at(12, 6, cap('编辑器')) + at(12, 32, editor('cat', { cursor: -1, cls: `sm ${o.cls ?? ''}`, hi: o.hi ? [0, 1, 2] : [] })), '', 'width:196px;height:84px;padding:0'))
const PILL = (cls = '') => at(40, 186, cqpill(1, Q[0], `on ${cls}`))

// ───────── 左栏：代码卡（编辑器） ─────────
// 各步的代码（代码卡里不写注释，注释由旁白念）
const TYPEDEF = ['typedef struct Node {', '    char         data;', '    struct Node *next;', '} Node;']
const DECL = 'Node *L;' // 第1屏末讲头指针的类型时先写声明
const EMPTY = 'Node *L = NULL;'
const blk = (p: string, ch: string, link: string) => [`Node *${p} = (Node *)malloc(sizeof(Node));`, `${p}->data = '${ch}';`, `${p}->next = NULL;`, link]
const P1 = blk('p1', 'c', 'L = p1;')
const P2 = blk('p2', 'a', 'p1->next = p2;')
const P3 = blk('p3', 't', 'p2->next = p3;')
const FOR = ['for (Node *p = L; p != NULL; p = p->next)', '    printf("%c", p->data);', 'printf("\\n");']
const PROG_HEAD = ['#include <stdio.h>', '#include <stdlib.h>', 'int main(void) {', '  return 0;', '}']
const FOLDS = ['/* c 结点：p1 */', '/* 搭出 cat：p1 p2 p3 */']
// 构建时一次高亮好（整段一起分词）
const ALL = [...TYPEDEF, DECL, EMPTY, ...P1, ...P2, ...P3, ...FOR, ...FOR.map((s) => '  ' + s), ...PROG_HEAD, '  ' + EMPTY, ...FOLDS, ...FOLDS.map((s) => '  ' + s)]
const HLS = await highlightC(ALL)
const HL = new Map(ALL.map((s, i) => [s, HLS[i]]))
const h = (s: string) => { const v = HL.get(s); if (v === undefined) throw new Error(`代码没有预先高亮：${s}`); return v }
const DOTS = '<span class="ce-dots">⋯</span>'

/** 一行：code 是 C 源码；fold 表示这一行是折叠起来的 n 行；cur 是光标所在行；mark 是自定义的高亮片段（[原文, 替换成的 HTML]） */
type Ln = { code: string; cls?: string; cur?: boolean; fold?: number; mark?: [string, string] }
const L = (code: string, cls = '', o: Partial<Ln> = {}): Ln => ({ code, cls, ...o })
/** 一块代码的前 n 行；第 fresh 行起带 new，最后一行是当前行 */
const lines = (b: string[], n: number, fresh = n) => b.slice(0, n).map((s, i) => L(s, i >= fresh ? 'new' : '', { cur: i === n - 1 && fresh < n }))
const F_TYPE: Ln = { code: '', fold: 4 } // typedef 折叠成一行：typedef struct Node {⋯} Node;
const fold = (comment: string, n: number, cls = ''): Ln => ({ code: comment, fold: n, cls })
const lnHtml = (l: Ln) => {
  if (l.fold && !l.code) return `${h(TYPEDEF[0])}${DOTS}${h(TYPEDEF[3])}`
  if (l.fold) return `${h(l.code)}${DOTS}`
  return l.mark ? h(l.code).replace(l.mark[0], l.mark[1]) : h(l.code)
}
const LH = 19
/** 代码卡 (40,86) 320×262；extra 是卡里另外放的东西（第4屏的步骤列表、第5屏的小注），坐标相对卡 */
function CODE(step: string, ls: Ln[], o: { scls?: string; extra?: string } = {}) {
  let n = 1
  const rows = ls.map((l) => {
    const num = n
    n += l.fold ?? 1
    return `<div class="ce-ln ${l.cls ?? ''} ${l.cur ? 'cur' : ''} ${l.fold ? 'fold' : ''}" style="height:${LH}px;line-height:${LH}px"><i>${num}</i><b>${l.fold ? '▸' : ''}</b><code>${lnHtml(l)}</code></div>`
  }).join('')
  return at(40, 86, `<div class="c-editor" style="width:320px;height:262px">` +
    `<div class="ce-bar"><span class="ce-tab">cat.c</span>${ckick(step, o.scls)}</div><div class="ce-body">${rows}</div>${o.extra ?? ''}</div>`)
}
/** 代码区第 k 行顶端在卡里的 y（标签栏 30 + 上边距 8） */
const rowY = (k: number) => 38 + LH * k

// ───────── 右上：目标卡 (372,86) 228×140 ─────────
// 结点画在卡内 y=50，第 i 个在 x=12+72i（数据格 22 + 地址格 28）；c 的数据格中心约 x=23，地址格约 x=48，c→a 的箭头在 x≈65–81
type Nd = { v: string; next: string; addr: string; cls?: string; dcls?: string; ncls?: string }
const node = (n: Nd) =>
  `<span class="c-node ${n.cls ?? ''}"><span class="${n.dcls ?? ''}" style="width:22px;height:30px">${n.v}</span><span class="${n.ncls ?? ''}" style="width:28px;height:30px">${n.next}</span><em>${n.addr}</em></span>`
const X = (i: number) => 12 + 72 * i
const nodeAt = (i: number, y: number, n: Nd) => at(X(i), y, node(n))
// 结点高 32（格子 30 + 上下边框），箭头的线放在 y+16 的中线上；display:block 免得按文字行再往下挪
const linkAt = (i: number, y: number, cls = '') => at(X(i) + 53, y + 16, `<span class="c-link ${cls}" style="display:block;width:16px;margin:0"></span>`)
const CAT: Nd[] = [{ v: 'c', next: '109', addr: '100' }, { v: 'a', next: '105', addr: '109' }, { v: 't', next: '0', addr: '105' }]

type Tag = [string, string?]
type TgOpt = {
  cls?: string; tcls?: string; done?: boolean
  nc?: string[]; dc?: string[]; xc?: string[]; lc?: string[]; hcls?: string
  frame?: string; head?: Tag; node?: Tag; data?: Tag; addr?: Tag; next?: Tag; ntype?: Tag
}
/** 引线：从 (x1,y1) 到 (x2,y2) 的 1px 细线，把标签连到它说的那一格；cls 跟着标签走（new / hl） */
const lead = (x1: number, y1: number, x2: number, y2: number, cls = '') => {
  const len = Math.hypot(x2 - x1, y2 - y1)
  const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
  return at(x1, y1, `<div class="${cls}" style="width:${len.toFixed(1)}px;border-top:1px solid var(--faint);transform:rotate(${deg.toFixed(1)}deg);transform-origin:0 0"></div>`)
}
// 结点那一组标在中间的 a 结点上：c 上方有 L 和 ↓，挤不下。a 的数据格中心 x≈97、地址格 x≈122，底边 y=82；a→t 箭头中点 (145,66)
const AX = X(1)
function TG(o: TgOpt = {}) {
  const ns = CAT.map((n, i) => nodeAt(i, 50, { ...n, cls: o.nc?.[i], dcls: o.dc?.[i], ncls: o.xc?.[i] })).join('')
  const ls = [0, 1].map((i) => linkAt(i, 50, o.lc?.[i])).join('')
  // 标签位置：结点在 a 正上方；数据格、地址格在地址数字下面一排（y=112），左右分开，引线斜着连到格子底边，绕开地址 109；
  // 地址格变成 next 以后，引线改指 a→t 的箭头；头指针在"L = 100"右边，横引线连到 L
  const k = (t?: Tag) => t?.[1] ?? ''
  const tags =
    (o.frame !== undefined ? at(AX - 5, 45, `<div class="dash ${o.frame}" style="width:62px;height:40px"></div>`) : '') +
    (o.node ? at(AX + 3, 20, lab(...o.node)) : '') +
    (o.data ? lead(80, 113, 96, 84, k(o.data)) + at(34, 112, lab(...o.data)) : '') +
    (o.addr ? lead(140, 113, 127, 84, k(o.addr)) + at(124, 112, lab(...o.addr)) : '') +
    // 第10拍 next 旁边再挂 Node *：两枚并排放一行，整体左移才放得下（第9拍没有 next，不会看到跳动）
    (o.next && !o.ntype ? lead(140, 113, 145, 70, k(o.next)) + at(124, 112, lab(...o.next)) : '') +
    (o.next && o.ntype ? lead(122, 113, 145, 70, k(o.next)) + at(100, 112, `<span style="display:inline-flex;gap:4px;white-space:nowrap">${lab(...o.next)}${lab(...o.ntype)}</span>`) : '') +
    (o.head ? lead(57, 18, 72, 18, k(o.head)) + at(74, 6, `<span style="white-space:nowrap">${lab(...o.head)}</span>`) : '')
  return at(372, 86, card(
    at(170, 6, cap(`目标${o.done ? ' ' + ok : ''}`, o.tcls)) +
      at(12, 6, cap('L = 100', o.hcls)) + at(22, 24, cap('↓', o.hcls)) + ns + ls + tags,
    o.cls ?? '', 'width:228px;height:140px;padding:0'))
}

// ───────── 右下：现在卡 (372,234) 228×118 ─────────
type NowNd = Nd & { slot: number; ptr?: Tag }
function NOW(o: { L?: string; lcls?: string; nodes?: NowNd[]; links?: (string | false)[]; out?: string; ocls?: string; extra?: string; cls?: string } = {}) {
  const Lv = o.L ?? 'NULL'
  const ns = (o.nodes ?? []).map((n) => nodeAt(n.slot, 40, n) +
    (n.ptr ? at(X(n.slot) + 14, 94, cap(n.ptr[0], n.ptr[1])) : '')).join('')
  const ls = (o.links ?? []).map((l, i) => (l === false ? '' : linkAt(i, 40, l))).join('')
  return at(372, 234, card(
    at(170, 6, cap('现在')) + at(12, 6, cap(`L = ${Lv}`, o.lcls)) + (Lv === 'NULL' ? '' : at(22, 22, cap('↓', o.lcls))) +
      (o.out !== undefined ? at(84, 6, `<span class="${o.ocls ?? ''}">${cap('输出 ')}${o.out ? `<span class="tuple">${o.out}</span>` : cslot('　　　')}</span>`) : '') +
      ns + ls + (o.extra ?? ''),
    o.cls ?? '', 'width:228px;height:118px;padding:0'))
}
// 现在卡里常用的结点
const nC = (o: Partial<NowNd> = {}): NowNd => ({ slot: 0, v: 'c', next: '0', addr: '100', ...o })
const nA = (o: Partial<NowNd> = {}): NowNd => ({ slot: 1, v: 'a', next: '0', addr: '109', ...o })
const nT = (o: Partial<NowNd> = {}): NowNd => ({ slot: 2, v: 't', next: '0', addr: '105', ...o })
const DONE3 = (o: { ptr?: boolean; cls?: string[]; pcls?: string } = {}) => [
  nC({ next: '109', cls: o.cls?.[0], ptr: o.ptr ? ['p1', o.pcls] : undefined }),
  nA({ next: '105', cls: o.cls?.[1], ptr: o.ptr ? ['p2', o.pcls] : undefined }),
  nT({ cls: o.cls?.[2], ptr: o.ptr ? ['p3', o.pcls] : undefined }),
]

// ───────── 第4屏：三行步骤列表（行高固定），放在代码下面 ─────────
const STEPS = ['从头出发', '走到下一个', '走到头停下']
const STEPC = ['p = L', 'p = p-&gt;next', 'p != NULL']
const steps = (o: { on?: number; code?: boolean; cls?: string } = {}) =>
  at(12, rowY(3) + 8, `<div class="${o.cls ?? ''}" style="display:flex;flex-direction:column;gap:4px;width:296px">${STEPS.map((s, i) =>
    `<div class="c-li ${o.on === i ? 'on' : ''}" style="height:40px"><span class="rn">${s}</span>${o.code ? `<span class="rs">${STEPC[i]}</span>` : ''}</div>`).join('')}</div>`)
// 搭好 cat 以后的代码：typedef、空链表、搭 cat 三块折叠
const BUILT = [F_TYPE, L(EMPTY), fold(FOLDS[1], 12)]
const PROG = (cls = '') => [
  L(PROG_HEAD[0], cls), L(PROG_HEAD[1], cls), F_TYPE, L(PROG_HEAD[2], cls), L('  ' + EMPTY, cls), fold('  ' + FOLDS[1], 12),
  ...FOR.map((s) => L('  ' + s, cls)), L(PROG_HEAD[3], cls), L(PROG_HEAD[4], cls),
]

// ───────── 练习 ─────────
const OPTS1 = ['ca', 'cat', 'c', '程序出错']
// 练习卡就是作答界面（cquiz）：暂停时播放器给选项、按钮条接上作答，解析写进解析位
const quiz1 = (o: { cls?: string; dim?: boolean; extra?: string } = {}) => cquiz(
  at(40, 16, ckick('练习 1 · 单选', o.cls)) + at(40, 44, ctitle('漏接一个结点会怎样？').replace('c-title', `c-title ${o.cls ?? ''}`)) +
  at(40, 92, `<div class="c-q ${o.cls ?? ''} ${o.dim ? 'dim' : ''}" style="font-size:14px">搭 <code>cat</code> 时漏写了 <code>p2-&gt;next = p3;</code> 这一行，其余不变。输出是什么？</div>`) +
  at(40, 124, `<div class="c-opts1 ${o.dim ? 'dim' : ''}">${OPTS1.map((s, i) => copt('ABCD'[i], s, o.cls)).join('')}</div>`) +
  (o.dim ? '' : at(40, 266, cqex(46)) + at(40, 314, cqbar('choice'))) + (o.extra ?? ''))
const quiz2 = (o: { cls?: string; dim?: boolean } = {}) => {
  const k = `${o.cls ?? ''} ${o.dim ? 'dim' : ''}`
  const rows: string[] = ['<code>L</code> 的值是', '<code>L-&gt;next</code> 的值是', 't 结点的 <code>next</code> 是']
  return cquiz(at(40, 16, ckick('练习 2 · 填空', o.cls)) + at(40, 44, ctitle('用C语言写出来，各是多少？').replace('c-title', `c-title ${o.cls ?? ''}`)) +
    at(40, 92, `<div class="c-q ${k}" style="font-size:14px">cat 存成链表：c 结点在 100 号，a 在 109 号，t 在 105 号，用一个 <code>Node *</code> 类型的变量 L 表示。</div>`) +
    rows.map((s, i) => at(40, 150 + 36 * i, `<span class="${k}">${s} ${cblank('', { w: 52, quiz: true })}</span>`)).join('') +
    at(40, 270, cqchips(['100', '109', 'NULL', '105', 'c'], k)) +
    (o.dim ? '' : at(40, 262, cqex(44)) + at(40, 314, cqbar('fill'))))
}

// ───────── 常用组合 ─────────
const K1 = kick(1), K1D = kick(1, true), K2 = kick(2), K2D = kick(2, true), K3 = kick(3), K3D = kick(3, true)
// 第2–3屏代码卡开头两行
const TOP = (fresh = false) => [F_TYPE, L(EMPTY, fresh ? 'new' : '', { cur: fresh })]
const S1 = '第一步 · 定义类型'

export const frames: Frame[] = [
  // ───────── 第1屏　定义结点类型：先问题屏（编辑器 + 目标卡），第6拍起左右对照 ─────────
  { beat: 1, html: head({ tcls: 'new' }) + ED({ cls: 'new' }) + TG({ cls: 'new' }) },
  { beat: 2, html: head() + ED({ hi: true }) + TG({ tcls: 'new', nc: ['hl new', 'hl new', 'hl new'] }) },
  // 先只标结点这一组：结点（套框）、数据格、地址格；头指针等结点讲完再标（第9拍）
  { beat: 3, reveal: 'spread', html: head() + ED() + TG({ frame: 'new', node: ['结点', 'new'], data: ['数据格', 'new'], addr: ['地址格', 'new'] }) },
  // 第一问从"结点"标签引出来，只出这一枚
  { beat: 4, html: head() + ED() + PILL('new') + TG({ frame: '', node: ['结点', 'hl new'], data: ['数据格'], addr: ['地址格'] }) },
  // 换版面：编辑器退场，代码卡出现；胶囊收成小标签
  { beat: 5, html: head({ kick: K1, kcls: 'new' }) + CODE(S1, lines(TYPEDEF, 1, 0), { scls: 'new' }) + TG({ frame: '', node: ['结点', 'hl new'], data: ['数据格'], addr: ['地址格'] }) },
  // 标签原位变成 C 的名字
  { beat: 6, html: head({ kick: K1 }) + CODE(S1, lines(TYPEDEF, 2, 1)) + TG({ frame: '', node: ['结点'], data: ['data', 'new'], addr: ['地址格'], dc: ['', 'hl new'] }) },
  { beat: 7, html: head({ kick: K1 }) + CODE(S1, lines(TYPEDEF, 3, 2)) + TG({ frame: '', node: ['结点'], data: ['data'], next: ['next', 'new'], lc: ['', 'hl new'] }) },
  // 每个方框都是一个 Node：三个结点一起浅蓝底，不再给每个挂标签（c 上方让给 L）
  { beat: 8, html: head({ kick: K1 }) + CODE(S1, [...lines(TYPEDEF, 3), L(TYPEDEF[3], 'new', { cur: true, mark: ['Node', '<span class="hl">Node</span>'] })]) + TG({ node: ['Node', 'new'], data: ['data'], next: ['next'], nc: ['hl new', 'hl new', 'hl new'] }) },
  // 结点讲完，标签收掉，再标头指针
  { beat: 9, html: head({ kick: K1 }) + CODE(S1, lines(TYPEDEF, 4)) + TG({ head: ['头指针', 'new'], hcls: 'hl new' }) },
  // L 和 next 是同一种类型：代码卡写出 L 的声明（第12拍原位补成 = NULL）
  { beat: 10, html: head({ kick: K1D, kcls: 'new' }) + CODE(S1, [...lines(TYPEDEF, 4), L(DECL, 'new', { cur: true })]) + TG({ head: ['Node *', 'hl new'], next: ['next', 'hl new'], ntype: ['Node *', 'hl new'] }) },

  // ───────── 第2屏　空链表和第一个结点：版面不变，typedef 折叠，标签收掉，右下出现现在卡 ─────────
  { beat: 11, html: head({ kick: K2, kcls: 'new' }) + CODE(S1, [F_TYPE, L(DECL)]) + TG({ nc: ['hl new', 'hl new', 'hl new'] }) },
  { beat: 12, html: head({ kick: K2 }) + CODE('第二步 · 空链表', TOP(true), { scls: 'new' }) + TG() + NOW({ cls: 'new' }) },
  { beat: 13, html: head({ kick: K2 }) + CODE('第二步 · 空链表', TOP()) + TG() + NOW({ extra: at(12, 74, `<span class="dim new">${cchip('<s>length</s>')} ${cchip('<s>capacity</s>')}</span>`) }) },
  { beat: 15, html: head({ kick: K2 }) + CODE('第三步 · 第一个结点', TOP(), { scls: 'new' }) + TG() + NOW() },
  { beat: 16, html: head({ kick: K2 }) + CODE('第三步 · 第一个结点', [...TOP(), ...lines(P1, 1, 0)]) + TG() + NOW() },
  { beat: 17, html: head({ kick: K2 }) + CODE('第三步 · 第一个结点', [...TOP(), ...lines(P1, 1)]) + TG() + NOW({ nodes: [nC({ v: '', next: '', cls: 'new', ptr: ['p1', 'new'] })] }) },
  { beat: 18, html: head({ kick: K2 }) + CODE('第三步 · 第一个结点', [...TOP(), L(P1[0], '', { mark: ['sizeof', '<span class="hl new">sizeof</span>'] })]) + TG() + NOW({ nodes: [nC({ v: '', next: '', ptr: ['p1'] })] }) },
  { beat: 19, html: head({ kick: K2 }) + CODE('第三步 · 第一个结点', [...TOP(), ...lines(P1, 2, 1)]) + TG() + NOW({ nodes: [nC({ next: '', dcls: 'new', ptr: ['p1'] })] }) },
  { beat: 20, html: head({ kick: K2 }) + CODE('第三步 · 第一个结点', [...TOP(), ...lines(P1, 3, 2)]) + TG() + NOW({ nodes: [nC({ ncls: 'new', ptr: ['p1'] })] }) },
  // 关键：L 变成 100 和箭头同一刻
  { beat: 21, html: head({ kick: K2 }) + CODE('第三步 · 第一个结点', [...TOP(), ...lines(P1, 4, 3)]) + TG() + NOW({ L: '100', lcls: 'new', nodes: [nC({ ptr: ['p1'] })] }) },

  // ───────── 第3屏　第二个、第三个结点：版面不变 ─────────
  // a 先散着放在右下，没有箭头连过去
  { beat: 22, reveal: 'spread', html: head({ kick: K2 }) + CODE('第四步 · 第二个结点', [...TOP(), ...lines(P1, 4), ...lines(P2, 3, 0)], { scls: 'new' }) + TG() + NOW({ L: '100', nodes: [nC({ ptr: ['p1'] }), nA({ cls: 'new', ptr: ['p2', 'new'] })] }) },
  { beat: 23, html: head({ kick: K2 }) + CODE('第四步 · 第二个结点', [...TOP(), ...lines(P1, 4), ...lines(P2, 3)]) + TG() + NOW({ L: '100', nodes: [nC({ ncls: 'hl new', ptr: ['p1'] }), nA({ ptr: ['p2'] })], extra: at(84, 22, cap('从 L 走不到 a', 'new')) }) },
  { beat: 24, html: head({ kick: K2 }) + CODE('第四步 · 第二个结点', [...TOP(), ...lines(P1, 4), ...lines(P2, 3)]) + TG() + NOW({ L: '100', nodes: [nC({ next: cslot('？'), ncls: 'new', ptr: ['p1', 'hl new'] }), nA({ ptr: ['p2', 'hl new'] })] }) },
  // 关键：地址格 0→109、箭头 c→a、a 移进队列，三处同一刻
  { beat: 25, html: head({ kick: K2 }) + CODE('第四步 · 第二个结点', [...TOP(), ...lines(P1, 4), ...lines(P2, 4, 3)]) + TG() + NOW({ L: '100', nodes: [nC({ next: '109', ncls: 'hl new', ptr: ['p1'] }), nA({ cls: 'new', ptr: ['p2'] })], links: ['new'] }) },
  // p1 那一块折叠；t 散着放
  { beat: 26, reveal: 'spread', html: head({ kick: K2 }) + CODE('第五步 · 第三个结点', [...TOP(), fold(FOLDS[0], 4, 'new'), ...lines(P2, 4), ...lines(P3, 3, 0)], { scls: 'new' }) + TG() + NOW({ L: '100', nodes: [nC({ next: '109', ptr: ['p1'] }), nA({ ptr: ['p2'] }), nT({ cls: 'new', ptr: ['p3', 'new'] })], links: [''] }) },
  { beat: 27, html: head({ kick: K2 }) + CODE('第五步 · 第三个结点', [...TOP(), fold(FOLDS[0], 4), ...lines(P2, 4), ...lines(P3, 4, 3)]) + TG() + NOW({ L: '100', nodes: [nC({ next: '109', ptr: ['p1'] }), nA({ next: '105', ncls: 'hl new', ptr: ['p2'] }), nT({ cls: 'new', ptr: ['p3'] })], links: ['', 'new'] }) },
  { beat: 28, reveal: 'spread', html: head({ kick: K2D, kcls: 'new' }) + CODE('第五步 · 第三个结点', [...TOP(), fold(FOLDS[0], 4), ...lines(P2, 4), ...lines(P3, 4)]) + TG({ done: true, tcls: 'new', nc: ['hl new', 'hl new', 'hl new'] }) + NOW({ L: '100', nodes: DONE3({ ptr: true, cls: ['hl new', 'hl new', 'hl new'] }), links: ['', ''] }) },

  // ───────── 第4屏　输出链表：搭 cat 的代码折叠，目标卡变淡，现在卡加输出 ─────────
  { beat: 29, reveal: 'spread', html: head({ kick: K3, kcls: 'new' }) + CODE('输出链表', BUILT, { scls: 'new' }) + TG({ cls: 'dim', done: true }) + NOW({ L: '100', nodes: DONE3({ ptr: true, cls: ['hl new', 'hl new', 'hl new'] }), links: ['', ''], out: '', ocls: 'new' }) },
  { beat: 30, html: head({ kick: K3 }) + CODE('输出链表', BUILT, { extra: steps({ cls: 'new' }) }) + TG({ cls: 'dim', done: true }) + NOW({ L: '100', nodes: DONE3({ ptr: true, pcls: 'dim' }), links: ['', ''], out: '' }) },
  { beat: 31, html: head({ kick: K3 }) + CODE('输出链表', BUILT, { extra: steps({ on: 0 }) }) + TG({ cls: 'dim', done: true }) + NOW({ L: '100', lcls: 'hl', nodes: [nC({ next: '109', cls: 'hl new', ptr: ['p', 'new'] }), nA({ next: '105' }), nT()], links: ['', ''], out: 'c', ocls: 'new' }) },
  { beat: 32, html: head({ kick: K3 }) + CODE('输出链表', BUILT, { extra: steps({ on: 1 }) }) + TG({ cls: 'dim', done: true }) + NOW({ L: '100', nodes: [nC({ next: '109', ncls: 'hl' }), nA({ next: '105', cls: 'hl new', ptr: ['p', 'new'] }), nT()], links: ['new', ''], out: 'ca', ocls: 'new' }) },
  { beat: 33, html: head({ kick: K3 }) + CODE('输出链表', BUILT, { extra: steps({ on: 1 }) }) + TG({ cls: 'dim', done: true }) + NOW({ L: '100', nodes: [nC({ next: '109' }), nA({ next: '105', ncls: 'hl' }), nT({ cls: 'hl new', ptr: ['p', 'new'] })], links: ['', 'new'], out: 'cat', ocls: 'new' }) },
  // p 走到 NULL
  { beat: 34, html: head({ kick: K3 }) + CODE('输出链表', BUILT, { extra: steps({ on: 2 }) }) + TG({ cls: 'dim', done: true }) + NOW({ L: '100', nodes: [nC({ next: '109' }), nA({ next: '105' }), nT({ ncls: 'hl' })], links: ['', ''], out: 'cat', extra: at(150, 94, cap('p = NULL', 'new')) }) },
  // L 一直是 100
  { beat: 35, html: head({ kick: K3 }) + CODE('输出链表', BUILT, { extra: steps({ on: 2 }) }) + TG({ cls: 'dim', done: true }) + NOW({ L: '100', lcls: 'hl new', nodes: DONE3(), links: ['', ''], out: 'cat', extra: at(150, 94, cap('p = NULL', 'dim new')) }) },

  // ───────── 第5屏　写成循环：版面不变 ─────────
  { beat: 36, reveal: 'spread', html: head({ kick: K3 }) + CODE('写成循环', BUILT, { scls: 'new', extra: steps({ code: true, cls: 'new' }) }) + TG({ cls: 'dim', done: true }) + NOW({ L: '100', nodes: DONE3(), links: ['', ''], out: 'cat' }) },
  // 三段代码飞进 for 头部：步骤列表让位给循环
  { beat: 37, html: head({ kick: K3 }) + CODE('写成循环', [...BUILT, ...FOR.map((s, i) => L(s, 'new', { cur: i === 2 }))]) + TG({ cls: 'dim', done: true }) + NOW({ L: '100', nodes: DONE3(), links: ['', ''], out: 'cat' }) },
  // 几块合起来就是完整程序
  { beat: 38, html: head({ kick: K3 }) + CODE('完整程序', PROG('new'), { scls: 'new' }) + TG({ cls: 'dim', done: true }) + NOW({ L: '100', nodes: DONE3(), links: ['', ''], out: 'cat', ocls: 'new' }) },
  { beat: 39, reveal: 'spread', html: head({ kick: K3D, kcls: 'new' }) + CODE('完整程序', PROG()) + TG({ cls: 'dim', done: true }) + NOW({ L: '100', nodes: DONE3(), links: ['hl new', 'hl new'], out: 'cat' }) },
  { beat: 40, html: head({ kick: K3D }) + CODE('完整程序', PROG(), { extra: at(100, 232, `<span class="new">${cchip('没检查 malloc')} ${cchip('没释放结点')}</span>`) }) + TG({ cls: 'dim', done: true }) + NOW({ L: '100', nodes: DONE3(), links: ['', ''], out: 'cat' }) },
  // 多一个字符就多一个指针
  { beat: 41, html: head({ kick: K3D }) + CODE('完整程序', PROG()) + TG({ cls: 'dim', done: true }) + NOW({ L: '100', nodes: DONE3({ ptr: true, pcls: 'hl new' }), links: ['', ''], extra: at(84, 6, `<span class="new">${cslot('p4 p5 …')}</span>`) }) },

  // ───────── 第6屏　练习1（单选） ─────────
  { beat: 42, html: quiz1({ cls: 'new' }) },
  { after: 42, html: quiz1() + pause('等学生作答；作答后每个选项下显示解析，不配旁白') },
  { beat: 43, html: quiz1({ dim: true, extra: at(40, 300, `<div class="c-q new" style="font-size:15px">链表的顺序只靠 next 连起来。</div>`) }) },

  // ───────── 第7屏　练习2（填空） ─────────
  { beat: 44, html: quiz2({ cls: 'new' }) },
  { after: 44, html: quiz2() + pause('等学生作答（点选项块再点空位）；作答后显示解析') },

  // ───────── 第8屏　下一步：一拍过门 ─────────
  { beat: 45, html: at(40, 16, ckick('下一步')) + at(40, 44, ctitle('把取元素、插入、删除写成通用的操作').replace('c-title', 'c-title new')) },
]
