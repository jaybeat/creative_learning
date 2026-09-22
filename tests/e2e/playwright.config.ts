import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const PORT = 4173

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
  // 4 个浏览器配置 × 本地 preview 服务：并发太高时会因机器负载超时误报
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}${process.env.SITE_BASE ?? '/'}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview',
    cwd: ROOT,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'chromium-mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } } },
    { name: 'webkit-mobile', use: { ...devices['Desktop Safari'], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
  ],
})
