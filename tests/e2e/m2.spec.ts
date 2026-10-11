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
  // 期望值对应修订版（17 节）的节号
  const cases: Array<[string, RegExp]> = [
    ['头结点', /2\.13/],
    ['扩容', /2\.8/],
    ['malloc', /2\.(8|9|1[0-2])/],
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
    // 分页的节里，长代码可能在后面的页上：先翻到它所在的那一页
    const n = await page.locator('[data-fold]').first().evaluate((el) => {
      const pg = el.closest('.lesson-page')
      return pg ? [...document.querySelectorAll('.lesson-page')].indexOf(pg) + 1 : 0
    })
    if (n > 0) await page.goto(`${pageWithFold()}#p${n}`)
    const box = page.locator('[data-fold]').first()
    await expect(box).toBeVisible()
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
    // 2.8 分页了：页底的上一节/下一节（已读标记就挂在那里）只在最后一页出现
    await page.goto('ch02/2-8#p9')
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForFunction(() => {
      const raw = localStorage.getItem('ds-book:progress')
      return raw !== null && JSON.parse(raw).read.some((e: { path: string }) => e.path === '/ch02/2-8')
    })

    await page.goto('')
    const cont = page.locator('.continue-reading .cr-button')
    await expect(cont).toHaveText(/继续阅读：2\.8/)
    await expect(page.locator('.book-chapters .cl-meta').filter({ hasText: '已读 1/17 节' })).toHaveCount(1)

    await page.reload()
    await expect(page.locator('.continue-reading .cr-button')).toHaveText(/继续阅读：2\.8/)

    await page.goto('ch02/')
    await expect(page.locator('.VPSidebar a.link.is-read[href*="2-8"]')).toHaveCount(1)
    await expect(page.locator('.ci-list li.is-read')).toHaveCount(1)
    await expect(page.locator('.chapter-index .cr-button')).toHaveText(/继续阅读：2\.8/)

    await page.goto('')
    await page.locator('.continue-reading .cr-button').click()
    await expect(page).toHaveURL(/\/ch02\/2-8$/)

    await page.goto('')
    await expect(page.locator('.book-chapters .cl-bar')).toHaveCount(1)
    await page.locator('.home-chapters .cr-clear').click()
    await expect(page.locator('.continue-reading .cr-button')).toHaveText('开始阅读')
    await expect(page.locator('.book-chapters .cl-meta').filter({ hasText: '已读' })).toHaveCount(0)
    await expect(page.locator('.home-chapters .cr-clear')).toHaveCount(0)
  })

  test('首页：封面（书名、副标题、图、一个按钮）与目录', async ({ page }) => {
    await page.goto('')
    const hero = page.locator('.home-hero')
    await expect(hero.locator('h1')).toContainText('数据结构')
    await expect(hero.locator('h1')).toContainText('从问题到表示')
    await expect(hero.locator('.home-title-en')).toHaveText(/From Problems to Representations/i)
    await expect(hero.locator('.home-tagline')).toHaveText('把复杂概念简化为能自己动手解决的问题')
    await expect(hero.locator('svg.cover-figure')).toHaveCount(1)
    await expect(hero.locator('a, button')).toHaveCount(1)
    await expect(page.locator('.home-idea')).toHaveCount(0)
    await expect(page.locator('.home-chapters a[href*="/ch01/"]')).toHaveCount(1)
    await expect(page.locator('.home-chapters .cl-question').first()).not.toBeEmpty()
    await expect(page.locator('.VPSidebar')).toHaveCount(0)
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
    await page.goto('ch02/')
    await expect(page.locator('.VPSidebar a.link.is-read')).toHaveCount(0)
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
      // 这里的静态预览服务没有 /api（评论接口），那些 404 与本测试无关
      if (m.type() === 'error' && !m.location().url.includes('/api/')) errors.push(m.text())
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
    // 分页的节里 ← → 先翻页，所以从 2.8 的最后一页开始
    await page.goto('ch02/2-8#p9')
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
    type Item = { link?: string; items?: Item[] }
    const sidebar = JSON.parse(fs.readFileSync(path.join(ROOT, 'site/.vitepress/generated/sidebar.json'), 'utf8')) as Item[]
    const firstLink = sidebar[0].link!
    // 章下可能有「练习」分组（没有 link，只有子项）：取最深的最后一项
    let last: Item = sidebar.at(-1)!
    while (last.items?.length) last = last.items.at(-1)!
    const lastLink = last.link!
    await page.goto(firstLink.replace(/^\//, ''))
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(300)
    await expect(page).toHaveURL(new RegExp(firstLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'))
    await page.goto(lastLink.replace(/^\//, ''))
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(300)
    await expect(page).toHaveURL(new RegExp(lastLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'))
  })
})

test.describe('标题锚点', () => {
  // 「小节标题带 # 锚点链接」：第1、2章都没有 ### 小节了（2.17 改版后），等后面的章有小节时再加回来

  test('加粗段落标题进右侧大纲，锚点为纯 ASCII', async ({ page, viewport }) => {
    await page.goto('ch02/2-8')
    await expect(page.locator('h3.para-title').first()).toHaveAttribute('id', '2-8-p1')
    if ((viewport?.width ?? 1280) >= 1280) {
      await expect(page.locator('.VPDocAsideOutline a.outline-link[href="#2-8-p1"]')).toHaveCount(1)
    }
  })

  test('本节问题卡片与结尾卡片', async ({ page }) => {
    // 改版后的节删掉了练一练，这条用还没改版、仍有练一练的第1章
    await page.goto('ch01/1-2')
    await expect(page.locator('blockquote.milestone-question .ms-question')).toHaveCount(1)
    await expect(page.locator('blockquote.milestone:not(.milestone-question) .ms-practice#practice')).toHaveCount(1)
  })
})
