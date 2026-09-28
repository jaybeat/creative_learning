import { expect, test, type Page } from '@playwright/test'

// 评论与登录：跑在 scripts/serve-e2e.ts（构建产物 + 本地 API + 内存数据库）上
const BASE = 'http://localhost:4174/'
test.use({ baseURL: BASE })

const PAGE = 'ch02/2-8'
const QUOTE = '满了就把数组变长'

/** 用脚本选中第一段包含 text 的正文（真实拖选在手机模拟下不稳定），等划词按钮出现 */
async function selectText(page: Page, text: string) {
  await page.evaluate((t) => {
    const walker = document.createTreeWalker(document.querySelector('.vp-doc')!, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const i = (n as Text).data.indexOf(t)
      if (i < 0) continue
      const r = document.createRange()
      r.setStart(n, i)
      r.setEnd(n, i + t.length)
      const sel = getSelection()!
      sel.removeAllRanges()
      sel.addRange(r)
      return
    }
    throw new Error(`正文里找不到：${t}`)
  }, text)
  await expect(page.locator('.cl-sel-btn')).toBeVisible()
}

async function login(page: Page, email: string, name: string) {
  await page.locator('.cl-nav-btn', { hasText: '登录' }).click()
  await page.locator('.cl-dialog input[type=email]').fill(email)
  await page.locator('.cl-dialog button[type=submit]').click()
  await expect(page.locator('.cl-dialog')).toContainText('验证码已发送')
  const code = await (await page.request.get(`${BASE}__test/last-code?email=${encodeURIComponent(email)}`)).text()
  await page.locator('.cl-dialog input[autocomplete=one-time-code]').fill(code)
  await page.locator('.cl-dialog button[type=submit]').click()
  await expect(page.locator('.cl-dialog-title')).toHaveText('设置昵称')
  await page.locator('.cl-dialog input[autocomplete=nickname]').fill(name)
  await page.locator('.cl-dialog button[type=submit]').click()
  await expect(page.locator('.cl-dialog')).toHaveCount(0)
  await expect(page.locator('.cl-nav-btn')).toContainText(name)
}

const uid = () => Math.random().toString(36).slice(2, 8)

test('未登录：能看评论入口，划词后提示登录', async ({ page }) => {
  await page.goto(PAGE)
  await expect(page.locator('.cl-page-comments')).toContainText('本页评论')
  await selectText(page, QUOTE)
  await page.locator('.cl-sel-btn').click()
  await expect(page.locator('.cl-panel')).toContainText('登录后才能发表评论')
})

test('登录 → 划词评论 → 刷新后高亮仍在 → 回复 → 删除', async ({ page }) => {
  // 完整流程有十几步请求，WebKit 在慢机器上要 20–30 秒
  test.setTimeout(60_000)
  const email = `reader-${uid()}@e2e.test`
  const name = `读者${uid()}`
  const quote = QUOTE
  await page.goto(PAGE)
  await login(page, email, name)

  await selectText(page, quote)
  await page.locator('.cl-sel-btn').click()
  const body = `这里没看懂 ${uid()}`
  await page.locator('.cl-panel textarea').fill(body)
  await page.locator('.cl-panel button[type=submit]').click()
  const thread = page.locator('.cl-panel .cl-thread')
  await expect(thread).toContainText(body)
  await expect(thread.locator('.cl-quote')).toContainText(quote)

  // 刷新：登录状态保持，原文重新定位成功（不是「原文已修改」）
  await page.reload()
  await expect(page.locator('.cl-nav-btn')).toContainText(name)
  await page.locator('.cl-page-comments button').click()
  const mine = page.locator('.cl-panel .cl-thread', { hasText: body })
  await expect(mine).toBeVisible()
  await expect(mine.locator('.cl-tag', { hasText: '原文已修改' })).toHaveCount(0)
  const highlighted = await page.evaluate(() => (CSS as unknown as { highlights?: Map<string, Set<Range>> }).highlights?.get('cl-comment')?.size ?? -1)
  // -1：浏览器不支持 CSS Custom Highlight API（只是不画高亮，功能照常）
  expect(highlighted === -1 || highlighted >= 1).toBe(true)

  // 回复
  await mine.locator('.cl-reply .cl-link', { hasText: '回复' }).click()
  await mine.locator('textarea').fill('补充一句')
  await mine.locator('button[type=submit]').click()
  await expect(mine.locator('.cl-comment.is-reply')).toContainText('补充一句')

  // 删除回复与评论
  page.on('dialog', (d) => void d.accept())
  await mine.locator('.cl-comment.is-reply .cl-link', { hasText: '删除' }).click()
  await expect(mine.locator('.cl-comment.is-reply')).toHaveCount(0)
  await mine.locator('.cl-link', { hasText: '删除' }).first().click()
  await expect(page.locator('.cl-panel .cl-thread', { hasText: body })).toHaveCount(0)
})

test('评论面板打开时没有页面级横向滚动', async ({ page }) => {
  await page.goto(PAGE)
  await page.locator('.cl-page-comments button').click()
  await expect(page.locator('.cl-panel')).toBeVisible()
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
})

test('管理页：普通读者看不到', async ({ page }) => {
  await page.goto('admin')
  await login(page, `r-${uid()}@e2e.test`, `读者${uid()}`)
  await expect(page.locator('.cl-admin')).toContainText('只有作者可以查看')
})
