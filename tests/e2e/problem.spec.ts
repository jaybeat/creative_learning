import { expect, test } from '@playwright/test'
import { login } from './helpers'

// 题目页：跑在 scripts/serve-e2e.ts（构建产物 + 本地 API + 内存数据库）上
const BASE = 'http://localhost:4174/'
test.use({ baseURL: BASE })

const uid = () => Math.random().toString(36).slice(2, 8)

test('题面、样例、编辑器都在；代码草稿刷新后仍在', async ({ page }) => {
  await page.goto('ch02/ex-1')
  await expect(page.locator('.problem-doc h1')).toContainText('第一问')
  await expect(page.locator('.sample-case')).toHaveCount(4)
  await expect(page.locator('.sample-case').first().locator('.sample-pre').first()).toHaveText('3 4 5 4 1 -1 0')

  const editor = page.locator('.cm-content')
  await expect(editor).toContainText('int main(void)')
  await editor.click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.type('// e2e-draft')
  await expect(editor).toContainText('// e2e-draft')
  await page.waitForTimeout(700) // 草稿 500ms 防抖

  await page.reload()
  await expect(page.locator('.cm-content')).toContainText('// e2e-draft')
})

test('第二问可以载入第一问的代码', async ({ page }) => {
  await page.goto('ch02/ex-1')
  await page.evaluate(() => localStorage.setItem('ds-book:code:ch02-ex-1', '/* from-ex-1 */\n'))
  await page.goto('ch02/ex-2')
  await page.locator('.pw-btn', { hasText: '载入第一问的代码' }).click()
  await expect(page.locator('.cm-content')).toContainText('from-ex-1')
})

test('登录后提交：记录出现、切换条打 ✓', async ({ page }) => {
  await page.goto('ch02/ex-3')
  await expect(page.locator('.pw-empty')).toContainText('登录后可以提交代码')
  await login(page, BASE, `p-${uid()}@e2e.test`, `读者${uid()}`)
  await expect(page.locator('.pw-empty')).toHaveText('还没有提交过。')
  // 登录后导航栏显示昵称：手机上也不能把页面撑出横向滚动
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
  expect(sw).toBeLessThanOrEqual(cw)
  await page.locator('.pw-submit').click()
  await expect(page.locator('.pw-list li')).toHaveCount(1)
  await expect(page.locator('.pw-list')).toContainText('等待评测')
  await expect(page.locator('.problem-tabs a.active .read-mark')).toBeVisible()
})
