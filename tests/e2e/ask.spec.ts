import { expect, test, type Page } from '@playwright/test'
import { login as loginAt } from './helpers'

// 问 AI（theme/ask/AskPanel.vue、server/ask.ts）：跑在 scripts/serve-e2e.ts 上，模型是把问题复述回来的假模型
const BASE = 'http://localhost:4174/'
const login = (page: Page, email: string, name: string) => loginAt(page, BASE, email, name)
test.use({ baseURL: BASE })

const TEXT = 'ch02/2-4' // 没有动画的节
const VIDEO = 'ch02/2-1'
const uid = () => Math.random().toString(36).slice(2, 8)

test('读文字：顶栏打开问 AI → 未登录先登录 → 流式回答、剩余次数；Esc 关闭', async ({ page }) => {
  await page.goto(TEXT)
  await page.locator('.lb-ask-btn').click()
  const panel = page.locator('.ask-panel')
  await expect(panel).toBeVisible()
  await expect(panel.locator('.ask-chip')).toHaveCount(3)

  await panel.getByRole('button', { name: '登录后提问' }).click()
  await expect(page.locator('.cl-dialog')).toBeVisible()
  await page.locator('.cl-dialog .cl-close').click()
  await expect(page.locator('.cl-dialog')).toHaveCount(0)
  await login(page, `ask-${uid()}@e2e.test`, `问${uid()}`)

  await expect(panel).toBeVisible()
  await panel.locator('.ask-input').fill('顺序表插入为什么要往后挪')
  await panel.locator('.ask-input').press('Enter')
  await expect(panel.locator('.ask-q')).toHaveText('顺序表插入为什么要往后挪')
  await expect(panel.locator('.ask-a')).toContainText('你问的是：顺序表插入为什么要往后挪')
  await expect(panel.locator('.ask-left')).toHaveText('今天还能问 29 次')

  // 对话按页留着：关掉再打开还在
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await page.locator('.lb-ask-btn').click()
  await expect(page.locator('.ask-q')).toHaveCount(1)
})

test('右侧一栏：本节目录、评论、问 AI 同一时间只开一个', async ({ page }) => {
  // 顺序：评论 → 问 AI → 本节目录。顶栏一直在上面，手机上底部弹层盖不住它
  await page.goto(TEXT)
  await page.locator('.cl-page-comments .cl-btn').click()
  await expect(page.locator('.cl-panel')).toBeVisible()
  await page.locator('.lb-ask-btn').click()
  await expect(page.locator('.ask-panel')).toBeVisible()
  await expect(page.locator('.cl-panel')).toHaveCount(0)
  await page.locator('.lb-outline-btn').click()
  await expect(page.locator('.lb-outline')).toBeVisible()
  await expect(page.locator('.ask-panel')).toHaveCount(0)
})

test('看动画：播放器的"问 AI"打开面板，播放器让出位置；Esc 只关面板不退出', async ({ page }) => {
  await page.goto(VIDEO)
  const frame = page.frameLocator('.cs-player iframe')
  await frame.locator('#ask').click()
  const panel = page.locator('.ask-panel.ask-in-video')
  await expect(panel).toBeVisible()

  const vw = page.viewportSize()!.width
  const full = await page.locator('.cs-full').boundingBox()
  const box = (await panel.boundingBox())!
  if (vw >= 768) {
    // 桌面：面板占右边一栏，播放器在它左边
    expect(Math.round(full!.width)).toBe(vw - Math.round(box.width))
  } else {
    // 手机：底部弹层，播放器缩到上面
    expect(Math.round(full!.y + full!.height)).toBe(Math.round(box.y))
  }

  await panel.locator('.ask-input').focus()
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`${VIDEO}$`))
  await expect(page.locator('.cs-full')).toBeVisible()
})
