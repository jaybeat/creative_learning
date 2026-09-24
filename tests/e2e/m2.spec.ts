import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))

const isMobile = (viewport: { width: number } | null) => (viewport?.width ?? 1280) < 500

async function openSearch(page: Page) {
  await page.locator('.VPNavBarSearch button').first().click()
  await page.waitForSelector('#localsearch-input')
}

test.describe('搜索', () => {
  // 期望值对应修订版（15 节）的节号
  const cases: Array<[string, RegExp]> = [
    ['头结点', /2\.11/],
    ['扩容', /2\.8/],
    ['malloc', /2\.(8|9)/],
    ['值传递', /2\.5/],
  ]
  for (const [kw, expected] of cases) {
    test(`搜「${kw}」命中正确的节`, async ({ page }) => {
      await page.goto('ch02/2-1')
      await openSearch(page)
      await page.fill('#localsearch-input', kw)
      const first = page.locator('.results li a').first()
      await expect(first).toBeVisible()
      const label = await first.getAttribute('aria-label')
      expect(label, `「${kw}」的首个结果是 ${label}`).toMatch(expected)
      await page.keyboard.press('Escape')
    })
  }
})

/** 从构建产物里找第一个带长代码块的页面（哪一节有 40 行以上的代码随书稿变化） */
function pageWithFold(): string {
  const dir = path.join(ROOT, 'site/.vitepress/dist/ch02')
  for (const f of fs.readdirSync(dir).sort()) {
    if (f.endsWith('.html') && fs.readFileSync(path.join(dir, f), 'utf8').includes('data-fold=')) return `ch02/${f.replace(/\.html$/, '')}`
  }
  throw new Error('构建产物里没有任何 data-fold 代码块')
}

test.describe('长代码折叠', () => {
  test('超过 40 行的 C 代码默认折叠，点击展开', async ({ page }) => {
    await page.goto(pageWithFold())
    const box = page.locator('[data-fold]').first()
    await expect(box).toHaveClass(/is-folded/)
    const pre = box.locator('pre')
    const before = await pre.evaluate((el) => el.clientHeight)
    await expect(box.locator('.fold-toggle')).toHaveText(/展开全部（共 \d+ 行）/)
    await box.locator('.fold-toggle').click()
    await expect(box).not.toHaveClass(/is-folded/)
    const after = await pre.evaluate((el) => el.clientHeight)
    expect(after).toBeGreaterThan(before)
    await expect(box.locator('.fold-toggle')).toHaveCount(0)
  })

  test('图示块不折叠', async ({ page }) => {
    await page.goto('ch02/2-8')
    await expect(page.locator('.diagram')).not.toHaveCount(0)
    await expect(page.locator('.diagram[data-fold]')).toHaveCount(0)
  })
})

test.describe('阅读进度', () => {
  test('读到页底即已读；首页继续阅读；侧栏 ✓；清除', async ({ page }) => {
    page.on('dialog', (d) => d.accept())
    await page.goto('ch02/2-8')
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForFunction(() => {
      const raw = localStorage.getItem('ds-book:progress')
      return raw !== null && JSON.parse(raw).read.some((e: { path: string }) => e.path === '/ch02/2-8')
    })

    await page.goto('')
    const cont = page.locator('.continue-reading .cr-button')
    await expect(cont).toHaveText(/继续阅读：2\.8/)
    await expect(page.locator('.VPSidebar a.link.is-read[href*="2-8"]')).toHaveCount(1)

    await page.reload()
    await expect(page.locator('.continue-reading .cr-button')).toHaveText(/继续阅读：2\.8/)

    await page.goto('ch02/')
    await expect(page.locator('.ci-list li.is-read')).toHaveCount(1)
    await expect(page.locator('.chapter-index .cr-button')).toHaveText(/继续阅读：2\.8/)

    await page.goto('')
    await page.locator('.continue-reading .cr-button').click()
    await expect(page).toHaveURL(/\/ch02\/2-8$/)

    await page.goto('')
    await page.locator('.cr-clear').click()
    await expect(page.locator('.continue-reading .cr-button')).toHaveText('开始阅读')
    await expect(page.locator('.VPSidebar a.link.is-read')).toHaveCount(0)
  })

  test('章节重排后，标题不再匹配的旧记录不显示', async ({ page }) => {
    await page.goto('')
    await page.evaluate(() => {
      localStorage.setItem(
        'ds-book:progress',
        JSON.stringify({
          last: { path: '/ch02/2-8', title: '2.8 链表：关系存哪里（旧版标题）', scrollY: 0, at: 1 },
          read: [{ path: '/ch02/2-8', title: '2.8 链表：关系存哪里（旧版标题）' }, '/ch02/2-1'],
        }),
      )
    })
    await page.reload()
    await expect(page.locator('.continue-reading .cr-button')).toHaveText('开始阅读')
    await expect(page.locator('.VPSidebar a.link.is-read')).toHaveCount(0)
    await page.goto('ch02/')
    await expect(page.locator('.ci-list li.is-read')).toHaveCount(0)
    await page.evaluate(() => localStorage.removeItem('ds-book:progress'))
  })

  test('无 hydration 警告', async ({ page }) => {
    const bad: string[] = []
    page.on('console', (m) => {
      if ((m.type() === 'warning' || m.type() === 'error') && /hydration|mismatch/i.test(m.text())) bad.push(m.text())
    })
    for (const p of ['', 'ch02/', 'ch02/2-8']) {
      await page.goto(p)
      await page.waitForSelector('.vp-doc')
    }
    expect(bad).toEqual([])
  })

  test('隐私模式（localStorage 抛异常）下不报错', async ({ browser, baseURL }) => {
    // 模拟隐私模式 / 配额用尽：读取正常，写入抛异常（Safari 隐私模式的历史行为）。
    // 只对本站自己的键生效：VitePress 内部（深色模式偏好等）用 VueUse 写入失败时会 console.error，
    // 那不在本站代码的控制范围内，这里验收的是本站的进度 / 字号代码全部 try/catch 了。
    const ctx = await browser.newContext({ baseURL: baseURL! })
    await ctx.addInitScript(() => {
      const boom = <T extends (...args: never[]) => unknown>(fn: T) =>
        function (this: Storage, ...args: unknown[]) {
          if (String(args[0]).startsWith('ds-book')) throw new DOMException('QuotaExceeded', 'QuotaExceededError')
          return (fn as unknown as (...a: unknown[]) => unknown).apply(this, args)
        }
      Storage.prototype.setItem = boom(Storage.prototype.setItem) as typeof Storage.prototype.setItem
      Storage.prototype.removeItem = boom(Storage.prototype.removeItem) as typeof Storage.prototype.removeItem
    })
    const page = await ctx.newPage()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    for (const p of ['', 'ch02/', 'ch02/2-8']) {
      await page.goto(p)
      await page.waitForSelector('.vp-doc')
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await page.waitForTimeout(300)
    }
    await page.locator('.font-size-switch button').nth(2).click({ force: true })
    expect(errors).toEqual([])
    await ctx.close()
  })
})

test.describe('字号调节', () => {
  test.skip(({ viewport }) => isMobile(viewport), '桌面视口检查')

  test('三档切换并持久化', async ({ page }) => {
    await page.goto('ch02/2-8')
    const size = () => page.locator('.vp-doc p').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    const base = await size()
    await page.locator('.font-size-switch button').nth(2).click()
    expect(await size()).toBeGreaterThan(base)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-font-size', 'l')
    expect(await size()).toBeGreaterThan(base)
    await page.locator('.font-size-switch button').nth(1).click()
    expect(await size()).toBeCloseTo(base, 1)
    await expect(page.locator('html')).not.toHaveAttribute('data-font-size', /./)
  })
})

test.describe('键盘翻节', () => {
  test('← → 翻节，焦点在搜索框时不触发', async ({ page }) => {
    await page.goto('ch02/2-8')
    await page.keyboard.press('ArrowRight')
    await expect(page).toHaveURL(/\/ch02\/2-9$/)
    await expect(page.locator('.vp-doc h1')).toHaveText(/^2\.9/)
    await page.keyboard.press('ArrowLeft')
    await expect(page).toHaveURL(/\/ch02\/2-8$/)
    await expect(page.locator('.vp-doc h1')).toHaveText(/^2\.8/)

    await openSearch(page)
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(300)
    await expect(page).toHaveURL(/\/ch02\/2-8$/)
    await page.keyboard.press('Escape')
  })

  test('全书第一页按 ← 不动，最后一页按 → 不动', async ({ page }) => {
    // 全书第一页 / 最后一页从侧栏数据取，随书稿变化
    const sidebar = JSON.parse(fs.readFileSync(path.join(ROOT, 'site/.vitepress/generated/sidebar.json'), 'utf8')) as Array<{ link: string; items: Array<{ link: string }> }>
    const firstLink = sidebar[0].link
    await page.goto(firstLink.replace(/^\//, ''))
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(300)
    await expect(page).toHaveURL(new RegExp(firstLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'))
    const lastLink = sidebar.at(-1)!.items.at(-1)!.link
    await page.goto(lastLink.replace(/^\//, ''))
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(300)
    await expect(page).toHaveURL(new RegExp(lastLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'))
  })
})

test.describe('标题锚点', () => {
  test('小节标题带 # 锚点链接', async ({ page }) => {
    await page.goto('ch02/2-9')
    const anchor = page.locator('h2 a.header-anchor').first()
    await expect(anchor).toHaveAttribute('href', '#2-9-1')
  })

  test('加粗段落标题进右侧大纲，锚点为纯 ASCII', async ({ page, viewport }) => {
    await page.goto('ch02/2-8')
    await expect(page.locator('h3.para-title').first()).toHaveAttribute('id', '2-8-p1')
    if ((viewport?.width ?? 1280) >= 1280) {
      await expect(page.locator('.VPDocAsideOutline a.outline-link[href="#2-8-p1"]')).toHaveCount(1)
    }
  })

  test('本节问题卡片与结尾卡片', async ({ page }) => {
    await page.goto('ch02/2-8')
    await expect(page.locator('blockquote.milestone-question .ms-question')).toHaveCount(1)
    await expect(page.locator('blockquote.milestone:not(.milestone-question) .ms-practice#practice')).toHaveCount(1)
  })
})
