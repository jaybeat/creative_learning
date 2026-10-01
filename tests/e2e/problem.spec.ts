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

/** 在编辑器末尾追加一行（e2e 的假评测机按代码里的标记决定输出） */
async function append(page: import('@playwright/test').Page, text: string) {
  await page.locator('.cm-content').click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.type(text)
}

test('运行：样例逐组对比，改过的样例与自定义输入只看输出', async ({ page }) => {
  // 登录 + 三次运行，WebKit 在并发负载下会超过默认的 30 秒
  test.setTimeout(60_000)
  await page.goto('ch02/ex-1')
  await login(page, BASE, `r-${uid()}@e2e.test`, `读者${uid()}`)
  // 模板代码：假评测机输出错误答案
  await page.locator('.pw-run').click()
  await expect(page.locator('.run-panel .vv-status')).toHaveText('有样例没通过')
  await expect(page.locator('.diff-view .dv-line.is-diff')).toHaveCount(2)
  await expect(page.locator('.dv-note')).toHaveText('第 1 行起不同')

  // 标记为正确解：四组样例全部通过
  await append(page, '// CORRECT ch02-ex-1')
  await page.locator('.pw-run').click()
  await expect(page.locator('.run-panel .vv-status')).toHaveText('样例全部通过')
  await expect(page.locator('.run-panel .vv-count').first()).toHaveText('4 / 4')

  // 加一组自定义输入：只显示输出，不比对
  await page.locator('.pw-tab', { hasText: '测试用例' }).click()
  await page.locator('.rp-add').click()
  await page.locator('.rp-input').fill('2 1 3 -1 3')
  await page.locator('.pw-run').click()
  await page.locator('.rp-chip', { hasText: '自定义 1' }).click()
  await expect(page.locator('.diff-view.no-expected')).toBeVisible()
  await expect(page.locator('.diff-view')).toContainText('0')
})

test('提交：评测中 → 答案错误并显示第一个没过的测试点；改对后通过、切换条打 ✓', async ({ page }) => {
  // 登录 + 两次提交（各要轮询评测结果）
  test.setTimeout(60_000)
  await page.goto('ch02/ex-3')
  await expect(page.locator('.pw-tab', { hasText: '提交记录' })).toBeVisible()
  await page.locator('.pw-tab', { hasText: '提交记录' }).click()
  await expect(page.locator('.pw-empty')).toContainText('登录后可以运行和提交代码')
  await login(page, BASE, `p-${uid()}@e2e.test`, `读者${uid()}`)
  await expect(page.locator('.pw-empty')).toHaveText('还没有提交过。')
  // 登录后导航栏显示昵称：手机上也不能把页面撑出横向滚动
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
  expect(sw).toBeLessThanOrEqual(cw)

  await page.locator('.pw-submit').click()
  await expect(page.locator('.verdict-view .vv-status')).toHaveText('答案错误')
  await expect(page.locator('.vv-fail-title')).toContainText('第 1 个测试点')
  await expect(page.locator('.verdict-view .diff-view')).toBeVisible()
  await expect(page.locator('.problem-tabs a.active .read-mark')).toHaveCount(0)

  await append(page, '// CORRECT ch02-ex-3')
  await page.locator('.pw-submit').click()
  await expect(page.locator('.verdict-view .vv-status')).toHaveText('通过')
  await expect(page.locator('.verdict-view .vv-count')).toHaveText(/通过 12 \/ 12 个测试点/)
  await expect(page.locator('.problem-tabs a.active .read-mark')).toBeVisible()

  await page.locator('.pw-link', { hasText: '全部提交' }).click()
  await expect(page.locator('.pw-list li')).toHaveCount(2)
  await expect(page.locator('.pw-list li').first()).toContainText('12/12')
})
