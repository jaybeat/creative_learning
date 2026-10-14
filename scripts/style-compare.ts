// 质感层对比页：npx tsx scripts/style-compare.ts 2-1
// 挑几拍，三栏并排：原版（<id>.frames.ts，和播放器里看到的一样）| 只换样式（同一帧 html 套 scripts/lib/clean.ts）|
// 样式 + 重排（<id>.clean.frames.ts）。页首放 Gauth 参考截图（docs/course/storyboard/ref/，不进仓库）。
// 输出 docs/course/storyboard/<id>.compare.html。原分镜墙、播放器都不受影响。
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT, esc, parseScript, FRAME_CSS, type Frame } from './lib/course'
import { cleanCss } from './lib/clean'
import type { DemoRow } from '../docs/course/storyboard/2-1.clean.frames'

/** 每一帧"改了什么"，按拍号 */
const NOTES: Record<number, string> = {
  6: '单个主体时，Gauth 的做法是左对齐、大留白；光标改蓝色细线，提示改成一行灰字。',
  28: '定义表左边行名、右边内容；c a t 画成分开的方块（逻辑画法，不暗示挨着放）；"长度 3"做成小徽章；问题卡缩成标题上方的小标签。',
  41: '没有先后的"一袋字符"用胶囊装进虚线袋子，和后面的格子分开：胶囊 = 只知道有哪些，格子 = 还知道先后。',
  42: '袋子换成分开的方块加浅灰箭头（只在讲前驱后继时画箭头）；cat 用浅蓝底标出，act、tca 变灰加划线（错误不用颜色）。',
  72: '两张卡各一个类别色标签，不再整块填橙；检查改成行内胶囊；没讲到的"个数有限"先留虚线空位。',
  77: '"练习 1 · 多选"小标签 + 宋体题干；选项改成"字母 | 内容"两列；"判断的办法"缩成三枚胶囊；检查/提示按钮。',
}

const REFS = [
  ['gauth-def.jpg', 'Gauth 定义表：左行名、右内容，结果逐行填进去'],
  ['gauth-cards.jpg', 'Gauth 两卡对比：类别色标签、胶囊元素、底部问号胶囊'],
  ['gauth-quiz.jpg', 'Gauth 练习：小标签 + 衬线题干 + 选项行 + 检查/提示'],
]

async function main() {
  const id = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? '2-1'
  const dir = path.join(ROOT, 'docs/course/storyboard')
  const { title, screens } = parseScript(path.join(ROOT, 'docs/course', `${id}.md`))
  const beats = new Map(screens.flatMap((s) => s.beats).map((b) => [b.n, b]))
  const { frames: orig } = (await import(pathToFileURL(path.join(dir, `${id}.frames.ts`)).href)) as { frames: Frame[] }
  const { frames: clean, compare, demo } = (await import(pathToFileURL(path.join(dir, `${id}.clean.frames.ts`)).href)) as {
    frames: Frame[]; compare: { beat: number; name: string }[]; demo?: DemoRow
  }

  const at = (fs: Frame[], n: number, what: string) => {
    const f = fs.find((f) => 'beat' in f && f.beat === n)
    if (!f) throw new Error(`${what}帧里没有从拍 ${n} 开始的帧`)
    return f.html
  }
  const rows = compare.map((c, k) => {
    const m = { ...c, html: at(clean, c.beat, '质感层') }
    const o = { html: at(orig, c.beat, '原版') }
    const b = beats.get(m.beat)
    if (!b) throw new Error(`双栏稿里没有拍 ${m.beat}`)
    return { m, o: o.html, b, tag: 'ABCDEFGH'[k] }
  })
  const { css, info } = await cleanCss([...rows.flatMap((r) => [r.o, r.m.html]), ...(demo?.cols.map((c) => c.html) ?? [])])

  const thumb = (html: string, cls: string) => `<div class="th ${cls}"><div class="f">${html}</div></div>`
  const body = rows
    .map(
      (r) => `<section class="cmp">
<h2>${r.tag} · 拍 ${r.m.beat}　${esc(r.m.name)}</h2>
<div class="cols">
  <figure><figcaption>原版</figcaption>${thumb(r.o, 'as-player')}</figure>
  <figure><figcaption>只换样式（帧不动）</figcaption><div class="th-clean">${thumb(r.o, 'anim')}</div></figure>
  <figure><figcaption>样式 + 重排</figcaption><div class="th-clean">${thumb(r.m.html, 'anim')}</div></figure>
</div>
<p class="vo"><span>旁白</span>${esc(r.b.text)}</p>
<p class="chg"><span>改了什么</span>${esc(NOTES[r.m.beat] ?? '')}</p>
</section>`,
    )
    .join('\n') +
    (demo
      ? `\n<section class="cmp">
<h2>${esc(demo.name)}</h2>
<div class="cols">${demo.cols.map((c) => `<figure><figcaption>${esc(c.cap)}</figcaption><div class="th-clean">${thumb(c.html, 'anim')}</div></figure>`).join('')}</div>
<p class="chg"><span>说明</span>${esc(demo.note)}</p>
</section>`
      : '')
  const refs = REFS.filter(([f]) => fs.existsSync(path.join(dir, 'ref', f)))
    .map(([f, cap]) => `<figure><img src="ref/${f}" alt=""><figcaption>${esc(cap)}</figcaption></figure>`)
    .join('')

  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>质感层对比 · ${esc(title)}</title>
<style>${PAGE_CSS}${FRAME_CSS}${css}</style></head><body>
<header class="top">
  <h1>质感层对比 · ${esc(title)}</h1>
  <div class="tg">
    <label><input type="checkbox" data-c="ink-black"> 正文改纯黑（默认 #1f1f1f）</label>
    <label><input type="checkbox" data-c="tuple-serif"> 元组改衬线斜体（默认更纱等宽）</label>
    <button id="play">▶ 播放入场</button>
  </div>
  <p class="hint">由 <code>docs/course/storyboard/${id}.frames.ts</code>、<code>${id}.clean.frames.ts</code> 和 <code>scripts/lib/clean.ts</code> 生成，不要手改。点画面放大。${esc(info)}</p>
</header>
${refs ? `<section class="refs"><h2>Gauth 参考（作者录屏截图）</h2><div class="rg">${refs}</div></section>` : ''}
${body}
<div id="modal" hidden><div class="mbox"></div></div>
<script>${PAGE_JS}</script>
</body></html>
`
  const out = path.join(dir, `${id}.compare.html`)
  fs.writeFileSync(out, html)
  console.log(`[style-compare] ${path.relative(ROOT, out)}：${rows.length} 帧，${info}`)
}

const PAGE_CSS = `
*{box-sizing:border-box}
body{margin:0;background:#faf8f4;font:14px/1.6 "Microsoft YaHei","PingFang SC",sans-serif;color:#222}
.top{padding:14px 28px;background:#fff;border-bottom:1px solid #e5e3de;position:sticky;top:0;z-index:5}
.top h1{margin:0 0 6px;font-size:19px}
.tg{display:flex;gap:18px;flex-wrap:wrap;align-items:center;font-size:13px}
.tg button{font:inherit;padding:3px 14px;border-radius:999px;border:1px solid #ccc;background:#fff;cursor:pointer}
.hint{color:#888;font-size:12px;margin:6px 0 0}
code{font-family:Consolas,monospace;background:#f1f1f1;padding:0 3px;border-radius:3px}
section{padding:6px 28px 18px}
h2{font-size:16px;margin:14px 0 8px}
.cols,.rg{display:flex;gap:14px;flex-wrap:wrap}
figure{margin:0}
figcaption{font-size:12px;color:#777;margin-bottom:4px}
.rg figure{width:calc(640px * var(--k));}
.rg img{width:100%;border-radius:8px;border:1px solid #e5e3de;display:block}
.rg figcaption{margin:4px 0 0}
.th{width:calc(640px * var(--k));height:calc(360px * var(--k));overflow:hidden;border-radius:8px;border:1px solid #e5e3de;cursor:zoom-in}
.th .f{transform:scale(var(--k));transform-origin:0 0}
.as-player .new,.cmp .th-clean .new{outline:none!important}
.cmp .th-clean .pause{display:none}
.as-player .f .pause{display:none}
.vo,.chg{margin:6px 0 0;font-size:13px;max-width:1200px}
.vo span,.chg span{display:inline-block;font-size:11px;color:#888;border:1px solid #ddd;border-radius:4px;padding:0 5px;margin-right:8px}
#modal{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:10;cursor:zoom-out}
#modal[hidden]{display:none}
.mbox .th{cursor:zoom-out;border:0}
`

// 缩略图按窗口宽度缩放（三栏放得下）；点开放大到窗口能放下的最大尺寸；播放入场：新元素 0.25 秒淡入、每个错开 0.15 秒
const PAGE_JS = `
const fit = () => document.documentElement.style.setProperty('--k', Math.min(1, (document.documentElement.clientWidth - 56 - 28 - 12) / 3 / 640).toFixed(4))
fit(); addEventListener('resize', fit)
document.querySelectorAll('.tg input').forEach((el) => el.addEventListener('change', () => document.body.classList.toggle(el.dataset.c, el.checked)))
const modal = document.getElementById('modal'), box = modal.querySelector('.mbox')
document.querySelectorAll('.th').forEach((el) => el.addEventListener('click', () => {
  const wrap = el.parentElement.classList.contains('th-clean') ? el.parentElement.cloneNode(true) : el.cloneNode(true)
  const k = Math.min((innerWidth - 40) / 640, (innerHeight - 40) / 360)
  box.innerHTML = ''; box.appendChild(wrap); box.style.setProperty('--k', k.toFixed(4)); modal.hidden = false
}))
modal.addEventListener('click', () => { modal.hidden = true })
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal.hidden = true })
document.getElementById('play').addEventListener('click', () => {
  document.querySelectorAll('.anim').forEach((th) => {
    const els = [...th.querySelectorAll('.new')]
    els.forEach((el) => { el.style.transition = 'none'; el.style.opacity = '0' })
    th.offsetWidth
    els.forEach((el, i) => { el.style.transition = 'opacity .25s linear ' + (0.4 + i * 0.15) + 's'; el.style.opacity = '' })
  })
})
`

main()
