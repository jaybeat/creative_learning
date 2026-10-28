// 把动画播放器导出成视频：npx tsx scripts/course-video.ts 2-1 [--style desk|sticker|classic|clean]
// 风格默认 clean（质感版，player/<id>/index.html）；备份风格 desk/sticker/classic 读 player/<id>/backup/<风格>.html。
// 先运行 scripts/course-player.ts 生成播放器和配音。
//
// 不录屏：Playwright 打开播放器，逐帧调用 window.__seek(t) 画出那一刻，截图后通过管道交给 ffmpeg 编码；
// 画面没变的帧（__seek 返回的签名相同）直接复用上一张截图。
// 声音不从浏览器录：按时间轴把每拍的 mp3 放到各自的起点，拼成一条音轨。画面和声音来自同一份时间轴，不会错位。
//
// 输出 docs/course/video/<id>/：<id>-<风格>.mp4（无字幕）、<id>-<风格>.srt、<id>-<风格>-sub.mp4（烧进字幕）。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { ROOT } from './lib/course'

const FPS = 30
const SCALE = 3 // 画布 640×360 → 1920×1080
const SAMPLE_RATE = 24000 // edge-tts 输出的采样率

type Step = { k: 'beat'; n: number; text: string; audio: string; start: number; dur: number } | { k: 'pause'; start: number }

async function renderFrames(playerFile: string, total: number, outFile: string) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: SCALE })
  await page.goto(pathToFileURL(playerFile).href)
  // 只留画布：去掉标题栏、进度条、字幕、按钮，画布铺满 640×360
  await page.addStyleTag({
    content: `body{margin:0;background:#fafaf8} main{padding:0;max-width:none}
      .dock,#exit,.bar,#prog,#cap,.ctl,.hint{display:none!important}
      .wrap{width:640px;border-radius:0;box-shadow:none}`,
  })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() => (document.getElementById('stage') as HTMLElement).style.transform === 'scale(1)')

  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', outFile], { stdio: ['pipe', 'inherit', 'inherit'] })
  const done = new Promise<void>((ok, fail) => ff.on('close', (c) => (c === 0 ? ok() : fail(new Error(`ffmpeg 编码画面失败（${c}）`)))))
  const write = (buf: Buffer) => new Promise<void>((ok) => (ff.stdin.write(buf) ? ok() : ff.stdin.once('drain', () => ok())))

  const frames = Math.ceil(total * FPS)
  let lastSig = ''
  let last: Buffer | null = null
  let shots = 0
  const t0 = Date.now()
  for (let f = 0; f < frames; f++) {
    const sig = await page.evaluate((t) => (window as unknown as { __seek: (t: number) => string }).__seek(t), f / FPS)
    if (sig !== lastSig || !last) {
      last = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 640, height: 360 } })
      lastSig = sig
      shots++
    }
    await write(last)
    if (f % (FPS * 30) === 0) process.stdout.write(`\r[video] 画面 ${Math.round((f / frames) * 100)}%（${f}/${frames} 帧，实际截图 ${shots} 张）`)
  }
  ff.stdin.end()
  await done
  await browser.close()
  console.log(`\r[video] 画面 100%：${frames} 帧，实际截图 ${shots} 张，用时 ${Math.round((Date.now() - t0) / 1000)} 秒        `)
}

/** 按时间轴把每拍配音放到各自的起点，拼成一条 WAV 音轨（单声道 16 位） */
function buildAudio(playerDir: string, steps: Step[], total: number, outFile: string) {
  const len = Math.ceil(total * SAMPLE_RATE)
  const pcm = Buffer.alloc(len * 2)
  for (const s of steps) {
    if (s.k !== 'beat') continue
    const r = spawnSync('ffmpeg', ['-v', 'error', '-i', path.join(playerDir, s.audio.replace(/\?.*$/, '')), '-f', 's16le', '-ac', '1', '-ar', String(SAMPLE_RATE), '-'], { maxBuffer: 64 << 20 })
    if (r.status !== 0) throw new Error(`解码失败：${s.audio}`)
    const at = Math.round(s.start * SAMPLE_RATE) * 2
    r.stdout.copy(pcm, at, 0, Math.min(r.stdout.length, pcm.length - at))
  }
  const head = Buffer.alloc(44)
  head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVE', 8)
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22)
  head.writeUInt32LE(SAMPLE_RATE, 24); head.writeUInt32LE(SAMPLE_RATE * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34)
  head.write('data', 36); head.writeUInt32LE(pcm.length, 40)
  fs.writeFileSync(outFile, Buffer.concat([head, pcm]))
}

function srt(steps: Step[]) {
  const ts = (s: number) => {
    const ms = Math.round(s * 1000)
    const p = (n: number, w = 2) => String(n).padStart(w, '0')
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`
  }
  return steps
    .filter((s): s is Extract<Step, { k: 'beat' }> => s.k === 'beat')
    .map((s, i) => `${i + 1}\n${ts(s.start)} --> ${ts(s.start + s.dur)}\n${s.text}\n`)
    .join('\n')
}

function ffmpeg(args: string[], cwd?: string) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { cwd, stdio: 'inherit' })
  if (r.status !== 0) throw new Error(`ffmpeg 失败：${args.join(' ')}`)
}

async function main() {
  const id = process.argv.slice(2).find((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--style') ?? '2-1'
  const si = process.argv.indexOf('--style')
  const style = si >= 0 ? process.argv[si + 1] : 'clean'
  const PAGES: Record<string, string> = { clean: 'index.html', desk: 'backup/desk.html', sticker: 'backup/sticker.html', classic: 'backup/classic.html' }
  if (!PAGES[style]) throw new Error(`没有风格 ${style}，可选：${Object.keys(PAGES).join(' ')}`)
  const playerDir = path.join(ROOT, 'docs/course/player', id)
  const playerFile = path.join(playerDir, PAGES[style])
  const name = `${id}-${style}`
  if (!fs.existsSync(playerFile)) throw new Error(`没有播放器：先运行 npm run course:player -- ${id}`)
  const html = fs.readFileSync(playerFile, 'utf8')
  const data = JSON.parse(html.match(/const DATA = (.*?);<\/script>/s)![1]) as { total: number; steps: Step[] }

  const outDir = path.join(ROOT, 'docs/course/video', id)
  fs.mkdirSync(outDir, { recursive: true })
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `course-video-${id}-`))
  const videoOnly = path.join(tmp, 'video.mp4')
  const audio = path.join(tmp, 'audio.wav')

  console.log(`[video] 时长 ${Math.floor(data.total / 60)}分${Math.round(data.total % 60)}秒，${FPS}fps，${640 * SCALE}×${360 * SCALE}`)
  await renderFrames(playerFile, data.total, videoOnly)
  buildAudio(playerDir, data.steps, data.total, audio)
  console.log('[video] 音轨已拼好，合成中…')

  ffmpeg(['-i', videoOnly, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', `${name}.mp4`], outDir)
  fs.writeFileSync(path.join(outDir, `${name}.srt`), srt(data.steps))
  // 烧字幕：在输出目录里用相对文件名，避开 subtitles 滤镜对 Windows 路径（盘符冒号）的转义
  // BorderStyle=3：字幕底下垫一块半透明黑底（颜色取 OutlineColour），压在画面内容上也看得清
  const subStyle = 'FontName=Microsoft YaHei,FontSize=16,PrimaryColour=&H00FFFFFF,OutlineColour=&H70000000,BorderStyle=3,Outline=5,Shadow=0,MarginV=8'
  ffmpeg(['-i', `${name}.mp4`, '-vf', `subtitles=${name}.srt:force_style='${subStyle}'`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-c:a', 'copy', `${name}-sub.mp4`], outDir)
  fs.rmSync(tmp, { recursive: true, force: true })

  for (const f of [`${name}.mp4`, `${name}-sub.mp4`, `${name}.srt`]) {
    const size = fs.statSync(path.join(outDir, f)).size
    console.log(`[video] ${path.relative(ROOT, path.join(outDir, f))}  ${(size / 1048576).toFixed(1)} MB`)
  }
}

main().catch((e) => {
  console.error(`[video] ${e.message}`)
  process.exit(1)
})
