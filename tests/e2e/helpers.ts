import { expect, type Page } from '@playwright/test'

/** 在已打开的页面上走一遍邮箱验证码登录（验证码从 serve-e2e 的测试接口取），并设置昵称 */
export async function login(page: Page, base: string, email: string, name: string) {
  await page.locator('.cl-nav-btn', { hasText: '登录' }).click()
  await page.locator('.cl-dialog input[type=email]').fill(email)
  await page.locator('.cl-dialog button[type=submit]').click()
  await expect(page.locator('.cl-dialog')).toContainText('验证码已发送')
  const code = await (await page.request.get(`${base}__test/last-code?email=${encodeURIComponent(email)}`)).text()
  await page.locator('.cl-dialog input[autocomplete=one-time-code]').fill(code)
  await page.locator('.cl-dialog button[type=submit]').click()
  await expect(page.locator('.cl-dialog-title')).toHaveText('设置昵称')
  await page.locator('.cl-dialog input[autocomplete=nickname]').fill(name)
  await page.locator('.cl-dialog button[type=submit]').click()
  await expect(page.locator('.cl-dialog')).toHaveCount(0)
  await expect(page.locator('.cl-nav-btn')).toContainText(name)
}
