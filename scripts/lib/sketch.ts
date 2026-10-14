// 分镜墙的手绘白板主题：npm run storyboard -- 2-1 --sketch
// 帧画面（frames.ts / kit.ts）不变，只在外面加一层：
// 1. 画面文字换成小赖字体（等宽内容仍用 Consolas）；
// 2. 页面加载后，把带边框的元素量出位置，用 rough.js 画成手绘线条，原边框设为透明。
// 种子由"元素种类 + 取整后的位置和大小"算出：同一元素在相邻帧里线条完全一样，帧间淡入淡出时不会抖。
import fs from 'node:fs'
import path from 'node:path'
import subsetFont from 'subset-font'
import { ROOT } from './course'

const FONT_SRC = path.join(ROOT, 'tools/fonts/Xiaolai-Regular.ttf')
const ROUGH_SRC = path.join(ROOT, 'tools/vendor/rough.js')

/** 帧 HTML 里实际显示的文字（去掉标签、解开常见实体） */
export function visibleText(htmls: string[]): string {
  return htmls
    .join('\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/** 返回要插进 <head> 的 style（字体 + 主题样式）和要放在 </body> 前的脚本 */
export async function sketchTheme(htmls: string[]): Promise<{ css: string; script: string; info: string }> {
  for (const f of [FONT_SRC, ROUGH_SRC]) {
    if (!fs.existsSync(f)) throw new Error(`找不到 ${path.relative(ROOT, f)}：小赖字体从 github.com/lxgw/kose-font 的 Releases 下载 Xiaolai-Regular.ttf；rough.js 取自 npm 包 roughjs 的 bundled/rough.js`)
  }
  const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('')
  const chars = [...new Set(visibleText(htmls) + ascii)].join('')
  const ttf = fs.readFileSync(FONT_SRC)
  const woff2 = await subsetFont(ttf, chars, { targetFormat: 'woff2' })
  const css = `
/* 小赖字体 Xiaolai（lxgw/kose-font），SIL Open Font License 1.1，全文见 tools/fonts/OFL-Xiaolai.txt。此处为按用字裁剪的子集。 */
@font-face{font-family:"Xiaolai";src:url(data:font/woff2;base64,${Buffer.from(woff2).toString('base64')}) format("woff2");font-display:block}
${SKETCH_CSS}`
  const script = `<script>/* rough.js 4.6.6，MIT，https://github.com/rough-stuff/rough */\n${fs.readFileSync(ROUGH_SRC, 'utf8')}</script>\n<script>${SKETCH_JS}</script>`
  return { css, script, info: `小赖子集 ${[...chars].length} 字（${(woff2.length / 1024).toFixed(0)} KB）` }
}

// 纸面底色加一层极淡的噪点（静态 SVG，不影响逐帧导出）
const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .45 0 0 0 0 .4 0 0 0 0 .3 0 0 0 .05 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")`

const SKETCH_CSS = `
/* —— 手绘主题（覆盖 FRAME_CSS） —— */
.f{background:#fdfbf6 ${NOISE};color:#2b2b2b;font-family:"Xiaolai","Microsoft YaHei",sans-serif}
.f .ct,.f .ci{font-family:"Xiaolai","Microsoft YaHei",sans-serif}
.f .t{font-size:22px;font-weight:400}
.f .note{color:#666}
.f .new{outline:none!important}
.f .hl{background:#fff1a8!important}
.f .tag{background:#efece4}.f .tag.big{background:#dcecfb}
.f .btn{background:#e9e6de}
.f .qc .qh,.f .qz-h{font-weight:400}
.f .row .rn,.f .card .ch{font-weight:400;font-size:1.08em}
.f .okm,.f .nom{font-weight:400}
.f .pause{z-index:3}
.sk{position:absolute;left:0;top:0;width:640px;height:360px;pointer-events:none;z-index:2;overflow:visible}
`

// 浏览器端：给每个 .f 画手绘层
const SKETCH_JS = String.raw`
(() => {
  // 要描边的元素：选择器 → 种类（参与种子）
  const KINDS = ['.ed', '.cell', '.card', '.row', '.inp', '.qc', '.ck', '.opt', '.lr', '.dash', '.keys .key', '.bounce']
  const GREY = /^rgb\((\d+), (\d+), (\d+)\)$/
  const gen = rough.generator()

  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return (h >>> 1) % 2147483646 + 1 }

  // 灰色边框改成铅笔墨色，彩色边框保留原色
  function ink(color, width) {
    const m = GREY.exec(color)
    if (m && Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]) < 12) {
      const v = +m[1]
      return { stroke: v >= 200 ? '#9a958c' : '#3a3836', w: v >= 200 ? 1 : Math.min(1.8, Math.max(1.1, width * 0.8)) }
    }
    return { stroke: color, w: Math.max(1.2, width * 0.85) }
  }

  // 圆角矩形路径（半径大的输入框、问题卡用）
  function rrect(x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2)
    return 'M' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h - r) +
      'Q' + (x + w) + ' ' + (y + h) + ' ' + (x + w - r) + ' ' + (y + h) + 'H' + (x + r) + 'Q' + x + ' ' + (y + h) + ' ' + x + ' ' + (y + h - r) +
      'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'Z'
  }

  function put(svg, drawable) {
    for (const p of gen.toPaths(drawable)) {
      const e = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      e.setAttribute('d', p.d); e.setAttribute('stroke', p.stroke); e.setAttribute('stroke-width', p.strokeWidth)
      e.setAttribute('fill', p.fill || 'none'); e.setAttribute('stroke-linecap', 'round'); e.setAttribute('stroke-linejoin', 'round')
      if (drawable.options.strokeLineDash) e.setAttribute('stroke-dasharray', drawable.options.strokeLineDash.join(' '))
      svg.appendChild(e)
    }
  }

  function box(svg, x, y, w, h, kind, opt) {
    const seed = hash(kind + '|' + Math.round(x) + ',' + Math.round(y) + ',' + Math.round(w) + ',' + Math.round(h))
    const o = Object.assign({ roughness: 0.8, bowing: 0.6, seed }, opt)
    put(svg, opt.radius > 8 ? gen.path(rrect(x, y, w, h, opt.radius), o) : gen.rectangle(x, y, w, h, o))
  }

  function sketch(f) {
    if (f.querySelector(':scope > .sk')) return
    const fr = f.getBoundingClientRect(), s = fr.width / 640
    if (!s) return
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('class', 'sk'); svg.setAttribute('viewBox', '0 0 640 360')
    const rel = (el) => { const r = el.getBoundingClientRect(); return { x: (r.left - fr.left) / s, y: (r.top - fr.top) / s, w: r.width / s, h: r.height / s } }
    const seen = new Set()

    // 1. 带边框的元素
    for (const sel of KINDS) for (const el of f.querySelectorAll(sel)) {
      if (seen.has(el)) continue; seen.add(el)
      const cs = getComputedStyle(el), bw = parseFloat(cs.borderTopWidth) || 0
      if (!bw) continue
      const { x, y, w, h } = rel(el), c = ink(cs.borderTopColor, bw)
      const dashed = cs.borderTopStyle === 'dashed' || cs.borderTopStyle === 'dotted'
      // 透明度要跟着元素走（.dim 的元素线条也要淡）
      let op = 1; for (let p = el; p && p !== f; p = p.parentElement) op *= +getComputedStyle(p).opacity
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); if (op < 1) g.setAttribute('opacity', op.toFixed(2)); svg.appendChild(g)
      box(g, x, y, w, h, sel, { stroke: c.stroke, strokeWidth: c.w, radius: parseFloat(cs.borderTopLeftRadius) || 0, strokeLineDash: dashed ? [5, 4] : undefined, disableMultiStroke: dashed })
      if (sel === '.keys .key') box(g, x + 1, y + h - 2, w - 2, 0.1, 'keyb', { stroke: c.stroke, strokeWidth: c.w, roughness: 0.6 })
      el.style.borderColor = 'transparent'
    }

    // 2. 家谱树：节点和连线改成手绘
    for (const t of f.querySelectorAll('svg.tree')) {
      for (const r of t.querySelectorAll('rect')) {
        const x = +r.getAttribute('x'), y = +r.getAttribute('y'), w = +r.getAttribute('width'), h = +r.getAttribute('height')
        put(t, gen.rectangle(x, y, w, h, { stroke: '#3a3836', strokeWidth: 1.3, roughness: 0.8, bowing: 0.6, seed: hash('nd|' + x + ',' + y) }))
        r.style.stroke = 'none'
      }
      for (const l of t.querySelectorAll('line')) {
        const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((k) => +l.getAttribute(k)), cs = getComputedStyle(l)
        put(t, gen.line(x1, y1, x2, y2, { stroke: cs.stroke, strokeWidth: parseFloat(cs.strokeWidth) || 1.5, roughness: 0.9, bowing: 1, preserveVertices: true, seed: hash('ln|' + x1 + ',' + y1 + ',' + x2 + ',' + y2) }))
        l.style.stroke = 'none'
      }
      for (const tx of t.querySelectorAll('text')) t.appendChild(tx) // 文字放到最上层
    }

    // 3. 标题下面一道手绘下划线
    for (const t of f.querySelectorAll(':scope > .t')) {
      const { x, y, w, h } = rel(t)
      put(svg, gen.line(x - 2, y + h + 1, x + w + 6, y + h - 1, { stroke: '#e8590c', strokeWidth: 2, roughness: 1.2, bowing: 2, seed: hash('ul|' + Math.round(w)) }))
    }

    // 4. 这一帧新出现的元素：橙色手绘框（审帧标记）
    for (const el of f.querySelectorAll('.new')) {
      const { x, y, w, h } = rel(el)
      box(svg, x - 4, y - 4, w + 8, h + 8, 'new', { stroke: '#f08c00', strokeWidth: 2, roughness: 1.3, bowing: 1, radius: 0 })
    }

    f.appendChild(svg)
  }

  document.fonts.ready.then(() => document.querySelectorAll('.f').forEach(sketch))
})()
`
