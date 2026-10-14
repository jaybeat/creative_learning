import { expect, test } from '@playwright/test'

// 节页专注模式（theme/components/LessonBar.vue、theme/focus.ts）：没有默认主题的侧栏和右栏，
// 顶栏"目录"/"本节目录"浮出两个抽屉，默认收起；宽屏可固定，固定状态刷新后保持、首屏就对
const TEXT = 'ch02/2-4' // 没有动画的节
const VIDEO = 'ch02/2-1'

test('节页默认专注：没有侧栏和右栏，顶栏有返回章地图、目录位置', async ({ page }) => {
  await page.goto(TEXT)
  await expect(page.locator('.VPSidebar')).toHaveCount(0)
  await expect(page.locator('.VPDocAside')).toHaveCount(0)
  await expect(page.locator('.lb-back')).toHaveAttribute('href', /\/ch02\/$/)
  await expect(page.locator('.lb-pos')).toHaveText(/4\/20/)
  await expect(page.locator('.lb-toc')).toBeHidden()
  await expect(page.locator('.lb-outline')).toBeHidden()
})

test('目录抽屉：点开浮出、当前节高亮，Esc 和点空白处关闭，点节名跳转', async ({ page }) => {
  await page.goto(TEXT)
  await page.locator('.lb-toc-btn').click()
  await expect(page.locator('.lb-toc')).toBeVisible()
  await expect(page.locator('.lb-toc li.is-current')).toContainText('2.4')
  await page.keyboard.press('Escape')
  await expect(page.locator('.lb-toc')).toBeHidden()

  await page.locator('.lb-toc-btn').click()
  await page.locator('.lb-toc').getByRole('tab', { name: '全书' }).click()
  expect(await page.locator('.lb-toc .lb-ch').count()).toBeGreaterThan(1)
  await expect(page.locator('.lb-toc a[href$="/ch01/1-1"]')).toHaveCount(1)
  // 点抽屉右边露出来的空白（左上角被抽屉自己盖着）
  const vw = page.viewportSize()!.width
  await page.mouse.click(vw - 8, 400)
  await expect(page.locator('.lb-toc')).toBeHidden()

  await page.locator('.lb-toc-btn').click()
  await page.locator('.lb-toc a[href$="/ch02/2-5"]').click()
  await expect(page).toHaveURL(/\/ch02\/2-5$/)
  await expect(page.locator('.lb-toc')).toBeHidden()
  await expect(page.locator('.lb-pos')).toHaveText(/5\/20/)
})

test('本节目录抽屉：列出本节标题；看动画时不出现', async ({ page }) => {
  await page.goto(TEXT)
  await page.locator('.lb-outline-btn').click()
  await expect(page.locator('.lb-outline')).toBeVisible()
  await expect(page.locator('.lb-outline-link').first()).toBeVisible()
  await page.keyboard.press('Escape')

  await page.goto(VIDEO)
  await expect(page.locator('.cs-video')).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.lb-outline-btn')).toBeHidden()
  await page.locator('.cs-text').click()
  await expect(page.locator('.lb-outline-btn')).toBeVisible()
})

test('宽屏固定：两个抽屉一直展开，正文让位；刷新后保持，取消后恢复', async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 1280) < 1280, '固定只在 ≥1280px 时有')
  await page.goto(TEXT)
  const content = page.locator('.VPDoc .vp-doc')
  const left0 = (await content.boundingBox())!.x

  await page.locator('.lb-toc-btn').click()
  await page.locator('.lb-toc .lb-pin').click()
  await expect(page.locator('.lb-toc')).toBeVisible()
  await expect(page.locator('.lb-backdrop')).toHaveCount(0)
  await expect(page.locator('.lb-toc-btn')).toBeHidden()

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-pin-toc', '')
  await expect(page.locator('.lb-toc')).toBeVisible()
  // 固定的抽屉不盖住正文
  const toc = (await page.locator('.lb-toc').boundingBox())!
  expect((await content.boundingBox())!.x).toBeGreaterThanOrEqual(toc.x + toc.width)
  expect(left0).toBeLessThan(toc.x + toc.width)

  await page.locator('.lb-toc .lb-pin').click()
  await expect(page.locator('.lb-toc')).toBeHidden()
  await expect(page.locator('.lb-toc-btn')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('ds-book:pin-toc'))).toBeNull()
})
