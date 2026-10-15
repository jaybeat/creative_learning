/**
 * 本地开发用的 API 服务：同一个 Hono app，数据库用 PGlite（存在 .tmp/pglite-dev，不碰线上库），
 * 邮件不真发，验证码直接打印在终端。VitePress dev 通过代理把 /api 转到这里。
 */
import fs from 'node:fs'
import path from 'node:path'
import { serve } from '@hono/node-server'
import { createApp } from '../../server/app.js'
import { loadConfig } from '../../server/config.js'
import { pgliteDb } from '../../server/db-pglite.js'
import { memoryMailer } from '../../server/mailer.js'
import { migrate } from '../../server/migrate.js'
import { readMigrations } from '../../server/migrations-fs.js'
import { judgeFromEnv } from '../../server/judge.js'
import { askModelFromEnv } from '../../server/ask-model.js'
import { ROOT } from './paths.js'

export const API_PORT = Number(process.env.API_PORT) || 8787

export async function startApiDev(opts: { dataDir?: string; port?: number; siteUrl?: string } = {}) {
  const dataDir = opts.dataDir ?? path.join(ROOT, '.tmp', 'pglite-dev')
  const db = await pgliteDb(dataDir === 'memory' ? undefined : dataDir)
  await migrate(db, readMigrations())
  const config = loadConfig({
    ADMIN_EMAILS: 'author@localhost.test',
    UNSUBSCRIBE_SECRET: 'dev-unsubscribe-secret',
    CRON_SECRET: 'dev-cron-secret',
    ...process.env,
    SITE_URL: opts.siteUrl ?? 'http://localhost:5173',
    INSECURE_COOKIE: '1',
  })
  const mailer = memoryMailer(true)
  // 评测机：环境变量里有 JUDGE_URL 与 JUDGE_SECRET 就连真的评测机，否则「运行」不可用、提交只保存
  const judge = judgeFromEnv(process.env)
  // 问 AI：仓库根目录 .env 里有 DEEPSEEK_API 就连真的 DeepSeek
  const ai = askModelFromEnv({ ...readDotEnv(), ...process.env })
  const app = createApp({ db, mailer, config, judge, ai })
  const port = opts.port ?? API_PORT
  const server = serve({ fetch: app.fetch, port })
  console.log(`[api] 本地 API http://localhost:${port}/api（管理员邮箱：${config.adminEmails.join(', ')}；验证码打印在终端；评测机：${judge ? process.env.JUDGE_URL : '未配置'}；问 AI：${ai ? 'DeepSeek' : '未配置（.env 里没有 DEEPSEEK_API）'}）`)
  return { app, db, mailer, server }
}

/** 只读 .env 的键值，不写进 process.env（.env 里还有配音用的 key，本地 API 用不到） */
function readDotEnv(): Record<string, string> {
  try {
    const out: Record<string, string> = {}
    for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
      if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
    }
    return out
  } catch {
    return {}
  }
}
