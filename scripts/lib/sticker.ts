// 分镜墙的贴纸主题：npm run storyboard -- 2-1 --sticker [--palette p0]（读 docs/course/storyboard/<id>.sticker.frames.ts）
// 参考原片"一部手机里藏着多少种元素"（贴纸风科普）：
// - 浅底 + 点阵；实物和卡片是白边贴纸，带柔和投影，可以轻微倾斜；
// - 数据是深色圆角格子，正在讲的那个换成强调色，没点亮的是浅灰；
// - 小方块 + 中文 kicker + 英文副标，900 粗标题，关键词下面一道强调色下划线；引线标注；大数字。
// 颜色全部来自色系令牌（scripts/lib/palettes.ts），这里只写 var()：换色系 = 换根元素上的 data-palette。
// 错误不用颜色：.s-wrongx 压暗、去色、划线；✗ 是灰色圆底。
import fs from 'node:fs'
import path from 'node:path'
import subsetFont from 'subset-font'
import { ROOT } from './course'
import { visibleText } from './sketch'
import { PALETTES, DEFAULT_PALETTE, paletteCss } from './palettes'

const FONTS = {
  sans: { file: 'tools/fonts/NotoSansSC-wght.ttf', note: '思源黑体 Noto Sans SC 可变字重（OFL，tools/fonts/OFL-NotoSansSC.txt）' },
  mono: { file: 'tools/fonts/SarasaFixedSC-Regular.ttf', note: '更纱等宽 Sarasa Fixed SC（OFL，tools/fonts/LICENSE-Sarasa.txt）' },
}

export async function stickerTheme(htmls: string[], palette = DEFAULT_PALETTE): Promise<{ css: string; script: string; info: string }> {
  if (!PALETTES[palette]) throw new Error(`没有色系 ${palette}，可选：${Object.keys(PALETTES).join(' ')}`)
  for (const f of Object.values(FONTS)) if (!fs.existsSync(path.join(ROOT, f.file))) throw new Error(`找不到 ${f.file}（${f.note}）`)
  const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('')
  // 页面上的色系名、元信息行也要进子集
  const extra = Object.values(PALETTES).map((p) => p.name).join('') + '林小川说学习数据结构线性表发送✓✗…≠→←⌫₀₁ₙ₋−'
  const chars = [...new Set(visibleText(htmls) + ascii + extra)].join('')
  const read = (f: string) => fs.readFileSync(path.join(ROOT, f))
  // 可变字重整个保留（wght 轴），标题 900、正文 400/700 都从这一个文件出
  const sans = await subsetFont(read(FONTS.sans.file), chars, { targetFormat: 'woff2' })
  const mono = await subsetFont(read(FONTS.mono.file), chars, { targetFormat: 'woff2', noLayoutClosure: true })
  const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64')
  const face = (name: string, b: Uint8Array, w = '') =>
    `@font-face{font-family:"${name}";src:url(data:font/woff2;base64,${b64(b)}) format("woff2");font-display:block${w ? `;font-weight:${w}` : ''}}`
  const css = `
/* 字体子集：${FONTS.sans.note}；${FONTS.mono.note}。 */
${face('StickerSans', sans, '100 900')}
${face('StickerMono', mono)}
/* 色系令牌（默认 ${palette}） */
${paletteCss(palette)}
${STICKER_CSS}`
  const kb = (b: Uint8Array) => (b.length / 1024).toFixed(0)
  const opts = Object.entries(PALETTES).map(([id, p]) => [id, p.name])
  const script = `<script>(${PICKER_JS})(${JSON.stringify(opts)}, ${JSON.stringify(palette)})</script>`
  return { css, script, info: `色系 ${palette}，思源黑体 ${kb(sans)} KB + 更纱 ${kb(mono)} KB（${[...chars].length} 字）` }
}

const SANS = `"StickerSans","Microsoft YaHei","PingFang SC",sans-serif`
const MONO = `"StickerMono",Consolas,monospace`
const DOTS = (v: string) => `radial-gradient(circle at 2px 2px,var(${v}) 1px,transparent 1.5px) 0 0/16px 16px`
// 贴纸投影：只用黑色透明度，和色系无关
const SHADOW = `0 1px 1px rgb(0 0 0/.06),0 7px 16px -6px rgb(0 0 0/.22)`

const STICKER_CSS = `
/* —— 贴纸主题（覆盖 FRAME_CSS） —— */
.f{background:${DOTS('--dot')},var(--bg);color:var(--ink);font-family:${SANS};font-size:14px;line-height:1.35}
.f.dark{background:${DOTS('--dark-dot')},var(--dark);color:var(--dark-ink)}
.f .new{outline:none!important}
/* 分镜墙审帧标记（只在墙上画，不属于画面）：虚线框出这一帧新出现的元素 */
.thumb .f .new{outline:2px dashed var(--ptr)!important;outline-offset:4px}

/* 版式层级 */
.s-kick{position:absolute;left:32px;top:20px;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;white-space:nowrap}
.s-kick i{width:9px;height:9px;background:var(--acc)}
.s-kick span{font-weight:500;letter-spacing:1.5px;color:var(--mute)}
.s-head{position:absolute;left:32px;top:40px;font-size:26px;font-weight:900;line-height:1.3;white-space:nowrap;letter-spacing:.5px}
.s-head u{text-decoration:none;background:linear-gradient(var(--acc),var(--acc)) 0 calc(100% - 2px)/100% 5px no-repeat}
.s-en{margin-left:12px;font-size:12px;font-weight:500;letter-spacing:2px;color:var(--mute);vertical-align:4px}
.s-lede{position:absolute;left:32px;top:80px;font-size:13px;color:var(--mute);white-space:nowrap}
.f.dark .s-kick,.f.dark .s-head{color:var(--dark-ink)}
.f.dark .s-kick span,.f.dark .s-lede,.f.dark .s-en{color:var(--dark-mute)}

/* 贴纸 */
.s-stk{position:relative;display:inline-block;background:var(--paper);color:var(--ink);border-radius:12px;padding:10px 12px;box-shadow:${SHADOW};transform:rotate(var(--r,0deg))}
.s-note{font-size:13px;line-height:1.5}.s-note b{font-size:15px;font-weight:900}
.s-note .s-m{color:var(--mute);font-size:12px}

/* 元素格子 */
.s-tiles{display:flex;align-items:center;gap:var(--g)}
.s-tile{position:relative;flex:none;width:var(--s);height:var(--s);border-radius:calc(var(--s) * .16);display:inline-flex;align-items:center;justify-content:center;
  font:700 calc(var(--s) * .46)/1 ${MONO}}
.s-on{background:var(--tile);color:var(--tile-ink)}
.s-hi{background:var(--acc);color:var(--acc-ink)}
.s-off{background:var(--off);color:var(--off-ink)}
.s-ghost{border:1.5px dashed var(--mute);color:var(--mute)}
.s-top,.s-idx{position:absolute;left:50%;transform:translateX(-50%);white-space:nowrap;font:500 12px/1 ${SANS};font-style:normal;color:var(--mute)}
.s-top{bottom:calc(100% + 8px)}
.s-idx{top:calc(100% + 8px);font-family:${MONO}}
.s-top b,.s-idx b{color:var(--acc-line);font-weight:700}
.s-arrows{gap:6px}
.s-arr{position:relative;flex:none;width:24px;height:2px;background:var(--ink)}
.s-arr::after{content:"";position:absolute;right:-2px;top:-5px;border:6px solid transparent;border-left:8px solid var(--ink);border-right:0}
.f.dark .s-arr{background:var(--dark-mute)}.f.dark .s-arr::after{border-left-color:var(--dark-mute)}
.f.dark .s-off{background:var(--dark-dot);color:var(--dark-mute)}

/* 贴纸编辑器、按键 */
.s-ed{padding:6px}
.s-field{position:relative;display:flex;align-items:center;min-height:calc(var(--fs) * 1.75);padding:0 14px;background:var(--field);border:1px solid var(--field-line);border-radius:8px;
  font:500 var(--fs)/1 ${MONO};white-space:pre}
.s-cur{display:inline-block;width:2.5px;height:calc(var(--fs) * 1.15);background:var(--acc-line);margin:0 1px;border-radius:1px}
.s-ph{font:400 13px ${SANS};color:var(--mute)}
.s-mark{background:var(--acc-soft);color:var(--acc-line);border-radius:3px;font-weight:700}
.s-ico{position:absolute;right:18px;top:50%;width:13px;height:13px;margin-top:-9px;border:2px solid var(--mute);border-radius:50%}
.s-ico::after{content:"";position:absolute;left:10px;top:10px;width:6px;height:2px;background:var(--mute);transform:rotate(45deg);transform-origin:0 0}
.s-send{margin-left:auto;background:var(--acc);color:var(--acc-ink);font:700 12px/1 ${SANS};padding:6px 10px;border-radius:6px}
.s-key{width:56px;height:56px;padding:0;display:inline-flex;align-items:center;justify-content:center;font:700 24px/1 ${MONO};border-radius:10px}
.s-key-word{font:700 15px/1 ${SANS}}
.s-step{font-size:12px;font-weight:700;color:var(--mute);white-space:nowrap}.s-step b{color:var(--acc-line)}

/* 线条层、引线标注 */
.s-svg{position:absolute;left:0;top:0;width:640px;height:360px;overflow:visible;pointer-events:none}
.s-svg .s-ink{stroke:var(--ink);fill:var(--ink)}
.s-svg .s-mute{stroke:var(--mute);fill:var(--mute)}
.s-svg .s-acc{stroke:var(--acc-line);fill:var(--acc-line)}
.s-svg .s-wrong{stroke:var(--wrong);fill:var(--wrong)}
.s-svg path{fill:none!important}
.s-call{font-size:12px;font-weight:700;line-height:18px;white-space:nowrap}
.s-call.end{transform:translateX(-100%);text-align:right}
.s-call small{display:block;font-size:12px;font-weight:400;line-height:16px;color:var(--mute)}
.s-call.acc{color:var(--acc-line)}.s-call.mute{color:var(--mute)}

/* 大数字 */
.s-big{display:inline-flex;align-items:flex-end;line-height:1}
.s-big text{font-family:${SANS};font-weight:900;fill:var(--big);stroke:var(--big-stroke);stroke-width:var(--big-stroke-w);paint-order:stroke;stroke-linejoin:round}
.f.dark .s-big text{stroke:var(--dark)}
.s-den{font-weight:700;color:var(--mute);padding:0 0 .9em 6px;white-space:nowrap}
.f.dark .s-den{color:var(--dark-mute)}

/* 标签、勾叉、编号、错误、强调框 */
.s-chip{display:inline-block;padding:0 10px;height:22px;line-height:22px;border-radius:11px;font-size:12px;font-weight:700;white-space:nowrap}
.s-c-acc{background:var(--acc);color:var(--acc-ink)}
.s-c-soft{background:var(--acc-soft);color:var(--acc-line)}
.s-c-tile{background:var(--tile);color:var(--tile-ink)}
.s-c-ok{background:var(--ok);color:var(--paper)}
.s-c-wrong{background:var(--wrong);color:var(--paper)}
.s-chk{display:inline-flex;flex:none;width:20px;height:20px;border-radius:50%;align-items:center;justify-content:center;font:700 12px/1 ${SANS};color:var(--paper);vertical-align:middle}
.s-k-ok{background:var(--ok)}
.s-k-no{background:var(--wrong)}
.s-k-wait{background:none;border:1.5px dashed var(--off)}
.s-num{display:inline-flex;flex:none;width:24px;height:24px;border-radius:5px;background:var(--acc);color:var(--acc-ink);font:700 12px/1 ${MONO};align-items:center;justify-content:center}
.s-num.done{background:var(--tile);color:var(--tile-ink)}.s-num.off{background:var(--off);color:var(--off-ink)}
.s-wrongx{position:relative;display:inline-block}
.s-wrongx>*{opacity:.5;filter:grayscale(1)}
.s-wrongx::after{content:"";position:absolute;left:-6px;right:-6px;top:50%;height:2.5px;margin-top:-1px;background:var(--wrong);border-radius:2px}
.s-ring{border:2.5px solid var(--acc);border-radius:12px}
.s-ring.dash{border-style:dashed;border-width:1.5px}
.s-neq{font:900 44px/1 ${SANS};color:var(--acc-line)}
.s-mono{font-family:${MONO}}

/* 要点进度（替代手风琴）：已讲完的打勾，正在讲的用强调色 */
.s-steps{position:absolute;left:32px;top:88px;display:flex;gap:6px}
.s-steps .s-chip{background:var(--paper);color:var(--mute);box-shadow:${SHADOW}}
.s-steps .s-chip.on{background:var(--acc);color:var(--acc-ink)}
.s-steps .s-chip.done{background:var(--tile);color:var(--tile-ink)}

/* 右上角三问小卡 */
.s-q{width:188px;padding:6px 8px;border-radius:9px}
.s-qr{display:flex;align-items:center;gap:8px;height:22px;padding:0 6px;border-radius:5px;font-size:12px;white-space:nowrap}
.s-qr b{font:700 12px ${MONO};color:var(--mute)}
.s-qr.on{background:var(--acc-soft);font-weight:700}.s-qr.on b{color:var(--acc-line)}
.s-qr .s-chk{margin-left:auto;width:18px;height:18px;font-size:12px}

/* 例题卡：检查行 */
.s-ck{display:flex;align-items:center;justify-content:space-between;height:24px;padding:0 8px;margin-top:3px;border-radius:6px;font-size:13px;font-weight:700}
.s-ck.on{background:var(--acc-soft)}
.s-ck.dim{opacity:.4}
.s-ct{font-size:15px;font-weight:900;margin-bottom:6px}
.s-log{display:flex;flex-direction:column;gap:3px}
.s-lr{display:flex;justify-content:space-between;align-items:center;height:20px;padding:0 10px;border:1px solid var(--field-line);background:var(--field);border-radius:6px;font-size:12px;font-weight:700}
.s-lr span{font-weight:400;color:var(--mute)}
.s-log.arrows{padding-left:14px}.s-log.arrows .s-lr{position:relative}
.s-log.arrows .s-lr:not(:last-child)::before{content:"↓";position:absolute;left:-15px;top:9px;font:900 13px/1 ${SANS};color:var(--acc-line)}
.s-tree .nd{fill:var(--off)}.s-tree text{font:700 12px ${SANS};fill:var(--ink);text-anchor:middle}
.s-tree line{stroke:var(--ink);stroke-width:1.4}.s-tree .hi line{stroke:var(--acc-line);stroke-width:2.4}
.s-tree .hi circle{fill:var(--acc-line)}

/* 练习 */
.s-opt{display:flex;align-items:center;gap:8px;height:30px;padding:0 10px;border:1px solid var(--field-line);background:var(--field);border-radius:7px;font-size:12px;white-space:nowrap}
.s-opt i{flex:none;width:13px;height:13px;border:1.5px solid var(--mute);border-radius:3px}
.s-opt.radio i{border-radius:50%}
.s-btn{display:inline-block;background:var(--tile);color:var(--tile-ink);font-size:12px;font-weight:700;padding:0 16px;height:26px;line-height:26px;border-radius:6px}

/* 底部元信息和进度 */
.s-foot{position:absolute;left:32px;right:32px;top:330px;border-top:1px solid var(--off);padding-top:7px;display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--mute)}
.s-foot i{display:flex;gap:4px}.s-foot i b{width:20px;height:4px;border-radius:2px;background:var(--off)}.s-foot i b.on{background:var(--acc)}
.f.dark .s-foot{border-color:var(--dark-dot);color:var(--dark-mute)}.f.dark .s-foot i b{background:var(--dark-dot)}.f.dark .s-foot i b.on{background:var(--acc)}

/* 暂停遮罩 */
.f .pause{background:color-mix(in srgb,var(--bg) 80%,transparent);color:var(--ink);font-weight:700}
.f .pause .pi{color:var(--acc-line)}

/* 分镜墙：色系下拉框 */
.pal{position:absolute;right:28px;top:18px;font-size:13px}
.pal select{font:inherit;padding:2px 6px;margin-left:6px}
`

// 浏览器端：分镜墙右上角的色系下拉框；?palette=n1 也能直接打开某一套
const PICKER_JS = String.raw`(opts, def) => {
  const root = document.documentElement
  const want = new URLSearchParams(location.search).get('palette')
  const set = (id) => { root.dataset.palette = id }
  set(opts.some(([id]) => id === want) ? want : def)
  const top = document.querySelector('.top')
  const box = document.createElement('label'); box.className = 'pal'; box.textContent = '色系'
  const sel = document.createElement('select')
  for (const [id, name] of opts) { const o = document.createElement('option'); o.value = id; o.textContent = name; sel.appendChild(o) }
  sel.value = root.dataset.palette
  sel.addEventListener('change', () => { set(sel.value); const u = new URL(location.href); u.searchParams.set('palette', sel.value); history.replaceState(null, '', u) })
  box.appendChild(sel); top.appendChild(box)
}`
