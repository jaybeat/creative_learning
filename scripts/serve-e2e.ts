/**
 * e2e 用服务器：静态托管构建产物（site/.vitepress/dist，模拟 Vercel 的 cleanUrls）+ /api（内存 PGlite、邮件不发）。
 * 测试通过 GET /__test/last-code?email= 取验证码——只存在于这个测试服务器里。
 */
import fs from 'node:fs'
import path from 'node:path'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { createApp } from '../server/app.js'
import { loadConfig } from '../server/config.js'
import { pgliteDb } from '../server/db-pglite.js'
import { memoryMailer } from '../server/mailer.js'
import { migrate } from '../server/migrate.js'
import { readMigrations } from '../server/migrations-fs.js'
import { fakeJudge } from '../server/judge.js'
import { SOLVERS } from './lib/poly-ref.js'
import { ROOT } from './lib/paths.js'

const PORT = Number(process.env.E2E_PORT) || 4174
const DIST = path.join(ROOT, 'site', '.vitepress', 'dist')
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

async function main() {
  const db = await pgliteDb()
  await migrate(db, readMigrations())
  const mailer = memoryMailer()
  const config = loadConfig({
    ADMIN_EMAILS: 'author@e2e.test',
    UNSUBSCRIBE_SECRET: 'e2e',
    CRON_SECRET: 'e2e',
    SITE_URL: `http://localhost:${PORT}`,
    INSECURE_COOKIE: '1',
  })
  // 假评测机：代码里写「CORRECT ch02-ex-N」就按参考解输出，含 TLE 就超时，含 COMPILE_ERROR 就编译错误，否则输出错误答案
  const judge = fakeJudge((code, input) => {
    const m = /CORRECT (ch\d{2}-ex-\d+)/.exec(code)
    if (m && SOLVERS[m[1]]) return SOLVERS[m[1]](input)
    if (code.includes('TLE')) return { status: 'time_limit' }
    return 'wrong answer\n'
  })
  const api = createApp({ db, mailer, config, judge })

  const app = new Hono()
  app.get('/__test/last-code', (c) => {
    const email = c.req.query('email')
    const m = [...mailer.sent].reverse().find((x) => x.to === email)
    return c.text(m ? /(\d{6})/.exec(m.text)![1] : '', m ? 200 : 404)
  })
  // 所有测试请求都来自本机：每个请求给一个不同的 IP，免得撞上「同 IP 每小时 10 次验证码」的限流
  app.all('/api/*', (c) => {
    const headers = new Headers(c.req.raw.headers)
    headers.set('x-real-ip', `e2e-${Math.random()}`)
    return api.fetch(new Request(c.req.raw, { headers }))
  })
  app.get('*', (c) => {
    const p = decodeURIComponent(new URL(c.req.url).pathname)
    const candidates = p.endsWith('/') ? [p + 'index.html'] : [p, p + '.html', p + '/index.html']
    for (const cand of candidates) {
      const file = path.join(DIST, cand)
      if (file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        return c.body(fs.readFileSync(file), 200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' })
      }
    }
    return c.body(fs.readFileSync(path.join(DIST, '404.html')), 404, { 'content-type': TYPES['.html'] })
  })

  serve({ fetch: app.fetch, port: PORT })
  console.log(`[e2e] http://localhost:${PORT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
