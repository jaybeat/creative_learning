// 分镜墙的纸面主题：npm run storyboard -- 2-1 --paper（读 docs/course/storyboard/<id>.paper.frames.ts）
// 参考 prompt-motion 上 @ik_builds 的 Paper-style 短片，分两层：
// 1. 纸片层：卡片、手风琴、问题卡是印刷体白纸片，带柔和投影、略微倾斜（角度由位置算出，逐帧不变）；
//    格子、编辑器是精确的印刷线；正文用系统黑体，等宽内容用更纱等宽（和书站一致）。
// 2. 笔迹层：只给老师的批注——手写字（漫黑 + Excalifont）、弯箭头、圈、勾叉、主角光标、审帧标记，
//    笔画复用 pen.ts（和白板版同一个生成器）。另有便利贴、图章两种实物。
// 暗场帧（.f.dark）：深墨绿底、浅色大字，只用在点名时刻。
import fs from 'node:fs'
import path from 'node:path'
import subsetFont from 'subset-font'
import { ROOT } from './course'
import { visibleText } from './sketch'
import { PEN_JS } from './pen'

const FONTS = {
  hand: { file: 'tools/fonts/LXGWMarkerGothic-Regular.ttf', note: '霞鹜漫黑 LXGW Marker Gothic（OFL，tools/fonts/OFL-LXGWMarkerGothic.txt）' },
  latin: { file: 'tools/fonts/Excalifont-Regular.woff2', note: 'Excalifont（OFL，tools/fonts/OFL-Excalifont.txt）' },
  mono: { file: 'tools/fonts/SarasaFixedSC-Regular.ttf', note: '更纱等宽 Sarasa Fixed SC（OFL，tools/fonts/LICENSE-Sarasa.txt）' },
}

export async function paperTheme(htmls: string[]): Promise<{ css: string; script: string; info: string }> {
  for (const f of Object.values(FONTS)) if (!fs.existsSync(path.join(ROOT, f.file))) throw new Error(`找不到 ${f.file}（${f.note}）`)
  const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('')
  const chars = [...new Set(visibleText(htmls) + ascii)].join('')
  const read = (f: string) => fs.readFileSync(path.join(ROOT, f))
  const hand = await subsetFont(read(FONTS.hand.file), chars, { targetFormat: 'woff2' })
  const latin = await subsetFont(read(FONTS.latin.file), ascii, { targetFormat: 'woff2' })
  const mono = await subsetFont(read(FONTS.mono.file), chars, { targetFormat: 'woff2', noLayoutClosure: true })
  const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64')
  const face = (name: string, b: Uint8Array) => `@font-face{font-family:"${name}";src:url(data:font/woff2;base64,${b64(b)}) format("woff2");font-display:block}`
  const css = `
/* 字体子集：${FONTS.hand.note}；${FONTS.latin.note}；${FONTS.mono.note}。正文黑体用系统字体。 */
${face('PaperLatin', latin)}
${face('PaperHand', hand)}
${face('PaperMono', mono)}
${PAPER_CSS}`
  const kb = (b: Uint8Array) => (b.length / 1024).toFixed(0)
  return { css, script: `<script>${PAPER_JS}</script>`, info: `手写 ${kb(hand)} KB + Excalifont ${kb(latin)} KB + 更纱 ${kb(mono)} KB（${[...chars].length} 字）` }
}

const SANS = `"Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif`
const HAND = `"PaperLatin","PaperHand","Segoe UI Symbol","Microsoft YaHei",sans-serif`
const MONO = `"PaperMono",Consolas,monospace`
// 纸面底色：米白 + 极淡纸纹 + 四角稍暗
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .42 0 0 0 0 .38 0 0 0 0 .3 0 0 0 .07 0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E")`

const PAPER_CSS = `
/* —— 纸面主题（覆盖 FRAME_CSS） —— */
.f{--ink:#22231f;--green:#1e6b4a;--red:#c42b2b;--blue:#1d5fb4;--paper:#fffefa;
  background:${GRAIN},radial-gradient(ellipse at 45% 40%,#f7f4ec 0%,#efeadf 70%,#e4ddcf 100%);
  color:var(--ink);font-family:${SANS};font-size:15px}
.f .t{font-size:22px;font-weight:700;letter-spacing:.5px;top:12px}
/* 纸片：白纸、柔和投影、略微倾斜（倾斜由脚本按位置算） */
.f .card,.f .acc,.f .qc{background:var(--paper);border-color:transparent!important;border-radius:2px;
  box-shadow:0 1px 1px rgba(60,50,30,.10),0 8px 18px -6px rgba(60,50,30,.30)}
.f .acc{padding:6px 8px;width:376px}
.f .acc .row{background:none;border:0;border-bottom:1px solid #e9e3d6;border-radius:0;margin:0;min-height:26px;font-size:14px}
.f .acc .row:last-child{border-bottom:0}
.f .acc .row.open{background:#faf7ef;border-bottom:1px solid #e9e3d6}
.f .row .rn{font-weight:700}
.f .row .rs,.f .ed,.f .cell,.f .counter,.f .brace,.f .keys .key{font-family:${MONO}}
.f .card .card{box-shadow:0 1px 3px rgba(60,50,30,.18)}
.f .qc{border:0}
.f .qc .qh,.f .qz-h{color:var(--ink)}
.f .qc li.on{background:linear-gradient(100deg,transparent 1%,#fff09a 4%,#ffe974 96%,transparent 99%)}
.f .qc li.ok{color:var(--green)}
.f .qc.corner{width:214px;font-size:12px}
.f .qc.corner::before{content:"";position:absolute;left:50%;top:-9px;width:62px;height:17px;margin-left:-31px;transform:rotate(-4deg);
  background:rgba(255,255,255,.55);box-shadow:0 0 0 1px rgba(160,150,120,.25)}
/* 印刷的图形：精确细线 */
.f .cell{border:1.5px solid #3b3a36;margin-left:-1.5px;background:#fff}
.f .cells.gap .cell{margin-left:0}
.f .ed{border:1.5px solid #3b3a36;border-radius:3px;background:#fff;box-shadow:inset 0 1px 2px rgba(0,0,0,.06)}
.f .inp{border:1.5px solid #b9b3a5;background:#fff;box-shadow:0 2px 6px -2px rgba(60,50,30,.2)}
.f .ck,.f .opt,.f .lr{border-color:#e2dccf;background:#fff}
.f .btn{background:#2c2b27;color:#fff;border-radius:3px}
.f .tag{background:#e9eff6;color:var(--blue)}
.f .ct,.f .ci{color:#666;font-family:${SANS};font-size:12px}
.f .note{color:#5e5a52;font-size:13px}
.f .mini{font-size:12px;color:#777}
.f .log .la{font-size:12px;line-height:12px}
.f .hl{background:linear-gradient(100deg,transparent 2%,#fff09a 6%,#ffe974 94%,transparent 98%)!important}
.f .new{outline:none!important}
.f .cur{color:var(--red);font-weight:700}
/* 笔迹层：手写字 */
.f .ink{font-family:${HAND};font-size:17px;line-height:1.15;white-space:nowrap;color:var(--green)}
.f .ink.red{color:var(--red)}.f .ink.blue{color:var(--blue)}
.f .okm,.f .nom{font-family:${HAND};font-weight:400;font-size:1.3em}
.f .okm{color:var(--green)}.f .nom{color:var(--red)}
.f .hero{display:inline-block;width:0;vertical-align:top}
/* 被弹开的小纸片（"7""图片"挤不进格子） */
.f .chip{display:inline-block;background:var(--paper);padding:4px 11px;margin-right:16px;font:18px ${MONO};transform:rotate(var(--r,-8deg));
  box-shadow:0 1px 1px rgba(60,50,30,.12),0 6px 10px -4px rgba(60,50,30,.3)}
/* 图章 */
.f .stamp{display:inline-block;font:700 17px/1.2 ${SANS};letter-spacing:2px;padding:3px 10px;border:3px double currentColor;border-radius:6px;
  transform:rotate(-6deg);opacity:.86;mix-blend-mode:multiply}
.f .stamp.ok{color:#23794a}.f .stamp.no{color:#c0392b}
/* 便利贴 */
.f .sticky{position:relative;background:linear-gradient(170deg,#fff6b0 0%,#fbec8c 100%);padding:12px 14px 10px;font-family:${HAND};font-size:17px;line-height:1.35;color:#3a3420;
  transform:rotate(2deg);box-shadow:0 1px 1px rgba(60,50,30,.12),0 10px 16px -8px rgba(60,50,30,.35)}
.f .sticky::before{content:"";position:absolute;left:50%;top:-8px;width:58px;height:16px;margin-left:-29px;transform:rotate(-3deg);
  background:rgba(255,255,255,.5);box-shadow:0 0 0 1px rgba(160,150,120,.22)}
/* 暗场 */
.f.dark{background:${GRAIN},radial-gradient(ellipse at 50% 45%,#1d3029 0%,#14211c 70%,#0f1915 100%);color:#ece7da}
.f .dk{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center}
.f .dk-big{font-family:${HAND};font-size:48px;letter-spacing:2px;color:#f4efe2}
.f .dk-sub{font-family:${HAND};font-size:20px;color:#a9bfb2}
.f.dark .cell{background:transparent;border-color:#cfd8cf;color:#ece7da}
.f.dark .arr{color:#a9bfb2}
.f .tree .hl line{stroke:#c42b2b}
/* 例题卡：记录和检查行收紧，手写勾叉只在行内放大，不撑高行（原版记录和检查行之间留 14px） */
.f .log{line-height:1.35}.f .ck{line-height:1.35}.f .ck .okm,.f .ck .nom{line-height:1;font-size:1.15em}
.f .pause{z-index:3}
.pp{position:absolute;left:0;top:0;width:640px;height:360px;pointer-events:none;z-index:2;overflow:visible}
/* 分镜墙：前半拍暗场画在本帧上方 */
.thumb.lead{margin-bottom:4px}
`

// 浏览器端：先把纸片按位置轻微倾斜，再画笔迹层
const PAPER_JS = String.raw`
(() => {
  const NS = 'http://www.w3.org/2000/svg'
${PEN_JS}

  // 弯箭头：从批注文字边上出发，弯一下，落到 (tx, ty)
  function arrow(x1, y1, x2, y2, r) {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / len, uy = (y2 - y1) / len
    const bend = (r() < 0.5 ? -1 : 1) * Math.min(26, len * 0.22)
    const mx = (x1 + x2) / 2 - uy * bend, my = (y1 + y2) / 2 + ux * bend
    const N = Math.max(10, Math.min(30, Math.round(len / 6))), pts = []
    for (let i = 0; i < N; i++) { const t = i / (N - 1), u = 1 - t; pts.push([u * u * x1 + 2 * u * t * mx + t * t * x2, u * u * y1 + 2 * u * t * my + t * t * y2]) }
    // 箭头两翼沿末段方向
    const a = pts[N - 3], dx = x2 - a[0], dy = y2 - a[1], dl = Math.hypot(dx, dy) || 1, ex = dx / dl, ey = dy / dl, L = 8
    const wing = (s) => { const c = Math.cos(s * 0.5), sn = Math.sin(s * 0.5); return [x2 - L * (ex * c - ey * sn), y2 - L * (ey * c + ex * sn)] }
    const w1 = wing(1), w2 = wing(-1)
    return stroke(pts, 2) + line(w1[0], w1[1], x2, y2, 2, r, { over: 0, jitter: 0.3 }) + line(w2[0], w2[1], x2, y2, 2, r, { over: 0, jitter: 0.3 })
  }

  function draw(f) {
    if (f.querySelector(':scope > .pp')) return
    let fr = f.getBoundingClientRect(), s = fr.width / 640
    if (!s) return
    const rel = (el) => { const q = el.getBoundingClientRect(); return { x: (q.left - fr.left) / s, y: (q.top - fr.top) / s, w: q.width / s, h: q.height / s } }

    // 1. 纸片倾斜：最外层的卡片、手风琴、问题卡各转一个小角度（按种类和位置算，同一张纸逐帧不变）
    const PAPERS = [['.acc', 0.5], ['.qc', 1.2], ['.card', 1.4]]
    for (const [sel, max] of PAPERS) for (const el of f.querySelectorAll(sel)) {
      if (el.parentElement.closest('.acc,.qc,.card,.sticky')) continue
      if (el.style.transform) continue
      const { x, y, w, h } = rel(el)
      const r = rng(hash(sel + '|' + Math.round(x) + ',' + Math.round(y) + ',' + Math.round(w) + ',' + Math.round(h)))
      el.style.transform = 'rotate(' + ((r() * 2 - 1) * max).toFixed(2) + 'deg)'
    }
    fr = f.getBoundingClientRect()

    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'pp'); svg.setAttribute('viewBox', '0 0 640 360')
    const COLOR = { green: '#1e6b4a', red: '#c42b2b', blue: '#1d5fb4' }
    const colorOf = (el) => COLOR[['green', 'red', 'blue'].find((c) => el.classList.contains(c))] || COLOR.green

    // 2. 批注的弯箭头
    for (const el of f.querySelectorAll('.ink[data-to]')) {
      const [tx, ty] = el.dataset.to.split(',').map(Number), b = rel(el)
      // 起点：文字框上离目标最近的点，再往外挪 4px
      const cx = Math.max(b.x, Math.min(tx, b.x + b.w)), cy = Math.max(b.y, Math.min(ty, b.y + b.h))
      const d = Math.hypot(tx - cx, ty - cy) || 1
      const sx = cx + (tx - cx) / d * 4, sy = cy + (ty - cy) / d * 4
      const r = rng(hash('ink|' + el.textContent + '|' + tx + ',' + ty))
      add(svg, arrow(sx, sy, tx, ty, r), colorOf(el))
    }

    // 3. 手画圈
    for (const el of f.querySelectorAll('.circ')) {
      const { x, y, w, h } = rel(el), r = rng(hash('circ|' + Math.round(x) + ',' + Math.round(y)))
      add(svg, loop(x + w / 2, y + h / 2, w / 2, h / 2, 2.4, r), colorOf(el))
    }

    // 4. 主角光标：红色马克笔画的工字形竖光标
    for (const el of f.querySelectorAll('.hero')) {
      const { x, y, h } = rel(el), r = rng(hash('hero|' + Math.round(x) + ',' + Math.round(y)))
      add(svg, line(x, y + 2, x, y + h - 2, 3.6, r, { over: 0.5, jitter: 0.3 }) + line(x - 5, y + 1, x + 5, y + 1, 2.6, r, { over: 0.5 }) + line(x - 5, y + h - 1, x + 5, y + h - 1, 2.6, r, { over: 0.5 }), '#d6332b')
    }

    // 5. 标题下面一道绿色马克笔线
    for (const t of f.querySelectorAll(':scope > .t')) {
      const { x, y, w, h } = rel(t), r = rng(hash('ul|' + Math.round(w)))
      add(svg, line(x, y + h + 1, x + w * 0.9, y + h - 0.5, 2.4, r, { over: 3 }), 'rgba(30,107,74,.85)')
    }

    // 6. 审帧标记（这一帧新出现的元素）：橙色马克笔，小元素画圈，大元素画框
    for (const el of f.querySelectorAll('.new')) {
      const { x, y, w, h } = rel(el), r = rng(hash('new|' + Math.round(x) + ',' + Math.round(y)))
      const big = w > 200 || h > 70
      add(svg, big ? box(x - 5, y - 5, w + 10, h + 10, 2, r) : loop(x + w / 2, y + h / 2, w / 2 + 7, h / 2 + 6, 2.2, r), 'rgba(240,140,0,.8)')
    }

    f.appendChild(svg)
  }

  document.fonts.ready.then(() => document.querySelectorAll('.f').forEach(draw))
})()
`
