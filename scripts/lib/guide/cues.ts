// 引导模块的服务端（念到哪，看到哪）：cue 的类型、在旁白里找短语、短语的时间、把一帧的 cue 换成绝对时间。
// 分镜墙（scripts/storyboard.ts）、课程播放器（scripts/course-player.ts）共用；浏览器端是同目录的 runtime.js。用法见 README.md。
import type { Card } from '../course'

/**
 * 拍内动作（念到哪，看到哪）：at 是这一帧旁白里的一个短语，念到它的时候——
 * - steps：画面依次换成这些状态，均匀摊在这个短语的时长里（读头一格格走、元素入栈出栈）；
 *   前后两个状态里 data-k 相同的元素从旧位置滑到新位置，带 data-src 的新元素从那个 data-k 元素的位置滑过来；
 * - focus：指示框指向 data-k 是它的元素（逗号分开可以几个；挨着的格子合成一个框），到下一个 focus 或这一帧结束；
 * - zoom：聚焦时顺带以目标为中心放大（已不用：整屏缩放和压暗一样抢注意力）；
 * - note：框旁批注，一句"为什么"（四五个字），框到了以后画箭头、写出红字；side 指定写在框的哪一边（默认右边）。
 * 几个 cue 按顺序写，同一个短语出现两次时，后一个 cue 从前一个找到的位置往后找。
 */
export type Cue = { at: string; steps?: string[]; focus?: string; zoom?: number; note?: string; side?: 'r' | 'l' | 'b' }

// 旁白比对用的文字：去掉标点、反引号、加粗记号和空白，和 scripts/course_tts.py 的 norm 一致
const PUNCT = new Set('，。、：；？！,.:;?!“”"\'（）() 　…—`*')
export const normSpeech = (t: string) => [...t].filter((c) => !PUNCT.has(c)).join('').toLowerCase()

/**
 * 短语在一拍配音里的起止秒数（相对拍首）。times 是这一拍每个字（normSpeech 之后）的 [起, 止]，转写对不上的字是 null；
 * 没有 times、字数对不上、或短语里的字都没对上时，按字数比例估
 */
export type CharTimes = ([number, number] | null)[]
export function phraseTime(text: string, dur: number, i: number, len: number, times?: CharTimes | null): [number, number] {
  const n = normSpeech(text).length || 1
  let a = (dur * i) / n, b = (dur * (i + len)) / n
  if (times && times.length === n) {
    const inside = times.slice(i, i + len)
    const first = inside.find((x) => x), last = [...inside].reverse().find((x) => x)
    if (first) a = first[0]
    if (last) b = last[1]
  }
  return [Math.max(0, a), Math.max(a + 0.3, Math.min(dur, b))]
}

/** cue 的短语落在这一帧的哪一拍、norm 之后的第几个字；找不到的记进 errors */
export type CueAt = { cue: Cue; beat: number; i: number; len: number }
export function locateCues(c: Card, errors: string[] = []): CueAt[] {
  const out: CueAt[] = []
  let bi = 0, from = 0
  for (const cue of c.cues ?? []) {
    const p = normSpeech(cue.at)
    let hit: CueAt | undefined
    for (let k = bi; k < c.beats.length && !hit; k++) {
      const i = normSpeech(c.beats[k].text).indexOf(p, k === bi ? from : 0)
      if (i >= 0) { hit = { cue, beat: c.beats[k].n, i, len: p.length }; bi = k; from = i + 1 }
    }
    if (!p || !hit) errors.push(`帧 ${c.id}：cue 的短语「${cue.at}」在这一帧的旁白里（按顺序往后）找不到`)
    else out.push(hit)
  }
  return out
}

/** 一拍念的文字和每个字的时间（scripts/lib/guide/timing.ts 的 charTimes 给出） */
export type Said = { text: string; times: CharTimes | null }

/**
 * 一帧的拍内动作换成绝对时间：states 是这一帧的各个画面状态（第一个是帧本身）和它们开始的秒数；
 * focus 是聚焦区间（到下一个 focus 或这一帧结束）
 */
export function cueTimeline(c: Card, start: number, end: number, beatStep: Map<number, { start: number; dur: number }>, said: Map<number, Said>) {
  const states = [{ html: c.html, at: start }]
  const focus: { k: string; t0: number; t1: number; z: number; note?: string; side?: string }[] = []
  for (const h of locateCues(c)) {
    const st = beatStep.get(h.beat)!, b = c.beats.find((x) => x.n === h.beat)!, s = said.get(h.beat)
    // 配音念的是念法表换过的文字时，先在那段文字里找短语用转写时间；找不到就按原文字数比例估
    const j = s ? normSpeech(s.text).indexOf(normSpeech(h.cue.at)) : -1
    const [a, z] = j >= 0 ? phraseTime(s!.text, st.dur, j, h.len, s!.times) : phraseTime(b.text, st.dur, h.i, h.len, null)
    const t0 = st.start + a, t1 = st.start + z
    h.cue.steps?.forEach((html, k, all) => states.push({ html, at: t0 + ((t1 - t0) * k) / all.length }))
    if (h.cue.focus) {
      const last = focus.at(-1)
      if (last && last.t1 > t0) last.t1 = t0
      focus.push({ k: h.cue.focus, t0, t1: end, z: h.cue.zoom ?? 1, ...(h.cue.note ? { note: h.cue.note, side: h.cue.side } : {}) })
    }
  }
  return { states, focus }
}
