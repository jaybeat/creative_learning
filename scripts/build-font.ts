import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import subsetFont from 'subset-font'
import { CHAPTERS_DIR, FONTS_OUT_DIR, FONT_SRC, GENERATED_DIR } from './lib/paths'
import { collectCodeChars, withAscii, type CharHit } from './lib/charset'
import { checkFont, formatProblems, openFont } from './lib/font-check'

export const FONT_FAMILY = 'BookMono'

/** 扫描 book/chapters 下所有章节（含 draft），返回字符 → 首次出现位置。 */
export function scanChapters(dir: string = CHAPTERS_DIR): Map<string, CharHit> {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
  const hits: CharHit[] = []
  for (const f of files) hits.push(...collectCodeChars(fs.readFileSync(path.join(dir, f), 'utf8'), f))
  return withAscii(hits)
}

export async function runBuildFont(): Promise<void> {
  if (!fs.existsSync(FONT_SRC)) {
    throw new Error(
      `找不到字体源文件 ${FONT_SRC}\n` +
        '请从 https://github.com/be5invis/Sarasa-Gothic/releases（v1.0.41）下载 SarasaFixedSC-TTF-Unhinted 包，' +
        '解压出 SarasaFixedSC-Regular.ttf 放到 tools/fonts/ 下。',
    )
  }
  const chars = scanChapters()
  const ttf = fs.readFileSync(FONT_SRC)
  const font = openFont(ttf)

  // 1. 字宽硬校验（源字体）
  const problems = checkFont(font, chars)
  if (problems.length) {
    throw new Error(
      `字体校验失败：以下 ${problems.length} 个字符在 Sarasa Fixed SC 里缺字形或字宽不对，图示会歪。\n` +
        formatProblems(problems) +
        '\n请换用字体支持的等价符号，或联系维护者更新字体。',
    )
  }

  // 2. 子集化为 woff2
  const text = [...chars.keys()].join('')
  // noLayoutClosure：不为 GSUB 替换做字形闭包（Fixed 变体本就无连字，CSS 里还有 font-variant-ligatures:none 兜底）
  const woff2 = await subsetFont(ttf, text, { targetFormat: 'woff2', noLayoutClosure: true })
  const hash = createHash('sha256').update(woff2).digest('hex').slice(0, 8)
  const fileName = `bookmono.${hash}.woff2`

  // 3. 再打开子集，确认每个字符都还在
  const subset = openFont(Buffer.from(woff2))
  const lost = [...chars.keys()].filter((ch) => !subset.hasGlyphForCodePoint(ch.codePointAt(0)!))
  if (lost.length) {
    throw new Error(`子集化后丢失了字符：${lost.map((c) => JSON.stringify(c)).join(' ')}`)
  }

  // 4. 写产物
  fs.rmSync(FONTS_OUT_DIR, { recursive: true, force: true })
  fs.mkdirSync(FONTS_OUT_DIR, { recursive: true })
  fs.writeFileSync(path.join(FONTS_OUT_DIR, fileName), woff2)

  fs.mkdirSync(GENERATED_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(GENERATED_DIR, 'font.css'),
    [
      `/* 由 scripts/build-font.ts 生成，勿手改 */`,
      `@font-face {`,
      `  font-family: "${FONT_FAMILY}";`,
      `  src: url("/fonts/${fileName}") format("woff2");`,
      `  font-weight: 400;`,
      `  font-style: normal;`,
      `  font-display: swap;`,
      `}`,
      '',
    ].join('\n'),
  )
  fs.writeFileSync(
    path.join(GENERATED_DIR, 'font.json'),
    JSON.stringify({ family: FONT_FAMILY, file: fileName, chars: chars.size, bytes: woff2.length }, null, 2) + '\n',
  )

  console.log(`[build-font] ${chars.size} 个字符，${fileName}（${(woff2.length / 1024).toFixed(1)} KB），字宽校验通过`)
}

if (process.argv[1]?.endsWith('build-font.ts')) {
  runBuildFont().catch((err) => {
    console.error(`[build-font] ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  })
}
