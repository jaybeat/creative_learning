// 引导模块：每拍每个字的时间。faster-whisper 转写配音（scripts/course_tts.py --times），存在 audio/bNNN.t.json。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { ROOT, type Card } from '../course'
import type { Said } from './cues'
export type { Said }

// 每拍每个字的时间（念到哪，看到哪）：faster-whisper 转写这一拍的配音，存在 bNNN.t.json。
// 只在帧里写了 cue 的拍才需要；旁白（或念法）改过、配音重新合成过，就重新转写。COURSE_TIMES=0 跳过，按字数比例估
export function charTimes(id: string, cards: Card[], say: Record<number, string>, audio: Map<number, { file: string }>): Map<number, Said> {
  const audioDir = path.join(ROOT, 'docs/course/player', id, 'audio')
  const out = new Map<number, Said>()
  const jobs: { text: string; mp3: string; out: string }[] = []
  for (const b of cards.filter((c) => c.cues?.length).flatMap((c) => c.beats)) {
    const text = say[b.n] ?? b.text
    const mp3 = path.join(ROOT, 'docs/course/player', id, audio.get(b.n)!.file.replace(/\?.*$/, ''))
    const tf = path.join(audioDir, `b${String(b.n).padStart(3, '0')}.t.json`)
    const fresh = fs.existsSync(tf) && fs.statSync(tf).mtimeMs >= fs.statSync(mp3).mtimeMs && JSON.parse(fs.readFileSync(tf, 'utf8')).text === text
    if (!fresh) jobs.push({ text, mp3, out: tf })
    out.set(b.n, { text, times: null })
  }
  if (jobs.length && process.env.COURSE_TIMES !== '0') {
    console.log(`[player] 转写 ${jobs.length} 拍配音，记下每个字的时间（cue 对齐用）…`)
    const jobsFile = path.join(os.tmpdir(), `course-times-${id}.json`)
    fs.writeFileSync(jobsFile, JSON.stringify(jobs))
    const r = spawnSync('python', ['-P', path.join(ROOT, 'scripts/course_tts.py'), '--times', jobsFile], { stdio: 'inherit' })
    if (r.status !== 0) throw new Error('转写配音失败（COURSE_TIMES=0 可以跳过，按字数比例估）')
  }
  for (const [n, s] of out) {
    const tf = path.join(audioDir, `b${String(n).padStart(3, '0')}.t.json`)
    if (fs.existsSync(tf)) { const j = JSON.parse(fs.readFileSync(tf, 'utf8')); if (j.text === s.text) s.times = j.times }
  }
  return out
}
