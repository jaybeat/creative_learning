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
import { parseQuizzes, type Quiz } from './lib/course-quiz'
import { ROOT, parseScript, assemble, FRAME_CSS, type Beat, type Card, type Frame, type Screen } from './lib/course'
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
      // 字幕用纯文字：双栏稿里的反引号、加粗记号不显示
      steps.push({ k: 'beat', n: b.n, text: b.text.replace(/`|\*\*/g, ''), audio: a.file, start: t, dur: a.dur, end: t + a.dur + gap, card: ci })
      t += a.dur + gap
    })
  })
  return { steps, cardStart, total: t, quizCount: quiz }
}

// ───────── 练习卡：帧里画的卡就是作答界面（质感版） ─────────

/** 去掉标签、解开转义、去掉空白，用来比帧里的选项和书稿的选项 */
const plain = (h: string) =>
  h.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, '')

/**
 * 第 k 个暂停帧配第 k 道题。卡上要有 data-quiz、按钮条、解析位；
 * 选择题：选项个数和书稿一样，按顺序对应（帧里的选项字可以缩写，开头几个字要和书稿一样）；
 * 填空题：空位个数等于答案个数，选项块的字和书稿的选项一一对上（顺序可以不同），给每个选项块写上 data-qi
 */
function wireQuizzes(cards: Card[], quizzes: Quiz[]): Card[] {
  let k = 0
  return cards.map((c) => {
    if (!c.pause) return c
    const Q = quizzes[k++], where = `第 ${k} 道练习（帧 ${c.id}）`
    for (const a of ['data-quiz', 'data-qbar', 'data-ex']) if (!c.html.includes(a)) throw new Error(`${where}：练习卡上没有 ${a}，要用 kit 的 cquiz / cqbar / cqex 画`)
    if (Q.kind !== 'fill') {
      const opts = [...c.html.matchAll(/data-opt="(\d+)"><b>[^<]*<\/b>([\s\S]*?)<\/div>/g)]
      if (opts.length !== Q.options.length) throw new Error(`${where}：卡上 ${opts.length} 个选项，书稿 ${Q.options.length} 个`)
      opts.forEach((m, i) => {
        const f = plain(m[2]), b = plain(Q.options[i].html)
        if (Number(m[1]) !== i || !b.startsWith(f.slice(0, Math.min(4, f.length)))) throw new Error(`${where}：卡上第 ${i + 1} 个选项「${f}」和书稿「${b}」对不上`)
      })
      return c
    }
    const blanks = c.html.match(/data-blank/g)?.length ?? 0
    if (blanks !== Q.answers.length) throw new Error(`${where}：卡上 ${blanks} 个空位，书稿 ${Q.answers.length} 个空`)
    const left = Q.options.map((o, i) => ({ t: plain(o), i }))
    const html = c.html.replace(/<span class="c-chip" data-chip>([\s\S]*?)<\/span>/g, (all, s: string) => {
      const j = left.findIndex((o) => o.t === plain(s))
      if (j < 0) throw new Error(`${where}：卡上的选项块「${plain(s)}」书稿里没有（书稿：${Q.options.join('、')}）`)
      const [{ i }] = left.splice(j, 1)
      return `<span class="c-chip" data-chip data-qi="${i}">${s}</span>`
    })
    if (left.length) throw new Error(`${where}：书稿的选项「${left.map((o) => o.t).join('、')}」卡上没有`)
    return { ...c, html }
  })
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
    // 质感版：暂停时在帧里画的练习卡上直接作答（wireQuizzes 已核对过），不盖题卡
    inplace: style === 'clean',
  }
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${style === 'clean' ? '' : '<base href="../">'}
<title>${title}</title>
<style>${FRAME_CSS}${PLAYER_CSS}${style === 'classic' ? '' : themeCss + SHELL_CSS}${style === 'clean' ? CLEAN_SHELL_CSS : ''}</style></head>
<body class="player${style === 'classic' ? '' : ' themed st-' + style}${style === 'clean' ? ' th-clean' : ''}">
<!-- 由 docs/course/${id}.md 和 docs/course/storyboard/${id}${STYLES.find((s) => s.style === style)!.frames} 生成，不要手改本文件。配音：${VOICE}。 -->
<main>
  <div class="wrap" id="wrap">
    <div class="stage" id="stage"></div>
    <div class="cover" id="cover"><button id="start"><span class="big">${ICON.play}</span><span id="startLabel"></span></button></div>
  </div>
  <p id="cap"></p>
  <div class="dock" id="dock">
    <div id="prog"></div>
    <div class="bar">
      <button id="exit" class="ib emb" title="退出动画，回到本章（Esc）" aria-label="退出">${ICON.close}</button>
      <button id="play" class="ib" title="播放/暂停（空格）" aria-label="播放">${ICON.play}${ICON.pause}</button>
      <span id="time"></span>
      <div class="nav">
        <button id="menu" class="ib txt" title="目录：看全部屏、点哪屏跳哪屏" aria-expanded="false">${ICON.list}<span id="scr"></span><span class="caret">▾</span></button>
        <div id="toc" hidden></div>
      </div>
      <button id="next" class="ib txt" title="跳到下一屏">下一屏 ›</button>
      <div class="tools">
        <button id="speed" class="ib txt" title="倍速">1×</button>
        <button id="capOn" class="ib txt" title="字幕（C）" aria-pressed="true">字</button>
        <button id="ask" class="ib txt emb" title="边看边问：右侧打开问 AI 面板（动画会暂停）">问 AI</button>
        <button id="toText" class="ib txt emb" title="改读文字详细版">读文字</button>
        <button id="fs" class="ib" title="全屏（F）" aria-label="全屏" hidden>${ICON.fsOn}${ICON.fsOff}</button>${style === 'sticker' ? `
        <select id="pal" title="色系">${Object.entries(PALETTES).map(([k, p]) => `<option value="${k}"${k === DEFAULT_PALETTE ? ' selected' : ''}>${p.name}</option>`).join('')}</select>` : ''}
      </div>
    </div>
    <div id="tip" hidden></div>
  </div>
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
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  fsOn: '<svg class="i-fs-on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  fsOff: '<svg class="i-fs-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r=".9" fill="currentColor"/><circle cx="4.5" cy="12" r=".9" fill="currentColor"/><circle cx="4.5" cy="17.5" r=".9" fill="currentColor"/></svg>',
}

const PLAYER_CSS = `
body{margin:0;background:#eceae4;font:14px/1.5 "Microsoft YaHei","PingFang SC",sans-serif;color:#333}
main{max-width:980px;margin:0 auto;padding:16px}
/* 底部控制区（照抖音/B站）：上面一条按每屏时长分段的进度线，下面一行按钮 */
.dock{position:relative;margin-top:6px}
.bar{display:flex;align-items:center;gap:10px;height:40px}
#time{flex:none;font-size:13px;color:#666;font-variant-numeric:tabular-nums}
/* 屏名就是目录按钮（照 YouTube 章节名）：☰ 屏名 ▾，点开从左下往上弹出全部屏 */
.nav{flex:0 1 auto;min-width:0;position:relative}
#menu{max-width:100%;gap:6px;padding:0 8px 0 6px;font-weight:400}
#scr{min-width:0;font-size:13px;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.caret{flex:none;font-size:10px;opacity:.55}
#next{flex:none;font-weight:400}
#next[hidden]{display:none}
#prog{display:flex;gap:3px;align-items:center;height:16px}
.seg{min-width:6px;height:16px;display:flex;align-items:center;cursor:pointer}
.seg b{display:block;position:relative;width:100%;height:4px;border-radius:2px;background:#ddd;overflow:hidden;transition:height .12s}
#prog:hover .seg b{height:6px}
.seg i{position:absolute;left:0;top:0;bottom:0;background:#222}
.tools{flex:none;display:flex;align-items:center;gap:2px;position:relative;margin-left:auto}
.ib{width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:#333;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;font:600 13px/1 inherit}
.ib:hover{background:rgba(0,0,0,.06)}
.ib svg{width:20px;height:20px}
.ib .i-pause,.ib.on .i-play{display:none}.ib.on .i-pause{display:block}
.ib.txt{width:auto;min-width:32px;padding:0 6px}
#capOn[aria-pressed=true]{background:#e4ecf6;color:#0e3061}
/* 目录从屏名按钮向上弹出：开始时间 + 屏名，当前屏加粗带"▶" */
#toc{position:absolute;left:0;bottom:38px;z-index:30;background:#fff;border:1px solid #ddd;border-radius:12px;padding:6px;min-width:260px;max-width:min(420px,90vw);max-height:60vh;overflow:auto;box-shadow:0 -10px 30px -10px rgba(0,0,0,.25)}
#toc[hidden],#tip[hidden]{display:none}
#toc button{display:flex;width:100%;gap:12px;border:0;background:none;padding:7px 10px;border-radius:8px;font:13px/1.4 inherit;cursor:pointer;color:inherit;text-align:left}
#toc button:hover{background:rgba(0,0,0,.05)}#toc button.cur{font-weight:700}
#toc em{flex:none;width:3em;font-style:normal;opacity:.55;font-variant-numeric:tabular-nums}
#toc button.cur em{opacity:1}
#toc button.cur em::before{content:"▶ ";font-size:9px;vertical-align:1px}
#tip{position:absolute;top:-30px;transform:translateX(-50%);background:#222;color:#fff;font-size:12px;line-height:1.5;padding:3px 9px;border-radius:6px;white-space:nowrap;pointer-events:none;z-index:31}
#pal{font:inherit;font-size:12px;margin-left:6px}
/* 嵌入网站节页：全屏学习层（网站 CourseSwitch.vue 把 iframe 铺满视口）。左上角 ×，中间舞台 + 字幕，底部控制区贴着视口下沿；舞台按宽高两个方向缩放（fit） */
.emb{display:none!important}
body.embed .emb{display:inline-flex!important}
body.embed{background:transparent!important;overflow:hidden}
body.embed.th-clean{background:var(--page)!important}
body.embed main{max-width:none!important;box-sizing:border-box;height:100vh;height:100dvh;display:flex;flex-direction:column;padding:12px 24px 6px!important}
body.embed .wrap{flex:none;margin:auto auto 0}
body.embed #cap{flex:none;margin:14px auto auto}
body.embed .dock{flex:none;box-sizing:border-box;margin-left:auto;margin-right:auto;max-width:100%}
#fs .i-fs-off,body.fs #fs .i-fs-on{display:none}body.fs #fs .i-fs-off{display:block}
#fs[hidden]{display:none}
/* 真全屏（浏览器全屏接口）：四周不留白，控制区叠在画面底边上（bottom 由 fitWrap 算），播放时鼠标不动 2.5 秒就淡出；字幕仍在画面下方，不被压住 */
body.fs main{max-width:none!important;box-sizing:border-box;height:100vh;display:flex;flex-direction:column;padding:0 0 4px!important}
body.fs .wrap{flex:none;margin:auto auto 0;border-radius:0!important;border:0!important}
body.fs #cap{flex:none;margin:10px auto auto}
body.fs .dock{position:fixed;left:0;right:0;bottom:0;width:auto!important;margin:0;padding:22px 24px 2px;z-index:35;transition:opacity .25s;
  background:linear-gradient(transparent,color-mix(in srgb,var(--stage,#fafaf8) 92%,transparent) 40%)}
body.fs.idle .dock{opacity:0;pointer-events:none}
body.fs.idle{cursor:none}
body.fs #exit{display:none!important}
@media (max-width:640px){body.embed main{padding:8px 10px 4px!important}.bar{gap:6px}#scr,.caret,#speed{display:none}}
@media (max-width:400px){#time{display:none}}
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
/* 填空题：空位和选项块（质感版的样式在 scripts/lib/clean.ts，和例题的空位共用）；这里是其他风格的底子 */
.fq .qs p{margin:0 0 4px}.fq .qs ul,.fq .qs ol{margin:0;padding-left:20px}.fq .qs li{margin:6px 0}
.fq .qs pre{margin:4px 0;font-size:12px}
.fq .qex p{margin:0 0 4px}
.c-blank{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;box-sizing:border-box;min-width:64px;min-height:26px;margin:0 3px;padding:2px;border:1px dashed #bbb;border-radius:8px;background:#f1f3f5;font:inherit;color:inherit}
.c-fill{display:inline-block;border:1px solid #ccc;border-radius:6px;background:#fff;padding:0 10px;line-height:20px;white-space:nowrap;font:inherit;color:inherit}
.fq-b{cursor:pointer}.fq.locked .fq-b{cursor:default}
.fq-b.is-picked{border-style:solid;border-color:#1971c2}
.fq-b.is-wrong .c-fill{color:#999;text-decoration:line-through}
.fq-b.is-right .c-fill{border-color:#2b8a3e}
.fq-opts{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 2px}
.fq-o{cursor:grab}
.fq-o.picked{border-color:#1971c2;box-shadow:inset 0 0 0 1px #1971c2}
.fq-o:disabled{opacity:.35;cursor:default}
.qbar button[hidden]{display:none}
`

// 工作台版、贴纸版的页面外壳：只用色系令牌（var(--xxx)），跟着画面的风格走。
// 练习题也守"错误不用颜色"：答对是强调色边 + 浅强调底 + ✓；答错变灰、划线、灰 ✗。
const SHELL_CSS = `
/* —— 页面外壳（工作台 / 贴纸） —— */
body.themed{color:var(--ink);font:14px/1.5 var(--sf)}
body.st-desk{--sf:"DeskSans","Microsoft YaHei",sans-serif;--tf:"DeskHand","Microsoft YaHei",sans-serif;background:var(--bg)}
body.st-sticker{--sf:"StickerSans","Microsoft YaHei",sans-serif;--tf:"StickerSans","Microsoft YaHei",sans-serif;
  background:radial-gradient(circle at 2px 2px,var(--dot) 1px,transparent 1.5px) 0 0/16px 16px,var(--bg)}
.themed .bar{align-items:center;color:var(--mute)}
.themed #scr{font-family:var(--tf);font-size:16px;color:var(--ink)}
.st-desk #scr{display:inline-block;background:var(--tape);padding:2px 12px;border:1.5px solid var(--ink);box-shadow:2px 3px 0 var(--shadow);transform:rotate(-1deg)}
.st-sticker #scr{font-weight:900}.st-sticker #scr::before{content:"";display:inline-block;width:9px;height:9px;margin-right:8px;background:var(--acc);vertical-align:1px}
.themed .seg b{background:var(--off)}.themed .seg i{background:var(--acc)}
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
// 配音所在目录：不能直接用相对路径。线上 Vercel（cleanUrls、trailingSlash: false）会把 /course/2-1/index.html 重定向到 /course/2-1，
// 末尾没有 /，相对路径 audio/b001.mp3 会被解析成 /course/audio/b001.mp3（线上返回 200 的 404 页面，没有声音也不报错）。
// 地址以 .html 结尾（本地直接打开、file://）照常按文件所在目录解析；否则把末尾补上 /
const audioDir = new URL(location.href)
audioDir.search = ''
audioDir.hash = ''
if (!/\.html$/.test(audioDir.pathname)) audioDir.pathname = audioDir.pathname.replace(/\/?$/, '/')
// 配音按需加载：一开始都不下载，播到哪一拍再预先拉取这一拍和后面两拍（手机流量友好；网站上一节有几十段配音）
const audios = new Map(beats.map((s) => { const a = new Audio(); a.preload = 'none'; a.dataset.src = new URL(s.audio, audioDir).href; return [s.n, a] }))
function warm(n) {
  const i = beats.findIndex((s) => s.n === n)
  for (const s of beats.slice(Math.max(0, i), i + 3)) { const a = audios.get(s.n); if (!a.src) { a.src = a.dataset.src; a.preload = 'auto' } }
}

let t = 0, playing = false, speed = 1, curAudio = null, waitingQuiz = -1
const quizState = DATA.quizzes.map((Q) => Q.kind === 'fill'
  ? { filled: Q.answers.map(() => -1), pickO: -1, pickB: -1, status: 'idle' }
  : { sel: new Set(), checked: false, shown: false })
// 每拍开始的秒数：例题空位按拍填（帧里带 data-beat 的选项块）
const beatStart = new Map(beats.map((s) => [s.n, s.start]))
const BLANK_FADE = 0.25

// —— 进度线：每屏一段，宽度按这一屏的时长，段间缺口就是分屏标记（照抖音）；点哪儿跳哪儿，悬停显示屏名和时间 ——
const tip = $('tip')
const segAt = (s, el, e) => {
  const r = el.getBoundingClientRect(); return s.start + (s.end - s.start) * Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
}
const segs = DATA.screens.map((s) => {
  const el = document.createElement('div'); el.className = 'seg'; el.innerHTML = '<b><i></i></b>'
  el.style.flex = (s.end - s.start).toFixed(2) + ' 1 0'
  el.onclick = (e) => { $('cover').hidden = true; seek(segAt(s, el, e), true) }
  el.onmousemove = (e) => {
    const box = $('dock').getBoundingClientRect()
    tip.textContent = s.name + '　' + fmt(segAt(s, el, e)) + ' / ' + fmt(DATA.total); tip.hidden = false
    const half = tip.offsetWidth / 2
    tip.style.left = Math.max(half, Math.min(box.width - half, e.clientX - box.left)) + 'px'
  }
  el.onmouseleave = () => { tip.hidden = true }
  $('prog').appendChild(el); return el
})
const fill = segs.map((el) => el.querySelector('i'))
// —— 跳屏：目录里点哪屏跳哪屏；"下一屏"跳到下一屏开头。都从屏首开始放 ——
const toc = $('toc')
const closeToc = () => { toc.hidden = true; $('menu').setAttribute('aria-expanded', 'false') }
const goScreen = (s) => { closeToc(); $('cover').hidden = true; seek(s.start, true) }
DATA.screens.forEach((s) => {
  const b = document.createElement('button')
  b.innerHTML = '<em>' + fmt(s.start) + '</em><span>' + s.name + '</span>'
  b.onclick = () => goScreen(s)
  toc.appendChild(b)
})
let scrIdx = 0
$('next').onclick = () => { const s = DATA.screens[scrIdx + 1]; if (s) goScreen(s) }

// —— 画面层：每帧一个 .f，只在第一次用到时创建 ——
const layers = new Map()
function layer(ci) {
  if (layers.has(ci)) return layers.get(ci)
  const c = DATA.cards[ci]
  const el = document.createElement('div'); el.className = 'f'; el.innerHTML = c.html; el.style.display = 'none'
  stage.appendChild(el)
  // 按拍填的空位（data-beat）不跟着帧一起出现，到那一拍才淡入；分镜墙上它们也带 new，这里排除
  const items = [...el.querySelectorAll('.new:not([data-beat])')]
  const span = c.reveal === 'spread' ? Math.max(0.6, c.speak * 0.85) : Math.min(0.6, 0.12 * items.length)
  const fills = [...el.querySelectorAll('[data-beat]')].map((node) => ({ node, at: beatStart.get(Number(node.dataset.beat)) ?? 0 }))
  const L = { el, items: items.map((node, i) => ({ node, at: items.length > 1 ? (span * i) / items.length : 0 })), fills }
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
  // 练习暂停时时钟停在暂停帧的第一刻：它不做淡入，直接显示（卡上作答就在这一帧上，淡入会停在全透明）
  const fade = ci > 0 && step.k !== 'pause'
  const vis = [ci]; if (fade && local < FADE) vis.push(ci - 1)
  for (const k of shown) if (!vis.includes(k)) layers.get(k).el.style.display = 'none'
  shown = vis
  const cur = layer(ci)
  cur.el.style.display = ''; cur.el.style.opacity = fade ? String(ease(local / FADE)) : '1'; cur.el.style.zIndex = '2'
  for (const it of cur.items) {
    const e = ease((local - it.at) / POP)
    // data-from：从这个透明度亮起来，原地变亮不上移（"由淡变亮"）；没有就从 0 淡入加上移
    const from = parseFloat(it.node.dataset.from ?? '0')
    sig.push(e.toFixed(3)); it.node.style.opacity = String(from + (1 - from) * e)
    it.node.style.translate = e < 1 && !it.node.dataset.from ? '0 ' + ((1 - e) * 8).toFixed(1) + 'px' : ''
  }
  for (const it of cur.fills) {
    const e = Math.max(0, Math.min(1, (time - it.at) / BLANK_FADE))
    sig.push('b' + e.toFixed(3)); it.node.style.opacity = String(e)
  }
  sig.unshift(ci, cur.el.style.opacity)
  if (vis.length > 1) { const p = layer(ci - 1); sig.push('p'); p.el.style.display = ''; p.el.style.opacity = String(1 - ease(local / FADE)); p.el.style.zIndex = '1' }

  // 练习题
  const q = step.k === 'pause' ? step.quiz : -1
  if (q !== quizShown) showQuiz(q)
  if (exportMode && q >= 0) sig.push('q' + q, videoQuiz(step, time - step.start))

  // 字幕、进度、时间、当前屏
  $('cap').textContent = step.k === 'beat' ? step.text : ''
  let k = DATA.screens.findIndex((s) => time >= s.start && time < s.end)
  if (k < 0) k = DATA.screens.length - 1
  if (k !== scrIdx || !$('scr').textContent) {
    scrIdx = k
    $('scr').textContent = $('scr').title = DATA.screens[k].name
    $('next').hidden = k === DATA.screens.length - 1
    toc.querySelectorAll('button').forEach((b, i) => b.classList.toggle('cur', i === k))
  }
  DATA.screens.forEach((s, i) => { fill[i].style.width = Math.max(0, Math.min(1, (time - s.start) / (s.end - s.start))) * 100 + '%' })
  $('time').textContent = fmt(time) + ' / ' + fmt(DATA.total)
  return sig.join(',')
}

// 视频里的练习题：先倒计时"自己想想"，再揭晓正确选项和解析。返回这一刻的状态，供导出时判断画面变没变
let exportMode = false
function videoQuiz(step, local) {
  const left = Math.ceil(step.think - local), revealed = left <= 0
  // 倒计时条：盖层题卡放在最后；卡上作答（质感版）放进按钮条，按钮在导出时藏起来
  const host = quizEl.inplace ? quizEl.querySelector('[data-qbar]') : quizEl
  let think = host.querySelector('.think')
  if (!think) { think = document.createElement('div'); think.className = 'think'; host.appendChild(think) }
  think.innerHTML = revealed ? '✓ 答案' : '⏸ 暂停一下，自己想想　<b>' + left + '</b>'
  think.classList.toggle('ans', revealed)
  quizEl.videoReveal(revealed)
  return revealed ? 'r' : String(left)
}

// —— 练习题（网页里可作答；导出视频时只显示题面）——
// 质感版（DATA.inplace）：帧里画的练习卡就是作答界面，暂停时直接给卡上的选项、空位、选项块、按钮条接上作答，
// 画面不换（生成时已核对卡上的选项和书稿对得上，见 wireQuizzes）。其他风格：在画面上盖一层题卡
let quizShown = -1, quizEl = null
function showQuiz(q) {
  quizShown = q
  if (quizEl && !quizEl.inplace) quizEl.remove()
  quizEl = null
  if (q < 0) return
  const Q = DATA.quizzes[q]
  const step = DATA.steps.find((x) => x.k === 'pause' && x.quiz === q)
  const root = DATA.inplace ? layer(step.card).el.querySelector('[data-quiz]') : null
  if (root) {
    quizEl = root; root.inplace = true
    const bar = root.querySelector('[data-qbar]')
    const ui = { fb: bar.querySelector('.fb'), btn: (c) => bar.querySelector(c), ex: root.querySelector('[data-ex]') }
    if (Q.kind === 'fill') {
      root.classList.add('fq')
      // 选项块在帧里画成 span，换成按钮才能点、能禁用；data-qi 是它在书稿选项里的下标
      root.querySelectorAll('span[data-chip]').forEach((el) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = el.className + ' fq-o'
        b.dataset.chip = ''; b.dataset.qi = el.dataset.qi; b.textContent = el.textContent; el.replaceWith(b)
      })
      ui.blanks = [...root.querySelectorAll('[data-blank]')]
      ui.opts = []
      root.querySelectorAll('[data-chip]').forEach((b) => { ui.opts[Number(b.dataset.qi)] = b })
      return bindFill(q, ui)
    }
    ui.opts = [...root.querySelectorAll('[data-opt]')].sort((a, b) => a.dataset.opt - b.dataset.opt)
    return bindChoice(q, ui)
  }
  quizEl = document.createElement('div'); quizEl.className = 'quiz'
  const n = DATA.steps.filter((s) => s.k === 'pause').findIndex((s) => s.quiz === q) + 1
  const btn = (c) => quizEl.querySelector(c)
  if (Q.kind === 'fill') return showFill(q, n)
  quizEl.innerHTML = '<div class="qh">练习' + n + '　' + (Q.kind === 'multi' ? '多选' : '单选') + '</div><div class="qs">' + Q.stem + '</div>' +
    Q.options.map((o, i) => '<button class="qopt" data-i="' + i + '">' + o.html + '<div class="why">' + o.why + '</div></button>').join('') +
    '<div class="qex">' + Q.explain + '</div>' +
    '<div class="qbar"><span class="fb"></span><button class="ck">检查</button><button class="ans">看答案</button><button class="go">继续 ▶</button></div>'
  stage.appendChild(quizEl)
  bindChoice(q, { opts: [...quizEl.querySelectorAll('.qopt')], fb: btn('.fb'), btn, ex: null })
}
const goOn = (q) => { const s = DATA.steps.find((x) => x.k === 'pause' && x.quiz === q); waitingQuiz = -1; seek(s.end, playing) }

// —— 选择题。ex 是卡上的解析位（盖层题卡没有：解析写在选项里和题卡底部，按 .done 显示）：
// 答错写选错的那几项的解析，答对、看答案写整题解析（没有整题解析就写正确选项的解析）——
function bindChoice(q, ui) {
  const Q = DATA.quizzes[q], st = quizState[q], opts = ui.opts, fb = ui.fb, ck = ui.btn('.ck')
  const whyOf = (i) => (Q.options[i].why ? '<div class="why"><b>' + String.fromCharCode(65 + i) + '</b>' + Q.options[i].why + '</div>' : '')
  const solved = () => Q.explain || Q.options.map((o, i) => (o.correct ? whyOf(i) : '')).join('')
  const writeEx = (html) => { if (ui.ex) ui.ex.innerHTML = html }
  const paint = () => {
    opts.forEach((b, i) => { b.classList.toggle('sel', st.sel.has(i) && !st.checked) })
    ck.disabled = st.sel.size === 0
    ck.textContent = st.checked && !st.right ? '再试一次' : '检查'
    quizEl.classList.toggle('locked', st.checked)
  }
  opts.forEach((b, i) => b.onclick = () => {
    if (st.checked) return
    if (Q.kind === 'single') st.sel = new Set([i]); else st.sel.has(i) ? st.sel.delete(i) : st.sel.add(i)
    paint()
  })
  ck.onclick = () => {
    if (st.checked) { st.checked = false; opts.forEach((b) => b.classList.remove('right', 'wrong')); fb.textContent = ''; st.sel.clear(); writeEx(''); paint(); return }
    st.checked = true
    const wrong = [...st.sel].filter((i) => !Q.options[i].correct)
    const miss = Q.options.filter((o, i) => o.correct && !st.sel.has(i)).length
    st.right = wrong.length === 0 && miss === 0
    if (st.right) { reveal(); fb.textContent = '答对了。'; fb.className = 'fb ok' }
    else {
      wrong.forEach((i) => opts[i].classList.add('wrong'))
      writeEx(wrong.map(whyOf).join(''))
      fb.textContent = Q.kind === 'multi' ? '选错了 ' + wrong.length + ' 个' + (miss ? '，还有漏选的' : '') : '不对，再想想。'
      fb.className = 'fb no'
    }
    paint()
  }
  const reveal = () => { Q.options.forEach((o, i) => { if (o.correct) opts[i].classList.add('right') }); quizEl.classList.add('done'); writeEx(solved()) }
  ui.btn('.ans').onclick = () => { st.checked = true; st.right = true; reveal(); fb.textContent = ''; paint() }
  ui.btn('.go').onclick = () => goOn(q)
  // 导出视频：倒计时时题面空着，揭晓时标出正确选项、写上解析
  quizEl.videoReveal = (on) => { opts.forEach((b, i) => b.classList.toggle('right', on && Q.options[i].correct)); quizEl.classList.toggle('done', on); writeEx(on ? solved() : '') }
  paint()
}

// —— 填空题（照网站 FillQuiz.vue）：点选项块再点空，或者先点空再点选项块，桌面上也能拖；点已填的空把选项块退回。
// 用过的选项块变灰；填满了才能检查；答错只标出错的空，可以再试一次（错的空退回）或看答案；答对、看答案之后显示解析 ——
function showFill(q, n) {
  const Q = DATA.quizzes[q]
  quizEl.className = 'quiz fq'
  quizEl.innerHTML = '<div class="qh">练习' + n + '　填空</div><div class="qs">' + Q.stem + '</div>' +
    '<div class="fq-opts" role="group" aria-label="选项">' + Q.options.map((o, i) => '<button type="button" class="c-fill fq-o" data-i="' + i + '"></button>').join('') + '</div>' +
    '<div class="qex">' + Q.explain + '</div>' +
    '<div class="qbar"><span class="fb" role="status"></span><button class="ck">检查</button><button class="retry">再试一次</button><button class="ans">看答案</button><button class="redo">重做</button><button class="go">继续 ▶</button></div>'
  stage.appendChild(quizEl)
  const opts = [...quizEl.querySelectorAll('.fq-o')], btn = (c) => quizEl.querySelector(c)
  opts.forEach((b, i) => { b.textContent = Q.options[i] })
  bindFill(q, { blanks: [...quizEl.querySelectorAll('.fq-b')], opts, fb: btn('.fb'), btn, ex: null })
}
// opts[i] 是书稿第 i 个选项的按钮（卡上作答时，画面上的排列可以和书稿不同）；ex 是卡上的解析位，答对、看答案后写整题解析
function bindFill(q, ui) {
  const Q = DATA.quizzes[q], st = quizState[q], blanks = ui.blanks, opts = ui.opts, btn = ui.btn, fb = ui.fb
  // 空位原来的样式类（帧里的空位可能带别的类），每次重画在它后面加作答状态
  const base = (b) => b.dataset.base ?? (b.dataset.base = [...b.classList].filter((c) => c !== 'fq-b' && !c.startsWith('is-')).join(' '))
  const locked = () => st.status !== 'idle'
  const used = () => new Set(st.filled.filter((x) => x >= 0))
  const isRight = (k) => st.filled[k] >= 0 && Q.options[st.filled[k]] === Q.answers[k]
  const place = (i, k) => { if (locked() || used().has(i)) return; st.filled[k] = i; st.pickO = st.pickB = -1; paint() }
  // 每个空放上一个写着正确答案的选项块（答案相同的块可以互换）
  const fillAnswers = () => { const taken = new Set(); st.filled = Q.answers.map((a) => { const i = Q.options.findIndex((o, j) => o === a && !taken.has(j)); taken.add(i); return i }) }
  const paint = () => {
    const u = used(), answered = st.status === 'right' || st.status === 'revealed'
    blanks.forEach((b, k) => {
      const i = st.filled[k], cls = base(b)
      b.textContent = ''
      if (i >= 0) { const c = document.createElement('span'); c.className = 'c-fill'; c.textContent = Q.options[i]; b.appendChild(c) }
      const s = answered ? 'right' : st.status === 'wrong' ? (isRight(k) ? '' : 'wrong') : i < 0 && st.pickB === k ? 'picked' : ''
      b.className = cls + ' fq-b' + (s ? ' is-' + s : '')
      b.setAttribute('aria-label', '第' + (k + 1) + '个空' + (i >= 0 ? '：' + Q.options[i] : ''))
    })
    opts.forEach((b, i) => { b.disabled = locked() || u.has(i); b.draggable = !b.disabled; b.classList.toggle('picked', st.pickO === i) })
    quizEl.classList.toggle('locked', locked()); quizEl.classList.toggle('done', answered)
    if (ui.ex) ui.ex.innerHTML = answered ? Q.explain : ''
    const wrongN = Q.answers.filter((_, k) => !isRight(k)).length
    fb.textContent = st.status === 'right' ? '答对了。' : st.status === 'revealed' ? '正确答案已填好。' : st.status === 'wrong' ? '还不对：有 ' + wrongN + ' 个空填错了。' : ''
    fb.className = 'fb' + (st.status === 'right' ? ' ok' : st.status === 'wrong' ? ' no' : '')
    btn('.ck').hidden = st.status !== 'idle'; btn('.ck').disabled = st.filled.some((x) => x < 0)
    btn('.retry').hidden = btn('.ans').hidden = st.status !== 'wrong'
    btn('.redo').hidden = !answered
  }
  opts.forEach((b, i) => {
    b.onclick = () => {
      if (locked() || used().has(i)) return
      if (st.pickB >= 0) return place(i, st.pickB)
      st.pickO = st.pickO === i ? -1 : i; paint()
    }
    b.ondragstart = (e) => { if (b.disabled) return e.preventDefault(); e.dataTransfer.setData('text/plain', String(i)); st.pickO = i; paint() }
  })
  blanks.forEach((b, k) => {
    b.onclick = () => {
      if (locked()) return
      if (st.filled[k] >= 0) { st.filled[k] = -1; paint(); return }
      if (st.pickO >= 0) return place(st.pickO, k)
      st.pickB = st.pickB === k ? -1 : k; paint()
    }
    b.ondragover = (e) => { if (!locked() && st.filled[k] < 0) e.preventDefault() }
    b.ondrop = (e) => { e.preventDefault(); const i = Number(e.dataTransfer.getData('text/plain')); if (Number.isInteger(i) && st.filled[k] < 0) place(i, k) }
  })
  btn('.ck').onclick = () => { if (st.filled.some((x) => x < 0)) return; st.status = Q.answers.every((_, k) => isRight(k)) ? 'right' : 'wrong'; paint() }
  btn('.retry').onclick = () => { st.filled = st.filled.map((x, k) => (isRight(k) ? x : -1)); st.status = 'idle'; paint() }
  btn('.ans').onclick = () => { fillAnswers(); st.status = 'revealed'; paint() }
  btn('.redo').onclick = () => { st.filled = Q.answers.map(() => -1); st.pickO = st.pickB = -1; st.status = 'idle'; paint() }
  btn('.go').onclick = () => goOn(q)
  // 导出视频：倒计时时空着，揭晓时把答案填好
  quizEl.videoReveal = (on) => { if (on) fillAnswers(); else st.filled = Q.answers.map(() => -1); st.status = on ? 'revealed' : 'idle'; paint(); fb.textContent = '' }
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
function setPlaying(p) { playing = p; if (typeof wake === 'function') wake(); $('play').classList.toggle('on', p); $('play').setAttribute('aria-label', p ? '暂停' : '播放'); if (!p) stopAudio() }
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
document.addEventListener('click', (e) => { if (!toc.hidden && !toc.contains(e.target)) closeToc() })
$('startLabel').textContent = '开始播放 · ' + fmt(DATA.total)
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return
  if (e.key === ' ') { e.preventDefault(); $('cover').hidden = true; setPlaying(!playing) }
  else if (e.key === 'ArrowLeft') jumpBeat(-1)
  else if (e.key === 'ArrowRight') jumpBeat(1)
  else if (e.key === 'c' || e.key === 'C') toggleCap()
  else if ((e.key === 'f' || e.key === 'F') && !$('fs').hidden) toggleFs()
  else if (e.key === 'Escape') closeToc()
})

// —— 真全屏（浏览器全屏接口，网站的 iframe 带 allow="fullscreen"）；不支持的浏览器（iPhone）不显示按钮 ——
const isFs = () => Boolean(document.fullscreenElement)
const toggleFs = () => (isFs() ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})
if (document.fullscreenEnabled) $('fs').hidden = false
$('fs').onclick = toggleFs
let fsLeftAt = -Infinity
document.addEventListener('fullscreenchange', () => {
  document.body.classList.toggle('fs', isFs())
  $('fs').setAttribute('aria-label', isFs() ? '退出全屏' : '全屏'); $('fs').title = isFs() ? '退出全屏（F / Esc）' : '全屏（F）'
  if (!isFs()) fsLeftAt = performance.now()
  wake(); fitWrap()
})
// 全屏里播放时鼠标 2.5 秒不动，控制区淡出；动一下、按键、暂停、目录开着时都显示
let idleTimer = 0
function wake() {
  document.body.classList.remove('idle'); clearTimeout(idleTimer)
  idleTimer = setTimeout(() => { if (isFs() && playing && toc.hidden) document.body.classList.add('idle') }, 2500)
}
for (const ev of ['mousemove', 'pointerdown', 'keydown']) document.addEventListener(ev, wake, { passive: true })

// —— 画布缩放 ——
// 嵌入网站、或真全屏时整屏只有这一页：先按宽、高两个方向算出舞台最大能多大（扣掉控制区、字幕和留白），再按舞台宽度缩放画布。
// 控制区和字幕跟画面同宽，看起来是一台播放器；真全屏时控制区叠在画面上，不扣它的高度
function fitWrap() {
  const dock = $('dock'), cap = $('cap')
  if (!document.body.classList.contains('embed') && !isFs()) { wrap.style.width = dock.style.width = cap.style.maxWidth = ''; return }
  const main = document.querySelector('main'), cs = getComputedStyle(main)
  const px = (v) => parseFloat(v) || 0
  const w = main.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight)
  const under = isFs() ? 0 : dock.offsetHeight + px(getComputedStyle(dock).marginTop)
  const h = innerHeight - px(cs.paddingTop) - px(cs.paddingBottom) - under - cap.offsetHeight - px(getComputedStyle(cap).marginTop)
  const width = Math.max(160, Math.floor(Math.min(w, (h * 16) / 9)))
  wrap.style.width = width + 'px'
  dock.style.width = isFs() ? '' : width + 'px'
  cap.style.maxWidth = Math.floor(width * 0.9) + 'px'
  // 真全屏：控制区叠在画面底边上（照 YouTube），不压住下面的字幕
  dock.style.bottom = isFs() ? Math.max(0, innerHeight - wrap.getBoundingClientRect().bottom) + 'px' : ''
}
addEventListener('resize', fitWrap)
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
// —— 嵌入网站节页（?embed）：全屏学习层。告诉外层页面：播完了、要退出、要改读文字、要问 AI；外层可以让它重新播放、暂停 ——
if (params.has('embed') && window.parent !== window) {
  document.body.classList.add('embed')
  const post = (msg) => window.parent.postMessage(Object.assign({ source: 'ds-course' }, msg), '*')
  window.__onEnded = () => post({ type: 'ended' })
  $('exit').onclick = () => post({ type: 'exit' })
  $('toText').onclick = () => { setPlaying(false); post({ type: 'text' }) }
  // 全屏里问 AI：先退出全屏，侧栏才看得见
  $('ask').onclick = () => { setPlaying(false); (isFs() ? document.exitFullscreen().catch(() => {}) : Promise.resolve()).then(() => post({ type: 'ask' })) }
  // Esc：目录开着先关目录，否则退出。全屏时 Esc 归浏览器退出全屏，不连带退出动画
  // 捕获阶段先于上面关目录的那个监听器，才能看到按下时目录是不是开着
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toc.hidden && !isFs() && performance.now() - fsLeftAt > 500) post({ type: 'exit' })
  }, true)
  window.addEventListener('message', (e) => {
    const d = e.data
    if (e.source !== window.parent || !d || d.source !== 'ds-site') return
    if (d.type === 'replay') { t = 0; $('start').click() }
    else if (d.type === 'pause') setPlaying(false)
  })
  fitWrap()
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

  const hasFill = quizzes.some((q) => q.kind === 'fill')
  // 质感版在帧里的练习卡上直接作答：先核对卡和书稿对得上，再给选项块标上书稿里的下标
  for (const p of pages) if (p.style === 'clean') p.cards = wireQuizzes(p.cards, quizzes)

  const audio = synthesize(id, screens, mod.say ?? {}, skipTts)
  const tl = timeline(cards, audio, quizzes)
  const outDir = path.join(ROOT, 'docs/course/player', id)
  // 页面上除了画面还要显示的字：字幕、练习题、按钮，都要进主题的字体子集
  const strip = (h: string) => h.replace(/<[^>]*>/g, '')
  const more = screens.flatMap((s) => s.beats.map((b) => b.text)).join('') + title + screens.map((s) => s.name).join('') +
    quizzes.map((q) => strip(q.stem + q.explain) + (q.kind === 'fill' ? q.options.join('') : q.options.map((o) => strip(o.html + o.why)).join(''))).join('') +
    (hasFill ? '填空重做正确答案已填好还不对有个空填错了' : '') +
    '第屏下一›▾全退出0123456789:/练习多选单选检查看答案继续再试一次答对了不对再想想选错了个还有漏选的暂停一下自己想想答案开始播放接着播放重新播放倍速字幕读文字问AI退出色系工作台贴纸原版质感由和生成不要手改本文件配音：⏮⏭⏸▶↻✓✗'
  for (const p of pages) {
    const htmls = p.cards.map((c) => c.html)
    const themeCss = p.style === 'desk' ? (await deskCss(htmls, more)).css : p.style === 'sticker' ? (await stickerCss(htmls, DEFAULT_PALETTE, more)).css : p.style === 'clean' ? (await cleanCss(htmls, more, { blanks: hasFill })).css : ''
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
