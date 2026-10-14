// 由双栏稿生成配音和动画播放器：npx tsx scripts/course-player.ts 2-1 [--no-tts]
//
// 1. 配音：每拍一段 mp3（默认 fish s2.1-pro，COURSE_TTS=edge 换回云希；见 scripts/course_tts.py），多音字按 docs/course/pronounce.json 钉读音。
//    fish 一屏整段合成再切成每拍（语调连贯），按段缓存：段里旁白没改就不重新合成。
// 2. 时间轴：每拍音频时长 + 拍间停顿 + 练习暂停段，算出每拍、每帧的起止秒数。
// 3. 播放器：画面完全由时间 t 决定（render(t)），不用 CSS 过渡。网页里 t 跟着音频走；
//    以后导出视频时，逐帧调用 window.__seek(t) 截图，再和配音合成即可。
//
// 输出 docs/course/player/<id>/index.html（质感版，主推：<id>.clean.frames.ts，scripts/lib/clean.ts）和 audio/ 目录。
// 备份风格只在显式指定时生成，写到 player/<id>/backup/（页面加 <base href="../">，音频路径照用）：
//   --style desk    工作台版（<id>.desk.frames.ts，scripts/lib/desk.ts）
//   --style sticker 贴纸版（<id>.sticker.frames.ts，scripts/lib/sticker.ts，页面上可切色系）
//   --style classic 原版线框（<id>.frames.ts）
// 各套帧文件逐拍对应，配音和时间轴只算一次；原版帧文件始终提供练习题来源、读音表和帧位基准。
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { ROOT, md, parseScript, assemble, FRAME_CSS, type Beat, type Card, type Frame, type Screen } from './lib/course'
import { stickerCss } from './lib/sticker'
import { deskCss } from './lib/desk'
import { cleanCss, CLEAN_SHELL_CSS } from './lib/clean'
import { PALETTES, DEFAULT_PALETTE } from './lib/palettes'

type Style = 'desk' | 'sticker' | 'classic' | 'clean'
const STYLES: { style: Style; page: string; frames: string; label: string }[] = [
  { style: 'clean', page: 'index.html', frames: '.clean.frames.ts', label: '质感' },
  { style: 'desk', page: 'backup/desk.html', frames: '.desk.frames.ts', label: '工作台' },
  { style: 'sticker', page: 'backup/sticker.html', frames: '.sticker.frames.ts', label: '贴纸' },
  { style: 'classic', page: 'backup/classic.html', frames: '.frames.ts', label: '原版' },
]

// 配音引擎：fish（默认，s2.1-pro + 社区音色"科普"）或 edge（云希，离线兜底）
const ENGINE = process.env.COURSE_TTS ?? 'fish'
const MODEL = ENGINE === 'fish' ? (process.env.COURSE_MODEL ?? 's2.1-pro') : ''
const VOICE = process.env.COURSE_VOICE ?? (ENGINE === 'fish' ? '83bc284d2a3848c8a37f6d9a9ab11cd8' : 'zh-CN-YunxiNeural')
const RATE = process.env.COURSE_RATE ?? '+0%'
// fish 默认整段合成再切拍（同一屏语调连贯），COURSE_SPLIT=beat 改回逐拍合成
const BY_SCREEN = ENGINE === 'fish' && process.env.COURSE_SPLIT !== 'beat'

// 多音字词表：按"词"匹配（"一行"读 háng，"执行"读 xíng，不能按单字）。
// 条目写 py 就给 fish 加注音标签；写 say 就把送去合成的文字换成同音写法，任何引擎都管用。
type Pron = { word: string; py?: string; say?: string }
const PRON: Pron[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/course/pronounce.json'), 'utf8'))
const PRON_RE = PRON.length ? new RegExp([...PRON].sort((a, b) => b.word.length - a.word.length).map((p) => p.word).join('|'), 'g') : null
// 词表没覆盖时要提醒核对的常见多音字
const POLY = '行长重得数空还调处种'

function pronounce(text: string): { spoken: string; uncovered: string[] } {
  const covered = new Set<number>()
  const spoken = PRON_RE
    ? text.replace(PRON_RE, (w, at: number) => {
        for (let i = 0; i < w.length; i++) covered.add(at + i)
        const p = PRON.find((x) => x.word === w)!
        if (p.say) return p.say
        if (ENGINE !== 'fish' || !p.py) return w
        const py = p.py.split(/\s+/)
        if (py.length !== w.length) throw new Error(`pronounce.json：「${w}」的拼音个数和字数不一致`)
        return py.map((s) => `<|phoneme_start|>${s}<|phoneme_end|>`).join('')
      })
    : text
  const uncovered = [...text].flatMap((c, i) => (POLY.includes(c) && !covered.has(i) ? [text.slice(Math.max(0, i - 1), i + 2)] : []))
  return { spoken, uncovered }
}

// 停顿（秒）
const GAP_BEAT = 0.25 // 同一帧里的下一拍
const GAP_CARD = 0.45 // 换帧
const GAP_SCREEN = 0.9 // 换屏
// 练习暂停在视频里的时长（网页里停住等学生作答）：先倒计时"自己想想"，再揭晓答案，选项越多揭晓停得越久
const THINK = 5
const revealSecs = (q: { options: unknown[] }) => 4 + 0.8 * q.options.length

// ───────── 练习题：从书稿这一节的 ::: quiz 读 ─────────

type Quiz = { kind: 'single' | 'multi'; stem: string; options: { html: string; correct: boolean; why: string }[]; explain: string }

function parseQuizzes(file: string, section: string): Quiz[] {
  const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n')
  const start = lines.findIndex((l) => l.startsWith(`## ${section} `))
  if (start < 0) throw new Error(`${file} 里找不到 ## ${section}`)
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l))
  if (end < 0) end = lines.length
  const quizzes: Quiz[] = []
  for (let i = start; i < end; i++) {
    const m = /^:::\s*quiz(?:\s+(单选|多选))?\s*$/.exec(lines[i])
    if (!m) continue
    const stem: string[] = []
    const options: Quiz['options'] = []
    const explain: string[] = []
    let j = i + 1
    for (; j < end && !/^:::\s*$/.test(lines[j]); j++) {
      const l = lines[j]
      const opt = /^- \[([ xX])\]\s*(.*)$/.exec(l)
      if (opt) options.push({ html: md(opt[2]), correct: opt[1] !== ' ', why: '' })
      else if (/^\s{2,}\S/.test(l) && options.length && !explain.length) options.at(-1)!.why += md(l.trim())
      else if (l.trim() && !options.length) stem.push(md(l.trim()))
      else if (l.trim()) explain.push(md(l.trim()))
    }
    const kind = m[1] === '单选' ? 'single' : m[1] === '多选' ? 'multi' : options.filter((o) => o.correct).length > 1 ? 'multi' : 'single'
    quizzes.push({ kind, stem: stem.join('<br>'), options, explain: explain.join('<br>') })
    i = j
  }
  return quizzes
}

// ───────── 配音 ─────────

type AudioInfo = { file: string; dur: number }

function synthesize(id: string, screens: Screen[], say: Record<number, string>, skip: boolean): Map<number, AudioInfo> {
  const audioDir = path.join(ROOT, 'docs/course/player', id, 'audio')
  fs.mkdirSync(audioDir, { recursive: true })
  const manifestFile = path.join(audioDir, 'manifest.json')
  const manifest: Record<string, { hash: string; dur: number; text: string }> = fs.existsSync(manifestFile)
    ? JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
    : {}

  // 分段：fish 默认一屏一段（遇到练习暂停另起一段），整段一次合成再切拍；edge 或 COURSE_SPLIT=beat 时一拍一段
  const beats = screens.flatMap((s) => s.beats)
  const segments: Beat[][] = []
  for (const sc of screens) {
    const stops = new Set(sc.pauses.map((p) => p.after))
    let cur: Beat[] = []
    for (const b of sc.beats) {
      cur.push(b)
      if (stops.has(b.n) || !BY_SCREEN) (segments.push(cur), (cur = []))
    }
    if (cur.length) segments.push(cur)
  }

  type Job = { n: number; text: string; spoken: string; out: string }
  const jobs: { engine: string; model: string; voice: string; rate: string; hash: string; beats: Job[] }[] = []
  const unsure: string[] = []
  for (const seg of segments) {
    const parts = seg.map((b) => {
      const text = say[b.n] ?? b.text
      const { spoken, uncovered } = pronounce(text)
      if (uncovered.length) unsure.push(`  第${b.n}拍「${uncovered.join('、')}」：${text}`)
      const out = path.join(audioDir, `b${String(b.n).padStart(3, '0')}.mp3`).replace(/\\/g, '/')
      return { n: b.n, text, spoken, out }
    })
    // 一段共用一个哈希：段里任何一拍改了，整段重新合成，保证同段语调一致
    const hash = crypto
      .createHash('sha1')
      .update(`${ENGINE}|${MODEL}|${VOICE}|${RATE}|${BY_SCREEN}|${parts.map((p) => p.spoken).join('\u0001')}`)
      .digest('hex')
      .slice(0, 12)
    if (parts.every((p) => manifest[p.n]?.hash === hash && fs.existsSync(p.out))) continue
    jobs.push({ engine: ENGINE, model: MODEL, voice: VOICE, rate: RATE, hash, beats: parts })
  }

  if (jobs.length) {
    const count = jobs.reduce((k, j) => k + j.beats.length, 0)
    if (skip) throw new Error(`--no-tts，但有 ${count} 拍没有配音或旁白改过了`)
    if (unsure.length) console.log(`[player] 这些拍含多音字、词表没覆盖，请核对读音（词表：docs/course/pronounce.json）：\n${unsure.join('\n')}`)
    console.log(`[player] 合成 ${jobs.length} 段、${count} 拍配音（${ENGINE} ${MODEL} ${VOICE}${BY_SCREEN ? '，整段合成再切拍' : ''}）…`)
    const jobsFile = path.join(os.tmpdir(), `course-tts-${id}.json`)
    fs.writeFileSync(jobsFile, JSON.stringify(jobs))
    const r = spawnSync('python', ['-P', path.join(ROOT, 'scripts/course_tts.py'), jobsFile], { stdio: 'inherit' })
    if (r.status !== 0) throw new Error('配音合成失败')
    for (const j of jobs) for (const b of j.beats) manifest[b.n] = { hash: j.hash, dur: probeDuration(b.out), text: b.text }
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1))
  }

  const out = new Map<number, AudioInfo>()
  for (const b of beats) out.set(b.n, { file: `audio/b${String(b.n).padStart(3, '0')}.mp3`, dur: manifest[b.n].dur })
  return out
}

function probeDuration(file: string): number {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' })
  const d = parseFloat(r.stdout)
  if (!Number.isFinite(d)) throw new Error(`读不出时长：${file}`)
  return Math.round(d * 1000) / 1000
}

// ───────── 时间轴 ─────────

type Step =
  | { k: 'beat'; n: number; text: string; audio: string; start: number; dur: number; end: number; card: number }
  | { k: 'pause'; quiz: number; start: number; end: number; card: number; think: number }

function timeline(cards: Card[], audio: Map<number, AudioInfo>, quizzes: Quiz[]) {
  const steps: Step[] = []
  const cardStart: number[] = []
  let t = 0
  let quiz = 0
  cards.forEach((c, ci) => {
    const next = cards[ci + 1]
    cardStart.push(t)
    if (c.pause) {
      // end 取到下一段的开始，"继续"跳到 end 就正好离开暂停段
      const len = THINK + revealSecs(quizzes[quiz])
      steps.push({ k: 'pause', quiz: quiz++, start: t, end: t + len + GAP_BEAT, card: ci, think: THINK })
      t += len + GAP_BEAT
      return
    }
    c.beats.forEach((b, bi) => {
      const a = audio.get(b.n)!
      const last = bi === c.beats.length - 1
      const gap = !last ? GAP_BEAT : !next ? 1.2 : next.screen !== c.screen ? GAP_SCREEN : GAP_CARD
      steps.push({ k: 'beat', n: b.n, text: b.text, audio: a.file, start: t, dur: a.dur, end: t + a.dur + gap, card: ci })
      t += a.dur + gap
    })
  })
  return { steps, cardStart, total: t, quizCount: quiz }
}

// ───────── 页面 ─────────

function render(id: string, title: string, screens: Screen[], cards: Card[], tl: ReturnType<typeof timeline>, quizzes: Quiz[], style: Style, themeCss: string) {
  const data = {
    title,
    total: tl.total,
    steps: tl.steps,
    cards: cards.map((c, i) => ({
      id: c.id,
      html: c.html,
      screen: c.screen,
      reveal: c.reveal ?? null,
      start: tl.cardStart[i],
      // 这一帧旁白（不含停顿）的总长：spread 模式把新元素摊在这段时间里
      speak: tl.steps.filter((s) => s.card === i && s.k === 'beat').reduce((a, s) => a + (s as { dur: number }).dur, 0),
    })),
    screens: screens.map((s) => {
      const idx = cards.map((c, i) => (c.screen === s.n ? i : -1)).filter((i) => i >= 0)
      const start = tl.cardStart[idx[0]]
      const end = idx.at(-1)! + 1 < cards.length ? tl.cardStart[idx.at(-1)! + 1] : tl.total
      return { n: s.n, name: s.name, start, end }
    }),
    quizzes,
  }
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${style === 'clean' ? '' : '<base href="../">'}
<title>${title}</title>
<style>${FRAME_CSS}${PLAYER_CSS}${style === 'classic' ? '' : themeCss + SHELL_CSS}${style === 'clean' ? CLEAN_SHELL_CSS : ''}</style></head>
<body class="player${style === 'classic' ? '' : ' themed st-' + style}${style === 'clean' ? ' th-clean' : ''}">
<!-- 由 docs/course/${id}.md 和 docs/course/storyboard/${id}${STYLES.find((s) => s.style === style)!.frames} 生成，不要手改本文件。配音：${VOICE}。 -->
<main>
  <div class="bar">
    <span id="scr"></span>
    <div id="prog"></div>
    <div class="tools">
      <button id="play" class="ib" title="播放/暂停（空格）" aria-label="播放">${ICON.play}${ICON.pause}</button>
      <button id="speed" class="ib txt" title="倍速">1×</button>
      <button id="capOn" class="ib txt" title="字幕（C）" aria-pressed="true">字</button>
      <button id="menu" class="ib" title="目录" aria-expanded="false">${ICON.list}</button>${style === 'sticker' ? `
      <select id="pal" title="色系">${Object.entries(PALETTES).map(([k, p]) => `<option value="${k}"${k === DEFAULT_PALETTE ? ' selected' : ''}>${p.name}</option>`).join('')}</select>` : ''}
      <div id="toc" hidden></div>
    </div>
    <div id="tip" hidden></div>
  </div>
  <div class="wrap" id="wrap">
    <div class="stage" id="stage"></div>
    <div class="cover" id="cover"><button id="start"><span class="big">${ICON.play}</span><span id="startLabel"></span></button></div>
  </div>
  <p id="cap"></p>
</main>
<script>const DATA = ${json};</script>
<script>${PLAYER_JS}</script>
</body></html>
`
}

// 外壳图标：细线 SVG，颜色跟着 currentColor
const ICON = {
  play: '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8c0 .8.9 1.3 1.6.8l10-6.4c.6-.4.6-1.2 0-1.6l-10-6.4C8.9 4.3 8 4.8 8 5.6z" fill="currentColor"/></svg>',
  pause: '<svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5v13M15.5 5.5v13" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r=".9" fill="currentColor"/><circle cx="4.5" cy="12" r=".9" fill="currentColor"/><circle cx="4.5" cy="17.5" r=".9" fill="currentColor"/></svg>',
}

const PLAYER_CSS = `
body{margin:0;background:#eceae4;font:14px/1.5 "Microsoft YaHei","PingFang SC",sans-serif;color:#333}
main{max-width:980px;margin:0 auto;padding:16px}
.bar{display:flex;align-items:center;gap:18px;height:40px;margin-bottom:8px;position:relative}
#scr{flex:0 1 auto;max-width:32%;font-size:13px;color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#prog{flex:1;display:flex;gap:5px;align-items:center;height:16px}
.seg{flex:0 0 18px;height:4px;border-radius:2px;background:#ddd;position:relative;cursor:pointer;overflow:hidden}
.seg.cur{flex:1 1 auto}
.seg i{position:absolute;left:0;top:0;bottom:0;background:#222}
.tools{flex:none;display:flex;align-items:center;gap:2px;position:relative}
.ib{width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:#333;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;font:600 13px/1 inherit}
.ib:hover{background:rgba(0,0,0,.06)}
.ib svg{width:20px;height:20px}
.ib .i-pause,.ib.on .i-play{display:none}.ib.on .i-pause{display:block}
.ib.txt{width:auto;min-width:32px;padding:0 6px}
#capOn[aria-pressed=true]{background:#e4ecf6;color:#0e3061}
#toc{position:absolute;right:0;top:38px;z-index:30;background:#fff;border:1px solid #ddd;border-radius:12px;padding:6px;min-width:240px;box-shadow:0 10px 30px -10px rgba(0,0,0,.25)}
#toc[hidden],#tip[hidden]{display:none}
#toc button{display:flex;width:100%;justify-content:space-between;gap:18px;border:0;background:none;padding:7px 10px;border-radius:8px;font:13px/1.4 inherit;cursor:pointer;color:inherit;text-align:left}
#toc button:hover{background:rgba(0,0,0,.05)}#toc button.cur{font-weight:700}
#toc em{font-style:normal;opacity:.55;font-variant-numeric:tabular-nums}
#tip{position:absolute;top:34px;transform:translateX(-50%);background:#222;color:#fff;font-size:12px;line-height:1.5;padding:3px 9px;border-radius:6px;white-space:nowrap;pointer-events:none;z-index:31}
#pal{font:inherit;font-size:12px;margin-left:6px}
body.embed{background:transparent!important;overflow:hidden}
body.embed main{max-width:none!important;padding:0!important}
.wrap{position:relative;box-sizing:border-box;width:100%;aspect-ratio:16/9;background:#fafaf8;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.15)}
.stage{position:absolute;left:0;top:0;width:640px;height:360px;transform-origin:0 0}
.stage .f{position:absolute;left:0;top:0}
.player .new{outline:none!important}
.f .pause{display:none}
.cover{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(250,250,248,.85);z-index:20}
.cover[hidden]{display:none}
.cover button{display:flex;flex-direction:column;align-items:center;gap:12px;border:0;background:none;cursor:pointer;color:#555;font:14px/1.4 inherit;padding:0}
.cover .big{width:64px;height:64px;border-radius:50%;background:#222;color:#fff;display:flex;align-items:center;justify-content:center}
.cover .big svg{width:28px;height:28px;margin-left:3px}
#cap{min-height:3.2em;max-width:80%;margin:14px auto 0;font-size:17px;line-height:1.6;text-align:center;color:#222}
#cap.off{visibility:hidden}
.quiz{position:absolute;inset:12px;background:#fff;border:1.5px solid #bbb;border-radius:10px;padding:10px 16px;overflow:auto;font-size:13px;z-index:5}
.quiz .qh{font-weight:700;color:#1971c2}
.quiz .qs{margin:2px 0 6px;color:#444}
.qopt{display:block;width:100%;text-align:left;border:1px solid #ccc;border-radius:6px;padding:3px 10px;margin:3px 0;background:#fff;cursor:pointer;font:inherit;color:inherit}
.qopt.sel{border-color:#1971c2;background:#e7f5ff}
.qopt.right{border-color:#2b8a3e;background:#ebfbee}
.qopt.wrong{border-color:#c92a2a;background:#fff5f5}
.qopt .why{display:none;font-size:11px;color:#666}
.qopt.right .why,.qopt.wrong .why{display:block}
.qbar{display:flex;gap:8px;justify-content:flex-end;align-items:center;margin-top:6px}
.qbar .fb{margin-right:auto;font-weight:700}
.qbar .fb.ok{color:#2b8a3e}.qbar .fb.no{color:#c92a2a}
.qbar button{font:inherit;padding:2px 14px;border-radius:5px;border:1px solid #bbb;background:#f1f3f5;cursor:pointer}
.qbar button.go{background:#1971c2;color:#fff;border-color:#1971c2}
.qbar button:disabled{opacity:.4;cursor:default}
.qex{display:none;font-size:12px;color:#555;margin-top:4px}
.quiz.done .qex{display:block}
.export .qbar button{display:none}
.export .quiz{padding:8px 14px}
.export .qopt{padding:2px 10px;margin:2px 0}
.export .qopt.right .why{display:inline;margin-left:10px}
.export .think{margin-top:6px;padding:4px 12px}
.export .qex{margin-top:2px}
.think{margin-top:8px;padding:6px 12px;border-radius:8px;background:#fff3bf;color:#a06000;font-size:15px;text-align:center}
.think b{font-size:20px;margin-left:6px}
.think.ans{background:#ebfbee;color:#2b8a3e}
`

// 工作台版、贴纸版的页面外壳：只用色系令牌（var(--xxx)），跟着画面的风格走。
// 练习题也守"错误不用颜色"：答对是强调色边 + 浅强调底 + ✓；答错变灰、划线、灰 ✗。
const SHELL_CSS = `
/* —— 页面外壳（工作台 / 贴纸） —— */
body.themed{color:var(--ink);font:14px/1.5 var(--sf)}
body.st-desk{--sf:"DeskSans","Microsoft YaHei",sans-serif;--tf:"DeskHand","Microsoft YaHei",sans-serif;background:var(--bg)}
body.st-sticker{--sf:"StickerSans","Microsoft YaHei",sans-serif;--tf:"StickerSans","Microsoft YaHei",sans-serif;
  background:radial-gradient(circle at 2px 2px,var(--dot) 1px,transparent 1.5px) 0 0/16px 16px,var(--bg)}
.themed .bar{align-items:center;color:var(--mute);margin-bottom:10px}
.themed #scr{font-family:var(--tf);font-size:16px;color:var(--ink)}
.st-desk #scr{display:inline-block;background:var(--tape);padding:2px 12px;border:1.5px solid var(--ink);box-shadow:2px 3px 0 var(--shadow);transform:rotate(-1deg)}
.st-sticker #scr{font-weight:900}.st-sticker #scr::before{content:"";display:inline-block;width:9px;height:9px;margin-right:8px;background:var(--acc);vertical-align:1px}
.themed .seg{background:var(--off)}.themed .seg i{background:var(--acc)}
.st-desk .wrap{background:var(--bg);border:2px solid var(--ink);border-radius:10px;box-shadow:5px 6px 0 var(--shadow)}
.st-sticker .wrap{background:var(--bg);border:6px solid var(--paper);border-radius:16px;box-shadow:0 1px 1px rgb(0 0 0/.06),0 12px 28px -10px rgb(0 0 0/.3)}
.themed .cover{background:color-mix(in srgb,var(--bg) 82%,transparent)}
.themed .cover button{font-family:var(--tf);background:var(--ink);color:var(--paper);border-radius:12px}
.st-desk .cover button{border:2px solid var(--ink);box-shadow:3px 4px 0 var(--shadow)}
.st-sticker .cover button{background:var(--tile);color:var(--tile-ink);font-weight:900}
.themed #cap{color:var(--ink);font-family:var(--sf)}
.themed .ctl{flex-wrap:wrap;color:var(--mute)}
.themed .ctl button,.themed .ctl select,.themed .qbar button{background:var(--paper);color:var(--ink);font-family:var(--sf);cursor:pointer}
.st-desk .ctl button,.st-desk .ctl select,.st-desk .qbar button{border:1.5px solid var(--ink);border-radius:8px;box-shadow:2px 3px 0 var(--shadow)}
.st-sticker .ctl button,.st-sticker .ctl select,.st-sticker .qbar button{border:0;border-radius:10px;box-shadow:0 1px 1px rgb(0 0 0/.06),0 4px 10px -4px rgb(0 0 0/.25)}
.themed .ctl select{padding:3px 6px}
.themed .hint{color:var(--mute)}
.themed .hint code{background:var(--off);color:var(--ink)}
/* 练习题 */
.themed .quiz{background:var(--paper);color:var(--ink);font-family:var(--sf)}
.st-desk .quiz{border:1.8px solid var(--ink);border-radius:8px;box-shadow:3px 4px 0 var(--shadow)}
.st-sticker .quiz{border:0;border-radius:12px;box-shadow:0 1px 1px rgb(0 0 0/.06),0 8px 20px -6px rgb(0 0 0/.25)}
.themed .quiz .qh{font-family:var(--tf);font-size:16px;color:var(--ink)}
.st-sticker .quiz .qh{font-weight:900}
.themed .quiz .qs,.themed .qex,.themed .qopt .why{color:var(--mute)}
.themed .qopt{background:var(--field);border:1px solid var(--field-line);color:var(--ink)}
.st-sticker .qopt{border-color:var(--off)}
.themed .qopt.sel{border-color:var(--acc);background:var(--field);box-shadow:inset 0 0 0 1px var(--acc)}
.themed .qopt.right{border-color:var(--acc);background:var(--acc-soft)}
.themed .qopt.right::before{content:"✓ ";color:var(--acc-line);font-weight:700}
.themed .qopt.wrong{border-color:var(--off);background:var(--field);color:var(--wrong);text-decoration:line-through}
.themed .qopt.wrong::before{content:"✗ ";color:var(--wrong);font-weight:700}
/* 解析不跟着划线：行内块不继承父元素的删除线 */
.themed .qopt.wrong .why{display:inline-block;width:100%;color:var(--mute)}
.themed .qbar .fb.ok{color:var(--acc-line)}.themed .qbar .fb.no{color:var(--mute)}
.themed .qbar button.go{background:var(--ink);color:var(--paper)}
.st-sticker .qbar button.go{background:var(--tile);color:var(--tile-ink)}
.themed .think{background:var(--acc-soft);color:var(--acc-line)}
.st-desk .think{background:var(--sticky);color:var(--ink);border:1.5px solid var(--ink);border-radius:4px}
.themed .think.ans{background:var(--acc-soft);color:var(--acc-line)}
`

// 浏览器端：画面只由 t 决定（render），播放时 t 跟着音频走（tick），导出时用 __seek(t)。
const PLAYER_JS = String.raw`
const FADE = 0.3, POP = 0.45
const $ = (id) => document.getElementById(id)
const fmt = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0')
const stage = $('stage'), wrap = $('wrap')
const beats = DATA.steps.filter((s) => s.k === 'beat')
// 配音按需加载：一开始都不下载，播到哪一拍再预先拉取这一拍和后面两拍（手机流量友好；网站上一节有几十段配音）
const audios = new Map(beats.map((s) => { const a = new Audio(); a.preload = 'none'; a.dataset.src = s.audio; return [s.n, a] }))
function warm(n) {
  const i = beats.findIndex((s) => s.n === n)
  for (const s of beats.slice(Math.max(0, i), i + 3)) { const a = audios.get(s.n); if (!a.src) { a.src = a.dataset.src; a.preload = 'auto' } }
}

let t = 0, playing = false, speed = 1, curAudio = null, waitingQuiz = -1
const quizState = DATA.quizzes.map(() => ({ sel: new Set(), checked: false, shown: false }))

// —— 进度条：当前这一屏展开成长条，其余屏缩成短横（照 Gauth）；悬停显示屏名和时间 ——
const tip = $('tip')
const segAt = (s, el, e) => {
  if (!el.classList.contains('cur')) return s.start
  const r = el.getBoundingClientRect(); return s.start + (s.end - s.start) * Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
}
const segs = DATA.screens.map((s) => {
  const el = document.createElement('div'); el.className = 'seg'; el.innerHTML = '<i></i>'
  el.onclick = (e) => seek(segAt(s, el, e), true)
  el.onmousemove = (e) => {
    const bar = tip.parentElement.getBoundingClientRect()
    tip.textContent = s.name + '　' + fmt(segAt(s, el, e)) + ' / ' + fmt(DATA.total)
    tip.style.left = (e.clientX - bar.left) + 'px'; tip.hidden = false
  }
  el.onmouseleave = () => { tip.hidden = true }
  $('prog').appendChild(el); return el
})
// —— 目录：列出各屏，点哪屏跳到哪屏 ——
const toc = $('toc')
DATA.screens.forEach((s) => {
  const b = document.createElement('button')
  b.innerHTML = '<span>' + s.name + '</span><em>' + fmt(s.end - s.start) + '</em>'
  b.onclick = () => { toc.hidden = true; $('menu').setAttribute('aria-expanded', 'false'); $('cover').hidden = true; seek(s.start, true) }
  toc.appendChild(b)
})

// —— 画面层：每帧一个 .f，只在第一次用到时创建 ——
const layers = new Map()
function layer(ci) {
  if (layers.has(ci)) return layers.get(ci)
  const c = DATA.cards[ci]
  const el = document.createElement('div'); el.className = 'f'; el.innerHTML = c.html; el.style.display = 'none'
  stage.appendChild(el)
  const items = [...el.querySelectorAll('.new')]
  const span = c.reveal === 'spread' ? Math.max(0.6, c.speak * 0.85) : Math.min(0.6, 0.12 * items.length)
  const L = { el, items: items.map((node, i) => ({ node, at: items.length > 1 ? (span * i) / items.length : 0 })) }
  layers.set(ci, L); return L
}
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3))

function stepAt(time) {
  let lo = 0, hi = DATA.steps.length - 1
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (DATA.steps[mid].start <= time) lo = mid; else hi = mid - 1 }
  return lo
}

// —— 由时间算画面 ——
let shown = []
function render(time) {
  const sig = []
  const si = stepAt(time), step = DATA.steps[si], ci = step.card, local = time - DATA.cards[ci].start
  const vis = [ci]; if (ci > 0 && local < FADE) vis.push(ci - 1)
  for (const k of shown) if (!vis.includes(k)) layers.get(k).el.style.display = 'none'
  shown = vis
  const cur = layer(ci)
  cur.el.style.display = ''; cur.el.style.opacity = ci > 0 ? String(ease(local / FADE)) : '1'; cur.el.style.zIndex = '2'
  for (const it of cur.items) {
    const e = ease((local - it.at) / POP)
    sig.push(e.toFixed(3)); it.node.style.opacity = String(e); it.node.style.translate = e < 1 ? '0 ' + ((1 - e) * 8).toFixed(1) + 'px' : ''
  }
  sig.unshift(ci, cur.el.style.opacity)
  if (vis.length > 1) { const p = layer(ci - 1); sig.push('p'); p.el.style.display = ''; p.el.style.opacity = String(1 - ease(local / FADE)); p.el.style.zIndex = '1' }

  // 练习题
  const q = step.k === 'pause' ? step.quiz : -1
  if (q !== quizShown) showQuiz(q)
  if (exportMode && q >= 0) sig.push('q' + q, videoQuiz(step, time - step.start))

  // 字幕、进度、标题
  $('cap').textContent = step.k === 'beat' ? step.text : ''
  const sc = DATA.screens.find((s) => time >= s.start && time < s.end) || DATA.screens.at(-1)
  $('scr').textContent = $('scr').title = sc.name
  DATA.screens.forEach((s, i) => {
    segs[i].classList.toggle('cur', s === sc)
    segs[i].firstChild.style.width = Math.max(0, Math.min(1, (time - s.start) / (s.end - s.start))) * 100 + '%'
  })
  toc.querySelectorAll('button').forEach((b, i) => b.classList.toggle('cur', DATA.screens[i] === sc))
  return sig.join(',')
}

// 视频里的练习题：先倒计时"自己想想"，再揭晓正确选项和解析。返回这一刻的状态，供导出时判断画面变没变
let exportMode = false
function videoQuiz(step, local) {
  const Q = DATA.quizzes[step.quiz], left = Math.ceil(step.think - local), revealed = left <= 0
  let think = quizEl.querySelector('.think')
  if (!think) { think = document.createElement('div'); think.className = 'think'; quizEl.appendChild(think) }
  think.innerHTML = revealed ? '✓ 答案' : '⏸ 暂停一下，自己想想　<b>' + left + '</b>'
  think.classList.toggle('ans', revealed)
  quizEl.querySelectorAll('.qopt').forEach((b, i) => b.classList.toggle('right', revealed && Q.options[i].correct))
  quizEl.classList.toggle('done', revealed)
  return revealed ? 'r' : String(left)
}

// —— 练习题（网页里可作答；导出视频时只显示题面）——
let quizShown = -1, quizEl = null
function showQuiz(q) {
  quizShown = q
  if (quizEl) { quizEl.remove(); quizEl = null }
  if (q < 0) return
  const Q = DATA.quizzes[q], st = quizState[q]
  quizEl = document.createElement('div'); quizEl.className = 'quiz'
  const n = DATA.steps.filter((s) => s.k === 'pause').findIndex((s) => s.quiz === q) + 1
  quizEl.innerHTML = '<div class="qh">练习' + n + '　' + (Q.kind === 'multi' ? '多选' : '单选') + '</div><div class="qs">' + Q.stem + '</div>' +
    Q.options.map((o, i) => '<button class="qopt" data-i="' + i + '">' + o.html + '<div class="why">' + o.why + '</div></button>').join('') +
    '<div class="qex">' + Q.explain + '</div>' +
    '<div class="qbar"><span class="fb"></span><button class="ck">检查</button><button class="ans">看答案</button><button class="go">继续 ▶</button></div>'
  stage.appendChild(quizEl)
  const opts = [...quizEl.querySelectorAll('.qopt')], fb = quizEl.querySelector('.fb'), ck = quizEl.querySelector('.ck')
  const paint = () => {
    opts.forEach((b, i) => { b.classList.toggle('sel', st.sel.has(i) && !st.checked) })
    ck.disabled = st.sel.size === 0
    ck.textContent = st.checked && !st.right ? '再试一次' : '检查'
  }
  opts.forEach((b, i) => b.onclick = () => {
    if (st.checked) return
    if (Q.kind === 'single') st.sel = new Set([i]); else st.sel.has(i) ? st.sel.delete(i) : st.sel.add(i)
    paint()
  })
  ck.onclick = () => {
    if (st.checked) { st.checked = false; opts.forEach((b) => b.classList.remove('right', 'wrong')); fb.textContent = ''; st.sel.clear(); paint(); return }
    st.checked = true
    const wrong = [...st.sel].filter((i) => !Q.options[i].correct)
    const miss = Q.options.filter((o, i) => o.correct && !st.sel.has(i)).length
    st.right = wrong.length === 0 && miss === 0
    if (st.right) { reveal(); fb.textContent = '答对了。'; fb.className = 'fb ok' }
    else {
      wrong.forEach((i) => opts[i].classList.add('wrong'))
      fb.textContent = Q.kind === 'multi' ? '选错了 ' + wrong.length + ' 个' + (miss ? '，还有漏选的' : '') : '不对，再想想。'
      fb.className = 'fb no'
    }
    paint()
  }
  const reveal = () => { Q.options.forEach((o, i) => { if (o.correct) opts[i].classList.add('right') }); quizEl.classList.add('done') }
  quizEl.querySelector('.ans').onclick = () => { st.checked = true; st.right = true; reveal(); fb.textContent = ''; paint() }
  quizEl.querySelector('.go').onclick = () => { const s = DATA.steps.find((x) => x.k === 'pause' && x.quiz === q); waitingQuiz = -1; seek(s.end, playing) }
  paint()
}

// —— 播放：t 跟着音频走 ——
function stopAudio() { if (curAudio) { curAudio.pause(); curAudio = null } }
let last = 0
function tick(now) {
  const dt = last ? (now - last) / 1000 : 0; last = now
  if (playing) {
    const step = DATA.steps[stepAt(t)]
    if (step.k === 'pause') {
      stopAudio(); t = step.start; waitingQuiz = step.quiz
    } else {
      const a = audios.get(step.n), local = t - step.start
      if (curAudio !== a) { stopAudio(); warm(step.n); if (local < step.dur) { curAudio = a; a.currentTime = local; a.playbackRate = speed; a.play().catch(() => {}) } }
      // 以音频为准：服务器不支持分段请求时，中途跳转会从这一拍开头放起，画面也跟着回到拍首
      if (curAudio === a && !a.paused && !a.ended) { const at = step.start + a.currentTime; if (at > t || t - at > 0.3) t = at }
      else t += dt * speed
      if (t >= DATA.total) { t = DATA.total - 0.001; setPlaying(false); $('cover').hidden = false; $('startLabel').textContent = '↻ 重新播放'; if (window.__onEnded) window.__onEnded() }
    }
    render(t)
  }
  requestAnimationFrame(tick)
}
function setPlaying(p) { playing = p; $('play').classList.toggle('on', p); $('play').setAttribute('aria-label', p ? '暂停' : '播放'); if (!p) stopAudio() }
function seek(time, keepPlaying) {
  stopAudio(); t = Math.max(0, Math.min(DATA.total - 0.001, time)); render(t)
  if (keepPlaying !== undefined) setPlaying(keepPlaying)
}
function jumpBeat(dir) {
  const i = beats.findIndex((s) => s.start > t + 0.001)
  const cur = (i < 0 ? beats.length : i) - 1
  let k = dir > 0 ? cur + 1 : (cur >= 0 && t - beats[cur].start > 1 ? cur : cur - 1)
  k = Math.max(0, Math.min(beats.length - 1, k)); seek(beats[k].start, playing)
}

$('start').onclick = () => { $('cover').hidden = true; if (t >= DATA.total - 0.01) t = 0; setPlaying(true) }
$('play').onclick = () => { $('cover').hidden = true; setPlaying(!playing) }
// 倍速：点一下换下一档
const SPEEDS = [0.8, 1, 1.25, 1.5]
$('speed').onclick = () => {
  speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; $('speed').textContent = speed + '×'
  if (curAudio) curAudio.playbackRate = speed
}
const toggleCap = () => {
  const on = $('capOn').getAttribute('aria-pressed') !== 'true'
  $('capOn').setAttribute('aria-pressed', String(on)); $('cap').classList.toggle('off', !on)
}
$('capOn').onclick = toggleCap
$('menu').onclick = (e) => { e.stopPropagation(); toc.hidden = !toc.hidden; $('menu').setAttribute('aria-expanded', String(!toc.hidden)) }
document.addEventListener('click', (e) => { if (!toc.hidden && !toc.contains(e.target)) { toc.hidden = true; $('menu').setAttribute('aria-expanded', 'false') } })
$('startLabel').textContent = '开始播放 · ' + fmt(DATA.total)
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return
  if (e.key === ' ') { e.preventDefault(); $('cover').hidden = true; setPlaying(!playing) }
  else if (e.key === 'ArrowLeft') jumpBeat(-1)
  else if (e.key === 'ArrowRight') jumpBeat(1)
  else if (e.key === 'c' || e.key === 'C') toggleCap()
  else if (e.key === 'Escape') { toc.hidden = true; $('menu').setAttribute('aria-expanded', 'false') }
})

// —— 画布缩放 ——
const fit = () => { stage.style.transform = 'scale(' + wrap.clientWidth / 640 + ')' }
new ResizeObserver(fit).observe(wrap); fit()

// —— 导出视频用：给定秒数，画出那一刻（不放声音）——
window.__duration = DATA.total
window.__seek = (time) => { exportMode = true; document.body.classList.add('export'); $('cover').hidden = true; setPlaying(false); t = time; return render(time) }

// —— 风格切换：带上当前秒数，到新页面接着放 ——
document.querySelectorAll('.sty a').forEach((a) => a.onclick = (e) => { e.preventDefault(); location.href = a.getAttribute('href') + '?t=' + t.toFixed(2) })
// —— 贴纸版的色系（记在 localStorage）——
const pal = $('pal')
if (pal) {
  const set = (v) => { document.documentElement.dataset.palette = v; pal.value = v }
  const saved = localStorage.getItem('course-palette'); if (saved && [...pal.options].some((o) => o.value === saved)) set(saved)
  pal.onchange = () => { set(pal.value); localStorage.setItem('course-palette', pal.value) }
}

const params = new URLSearchParams(location.search)
const t0 = parseFloat(params.get('t'))
if (t0 > 0 && t0 < DATA.total) { t = t0; $('startLabel').textContent = '接着播放 · ' + fmt(t) + ' / ' + fmt(DATA.total) }
// —— 嵌入网站节页（?embed）：背景透明、去掉外边距；把页面高度、播完这两件事告诉外层页面 ——
if (params.has('embed') && window.parent !== window) {
  document.body.classList.add('embed')
  const post = (msg) => window.parent.postMessage(Object.assign({ source: 'ds-course' }, msg), '*')
  // 量 main 的实际高度（body 被 iframe 撑满，量它只会越来越高）
  const main = document.querySelector('main')
  new ResizeObserver(() => post({ type: 'height', h: Math.ceil(main.getBoundingClientRect().height) })).observe(main)
  window.__onEnded = () => post({ type: 'ended' })
}
render(t); requestAnimationFrame(tick)
`

async function main() {
  const id = process.argv[2] ?? '2-1'
  const skipTts = process.argv.includes('--no-tts')
  const { title, screens } = parseScript(path.join(ROOT, 'docs/course', `${id}.md`))
  const si = process.argv.indexOf('--style')
  // 不指定风格时只生成质感版；备份风格要显式写 --style
  const only = si >= 0 ? process.argv[si + 1] : 'clean'
  if (only && !STYLES.some((s) => s.style === only)) throw new Error(`没有风格 ${only}，可选：${STYLES.map((s) => s.style).join(' ')}`)
  type Mod = { frames: Frame[]; quizSource?: { file: string; section: string }; say?: Record<number, string> }
  const load = async (frames: string) => (await import(pathToFileURL(path.join(ROOT, 'docs/course/storyboard', `${id}${frames}`)).href)) as Mod
  // 原版帧文件提供练习题来源和读音表；另外两套逐拍对应，卡片序列必须和它一模一样
  const mod = await load('.frames.ts')
  const { cards, errors } = assemble(screens, mod.frames)
  if (errors.length) throw new Error(`帧和双栏稿对不上：\n  ${errors.join('\n  ')}`)
  const sig = (cs: Card[]) => cs.map((c) => `${c.id}:${c.beats.map((b) => b.n).join(',')}${c.pause ? 'P' : ''}`).join(' ')
  const pages: { style: Style; page: string; cards: Card[] }[] = []
  for (const s of STYLES) {
    if (only && s.style !== only) continue
    if (s.style === 'classic') { pages.push({ style: s.style, page: s.page, cards }); continue }
    const r = assemble(screens, (await load(s.frames)).frames)
    if (r.errors.length) throw new Error(`${s.frames} 和双栏稿对不上：\n  ${r.errors.join('\n  ')}`)
    if (sig(r.cards) !== sig(cards)) throw new Error(`${s.frames} 的帧位和原版 ${id}.frames.ts 不一致`)
    pages.push({ style: s.style, page: s.page, cards: r.cards })
  }

  const quizzes = mod.quizSource ? parseQuizzes(mod.quizSource.file, mod.quizSource.section) : []
  const pauses = cards.filter((c) => c.pause).length
  if (quizzes.length !== pauses) throw new Error(`双栏稿有 ${pauses} 处暂停，书稿这一节有 ${quizzes.length} 道练习题，对不上`)

  const audio = synthesize(id, screens, mod.say ?? {}, skipTts)
  const tl = timeline(cards, audio, quizzes)
  const outDir = path.join(ROOT, 'docs/course/player', id)
  // 页面上除了画面还要显示的字：字幕、练习题、按钮，都要进主题的字体子集
  const strip = (h: string) => h.replace(/<[^>]*>/g, '')
  const more = screens.flatMap((s) => s.beats.map((b) => b.text)).join('') + title + screens.map((s) => s.name).join('') +
    quizzes.map((q) => strip(q.stem + q.explain + q.options.map((o) => o.html + o.why).join(''))).join('') +
    '第屏练习多选单选检查看答案继续再试一次答对了不对再想想选错了个还有漏选的暂停一下自己想想答案开始播放接着播放重新播放倍速字幕色系工作台贴纸原版质感由和生成不要手改本文件配音：⏮⏭⏸▶↻✓✗'
  for (const p of pages) {
    const htmls = p.cards.map((c) => c.html)
    const themeCss = p.style === 'desk' ? (await deskCss(htmls, more)).css : p.style === 'sticker' ? (await stickerCss(htmls, DEFAULT_PALETTE, more)).css : p.style === 'clean' ? (await cleanCss(htmls, more)).css : ''
    fs.mkdirSync(path.dirname(path.join(outDir, p.page)), { recursive: true })
    fs.writeFileSync(path.join(outDir, p.page), render(id, title, screens, p.cards, tl, quizzes, p.style, themeCss))
  }
  const speak = tl.steps.reduce((a, s) => a + (s.k === 'beat' ? s.dur : 0), 0)
  console.log(
    `[player] ${path.relative(ROOT, outDir)}${path.sep}{${pages.map((p) => p.page).join(',')}}：${tl.steps.length} 段（${pauses} 处练习暂停），` +
      `配音 ${Math.floor(speak / 60)}分${Math.round(speak % 60)}秒，时间轴共 ${Math.floor(tl.total / 60)}分${Math.round(tl.total % 60)}秒`,
  )
}

main().catch((e) => {
  console.error(`[player] ${e.message}`)
  process.exit(1)
})
