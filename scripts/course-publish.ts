// 把一节课程动画发布到网站：npm run course:publish -- 2-1
// 先用 npm run course:player -- <id> 生成播放器（docs/course/player/<id>/，不进仓库），
// 再用本脚本复制到 site/public/course/<id>/（进仓库，Vercel 直接部署）：
//   index.html   质感版播放器（节页用 iframe 嵌入，网址带 ?embed）
//   audio/*.mp3  播放器实际用到的配音
//   meta.json    时长、各屏名称和起止秒数；构建时据此给这一节加 frontmatter video，章首目录显示"▶ 时长"
// 目标目录先清空再写，删掉旧的、不再用到的 mp3。
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib/course'

type Data = { total: number; steps: { k: string; audio?: string }[]; screens: { n: number; name: string; start: number; end: number }[] }

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function main() {
  const id = process.argv[2] ?? '2-1'
  const src = path.join(ROOT, 'docs/course/player', id)
  const html = path.join(src, 'index.html')
  if (!fs.existsSync(html)) throw new Error(`找不到 ${path.relative(ROOT, html)}，先运行 npm run course:player -- ${id}`)
  const page = fs.readFileSync(html, 'utf8')
  const m = page.match(/const DATA = (\{.*?\});<\/script>/s)
  if (!m) throw new Error('播放器页面里找不到 DATA')
  const data = JSON.parse(m[1]) as Data
  // 地址后面的 ?v= 是内容指纹（防缓存），文件名不含它
  const audio = [...new Set(data.steps.flatMap((s) => (s.audio ? [s.audio.replace(/\?.*$/, '')] : [])))]

  const out = path.join(ROOT, 'site/public/course', id)
  fs.rmSync(out, { recursive: true, force: true })
  fs.mkdirSync(path.join(out, 'audio'), { recursive: true })
  fs.copyFileSync(html, path.join(out, 'index.html'))
  let bytes = fs.statSync(html).size
  for (const a of audio) {
    const from = path.join(src, a)
    if (!fs.existsSync(from)) throw new Error(`缺少配音 ${path.relative(ROOT, from)}`)
    fs.copyFileSync(from, path.join(out, a))
    bytes += fs.statSync(from).size
  }
  const meta = {
    id,
    seconds: Math.round(data.total),
    duration: fmt(data.total),
    screens: data.screens.map((s) => ({ name: s.name, start: Math.round(s.start * 10) / 10, end: Math.round(s.end * 10) / 10 })),
  }
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 2) + '\n')
  console.log(`[course:publish] ${path.relative(ROOT, out)}：时长 ${meta.duration}，${audio.length} 段配音，共 ${(bytes / 1024 / 1024).toFixed(1)} MB`)
}

main()
