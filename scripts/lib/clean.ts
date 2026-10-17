// 质感层（Gauth 式）：骨架用原版帧（<id>.frames.ts），只换样式。对比页 scripts/style-compare.ts 用它。
// 来源是 Gauth 录屏的取像素实测，换算到 640 画布，四条原理：
// 1. 字要黑、线要淡：正文接近黑，卡片线 1px、对比度约 1.2:1，胶囊线更淡；
// 2. 层级靠字体，不靠框：宋体标题 / 600 行名 / 400 正文 / 更纱等宽；
// 3. 颜色只做标签，不做色块：同色系"底浅字深"的小胶囊，从不整块填色；
// 4. 留白统一：几档固定间距，内容沿左边线对齐。
// 中文的调整：正文用 #1f1f1f 不用纯黑（汉字字面满，纯黑太重）；行名 600 不用 700；行高 1.6；
// 错误不用颜色（作者定的规则）：变灰加划线，不照搬 Gauth 的红叉。
// 所有选择器都挂在 .th-clean 下面，原版和质感层能放在同一页并排。颜色只写在 TOKENS 里。
import fs from 'node:fs'
import path from 'node:path'
import subsetFont from 'subset-font'
import { ROOT } from './course'
import { visibleText } from './sketch'
import { MONO, SANS, SERIF, TOKENS } from './clean-tokens'

const FONTS = {
  serif: { file: 'tools/fonts/NotoSerifSC-wght.ttf', note: '思源宋体 Noto Serif SC 可变字重（OFL，tools/fonts/OFL-NotoSerifSC.txt）' },
  sans: { file: 'tools/fonts/NotoSansSC-wght.ttf', note: '思源黑体 Noto Sans SC 可变字重（OFL，tools/fonts/OFL-NotoSansSC.txt）' },
  mono: { file: 'tools/fonts/SarasaFixedSC-Regular.ttf', note: '更纱等宽 Sarasa Fixed SC（OFL，tools/fonts/LICENSE-Sarasa.txt）' },
}

// 色值和字体栈在 clean-tokens.ts（网站外壳也用它们）
export { MONO, SANS, SERIF, TOKENS }

/**
 * 字体子集 + 令牌 + 质感层样式。more 是页面上另外要显示的文字（也进字体子集）。
 * 空位的样式（BLANK_CSS）只在用到时才带上：帧里有空位，或者 blanks（播放器里有填空练习）。没用到空位的节，输出和加空位之前逐字节一样
 */
export async function cleanCss(htmls: string[], more = '', o: { blanks?: boolean } = {}): Promise<{ css: string; info: string }> {
  for (const f of Object.values(FONTS)) if (!fs.existsSync(path.join(ROOT, f.file))) throw new Error(`找不到 ${f.file}（${f.note}）`)
  const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('')
  const chars = [...new Set(visibleText(htmls) + ascii + '问题练习多选单选检查提示·✓✗…≠→←↓₀₁₂ₙ₋−' + more)].join('')
  const read = (f: string) => fs.readFileSync(path.join(ROOT, f))
  // 可变字重整个保留（wght 轴）
  const serif = await subsetFont(read(FONTS.serif.file), chars, { targetFormat: 'woff2' })
  const sans = await subsetFont(read(FONTS.sans.file), chars, { targetFormat: 'woff2' })
  const mono = await subsetFont(read(FONTS.mono.file), chars, { targetFormat: 'woff2', noLayoutClosure: true })
  const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64')
  const face = (name: string, b: Uint8Array, w = '') =>
    `@font-face{font-family:"${name}";src:url(data:font/woff2;base64,${b64(b)}) format("woff2");font-display:block${w ? `;font-weight:${w}` : ''}}`
  const css = `
/* 字体子集：${FONTS.serif.note}；${FONTS.sans.note}；${FONTS.mono.note}。 */
${face('CleanSerif', serif, '200 900')}
${face('CleanSans', sans, '100 900')}
${face('CleanMono', mono)}
.th-clean{${Object.entries(TOKENS).map(([k, v]) => `${k}:${v}`).join(';')}}
${CLEAN_CSS}${o.blanks || htmls.some((h) => h.includes('c-blank')) ? BLANK_CSS : ''}`
  const kb = (b: Uint8Array) => (b.length / 1024).toFixed(0)
  return { css, info: `思源宋体 ${kb(serif)} KB + 思源黑体 ${kb(sans)} KB + 更纱 ${kb(mono)} KB（${[...chars].length} 字）` }
}

/** 分镜墙主题（npm run storyboard -- 2-1 --clean）：body 挂 .th-clean */
export async function cleanTheme(htmls: string[]): Promise<{ css: string; script: string; info: string; bodyClass: string }> {
  const { css, info } = await cleanCss(htmls)
  return { css, script: '', info, bodyClass: 'th-clean' }
}

/** 播放器外壳（--style clean）：把外壳用到的令牌对到质感层令牌上；body 是 .player.themed.st-clean.th-clean */
export const CLEAN_SHELL_CSS = `
body.st-clean{--sf:${SANS};--tf:${SERIF};--bg:var(--page);--acc:var(--ink-strong);--acc-soft:var(--c1-soft);--acc-line:var(--c1);
  --field:var(--paper);--field-line:var(--line);--wrong:var(--off);background:var(--page)}
body.st-clean .new{outline:none!important}
body.st-clean .f .new{translate:none!important}
body.st-clean main{max-width:1000px;padding:12px 20px 20px}
body.st-clean #scr{font-family:var(--sf);font-size:13px;font-weight:400;color:var(--ink)}
body.st-clean #time{color:var(--mute)}
body.st-clean .seg b{background:var(--track)}
body.st-clean .seg i{background:var(--ink-strong)}
body.st-clean .ib{color:var(--ink)}
body.st-clean .ib:hover{background:var(--btn)}
body.st-clean #capOn[aria-pressed=true]{background:var(--c1-soft);color:var(--c1)}
body.st-clean #toc{background:var(--paper);border-color:var(--line)}
body.st-clean #toc button:hover{background:var(--btn)}
body.st-clean #tip{background:var(--ink-strong);color:var(--paper)}
body.st-clean .wrap{background:var(--stage);border-radius:20px;box-shadow:none;border:1px solid var(--line-soft)}
body.st-clean .cover{background:color-mix(in srgb,var(--stage) 72%,transparent)}
body.st-clean .cover button{background:none;color:var(--mute);font-family:var(--sf);border:0;box-shadow:none;border-radius:0}
body.st-clean .cover .big{background:var(--ink-strong);color:var(--paper)}
body.st-clean #cap{color:var(--ink);font-family:var(--sf);font-size:17px}
body.st-clean .qbar button{border:1px solid var(--line);border-radius:10px}
body.st-clean .quiz{border:1px solid var(--line);border-radius:12px}
body.st-clean .quiz .qh{font-weight:700}
body.st-clean .qopt{border-radius:10px}
`

const C = '.th-clean'
const CLEAN_CSS = `
/* —— 质感层：覆盖 FRAME_CSS 的原版元素 —— */
${C} .f{background:var(--stage);color:var(--ink);font-family:${SANS};font-size:13px;line-height:1.6}
${C} .t{font-family:${SERIF};font-weight:700;font-size:19px;color:var(--ink-strong);top:14px;line-height:1.4}
/* 分镜墙审帧标记：这一帧新出现的元素（播放器和对比页里去掉） */
${C} .new{outline:1.5px dashed var(--caret)!important;outline-offset:3px}
${C} .note{color:var(--mute);font-size:12.5px}
${C} .mini{font-size:12px;color:var(--faint)}
${C} .dim{opacity:.4}
${C} .hl{background:var(--c1-soft)!important;color:var(--c1)}
${C} .tag{background:var(--paper);border:1px solid var(--line-soft);border-radius:999px;padding:1px 10px;font-size:12.5px;line-height:1.6}
${C} .tag.big{background:var(--c1-soft);color:var(--c1);border-color:transparent;font-weight:600;font-size:16px;padding:3px 14px}
${C} .ed{border:1px solid var(--line-cell);border-radius:8px;font-family:${MONO};background:var(--paper);color:var(--ink-strong);line-height:1.4}
${C} .ed.flash{box-shadow:0 0 0 3px var(--c1-soft)}
${C} .cur{color:var(--caret);font-weight:400}
${C} .inp{border:1px solid var(--line-cell);border-radius:999px;background:var(--paper);font-size:15px}
${C} .keys .key{border:1px solid var(--line-cell);border-bottom-width:2px;border-radius:6px;font-family:${MONO};background:var(--paper)}
${C} .cell{border:1px solid var(--line-cell);font-family:${MONO};background:var(--paper);color:var(--ink-strong);margin-left:-1px}
/* 格子分三层画法：默认是逻辑画法（分开的方块，只说谁在第几个）；.mem 是顺序表（共边连续，下面标地址）；链表用 .c-node */
${C} .cells .cell{margin:0 8px 0 0;border-radius:6px}
${C} .cells .cell:last-child,${C} .cells.gap .cell{margin-right:0}
${C} .cells.mem .cell{margin:0 0 0 -1px;border-radius:0}
${C} .cells.mem .cell:first-child{border-radius:6px 0 0 6px}
${C} .cells.mem .cell:last-child{border-radius:0 6px 6px 0}
${C} .cells.mem .ci{font-family:${MONO}}
${C} .ct{font-size:12px;color:var(--mute);font-family:${SANS};top:-21px}
${C} .ci{font-size:12px;color:var(--faint);font-family:${SANS};bottom:-21px}
${C} .arr{color:var(--faint);font-size:15px}
${C} .brace,${C} .counter{font-family:${MONO};color:var(--mute)}
${C} .dash{border:1px dashed var(--dash);border-radius:10px}
${C} .dl{color:var(--mute)}
${C} .okm{color:var(--ok)}
${C} .nom{color:var(--off)}
${C} .neq{color:var(--mute)}
${C} .bounce{border:1px dashed var(--dash);border-radius:999px;color:var(--off);text-decoration:line-through}
${C} .strike .ed{text-decoration:line-through;color:var(--off)}
/* 问题卡：大卡发丝框；角落小卡只留当前那一问，做成小标签 */
${C} .qc{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:8px 14px}
${C} .qc .qh{color:var(--warm);font-size:12px;font-weight:600}
${C} .qc li.on{background:var(--c1-soft);color:var(--c1);border-radius:4px}
${C} .qc li.ok{color:var(--ok)}
${C} .qc.corner{right:16px;top:16px;width:auto;max-width:300px;border:0;border-radius:999px;background:var(--warm-soft);color:var(--warm);padding:1px 10px;font-size:12px;font-weight:500}
${C} .qc.corner .qh{display:none}
${C} .qc.corner ol{margin:0;padding:0;list-style:none}
${C} .qc.corner li{display:none;margin:0;background:none;color:inherit}
${C} .qc.corner li.on{display:block}
${C} .qc.corner li:nth-child(1).on::before{content:"问题 1 · "}
${C} .qc.corner li:nth-child(2).on::before{content:"问题 2 · "}
${C} .qc.corner li:nth-child(3).on::before{content:"问题 3 · "}
/* 手风琴：1px 淡线，展开行不加深；行名 600；结果用等宽 */
${C} .row{border:1px solid var(--line);border-radius:10px;background:var(--paper);font-size:13px}
${C} .row .rn{font-weight:600}
${C} .row .rs{color:var(--mute);font-family:${MONO}}
${C} .row.open{border-color:var(--line)}
/* 卡片：1px 淡线；卡片标题变成类别色标签（例题的左右两张卡各一种颜色）；"正在讲的"卡只换线色，不填色 */
${C} .card{border:1px solid var(--line);border-radius:12px;background:var(--paper)}
${C} .card.hl{background:var(--paper)!important;border-color:var(--c1-line);color:var(--ink)}
${C} .card .ch{display:inline-block;font-weight:600;font-size:12.5px;padding:0 10px;border-radius:999px;background:var(--btn);margin-bottom:8px}
${C} .f>.abs:nth-child(2)>.card>.ch{background:var(--c1-soft);color:var(--c1)}
${C} .f>.abs:nth-child(3)>.card>.ch{background:var(--c2-soft);color:var(--c2)}
${C} .log .lr{border:1px solid var(--line-soft);border-radius:8px;background:var(--paper);font-size:12px}
${C} .log .la{color:var(--faint);font-size:12px;line-height:11px}
/* 检查行：一行一框改成行内胶囊加勾叉；错的那个变灰加划线 */
${C} .checks{display:flex;flex-wrap:wrap;gap:6px}
${C} .ck{margin:0;border:1px solid var(--line-soft);border-radius:999px;padding:0 10px;font-size:12px;background:var(--paper)}
${C} .ck:has(.nom){color:var(--off);text-decoration:line-through}
${C} .tree text{fill:var(--ink);font-family:${SANS}}
${C} .tree .nd{fill:var(--paper);stroke:var(--line-cell)}
${C} .tree line{stroke:var(--line-cell)}
${C} .tree .hl{background:none!important}
${C} .tree .hl line{stroke:var(--c1);stroke-width:1.5}
/* 练习卡 */
${C} .qz-h{display:inline-block;background:var(--warm-soft);color:var(--warm);border-radius:6px;padding:0 8px;font-size:12px;font-weight:600}
${C} .qz-s{font-size:13px;color:var(--ink);font-weight:500}
${C} .opt{border:1px solid var(--line);border-radius:10px;font-size:12.5px;background:var(--paper)}
${C} .btn{background:var(--btn);border-radius:999px;padding:1px 22px;font-size:12px}
${C} .pause{background:color-mix(in srgb,var(--stage) 82%,transparent);color:var(--warm);font-size:14px}

/* —— 重排版（<id>.clean.frames.ts）才用的元素，kit 里的 c* 函数 —— */
${C} .c-kick{display:inline-block;background:var(--warm-soft);color:var(--warm);border-radius:999px;padding:0 10px;font-size:12px;font-weight:500;line-height:1.7}
${C} .c-title{font-family:${SERIF};font-weight:700;font-size:19px;color:var(--ink-strong);line-height:1.4;white-space:nowrap}
${C} .c-q{font-family:${SERIF};font-weight:600;font-size:16px;color:var(--ink-strong);line-height:1.5}
${C} .c-chip{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--line-soft);border-radius:999px;padding:1px 11px;background:var(--paper);font-size:12.5px;line-height:1.7;margin:0 6px 6px 0}
${C} .c-chip.mono{font-family:${MONO};font-size:15px;color:var(--ink-strong);padding:2px 13px}
${C} .c-chip.off{color:var(--off);text-decoration:line-through}
${C} .c-label{display:inline-block;border-radius:999px;padding:0 10px;font-size:12.5px;font-weight:600;line-height:1.8}
${C} .c-label.c1{background:var(--c1-soft);color:var(--c1)}
${C} .c-label.c2{background:var(--c2-soft);color:var(--c2)}
${C} .c-badge{display:inline-block;border-radius:6px;padding:0 8px;font-size:12px;font-weight:600;background:var(--c1-soft);color:var(--c1);line-height:1.7}
${C} .c-slot{display:inline-block;border:1px dashed var(--dash);border-radius:8px;color:var(--faint);font-size:12px;padding:0 10px;line-height:1.8}
${C} .c-tbl{display:flex;flex-direction:column;gap:6px}
${C} .c-row{border:1px solid var(--line);border-radius:10px;background:var(--paper);display:flex;align-items:center;min-height:30px;padding:0 14px}
${C} .c-row .rn{font-weight:600;width:84px;flex:none}
${C} .c-row .rs{color:var(--mute);font-family:${MONO}}
${C} .c-row.open{align-items:flex-start;padding:10px 14px}
${C} .c-row.open .rn{padding-top:2px}
${C} .c-row.open>.rel{flex:1}
${C} .c-tuple{font-size:15px;color:var(--ink-strong)}
${C} .c-bag{display:inline-flex;border:1px dashed var(--dash);border-radius:14px;padding:5px 2px 0 8px}
${C} .cands-row{display:flex;gap:10px}
${C} .cands-row .ed{padding:0 8px;margin-right:4px}
${C} .qm{color:var(--faint);font-weight:500}
${C} .c-checks{position:absolute;left:14px;right:14px;bottom:8px}
${C} .c-tree{margin-top:8px}
${C} .card .log{margin-top:8px}
${C} .c-opts{display:grid;grid-template-columns:274px 274px;grid-auto-flow:column;grid-template-rows:repeat(4,30px);gap:6px 12px}
${C} .c-opt{display:flex;align-items:center;border:1px solid var(--line);border-radius:10px;background:var(--paper);height:30px;padding:0 12px;font-size:12.5px}
${C} .c-opt b{font-weight:500;color:var(--mute);width:16px;margin-right:10px;border-right:1px solid var(--line);flex:none}
${C} .c-btn{display:inline-block;background:var(--btn);color:var(--mute);border-radius:10px;padding:3px 0;width:160px;text-align:center;font-size:12.5px}
${C} .c-btn.ghost{background:var(--paper);border:1px solid var(--line-soft);width:auto;padding:3px 14px;color:var(--ink)}
${C} .c-cap{font-size:12.5px;color:var(--mute)}
${C} .c-down{color:var(--faint);font-size:12px;line-height:12px;text-align:center}
${C} .tuple{font-family:${MONO}}
${C} .c-brace{border:1px solid var(--faint);border-top:0;height:8px;border-radius:0 0 4px 4px;position:relative}
${C} .c-brace span{position:absolute;left:0;right:0;top:8px;text-align:center;font-size:12.5px;color:var(--mute)}
${C} .c-big{font-family:${SERIF};font-weight:700;font-size:26px;color:var(--ink-strong);margin-top:4px}
${C} .c-opts1{display:flex;flex-direction:column;gap:6px;width:560px}
${C} .c-tick{margin-left:auto}
${C} .card .pts{margin:8px 0}
${C} .gear{color:var(--mute)}
${C} .qc.big{width:380px;font-size:19px;padding:12px 18px}
${C} .qc.mid{width:200px}
${C} .c-node{display:inline-flex;border:1px solid var(--line-cell);border-radius:6px;background:var(--paper);font-family:${MONO};font-size:18px;color:var(--ink-strong);position:relative}
${C} .c-node span{width:38px;height:38px;display:flex;align-items:center;justify-content:center}
${C} .c-node span+span{width:48px;border-left:1px solid var(--line-cell);font-size:14px;color:var(--mute)}
${C} .c-node em{position:absolute;left:0;right:0;bottom:-21px;text-align:center;font-style:normal;font-size:12px;color:var(--faint)}
${C} .c-link{display:inline-block;width:34px;border-top:1.5px solid var(--faint);position:relative;vertical-align:middle;margin:0 2px}
${C} .c-link::after{content:"";position:absolute;right:-1px;top:-5px;border:4.5px solid transparent;border-left:7px solid var(--faint);border-right:0}
/* 第1屏左右两栏：左边五行要点（行高固定，讲到的行高亮），右边演示卡（位置固定，内容原位换） */
${C} .c-list{display:flex;flex-direction:column;gap:6px;width:196px}
${C} .c-li{height:44px;border:1px solid var(--line);border-radius:10px;background:var(--paper);padding:4px 12px;display:flex;flex-direction:column;justify-content:flex-start;position:relative}
${C} .c-li .rn{font-weight:600;font-size:13px;line-height:1.45}
${C} .c-li .rs{font-family:${MONO};font-size:12px;color:var(--mute);line-height:1.45;white-space:nowrap}
${C} .c-li.on{background:var(--c1-soft);border-color:transparent}
${C} .c-li.on .rn{color:var(--c1)}
${C} .c-li .c-tick{position:absolute;right:10px;top:10px;margin:0}
${C} .c-panel{width:348px;height:244px;border:1px solid var(--line);border-radius:12px;background:var(--paper);padding:12px 16px}
${C} .c-panel .ph{font-size:12px;font-weight:600;color:var(--mute)}
/* 第0屏：场景图（屏幕拼贴）、历史条、问题胶囊 */
${C} .c-scr{position:relative;width:280px;height:160px;border:1px solid var(--line-cell);border-radius:12px;background:var(--paper);overflow:hidden}
${C} .c-scr .bar{height:14px;border-bottom:1px solid var(--line);display:flex;gap:4px;align-items:center;padding-left:8px}
${C} .c-scr .bar i{width:6px;height:6px;border-radius:50%;background:var(--line-cell)}
${C} .c-scr .ui{position:absolute}
${C} .c-scr .in{border:1px solid var(--line-cell);border-radius:999px;padding:0 8px;font-size:12px;line-height:22px;height:24px;background:var(--paper);white-space:nowrap;color:var(--ink)}
${C} .c-scr .in.sq{border-radius:4px}
${C} .c-scr .pane{border:1px solid var(--line);border-radius:8px;background:var(--stage)}
${C} .c-scr .hd{font-size:12px;color:var(--mute);line-height:18px}
${C} .c-scr .bub{font-size:12px;line-height:20px;height:20px;padding:0 8px;border-radius:10px;background:var(--btn);white-space:nowrap}
${C} .c-scr .bub.me{background:var(--c1-soft);color:var(--c1)}
${C} .c-scr .doc{width:28px;height:36px;border:1px solid var(--line-cell);border-radius:2px 9px 2px 2px;background:var(--paper)}
/* 封面标题区：只用在封面屏，居中；其他屏一律左上 (40,16)/(40,44) */
${C} .c-cover{width:640px;text-align:center}
${C} .c-cover .c-kick{margin-bottom:4px}
${C} .c-sub{font-size:13px;color:var(--mute);margin-top:4px}
${C} .c-hist{display:flex;gap:6px}
${C} .c-hist .ed{min-width:0;padding:0 8px;margin:0;font-size:14px}
${C} .c-qp{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:999px;background:var(--paper);padding:2px 14px 2px 3px;font-size:14px;color:var(--ink);white-space:nowrap}
${C} .c-qp b{width:24px;height:24px;border-radius:50%;background:var(--btn);color:var(--mute);font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;margin-right:10px}
${C} .c-qp.on{background:var(--warm-soft);color:var(--warm);border-color:transparent}
${C} .c-qp.on b{background:var(--paper);color:var(--warm)}
/* 对比页开关：正文改纯黑、元组改衬线斜体（标题已定宋体） */
.ink-black ${C}{--ink:var(--ink-strong)}
.tuple-serif ${C} .tuple,.tuple-serif ${C} .row .rs,.tuple-serif ${C} .c-row .rs{font-family:${SERIF};font-style:italic}
`

/**
 * 空位（kit 的 cblank / cblanks，播放器的填空练习）：例题和练习同型，照 Gauth。
 * 灰底虚线框，填进去的是选项块（发丝框白底等宽字）；例题里老师按拍填，练习里学生填，看起来一样。
 * 练习检查后：错的空变灰加划线（不用红叉），对的换成蓝标签色；用过的选项块变灰。
 */
const BLANK_CSS = `
/* —— 空位：例题和填空练习共用 —— */
${C} .c-blank{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;box-sizing:border-box;min-width:64px;min-height:28px;margin:0 3px;padding:2px;border:1px dashed var(--line-cell);border-radius:10px;background:var(--btn);font:inherit;color:inherit}
${C} .c-fill{display:inline-block;border:1px solid var(--line-cell);border-radius:8px;background:var(--paper);padding:0 10px;font-family:${MONO};font-size:13px;line-height:22px;color:var(--ink-strong);white-space:nowrap}
${C} .c-steps{display:grid;grid-template-columns:auto auto auto;gap:6px 6px;align-items:center;justify-content:start}
${C} .c-steps .sa{font-size:12.5px;color:var(--ink);padding-right:6px;white-space:nowrap}
${C} .c-steps .c-blank{margin:0}
/* 填空练习（播放器）：空位可以点、可以拖进去 */
${C} .quiz.fq .qs{color:var(--ink)}
${C} .fq-b{cursor:pointer}
${C} .fq.locked .fq-b{cursor:default}
${C} .fq-b.is-picked{border-style:solid;border-color:var(--c1-line);background:var(--c1-soft)}
${C} .fq-b.is-wrong .c-fill{color:var(--off);text-decoration:line-through;border-color:var(--line-soft)}
${C} .fq-b.is-right .c-fill{background:var(--c1-soft);color:var(--c1);border-color:transparent}
${C} .fq-o{cursor:grab;font-size:13px}
${C} .fq-o:hover:not(:disabled){border-color:var(--c1-line)}
${C} .fq-o.picked{border-color:var(--c1);box-shadow:inset 0 0 0 1px var(--c1)}
${C} .fq-o:disabled{opacity:.35;cursor:default}
`
