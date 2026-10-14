// 分镜墙的工作台主题：npm run storyboard -- 2-1 --desk（读 docs/course/storyboard/<id>.desk.frames.ts）
// 参考视频"一晚上做出 Clawd 动画"里定风格、分镜软木板、代码卡三段：纸墙 + 陶土桌面，内容都是纸做的东西，
// 微抖深棕描边 + 实色错位阴影，红色只给手画圈和勾。每帧是 kit 里 dframe() 生成的一整张 SVG，
// 这里只管字体、色系令牌（w1，scripts/lib/palettes.ts）和分镜墙上叠的字幕层；颜色只写 var()。
import fs from 'node:fs'
import path from 'node:path'
import subsetFont from 'subset-font'
import { ROOT } from './course'
import { visibleText } from './sketch'
import { paletteCss } from './palettes'

const FONTS = {
  hand: { file: 'tools/fonts/LXGWMarkerGothic-Regular.ttf', note: '霞鹜漫黑 LXGW Marker Gothic（OFL，tools/fonts/OFL-LXGWMarkerGothic.txt）' },
  sans: { file: 'tools/fonts/NotoSansSC-wght.ttf', note: '思源黑体 Noto Sans SC 可变字重（OFL，tools/fonts/OFL-NotoSansSC.txt）' },
  mono: { file: 'tools/fonts/SarasaFixedSC-Regular.ttf', note: '更纱等宽 Sarasa Fixed SC（OFL，tools/fonts/LICENSE-Sarasa.txt）' },
}

/** subs 是分镜墙上要叠的字幕文字（每帧第一拍的旁白），也要进字体子集 */
export async function deskTheme(htmls: string[], subs: string[] = []): Promise<{ css: string; script: string; info: string }> {
  const { css, info } = await deskCss(htmls, subs.join(''))
  return { css, script: `<script>(${SUB_JS})()</script>`, info }
}

/** 字体子集 + 色系令牌（w1）+ 工作台样式；分镜墙和播放器共用。more 是页面上另外要显示的文字，也要进字体子集 */
export async function deskCss(htmls: string[], more = ''): Promise<{ css: string; info: string }> {
  for (const f of Object.values(FONTS)) if (!fs.existsSync(path.join(ROOT, f.file))) throw new Error(`找不到 ${f.file}（${f.note}）`)
  const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('')
  const chars = [...new Set(visibleText(htmls) + more + ascii + '⏸✓✗…≠→←⌫₀₁ₙ₋−·')].join('')
  const read = (f: string) => fs.readFileSync(path.join(ROOT, f))
  const hand = await subsetFont(read(FONTS.hand.file), chars, { targetFormat: 'woff2' })
  const sans = await subsetFont(read(FONTS.sans.file), chars, { targetFormat: 'woff2' })
  const mono = await subsetFont(read(FONTS.mono.file), chars, { targetFormat: 'woff2', noLayoutClosure: true })
  const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64')
  const face = (name: string, b: Uint8Array, w = '') =>
    `@font-face{font-family:"${name}";src:url(data:font/woff2;base64,${b64(b)}) format("woff2");font-display:block${w ? `;font-weight:${w}` : ''}}`
  const css = `
/* 字体子集：${FONTS.hand.note}；${FONTS.sans.note}；${FONTS.mono.note}。 */
${face('DeskHand', hand)}
${face('DeskSans', sans, '100 900')}
${face('DeskMono', mono)}
/* 色系令牌（工作台版固定用 w1） */
${paletteCss('w1')}
${DESK_CSS}`
  const kb = (b: Uint8Array) => (b.length / 1024).toFixed(0)
  return { css, info: `色系 w1，漫黑 ${kb(hand)} KB + 思源黑体 ${kb(sans)} KB + 更纱 ${kb(mono)} KB（${[...chars].length} 字）` }
}

const HAND = `"DeskHand","Microsoft YaHei",sans-serif`
const SANS = `"DeskSans","Microsoft YaHei",sans-serif`
const MONO = `"DeskMono",Consolas,monospace`

const DESK_CSS = `
/* —— 工作台主题（覆盖 FRAME_CSS） —— */
.f{background:var(--bg)}
.f .dk{position:absolute;left:0;top:0;display:block}
.dk .dh{font-family:${HAND}}
.dk .ds{font-family:${SANS}}
.dk .dm{font-family:${MONO}}
/* 分镜墙审帧标记（只在墙上画，不属于画面）：新出现的元素描一圈紫边 */
.f .new{outline:none!important}
.thumb .f .new{filter:drop-shadow(0 0 1.2px var(--ptr)) drop-shadow(0 0 1.2px var(--ptr))}
/* 字幕层：分镜墙上取这一帧第一拍的旁白；导出视频时由字幕轨负责，不画在帧里 */
.dsub{position:absolute;left:50%;top:314px;transform:translateX(-50%);max-width:600px;padding:5px 16px;border-radius:8px;
  background:var(--sub-bg);opacity:.92;color:var(--dark-ink);font:500 16px/22px ${SANS};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* 暂停遮罩 */
.f .pause{background:color-mix(in srgb,var(--bg) 78%,transparent);color:var(--ink);font-family:${HAND};z-index:2}
.f .pause .pi{color:var(--acc)}
`

// 浏览器端：给每张分镜卡的画面叠一条字幕（第一拍的旁白）
const SUB_JS = String.raw`() => {
  for (const sb of document.querySelectorAll('.sb')) {
    const li = sb.querySelector('.vo li')
    const f = sb.querySelector('.thumb:not(.lead) .f')
    if (!li || !f) continue
    const d = document.createElement('div'); d.className = 'dsub'; d.textContent = li.lastChild.textContent.trim()
    f.appendChild(d)
  }
}`
