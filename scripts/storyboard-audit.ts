// 分镜体检：npm run storyboard:audit -- 2-1 [--classic|--sticker|--desk|--paper|…] [--shots <目录>]
// 默认查质感版（主推）；其他风格查 storyboard/backup/ 里的备份分镜墙。先用 npm run storyboard 生成分镜墙，再跑本脚本。逐帧输出：
// - 时长：有播放器页面（docs/course/player/<id>/）就用实际配音时长，没有就用分镜墙上按字数估的时长；
// - 保留率：上一帧的元素（文字 + 类名 + 位置，按 8px 取整；状态类 new/on/hl/dim/off 不算）有多少还在原位；
// - 稳定率：两帧都有的元素（只比文字 + 类名）里，有多少没挪位置。
//   稳定率低于 60%（东西挪了），或保留率低于 30%（几乎整屏换掉），算"换版面"；
// - 出画布的元素、小于 12px 的文字（暂停遮罩和隐藏元素不算）。
// 每屏汇总版面数和换版面的帧。规则见 docs/course/visual-spec.md"分镜检查清单"。
// --shots 时另外输出每帧截图（<帧号>.png）和每屏一张联系表（sheet-<屏>.png）。
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { ROOT } from './lib/course'

const STAY = 0.6, KEEP = 0.3
const PAGES: Record<string, string> = { clean: 'index.html', classic: 'backup/classic.html', sticker: 'backup/sticker.html', desk: 'backup/desk.html' }

type Row = { id: string; keys: string[]; bad: string[]; est: string }

async function main() {
  const args = process.argv.slice(2)
  const si = args.indexOf('--shots')
  const shots = si >= 0 ? path.resolve(args[si + 1]) : ''
  const variant = ['clean', 'classic', 'sticker', 'desk', 'paper', 'sketch', 'board', 'board2', 'board2-xiaolai'].find((v) => args.includes('--' + v)) ?? 'clean'
  const id = args.find((a, i) => !a.startsWith('--') && i !== si + 1) ?? '2-1'
  const wall = variant === 'clean'
    ? path.join(ROOT, 'docs/course/storyboard', `${id}.clean.html`)
    : path.join(ROOT, 'docs/course/storyboard/backup', `${id}${variant === 'classic' ? '' : '.' + variant}.html`)
  if (!fs.existsSync(wall)) throw new Error(`找不到 ${path.relative(ROOT, wall)}，先运行 npm run storyboard -- ${id}${variant === 'clean' ? '' : ' --' + variant}`)

  // 实际时长：播放器页面里的 DATA
  const dur = new Map<string, number>()
  const page = PAGES[variant]
  const playerFile = page ? path.join(ROOT, 'docs/course/player', id, page) : ''
  if (playerFile && fs.existsSync(playerFile)) {
    const m = fs.readFileSync(playerFile, 'utf8').match(/const DATA = (\{.*?\});<\/script>/s)
    if (m) {
      const D = JSON.parse(m[1]) as { total: number; cards: { id: string; start: number }[] }
      D.cards.forEach((c, i) => dur.set(c.id, (D.cards[i + 1]?.start ?? D.total) - c.start))
    }
  }

  const browser = await chromium.launch()
  const p = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: shots ? 1.5 : 1 })
  await p.goto(pathToFileURL(wall).href)
  const rows: Row[] = await p.evaluate(async () => {
    // 缩略图恢复成 640×360 原尺寸再量；分镜墙的列宽也放宽，免得相邻两帧叠在一起
    document.querySelectorAll<HTMLElement>('.wall').forEach((w) => (w.style.gridTemplateColumns = 'repeat(auto-fill,minmax(660px,1fr))'))
    document.querySelectorAll<HTMLElement>('.thumb').forEach((t) => {
      t.style.width = '640px'; t.style.height = '360px'; (t.firstElementChild as HTMLElement).style.transform = 'none'
    })
    await document.fonts.ready
    return [...document.querySelectorAll<HTMLElement>('.sb')].map((sb) => {
      const id = sb.dataset.id!
      const f = sb.querySelector<HTMLElement>('.thumb:not(.lead) .f')!
      const fr = f.getBoundingClientRect()
      const keys: string[] = [], bad: string[] = []
      f.querySelectorAll<HTMLElement>('*').forEach((el) => {
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('.pause')) return
        const r = el.getBoundingClientRect()
        if (!r.width) return
        const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent!.trim()).join('')
        const cls = String(el.getAttribute('class') ?? '').replace(/\b(new|on|hl|dim|off)\b/g, '').replace(/\s+/g, ' ').trim()
        if (own || /\b(cell|ed|card|c-row|c-li|c-panel|qc|c-qp|inp|c-scr)\b/.test(cls))
          keys.push(`${own}|${cls}|${Math.round((r.left - fr.left) / 8)}|${Math.round((r.top - fr.top) / 8)}`)
        const short = el.textContent!.trim().slice(0, 12)
        if (own && parseFloat(cs.fontSize) < 12) bad.push(`字号 ${cs.fontSize} "${short}"`)
        if (r.right > fr.right + 0.5 || r.bottom > fr.bottom + 0.5 || r.left < fr.left - 0.5 || r.top < fr.top - 0.5) bad.push(`出画布 .${cls} "${short}"`)
      })
      return { id, keys, bad, est: sb.querySelector('.dur')?.textContent ?? '' }
    })
  })

  // 逐帧报告
  let prev: Row | undefined
  const screens = new Map<string, { frames: number; cuts: string[] }>()
  const problems: string[] = []
  for (const r of rows) {
    const sc = r.id.split('-')[0]
    const s = screens.get(sc) ?? { frames: 0, cuts: [] }
    s.frames++
    let keep = '—', stay = '—'
    if (prev && prev.id.split('-')[0] === sc) {
      const set = new Set(prev.keys)
      const k = r.keys.filter((x) => set.has(x)).length / Math.max(prev.keys.length, 1)
      // 稳定率：按"文字|类名"配对，看配上的有多少位置没变
      const name = (x: string) => x.split('|').slice(0, 2).join('|')
      const before = new Map<string, string[]>()
      for (const x of prev.keys) before.set(name(x), [...(before.get(name(x)) ?? []), x])
      let both = 0, same = 0
      for (const x of r.keys) {
        const cand = before.get(name(x))
        if (!cand?.length) continue
        both++
        const i = cand.indexOf(x)
        if (i >= 0) { same++; cand.splice(i, 1) } else cand.shift()
      }
      const st = both ? same / both : 0
      keep = `${Math.round(k * 100)}%`
      stay = both ? `${Math.round(st * 100)}%` : '—'
      if (st < STAY || k < KEEP) s.cuts.push(`${r.id}(保留${keep}/稳定${stay})`)
    }
    screens.set(sc, s)
    const t = dur.has(r.id) ? `${dur.get(r.id)!.toFixed(1)}秒` : r.est
    console.log(`${r.id}  ${t.padEnd(7)} 保留 ${keep.padStart(4)}  稳定 ${stay.padStart(4)}${r.bad.length ? '  ⚠ ' + r.bad.join('；') : ''}`)
    problems.push(...r.bad.map((b) => `${r.id} ${b}`))
    prev = r
  }
  console.log('\n每屏：')
  for (const [sc, s] of screens)
    console.log(`  第${sc}屏 ${s.frames} 帧，${s.cuts.length + 1} 种版面${s.cuts.length ? '，换版面：' + s.cuts.join(' ') : ''}`)
  console.log(problems.length ? `\n⚠ ${problems.length} 处出画布或字号过小` : '\n没有出画布的元素，没有小于 12px 的字')

  if (shots) {
    fs.mkdirSync(shots, { recursive: true })
    for (const sb of await p.$$('.sb')) {
      const fid = await sb.getAttribute('data-id')
      await (await sb.$('.thumb:not(.lead)'))!.screenshot({ path: path.join(shots, `${fid}.png`) })
    }
    // 联系表：每屏一张，3 列
    for (const sc of screens.keys()) {
      const ids = rows.filter((r) => r.id.split('-')[0] === sc).map((r) => r.id)
      const html = `<body style="margin:0;background:#ddd;display:grid;grid-template-columns:repeat(3,640px);gap:6px;padding:6px;width:max-content">${ids
        .map((fid) => {
          const png = fs.readFileSync(path.join(shots, fid + '.png')).toString('base64')
          return `<div style="position:relative"><img src="data:image/png;base64,${png}" style="width:640px;height:360px;display:block"><b style="position:absolute;left:6px;bottom:4px;color:#c00;font:16px sans-serif">${fid}</b></div>`
        })
        .join('')}</body>`
      const q = await browser.newPage({ viewport: { width: 1940, height: 400 } })
      await q.setContent(html)
      await q.screenshot({ path: path.join(shots, `sheet-${sc}.png`), fullPage: true })
      await q.close()
    }
    console.log(`截图和联系表：${shots}`)
  }
  await browser.close()
}

main()
