import { expect, test } from '@playwright/test'

// 节页"看动画 | 读文字"：看动画时是全屏学习层（theme/components/CourseSwitch.vue），读文字是专注阅读页（LessonBar.vue）。
// 2.1 有课程动画（site/public/course/2-1/），2.2 没有
const VIDEO = 'ch02/2-1'
const MODE_KEY = 'ds-book:course-mode'

test('有动画的节默认看动画：全屏学习层盖住整页，正文隐藏但仍在页面 HTML 里', async ({ page, request }) => {
  await page.goto(VIDEO)
  await expect(page.locator('.cs-player iframe')).toBeVisible()
  await expect(page.locator('.cs-video')).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.vp-doc')).toBeHidden()
  // 播放器铺满视口，网站导航被盖住，页面不能滚动
  const vp = page.viewportSize()!
  expect(await page.locator('.cs-player iframe').boundingBox()).toEqual({ x: 0, y: 0, width: vp.width, height: vp.height })
  expect(await page.evaluate(() => document.elementFromPoint(20, 20)?.tagName)).toBe('IFRAME')
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden')
  // 播放器的控制条是唯一的顶栏，嵌入时多出 ×（退出）和"读文字"
  const frame = page.frameLocator('.cs-player iframe')
  await expect(frame.locator('#exit')).toBeVisible()
  await expect(frame.locator('#toText')).toBeVisible()
  // 搜索引擎看到的 HTML 里有正文
  const html = await (await request.get(VIDEO)).text()
  expect(html).toContain('把字符换成任意一种元素')
})

test('切到读文字后记住选择：刷新、换节都保持；没有动画的节不出切换条', async ({ page }) => {
  await page.goto(VIDEO)
  await page.frameLocator('.cs-player iframe').locator('#toText').click()
  await expect(page.locator('.vp-doc')).toBeVisible()
  await expect(page.locator('.cs-player iframe')).toHaveCount(0)
  expect(await page.evaluate((k) => localStorage.getItem(k), MODE_KEY)).toBe('text')

  await page.reload()
  await expect(page.locator('.vp-doc')).toBeVisible()
  await expect(page.locator('.cs-text')).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.cs-player iframe')).toHaveCount(0)

  await page.goto('ch02/2-2')
  await expect(page.locator('.vp-doc')).toBeVisible()
  await expect(page.locator('.cs-player')).toHaveCount(0)
  await expect(page.locator('.cs-tabs')).toHaveCount(0)

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

test('全屏学习层：× 和 Esc 回到课程地图；播完弹出结束卡片，下一节、重新播放', async ({ page }) => {
  await page.goto(VIDEO)
  const frame = page.frameLocator('.cs-player iframe')
  await frame.locator('#exit').click()
  await expect(page).toHaveURL(/\/ch02\/$/)

  await page.goto(VIDEO)
  await expect(frame.locator('body.embed')).toHaveCount(1)
  await frame.locator('body').press('Escape')
  await expect(page).toHaveURL(/\/ch02\/$/)

  await page.goto(VIDEO)
  await expect(frame.locator('body.embed')).toHaveCount(1)
  // 在全屏层里按 →，归播放器，不翻到下一节
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(300)
  await expect(page).toHaveURL(/\/ch02\/2-1$/)

  await page.locator('.cs-player iframe').evaluate((f) => ((f as HTMLIFrameElement).contentWindow as unknown as { __onEnded: () => void }).__onEnded())
  const end = page.locator('.cs-end')
  await expect(end).toBeVisible()
  await expect(end.locator('.cs-end-next')).toHaveAttribute('href', /\/ch02\/2-2$/)
  await end.getByRole('button', { name: '重新播放' }).click()
  await expect(end).toHaveCount(0)
  await expect(frame.locator('#cover')).toBeHidden()

  await page.locator('.cs-player iframe').evaluate((f) => ((f as HTMLIFrameElement).contentWindow as unknown as { __onEnded: () => void }).__onEnded())
  await end.getByRole('button', { name: '读文字详细版' }).click()
  await expect(page.locator('.vp-doc')).toBeVisible()
  await expect(page.locator('.cs-full')).toBeHidden()
})

test('网址末尾没有 / 时配音也找得到（线上 Vercel 把 /course/2-1/index.html 重定向成 /course/2-1）', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Playwright 的 WebKit 不带 mp3 解码，根本不发配音请求')
  // 以前配音用相对路径，在 /course/2-1 下会去请求 /course/audio/b001.mp3：线上返回 200 的 404 页面，没有声音也不报错
  await page.goto('course/2-1?embed')
  const audio = page.waitForResponse((r) => /\/audio\/b001\.mp3$/.test(new URL(r.url()).pathname))
  await page.locator('#start').click()
  const r = await audio
  expect(new URL(r.url()).pathname).toMatch(/\/course\/2-1\/audio\/b001\.mp3$/)
  expect(r.status()).toBeLessThan(400)
  expect(r.headers()['content-type']).toMatch(/^audio\//)
})
