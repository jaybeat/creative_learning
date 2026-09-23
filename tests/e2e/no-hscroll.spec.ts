import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

interface SidebarItem {
  text: string
  link?: string
  items?: SidebarItem[]
}

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const sidebar: SidebarItem[] = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'site/.vitepress/generated/sidebar.json'), 'utf8'),
)

const links: string[] = ['/']
for (const ch of sidebar) {
  if (ch.link) links.push(ch.link)
  for (const s of ch.items ?? []) if (s.link) links.push(s.link)
}

/** 去掉开头的 `/`，让 baseURL（可能带 SITE_BASE 前缀）生效 */
const rel = (link: string) => link.replace(/^\//, '')

test.describe('375px 视口无页面级横向滚动', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) > 500, '只在手机视口检查')

  for (const link of links) {
    test(`页面 ${link}`, async ({ page }) => {
      await page.goto(rel(link))
      await page.waitForSelector('.vp-doc')
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(scrollWidth, `${link} 出现了页面级横向滚动`).toBeLessThanOrEqual(clientWidth)
    })
  }
})

test.describe('宽内容在各自容器内滚动', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) > 500, '只在手机视口检查')

  test('超过 8 列的宽表保持网格形态，在表格容器内横向滚动', async ({ page }) => {
    // 哪一节有宽表随书稿变化：从构建产物里找；一个都没有就跳过
    const dir = path.join(ROOT, 'site/.vitepress/dist/ch02')
    const file = fs.readdirSync(dir).sort().find((f) => f.endsWith('.html') && fs.readFileSync(path.join(dir, f), 'utf8').includes('wide-table'))
    test.skip(!file, '当前书稿没有超过 8 列的表格')
    await page.goto(`ch02/${file!.replace(/\.html$/, '')}`)
    const table = page.locator('table.wide-table').first()
    await expect(table).toBeVisible()
    const r = await table.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      rows: el.querySelectorAll('tr').length,
      cells: el.querySelectorAll('tr:first-child th').length,
    }))
    expect(r.cells).toBeGreaterThan(8)
    expect(r.rows).toBeLessThanOrEqual(3)
    expect(r.scrollWidth).toBeGreaterThan(r.clientWidth)
  })

  test('长代码不折行，在代码块内横向滚动', async ({ page }) => {
    await page.goto('ch02/2-3')
    const info = await page.evaluate(() => {
      const pres = [...document.querySelectorAll('.vp-doc [class*="language-"] pre')] as HTMLElement[]
      const overflowing = pres.filter((p) => p.scrollWidth > p.clientWidth)
      const wrapped = pres.filter((p) => getComputedStyle(p).whiteSpace !== 'pre')
      return { total: pres.length, overflowing: overflowing.length, wrapped: wrapped.length }
    })
    expect(info.total).toBeGreaterThan(0)
    expect(info.wrapped).toBe(0)
    expect(info.overflowing).toBeGreaterThan(0)
  })
})
