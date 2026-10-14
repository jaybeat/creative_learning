// 分镜墙的白板主题：npm run storyboard -- 2-1 --board（第一版：漫黑 + Caveat，保持原样）
// --board2：漫黑 + Excalifont + 字号规范（docs/course/visual-spec.md）；--board2-xiaolai：同上，中文换小赖。
// 和 sketch.ts 一样不改帧画面，只在外面加一层；区别在"怎么画"：
// 1. 笔迹：不用 rough.js 的双描线，自己生成"两端收尖、中间粗、略带弧度"的单笔笔画（填充多边形）；
//    方框按四笔画，角上略出头。
// 2. 框按角色分级：内容（格子、编辑器）画完整粗框；容器（卡片、展开行、问题卡）画细框；
//    列表行（收起的行、检查项、选项、通话记录）只画一道下划线；按钮画一个圈。
// 3. 字：中文霞鹜漫黑（马克笔风），英文数字 Caveat；字号放大；四种语义墨水。
// 4. 画面做成一块白板：金属边框 + 光泽。
// 随机数由"元素种类 + 取整后的位置和大小"作种子：同一元素在相邻帧里笔迹完全一样，刷新也不变。
import fs from 'node:fs'
import path from 'node:path'
import subsetFont from 'subset-font'
import { ROOT } from './course'
import { visibleText } from './sketch'
import { PEN_JS } from './pen'

export type BoardOpts = { latin: 'caveat' | 'excalifont'; cjk: 'marker' | 'xiaolai'; spec: boolean }
export const BOARD_V1: BoardOpts = { latin: 'caveat', cjk: 'marker', spec: false }

const FONTS = {
  marker: { file: 'tools/fonts/LXGWMarkerGothic-Regular.ttf', name: '漫黑', lic: 'LXGWMarkerGothic', src: '霞鹜漫黑 LXGW Marker Gothic（lxgw/LxgwMarkerGothic）' },
  xiaolai: { file: 'tools/fonts/Xiaolai-Regular.ttf', name: '小赖', lic: 'Xiaolai', src: '小赖 Xiaolai（lxgw/kose-font）' },
  caveat: { file: 'tools/fonts/Caveat-wght.ttf', name: 'Caveat', lic: 'Caveat', src: 'Caveat（google/fonts）' },
  excalifont: { file: 'tools/fonts/Excalifont-Regular.woff2', name: 'Excalifont', lic: 'Excalifont', src: 'Excalifont（plus.excalidraw.com/excalifont）' },
}

export async function boardTheme(htmls: string[], opts: BoardOpts = BOARD_V1): Promise<{ css: string; script: string; info: string }> {
  if (opts.spec) return boardTheme2(htmls, opts)
  const CJK_SRC = path.join(ROOT, FONTS.marker.file), LATIN_SRC = path.join(ROOT, FONTS.caveat.file)
  for (const f of [CJK_SRC, LATIN_SRC]) {
    if (!fs.existsSync(f)) throw new Error(`找不到 ${path.relative(ROOT, f)}：霞鹜漫黑取自 github.com/lxgw/LxgwMarkerGothic 的 Releases；Caveat 取自 github.com/google/fonts 的 ofl/caveat`)
  }
  const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('')
  const chars = [...new Set(visibleText(htmls) + ascii)].join('')
  const cjk = await subsetFont(fs.readFileSync(CJK_SRC), chars, { targetFormat: 'woff2' })
  const latin = await subsetFont(fs.readFileSync(LATIN_SRC), ascii, { targetFormat: 'woff2', variationAxes: { wght: 600 } })
  const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64')
  const css = `
/* 霞鹜漫黑 LXGW Marker Gothic（lxgw/LxgwMarkerGothic）、Caveat（google/fonts），均为 SIL Open Font License 1.1，
   全文见 tools/fonts/OFL-LXGWMarkerGothic.txt、tools/fonts/OFL-Caveat.txt。此处为按用字裁剪的子集。 */
@font-face{font-family:"BoardLatin";src:url(data:font/woff2;base64,${b64(latin)}) format("woff2");font-display:block}
@font-face{font-family:"BoardCJK";src:url(data:font/woff2;base64,${b64(cjk)}) format("woff2");font-display:block}
${BOARD_CSS}`
  return {
    css,
    script: `<script>${BOARD_JS}</script>`,
    info: `漫黑子集 ${[...chars].length} 字（${(cjk.length / 1024).toFixed(0)} KB），Caveat ${(latin.length / 1024).toFixed(0)} KB`,
  }
}

// 第二版：Excalifont 管英文数字，中文只用一种手写体；字号按 1080p 不小于 36px（画布 12px）
async function boardTheme2(htmls: string[], opts: BoardOpts): Promise<{ css: string; script: string; info: string }> {
  const C = FONTS[opts.cjk], L = FONTS[opts.latin]
  for (const f of [C, L]) if (!fs.existsSync(path.join(ROOT, f.file))) throw new Error(`找不到 ${f.file}（${f.src}）`)
  const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('')
  const chars = [...new Set(visibleText(htmls) + ascii)].join('')
  const cjk = await subsetFont(fs.readFileSync(path.join(ROOT, C.file)), chars, { targetFormat: 'woff2' })
  const latin = await subsetFont(fs.readFileSync(path.join(ROOT, L.file)), ascii, { targetFormat: 'woff2' })
  const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64')
  const css = `
/* ${C.src}、${L.src}，均为 SIL Open Font License 1.1，
   全文见 tools/fonts/OFL-${C.lic}.txt、tools/fonts/OFL-${L.lic}.txt。此处为按用字裁剪的子集。 */
@font-face{font-family:"BoardLatin";src:url(data:font/woff2;base64,${b64(latin)}) format("woff2");font-display:block}
@font-face{font-family:"BoardCJK";src:url(data:font/woff2;base64,${b64(cjk)}) format("woff2");font-display:block}
${BOARD_CSS}${SPEC_CSS}${opts.cjk === 'xiaolai' ? XIAOLAI_CSS : ''}`
  const js = BOARD_JS.replace(`tx.style.fontFamily = ${JSON.stringify(HAND)}`, `tx.style.fontFamily = ${JSON.stringify(HAND2)}`)
  return {
    css,
    script: `<script>${js}</script>`,
    info: `${C.name}子集 ${[...chars].length} 字（${(cjk.length / 1024).toFixed(0)} KB），${L.name} ${(latin.length / 1024).toFixed(0)} KB`,
  }
}

const HAND = `"BoardLatin","BoardCJK","Microsoft YaHei",sans-serif`
// Excalifont 没有 → ↓ ✓ ✗ 等符号：先回退到中文手写体，再回退到系统符号字体
const HAND2 = `"BoardLatin","BoardCJK","Segoe UI Symbol","Microsoft YaHei",sans-serif`

// 第二版的覆盖：字体栈、最小字号、语义墨水（规范见 docs/course/visual-spec.md）
const SPEC_CSS = `
/* —— 规范：画布 1px = 1080p 3px；画面文字不小于 12px（=36px） —— */
.f{--ptr:#7048e8} /* 指针、变量名专用色，整门课固定，不和红（错）绿（对）蓝（解释）混用 */
.f,.f .ed,.f .cell,.f .row .rs,.f .counter,.f .ct,.f .ci{font-family:${HAND2}}
.f .cur{font-family:${HAND2};font-weight:400;margin:0}
.f .ptr{color:var(--ptr)}
.f .halo{paint-order:stroke fill;-webkit-text-stroke:5px #f9f9f6} /* 只给压在线条上的标签用 */
.f .qc.corner{font-size:12px;width:222px} /* 12px 下最长一行约 216px，原 190px 会折行 */
.f .mini{font-size:12px}
.f .log .la{font-size:12px;line-height:12px}
.f .t{font-size:26px}
`
// 小赖笔画细：文字一律用纯墨色，不用灰
const XIAOLAI_CSS = `
.f .row .rs,.f .qz-s{color:var(--ink)}
.f .arr,.f .la,.f .brace{color:#333}
`

const BOARD_CSS = `
/* —— 白板主题（覆盖 FRAME_CSS） —— */
.f{--ink:#1f2023;--blue:#1d5fb4;--red:#c42b2b;--green:#237a3b;--grey:#8a8d91;
  background:radial-gradient(ellipse at 30% 25%,#ffffff 0%,#f7f7f4 55%,#eeeeea 100%);
  box-shadow:inset 0 0 0 3px #c9cdd1,inset 0 0 0 5px #9aa1a8,inset 0 -9px 0 0 #b8bec4;
  color:var(--ink);font-family:${HAND};font-size:16px;line-height:1.3}
.f .ed,.f .cell,.f .row .rs,.f .counter{font-family:${HAND}}
.f .ed{font-size:26px;padding:0 12px}.f .ed.big{font-size:34px}.f .ed.sm{font-size:18px}
.f .cell{font-size:24px}
.f .ct,.f .ci{font-family:${HAND};font-size:13px;color:var(--blue)}
.f .t{font-size:25px;font-weight:400;top:10px;letter-spacing:.5px}
.f .note{color:var(--blue);font-size:14px;white-space:nowrap}
.f .mini{color:var(--blue)}
.f .new{outline:none!important}
.f .hl{background:linear-gradient(100deg,transparent 2%,#fff09a 6%,#ffe974 94%,transparent 98%)!important}
.f .tag{background:none;color:var(--blue);font-size:15px;padding:0 4px}.f .tag.big{background:none;font-size:22px}
.f .btn{background:none;font-size:15px}
.f .inp{font-size:18px}
.f .qc{font-size:15px}.f .qc .qh,.f .qz-h{font-weight:400;color:var(--blue)}.f .qc li.ok{color:var(--green)}
.f .qc.corner{font-size:11px}
.f .qz-h{font-size:18px}.f .qz-s{font-size:14px;color:#444}.f .opt{font-size:14px}
.f .row{font-size:14px;background:none;padding:1px 10px}.f .row .rn{font-weight:400;font-size:16px;width:auto;min-width:80px;white-space:nowrap}.f .row .rs{font-size:16px;color:#333;white-space:nowrap}
.f .card{background:none}.f .card .ch{font-weight:400;font-size:17px}
.f .ck,.f .lr,.f .opt{background:none}.f .lr{font-size:14px}.f .ck{font-size:14px}
.f .okm{color:var(--green);font-weight:400;font-size:1.2em}.f .nom{color:var(--red);font-weight:400;font-size:1.2em}
.f .cur{color:var(--red);font-family:Consolas,monospace;font-weight:700;margin:0 1px}
.f .neq,.f .bounce{color:var(--red)}
.f .arr,.f .la,.f .brace{color:#555}
.f .pause{z-index:3}
.bd{position:absolute;left:0;top:0;width:640px;height:360px;pointer-events:none;z-index:2;overflow:visible}
`

// 浏览器端：给每个 .f 画白板笔迹
const BOARD_JS = String.raw`
(() => {
  const NS = 'http://www.w3.org/2000/svg'
  // 角色 → 画法
  const ROLES = [
    ['.ed', 'content'], ['.cell', 'content'], ['.inp', 'content'], ['.keys .key', 'content'],
    ['.card', 'container'], ['.row.open', 'container'], ['.qc', 'container'], ['.dash', 'container'], ['.bounce', 'container'],
    ['.row', 'line'], ['.ck', 'line'], ['.lr', 'line'], ['.opt', 'line'],
  ]
  const STYLE = {
    content: { w: 2.3, ink: '#1f2023' },
    container: { w: 1.6, ink: '#55585c' },
    line: { w: 1.3, ink: '#9a9da1' },
  }

${PEN_JS}

  function draw(f) {
    if (f.querySelector(':scope > .bd')) return
    const fr = f.getBoundingClientRect(), s = fr.width / 640
    if (!s) return
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'bd'); svg.setAttribute('viewBox', '0 0 640 360')
    const rel = (el) => { const q = el.getBoundingClientRect(); return { x: (q.left - fr.left) / s, y: (q.top - fr.top) / s, w: q.width / s, h: q.height / s } }
    const opacity = (el) => { let op = 1; for (let p = el; p && p !== f; p = p.parentElement) op *= +getComputedStyle(p).opacity; return op }
    const seen = new Set()

    for (const [sel, role] of ROLES) for (const el of f.querySelectorAll(sel)) {
      if (seen.has(el)) continue; seen.add(el)
      const cs = getComputedStyle(el)
      if (!(parseFloat(cs.borderTopWidth) > 0)) continue
      const { x, y, w, h } = rel(el), st = STYLE[role], r = rng(hash(role + '|' + Math.round(x) + ',' + Math.round(y) + ',' + Math.round(w) + ',' + Math.round(h)))
      // 彩色边框（问题卡的蓝、弹开的红）保留颜色，灰色边框用角色墨色
      const m = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(cs.borderTopColor)
      const colored = m && Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]) > 40
      const ink = colored ? cs.borderTopColor : st.ink
      const d = role === 'line' ? line(x + 2, y + h - 1, x + w - 4, y + h - 1.5, st.w, r, { over: 1 }) : box(x, y, w, h, st.w, r)
      add(svg, d, ink, opacity(el))
      el.style.borderColor = 'transparent'
      if (sel === '.keys .key') add(svg, line(x + 2, y + h + 2, x + w - 2, y + h + 2, 2, r), ink)
    }

    // 按钮：手画一个圈
    for (const el of f.querySelectorAll('.btn')) {
      const { x, y, w, h } = rel(el), r = rng(hash('btn|' + Math.round(x) + ',' + Math.round(y)))
      add(svg, loop(x + w / 2, y + h / 2, w / 2 + 4, h / 2 + 3, 1.6, r), '#55585c')
    }

    // 家谱树
    for (const t of f.querySelectorAll('svg.tree')) {
      for (const rc of t.querySelectorAll('rect')) {
        const x = +rc.getAttribute('x'), y = +rc.getAttribute('y'), w = +rc.getAttribute('width'), h = +rc.getAttribute('height')
        add(t, box(x, y, w, h, 2, rng(hash('nd|' + x + ',' + y))), '#1f2023'); rc.style.stroke = 'none'; rc.style.fill = 'none'
      }
      for (const l of t.querySelectorAll('line')) {
        const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((k) => +l.getAttribute(k)), cs = getComputedStyle(l)
        add(t, line(x1, y1, x2, y2, (parseFloat(cs.strokeWidth) || 1.5) + 0.6, rng(hash('ln|' + x1 + ',' + y1 + ',' + x2 + ',' + y2)), { over: 0.5 }), cs.stroke === 'rgb(240, 140, 0)' ? '#c42b2b' : '#1f2023')
        l.style.stroke = 'none'
      }
      for (const tx of t.querySelectorAll('text')) { tx.style.fontFamily = ${JSON.stringify(HAND)}; tx.style.fontSize = '14px'; t.appendChild(tx) }
    }

    // 标题下划线（黑笔，比标题略短）
    for (const t of f.querySelectorAll(':scope > .t')) {
      const { x, y, w, h } = rel(t), r = rng(hash('ul|' + Math.round(w)))
      add(svg, line(x, y + h - 1, x + w * 0.92, y + h - 2.5, 2.2, r, { over: 3 }), '#1f2023')
    }

    // 这一帧新出现的元素（审帧标记）：橙色马克笔
    for (const el of f.querySelectorAll('.new')) {
      const { x, y, w, h } = rel(el), r = rng(hash('new|' + Math.round(x) + ',' + Math.round(y)))
      // 小元素画圈；大元素（卡片、展开行）画圈会糊住画面，改画松一点的框
      const big = w > 200 || h > 70
      add(svg, big ? box(x - 5, y - 5, w + 10, h + 10, 2, r) : loop(x + w / 2, y + h / 2, w / 2 + 7, h / 2 + 6, 2.2, r), 'rgba(240,140,0,.85)')
    }

    f.appendChild(svg)
  }

  document.fonts.ready.then(() => document.querySelectorAll('.f').forEach(draw))
})()
`
