// 课程化脚本的公共部分：解析双栏稿、把帧对到拍上、画面元素的样式。
// 分镜墙（scripts/storyboard.ts）和动画播放器（scripts/course-player.ts）共用。
import fs from 'node:fs'
import path from 'node:path'

export const ROOT = path.resolve(import.meta.dirname, '../..')
export const CHARS_PER_SEC = 4.5

export type Beat = { n: number; screen: number; pic: string; text: string; src: string; chars: number }
export type Screen = { n: number; name: string; beats: Beat[]; pauses: { after: number; pic: string }[] }

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export const md = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>')
export const speakChars = (s: string) => [...s.replace(/[，。：；？、！\s]/g, '')].length

export function parseScript(file: string): { title: string; screens: Screen[] } {
  const src = fs.readFileSync(file, 'utf8')
  const title = src.match(/^# (.+)$/m)?.[1] ?? ''
  const screens: Screen[] = []
  for (const part of src.split(/\n(?=## 第\d+屏)/).slice(1)) {
    const head = part.match(/^## 第(\d+)屏\s*(.+)$/m)!
    const sc: Screen = { n: Number(head[1]), name: head[2].trim(), beats: [], pauses: [] }
    for (const line of part.split('\n')) {
      if (!line.startsWith('| ')) continue
      const cells = line.replace(/^\| /, '').replace(/ \|$/, '').split(' | ')
      if (/^\d+$/.test(cells[0])) {
        const [n, pic, text, srcTag] = cells
        sc.beats.push({ n: Number(n), screen: sc.n, pic, text, src: srcTag, chars: speakChars(text) })
      } else if (cells[0] === '—') {
        const last = sc.beats.at(-1)
        if (!last) throw new Error(`第${sc.n}屏：暂停行前面没有拍`)
        sc.pauses.push({ after: last.n, pic: cells[1] })
      }
    }
    screens.push(sc)
  }
  return { title, screens }
}

/**
 * reveal: 'spread' 表示这一帧新出现的元素按顺序摊在整帧的旁白里逐个出现（播放器用）；默认一起出现。
 * 以下字段目前只有纸面版帧（<id>.paper.frames.ts）用：
 * - pic：画面说明，覆盖双栏稿画面列（分镜墙显示它）；
 * - dark：暗场帧（深色底、大字）；
 * - lead：这一拍开头先显示的暗场画面（"前半拍"），之后才是 html。
 */
type FrameExtra = { pic?: string; dark?: boolean; lead?: string }
export type Frame = ({ beat: number; html: string; reveal?: 'spread' } & FrameExtra) | ({ after: number; html: string } & Pick<FrameExtra, 'pic'>)
export type Card = { id: string; screen: number; html: string; beats: Beat[]; pause?: string; reveal?: 'spread' } & FrameExtra

export function assemble(screens: Screen[], frames: Frame[]): { cards: Card[]; errors: string[] } {
  const errors: string[] = []
  const beatMap = new Map(screens.flatMap((s) => s.beats.map((b) => [b.n, b] as const)))
  const pauseAfter = new Map(screens.flatMap((s) => s.pauses.map((p) => [p.after, p.pic] as const)))
  const starts = new Map<number, Frame & { beat: number }>()
  const pauses = new Map<number, { html: string; pic?: string }>()
  for (const f of frames) {
    if ('beat' in f) {
      if (!beatMap.has(f.beat)) errors.push(`帧引用了不存在的第${f.beat}拍`)
      if (starts.has(f.beat)) errors.push(`第${f.beat}拍有两帧`)
      starts.set(f.beat, f)
    } else {
      if (!pauseAfter.has(f.after)) errors.push(`双栏稿第${f.after}拍后面没有暂停行`)
      pauses.set(f.after, { html: f.html, pic: f.pic })
    }
  }
  // 只在帧里写了的时候才带上，原版帧生成的 Card 和以前完全一样
  const extra = (f: FrameExtra): FrameExtra => Object.fromEntries(Object.entries({ pic: f.pic, dark: f.dark, lead: f.lead }).filter(([, v]) => v !== undefined))
  for (const [after] of pauseAfter) if (!pauses.has(after)) errors.push(`第${after}拍后的暂停没有画帧`)

  const cards: Card[] = []
  for (const sc of screens) {
    let k = 0
    let cur: Card | undefined
    for (const b of sc.beats) {
      const fr = starts.get(b.n)
      if (fr !== undefined) {
        cur = { id: `${sc.n}-${String(++k).padStart(2, '0')}`, screen: sc.n, html: fr.html, beats: [b], reveal: fr.reveal, ...extra(fr) }
        cards.push(cur)
      } else if (!cur) {
        errors.push(`第${sc.n}屏第一拍（第${b.n}拍）没有帧`)
      } else {
        if (b.pic !== '同上') errors.push(`第${b.n}拍画面有变化（"${b.pic}"），但没有单独的帧`)
        cur.beats.push(b)
      }
      const p = pauses.get(b.n)
      if (p !== undefined) {
        cur = undefined // 暂停之后必须重新起一帧
        cards.push({ id: `${sc.n}-${String(++k).padStart(2, '0')}`, screen: sc.n, html: p.html, beats: [], pause: pauseAfter.get(b.n), ...extra(p) })
      }
    }
  }
  return { cards, errors }
}

export const secs = (beats: Beat[]) => beats.reduce((a, b) => a + b.chars, 0) / CHARS_PER_SEC
export const fmt = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}分${Math.round(s % 60)}秒` : s < 10 ? `${s.toFixed(1)}秒` : `${Math.round(s)}秒`)


/** 画布（640×360）和画面元素的样式，分镜墙和播放器共用 */
export const FRAME_CSS = `/* —— 画布与画面元素（640×360） —— */
.f,.f *{box-sizing:border-box}
.f{width:640px;height:360px;position:relative;background:#fafaf8;color:#333;overflow:hidden;font-size:14px}
.abs{position:absolute}.rel{position:relative}
.t{position:absolute;left:24px;top:14px;font-size:20px;font-weight:700}
.new{outline:3px solid #f08c00!important;outline-offset:2px}
.hl{background:#ffe8cc!important}
.dim{opacity:.35}
.note{font-size:13px;color:#777}
.mini{font-size:11px;color:#999}
.tag{display:inline-block;padding:2px 10px;border-radius:12px;background:#e9ecef;font-size:13px;margin-right:6px}
.tag.big{font-size:18px;padding:4px 14px;background:#d0ebff}
.ed{display:inline-block;border:2px solid #999;border-radius:6px;padding:4px 12px;font:22px/1.4 Consolas,monospace;background:#fff;min-width:130px;margin-right:8px;vertical-align:top}
.ed.big{font-size:30px;min-width:220px}.ed.sm{font-size:15px;min-width:64px;padding:2px 8px}
.ed.flash{box-shadow:0 0 0 3px #d0ebff}
.cur{color:#e03131;font-weight:700}
.inp{border:2px solid #bbb;border-radius:20px;padding:6px 16px;width:280px;background:#fff;font-size:16px}
.keys .key{display:inline-block;border:2px solid #888;border-bottom-width:4px;border-radius:5px;width:36px;text-align:center;font:18px Consolas,monospace;margin-right:8px;background:#fff}
.cells{display:flex;align-items:center}
.cell{border:2px solid #777;display:flex;align-items:center;justify-content:center;font:20px Consolas,monospace;background:#fff;margin-left:-2px;position:relative}
.cells.gap .cell{margin-left:0}
.ct{position:absolute;top:-19px;font-size:11px;color:#555;white-space:nowrap;font-family:sans-serif}
.ci{position:absolute;bottom:-19px;font-size:11px;color:#888;white-space:nowrap;font-family:sans-serif}
.arr{margin:0 6px;color:#555;font-size:18px}
.brace{font:13px Consolas,monospace;color:#555}
.dash{border:2px dashed #999;border-radius:8px;padding:12px;position:relative}
.dl{position:absolute;right:-48px;top:18px;font-size:14px;color:#666}
.gear{font-size:44px;text-align:center;line-height:1}.gear div{font-size:14px}
.goal{font-size:16px;text-align:center;line-height:1.8}
.qc{background:#fff;border:2px solid #4dabf7;border-radius:8px;padding:6px 12px;font-size:14px;width:340px}
.qc .qh{font-weight:700;color:#1971c2}.qc ol{margin:4px 0 0;padding-left:20px}.qc li{margin:2px 0}
.qc li.on{background:#ffe8cc;border-radius:3px}.qc li.ok{color:#2b8a3e}
.qc.big{font-size:20px;width:380px}
.qc.mid{width:220px}
.qc.corner{position:absolute;right:10px;top:10px;width:190px;font-size:10px;padding:4px 8px}
.okm{color:#2b8a3e;margin-left:6px}.nom{color:#c92a2a;margin-left:6px}.okm.big{font-size:22px}
.acc{width:360px}
.row{border:1.5px solid #ccc;border-radius:6px;background:#fff;margin-bottom:4px;padding:3px 10px;display:flex;align-items:center;gap:10px;min-height:24px;font-size:13px}
.row .rn{font-weight:700;width:80px;flex:none}.row .rs{color:#555;font-family:Consolas,monospace}
.row.open{display:block;border-color:#888}.row.open .rn{margin-bottom:2px}
.card{background:#fff;border:1.5px solid #bbb;border-radius:8px;padding:8px 12px}
.card .ch{font-weight:700;margin-bottom:6px}
.log .lr{border:1px solid #ddd;border-radius:4px;padding:1px 8px;font-size:12px;background:#f8f9fa}
.log .la{text-align:center;font-size:10px;line-height:10px;color:#888}
.checks{position:absolute;bottom:10px;left:12px;right:12px}
.card{position:relative}
.ck{border:1px solid #ddd;border-radius:4px;padding:1px 8px;margin-top:3px;font-size:12px;background:#fff}
.tree text{font-size:12px;text-anchor:middle;fill:#333}.tree .nd{fill:#fff;stroke:#888}.tree line{stroke:#888;stroke-width:1.5}
.tree .hl line{stroke:#f08c00;stroke-width:3}
.cands div{margin-bottom:3px}.cands .ed{padding:0 8px}.strike .ed{text-decoration:line-through}
.neq{font-size:30px;margin:0 10px;color:#c92a2a;vertical-align:middle}
.bounce{display:inline-block;border:1px dashed #c92a2a;border-radius:4px;padding:2px 8px;margin-right:8px;color:#c92a2a}
.counter{font:16px Consolas,monospace;padding:2px 8px;display:inline-block}
.qz-h{font-weight:700;color:#1971c2;margin-bottom:4px}.qz-s{font-size:12px;color:#555;margin-bottom:4px}
.opt{border:1px solid #ddd;border-radius:4px;padding:1px 8px;margin:3px 0;font-size:12px}
.btns{text-align:right;margin-top:4px}.btn{display:inline-block;background:#dee2e6;border-radius:4px;padding:1px 14px;font-size:12px}
.pts{margin:6px 0}
.pause{position:absolute;inset:0;background:rgba(255,248,230,.75);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:15px;color:#a06000}
.pause .pi{font-size:46px}
`
