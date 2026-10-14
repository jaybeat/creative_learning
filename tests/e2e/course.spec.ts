import { expect, test } from '@playwright/test'

// 节页"看动画 | 读文字"（theme/components/CourseSwitch.vue）：2.1 有课程动画（site/public/course/2-1/），2.2 没有
const VIDEO = 'ch02/2-1'
const MODE_KEY = 'ds-book:course-mode'

test('有动画的节默认看动画：显示播放器，正文隐藏但仍在页面 HTML 里', async ({ page, request }) => {
  await page.goto(VIDEO)
  await expect(page.locator('.cs-player iframe')).toBeVisible()
  await expect(page.locator('.cs-video')).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.vp-doc')).toBeHidden()
  // 正文分页时页底导航只在最后一页出现；看动画时正文不显示，页底的上一节/下一节要照常出现
  await expect(page.locator('.VPDocFooter')).toBeVisible()
  // 播放器报上高度后，iframe 跟着变（不再是占位高度）
  await expect.poll(() => page.locator('.cs-player iframe').evaluate((f) => (f as HTMLIFrameElement).style.height)).toMatch(/^\d+px$/)
  // 搜索引擎看到的 HTML 里有正文
  const html = await (await request.get(VIDEO)).text()
  expect(html).toContain('把字符换成任意一种元素')
})

test('切到读文字后记住选择：刷新、换节都保持；没有动画的节不出切换条', async ({ page }) => {
  await page.goto(VIDEO)
  await page.locator('.cs-text').click()
  await expect(page.locator('.vp-doc')).toBeVisible()
  await expect(page.locator('.cs-player iframe')).toHaveCount(0)
  expect(await page.evaluate((k) => localStorage.getItem(k), MODE_KEY)).toBe('text')

  await page.reload()
  await expect(page.locator('.vp-doc')).toBeVisible()
  await expect(page.locator('.cs-text')).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.cs-player iframe')).toHaveCount(0)

  await page.goto('ch02/2-2')
  await expect(page.locator('.vp-doc')).toBeVisible()
  await expect(page.locator('.course-switch')).toHaveCount(0)

  await page.goto(VIDEO)
  await page.locator('.cs-video').click()
  await expect(page.locator('.cs-player iframe')).toBeVisible()
  await expect(page.locator('.vp-doc')).toBeHidden()
})

test('章首目录：有动画的节标出时长，按钮改成"开始学习"', async ({ page }) => {
  await page.goto('ch02/')
  const item = page.locator('.ci-list li').filter({ hasText: '2.1 线性表' })
  await expect(item.locator('.video-mark')).toHaveText(/▶ \d+:\d\d/)
  await expect(page.locator('.ci-list li').filter({ hasText: '2.2 ' }).locator('.video-mark')).toHaveCount(0)
  await expect(page.locator('.ci-actions .cr-button')).toHaveText('开始学习')
})

test('看动画时打开页面不算已读，动画播完才算', async ({ page }) => {
  await page.goto(VIDEO)
  await expect(page.locator('.cs-player iframe')).toBeVisible()
  const read = () => page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('ds-book:progress') ?? '{}').read ?? []))
  await page.waitForTimeout(500)
  expect(await read()).not.toContain('/ch02/2-1')
  // 让播放器发出"播完"（等它挂上 __onEnded，即嵌入模式初始化完成）
  const frame = page.frameLocator('.cs-player iframe')
  await expect(frame.locator('body.embed')).toHaveCount(1)
  await page.locator('.cs-player iframe').evaluate((f) => ((f as HTMLIFrameElement).contentWindow as unknown as { __onEnded: () => void }).__onEnded())
  await expect.poll(read).toContain('/ch02/2-1')
})
