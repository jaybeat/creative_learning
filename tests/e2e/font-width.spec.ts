import { expect, test } from '@playwright/test'

/** HANDOFF M1 验收：在 diagram 块的字体环境下，这些字符各重复 20 次的渲染宽度两两相等；`中` 恰为 2 倍。 */
const NARROW = ['a', '─', '│', '┼', '╱', '►', '▼', '▲', '◄', '●']
const TOLERANCE = 0.5

test('图示块里的字符宽度严格对齐', async ({ page }) => {
  await page.goto('ch02/2-8')
  await page.waitForSelector('.diagram code')
  await page.evaluate(() => document.fonts.ready)

  // fonts.check() 在字体列表里没有匹配项时也返回 true，所以用 load() 拿实际匹配到的 FontFace 数量
  const faces = await page.evaluate(async () => (await document.fonts.load('13px BookMono')).length)
  expect(faces, 'BookMono webfont 应已下发并加载').toBeGreaterThan(0)

  const widths = await page.evaluate(
    ({ narrow }) => {
      const code = document.querySelector('.diagram code') as HTMLElement
      const measure = (ch: string) => {
        const span = document.createElement('span')
        span.textContent = ch.repeat(20)
        span.style.whiteSpace = 'pre'
        code.appendChild(span)
        const w = span.getBoundingClientRect().width
        span.remove()
        return w
      }
      const font = getComputedStyle(code).fontFamily
      return { font, narrow: narrow.map(measure), wide: measure('中') }
    },
    { narrow: NARROW },
  )

  expect(widths.font.startsWith('BookMono')).toBe(true)
  const ref = widths.narrow[0]
  expect(ref).toBeGreaterThan(0)
  for (let i = 0; i < NARROW.length; i++) {
    expect(Math.abs(widths.narrow[i] - ref), `「${NARROW[i]}」宽度 ${widths.narrow[i]} 应等于「a」宽度 ${ref}`).toBeLessThanOrEqual(TOLERANCE)
  }
  expect(Math.abs(widths.wide - ref * 2), `「中」宽度 ${widths.wide} 应为 ${ref * 2}`).toBeLessThanOrEqual(TOLERANCE)
})

test('代码块内没有粗体、斜体和连字', async ({ page }) => {
  await page.goto('ch02/2-8')
  await page.waitForSelector('.language-c code')
  const bad = await page.evaluate(() => {
    const spans = document.querySelectorAll('.vp-doc [class*="language-"] code span')
    let bold = 0
    let italic = 0
    let ligatures = 0
    for (const s of spans) {
      const cs = getComputedStyle(s)
      if (Number(cs.fontWeight) >= 600) bold++
      if (cs.fontStyle === 'italic') italic++
      if (cs.fontVariantLigatures !== 'none') ligatures++
    }
    return { bold, italic, ligatures, total: spans.length }
  })
  expect(bad.total).toBeGreaterThan(0)
  expect(bad.bold).toBe(0)
  expect(bad.italic).toBe(0)
  expect(bad.ligatures).toBe(0)
})
