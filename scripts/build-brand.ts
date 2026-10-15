import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import subsetFont from 'subset-font'
import { DARK_TOKENS, TOKENS } from './lib/clean-tokens'
import { GENERATED_DIR, ROOT, SITE_DIR } from './lib/paths'
import { writeIfChanged } from './lib/fs-utils'

/**
 * 网站外壳的质感层（课程地图、节页顶栏、抽屉）：
 * 1. 令牌：把 clean-tokens.ts 的色值写成 generated/brand.css 里的 --cl-* 变量（浅色 + 深色），和课程播放器同一份来源；
 * 2. 宋体：标题用思源宋体子集 BrandSerif。源字体 25 MB 不进仓库，所以子集文件进仓库（site/public/brand/），
 *    字表 tools/fonts/brand-serif.chars.txt 只增不减：有源字体时缺字就补进去重新子集化；没有源字体（Vercel）时直接用仓库里的，
 *    缺的字打警告，浏览器回退到系统宋体。
 * 必须在 build-content 之后运行（要读 generated/book.json）。
 */
const SERIF_SRC = path.join(ROOT, 'tools/fonts/NotoSerifSC-wght.ttf')
const CHARS_FILE = path.join(ROOT, 'tools/fonts/brand-serif.chars.txt')
const OUT_DIR = path.join(SITE_DIR, 'public', 'brand')

/** 用宋体显示的文字：章名、章的问题（课程地图卡片标题"线性表：做一个单行编辑器"）、节名（首页"继续学习"卡、动画结束卡片），再加数字和几个标点 */
function serifText(): string {
  const book = JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, 'book.json'), 'utf8')) as {
    title: string
    chapters: { title: string; question: string; sections: { title: string }[]; problems: { items: { title: string }[] } | null }[]
  }
  const text = book.chapters.map((c) => c.title + c.question + c.sections.map((s) => s.title).join('') + (c.problems?.items.map((p) => p.title).join('') ?? ''))
  return book.title + text.join('') + '第章0123456789.：·'
}

const uniq = (s: string) => [...new Set([...s].filter((c) => c.trim()))].sort().join('')

async function buildSerif(): Promise<string | null> {
  const want = uniq(serifText())
  const have = fs.existsSync(CHARS_FILE) ? fs.readFileSync(CHARS_FILE, 'utf8').trim() : ''
  const missing = [...want].filter((c) => !have.includes(c))
  const existing = fs.existsSync(OUT_DIR) ? fs.readdirSync(OUT_DIR).find((f) => /^serif\.[0-9a-f]+\.woff2$/.test(f)) : undefined

  if (!missing.length && existing) return existing
  if (!fs.existsSync(SERIF_SRC)) {
    if (missing.length) console.warn(`[build-brand] 宋体子集缺 ${missing.length} 个字（${missing.join('')}），没有源字体 ${path.relative(ROOT, SERIF_SRC)}，这些字回退到系统宋体`)
    return existing ?? null
  }
  const chars = uniq(have + want)
  const woff2 = await subsetFont(fs.readFileSync(SERIF_SRC), chars, { targetFormat: 'woff2' })
  const file = `serif.${createHash('sha256').update(woff2).digest('hex').slice(0, 8)}.woff2`
  fs.mkdirSync(OUT_DIR, { recursive: true })
  for (const f of fs.readdirSync(OUT_DIR)) if (/^serif\..*\.woff2$/.test(f) && f !== file) fs.rmSync(path.join(OUT_DIR, f))
  writeIfChanged(path.join(OUT_DIR, file), Buffer.from(woff2))
  writeIfChanged(CHARS_FILE, chars + '\n')
  console.log(`[build-brand] 宋体子集 ${file}：${[...chars].length} 字，${(woff2.length / 1024).toFixed(0)} KB`)
  return file
}

export async function runBuildBrand(): Promise<void> {
  const serif = await buildSerif()
  const vars = (t: Record<string, string>) => Object.entries(t).map(([k, v]) => `  --cl-${k.slice(2)}: ${v};`).join('\n')
  const css = [
    `/* 由 scripts/build-brand.ts 生成，勿手改。色值来源 scripts/lib/clean-tokens.ts */`,
    serif
      ? `@font-face {\n  font-family: "BrandSerif";\n  src: url("/brand/${serif}") format("woff2");\n  font-weight: 200 900;\n  font-display: swap;\n}`
      : '',
    `:root {\n${vars(TOKENS)}\n  --cl-serif: BrandSerif, "Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif;\n}`,
    `.dark {\n${vars(DARK_TOKENS)}\n}`,
    // 课程动画只有浅色：全屏学习层（CourseSwitch.vue）在深色模式下也用浅色令牌
    `.cl-light {\n${vars(TOKENS)}\n}`,
    '',
  ]
    .filter((x) => x !== '')
    .join('\n')
  writeIfChanged(path.join(GENERATED_DIR, 'brand.css'), css + '\n')
}

if (process.argv[1]?.endsWith('build-brand.ts')) {
  runBuildBrand().catch((err) => {
    console.error(`[build-brand] ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  })
}
