// 由双栏稿生成分镜墙：npx tsx scripts/storyboard.ts 2-1
// 默认生成质感版（主推）：读 docs/course/<id>.md（旁白、来源、画面说明）和 docs/course/storyboard/<id>.clean.frames.ts，
// 输出自包含的 docs/course/storyboard/<id>.clean.html（scripts/lib/clean.ts，Gauth 式；--clean 同义）。旁白只从双栏稿取，改稿后重新生成即可。
// 下面这些是备份风格，输出到 docs/course/storyboard/backup/（不进仓库）：
// --classic 读 <id>.frames.ts 输出原版线框 <id>.html，
// --sketch 输出手绘版 <id>.sketch.html（scripts/lib/sketch.ts），--board 输出白板版 <id>.board.html（scripts/lib/board.ts），
// --board2 / --board2-xiaolai 输出按 docs/course/visual-spec.md 修订的白板版（中文分别用漫黑、小赖），
// --paper 读 <id>.paper.frames.ts 输出纸面版 <id>.paper.html（scripts/lib/paper.ts），
// --sticker 读 <id>.sticker.frames.ts 输出贴纸版 <id>.sticker.html（scripts/lib/sticker.ts，--palette p0|p1|p3|n1|z1|m2 选默认色系），
// --desk 读 <id>.desk.frames.ts 输出工作台版 <id>.desk.html（scripts/lib/desk.ts，色系 w1）。
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { sketchTheme } from './lib/sketch'
import { boardTheme } from './lib/board'
import { paperTheme } from './lib/paper'
import { stickerTheme } from './lib/sticker'
import { deskTheme } from './lib/desk'
import { cleanTheme } from './lib/clean'
import { ROOT, CHARS_PER_SEC, esc, md, parseScript, assemble, secs, fmt, FRAME_CSS, type Screen, type Card, type Frame } from './lib/course'

function render(id: string, title: string, screens: Screen[], cards: Card[], theme?: { css: string; script: string; bodyClass?: string }, framesName = `${id}.frames.ts`): string {
  const all = screens.flatMap((s) => s.beats)
  const count = (t: string) => all.filter((b) => b.src === t).length
  const pct = (t: string) => Math.round((count(t) / all.length) * 100)
  const total = secs(all)

  const cardHtml = (c: Card) => {
    const range = c.pause ? '暂停' : c.beats.length === 1 ? `拍 ${c.beats[0].n}` : `拍 ${c.beats[0].n}–${c.beats.at(-1)!.n}`
    const lines = c.beats
      .map((b) => `<li><span class="src s-${b.src}">${b.src}</span><span class="bn">${b.n}</span>${esc(b.text)}</li>`)
      .join('')
    // 纸面版帧可以自带画面说明（pic）、暗场（dark）和前半拍暗场（lead）；原版帧没有这些字段，输出不变
    const pic = c.pic !== undefined ? md(c.pic) : c.pause ? md(c.pause) : md(c.beats[0].pic)
    const lead = c.lead !== undefined ? `<div class="thumb lead"><div class="f dark">${c.lead}</div></div>` : ''
    return `<article class="sb${c.pause ? ' is-pause' : ''}" data-id="${c.id}">
  <header><b class="fid">${c.id}</b><span>${range}</span><span class="dur">${c.pause ? '⏸' : '≈' + fmt(secs(c.beats))}</span></header>
  ${lead}<div class="thumb"><div class="f${c.dark ? ' dark' : ''}">${c.html}</div></div>
  <p class="pic">${pic}</p>
  <ol class="vo">${lines}</ol>
</article>`
  }

  const sections = screens
    .map((sc) => {
      const cs = cards.filter((c) => c.screen === sc.n)
      return `<section><h2>第${sc.n}屏　${esc(sc.name)}<small>${sc.beats.length} 拍 · ${cs.length} 帧 · ≈${fmt(secs(sc.beats))}</small></h2>
<div class="wall">${cs.map(cardHtml).join('\n')}</div></section>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>分镜墙 · ${esc(title)}</title>
<style>${CSS}${theme?.css ?? ''}</style></head><body${theme?.bodyClass ? ` class="${theme.bodyClass}"` : ''}>
<header class="top"><h1>分镜墙 · ${esc(title)}</h1>
<p>${all.length} 拍 · ${cards.length} 帧 · 旁白 ≈${fmt(total)}（按每秒 ${CHARS_PER_SEC} 字估算，不含暂停）　|　原样 ${count('原样')}（${pct('原样')}%）· 小改 ${count('小改')}（${pct('小改')}%）· 新写 ${count('新写')}（${pct('新写')}%）</p>
<p class="hint">由 <code>docs/course/${id}.md</code> 和 <code>docs/course/storyboard/${framesName}</code> 生成，不要手改本文件。橙色描边 = 这一帧新出现或刚变化的元素。点卡片放大。</p></header>
${sections}
<div id="modal" hidden><div class="mbox"></div></div>
<script>
const modal = document.getElementById('modal'), box = modal.querySelector('.mbox')
document.querySelectorAll('.sb').forEach((el) => el.addEventListener('click', () => {
  box.innerHTML = el.innerHTML; modal.hidden = false
}))
modal.addEventListener('click', () => { modal.hidden = true })
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal.hidden = true })
</script>
${theme ? theme.script + '\n' : ''}</body></html>
`
}

const CSS = `
*{box-sizing:border-box}
body{margin:0;background:#eceae4;font:14px/1.5 "Microsoft YaHei","PingFang SC",sans-serif;color:#333}
.top{padding:16px 28px;background:#fff;border-bottom:1px solid #ddd;position:sticky;top:0;z-index:5}
.top h1{margin:0 0 4px;font-size:20px}.top p{margin:2px 0}.hint{color:#888;font-size:12px}
section{padding:8px 28px 20px}
h2{font-size:17px;margin:14px 0 10px}h2 small{font-weight:400;color:#888;margin-left:12px;font-size:13px}
.wall{display:grid;grid-template-columns:repeat(auto-fill,minmax(336px,1fr));gap:14px}
.sb{background:#fff;border-radius:8px;padding:8px;box-shadow:0 1px 3px rgba(0,0,0,.12);cursor:zoom-in}
.sb header{display:flex;gap:10px;align-items:baseline;font-size:12px;color:#666;margin-bottom:6px}
.fid{font-size:15px;color:#222}.dur{margin-left:auto}
.is-pause{background:#fff8e6}
.thumb{width:320px;height:180px;overflow:hidden;border-radius:4px;border:1px solid #ddd}
.thumb .f{transform:scale(.5);transform-origin:0 0}
.pic{font-size:12px;color:#888;margin:6px 0 4px}
.vo{list-style:none;margin:0;padding:0;font-size:13px}.vo li{margin:2px 0}
.bn{color:#aaa;font-size:11px;margin-right:4px}
.src{display:inline-block;font-size:10px;padding:0 4px;border-radius:3px;margin-right:4px;vertical-align:1px}
.s-原样{background:#e6f4ea;color:#2b8a3e}.s-小改{background:#fff3bf;color:#a06000}.s-新写{background:#ffe3e3;color:#c92a2a}
code{font-family:Consolas,monospace;background:#f1f1f1;padding:0 3px;border-radius:3px}
#modal{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:10}
#modal[hidden]{display:none}
.mbox{background:#fff;border-radius:10px;padding:16px;width:840px;max-height:94vh;overflow:auto;cursor:zoom-out}
.mbox .thumb{width:800px;height:450px}.mbox .thumb .f{transform:scale(1.25)}
.mbox .vo{font-size:16px}.mbox header{font-size:14px}

` + FRAME_CSS

async function main() {
  const args = process.argv.slice(2)
  const VARIANTS = ['board2-xiaolai', 'board2', 'board', 'sketch', 'paper', 'sticker', 'desk', 'clean', 'classic']
  const picked = VARIANTS.find((v) => args.includes('--' + v)) ?? 'clean'
  // 原版线框没有主题，文件名不带后缀
  const variant = picked === 'classic' ? '' : picked
  const pi = args.indexOf('--palette')
  const palette = pi >= 0 ? args[pi + 1] : undefined
  const id = args.find((a, i) => !a.startsWith('--') && i !== pi + 1) ?? '2-1'
  const scriptFile = path.join(ROOT, 'docs/course', `${id}.md`)
  // 纸面版、贴纸版有自己的帧文件，和原帧逐拍对应
  const framesFile = path.join(ROOT, 'docs/course/storyboard', `${id}${variant === 'paper' || variant === 'sticker' || variant === 'desk' || variant === 'clean' ? '.' + variant : ''}.frames.ts`)
  // 质感版放主目录，备份风格放 backup/
  const outDir = path.join(ROOT, 'docs/course/storyboard', variant === 'clean' ? '' : 'backup')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, `${id}${variant ? '.' + variant : ''}.html`)
  const { title, screens } = parseScript(scriptFile)
  const { frames } = (await import(pathToFileURL(framesFile).href)) as { frames: Frame[] }
  const { cards, errors } = assemble(screens, frames)
  if (errors.length) {
    console.error(`[storyboard] ${errors.length} 处对不上：\n  ` + errors.join('\n  '))
    process.exit(1)
  }
  const htmls = cards.flatMap((c) => (c.lead !== undefined ? [c.lead, c.html] : [c.html]))
  const theme =
    variant === 'paper' ? await paperTheme(htmls) :
    variant === 'sticker' ? await stickerTheme(htmls, palette) :
    variant === 'clean' ? await cleanTheme(htmls) :
    variant === 'desk' ? await deskTheme(htmls, cards.map((c) => c.beats[0]?.text ?? '')) :
    variant === 'board' ? await boardTheme(htmls)
    : variant === 'board2' ? await boardTheme(htmls, { latin: 'excalifont', cjk: 'marker', spec: true })
    : variant === 'board2-xiaolai' ? await boardTheme(htmls, { latin: 'excalifont', cjk: 'xiaolai', spec: true })
    : variant === 'sketch' ? await sketchTheme(htmls)
    : undefined
  fs.writeFileSync(outFile, render(id, title, screens, cards, theme, path.basename(framesFile)))
  const beats = screens.flatMap((s) => s.beats)
  console.log(`[storyboard] ${path.relative(ROOT, outFile)}：${beats.length} 拍，${cards.length} 帧，旁白 ≈${fmt(secs(beats))}${theme ? '，' + theme.info : ''}`)
}

main()
