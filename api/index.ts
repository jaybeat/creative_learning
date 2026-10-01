// Vercel 函数入口：所有 /api/* 请求经 vercel.json 的 rewrite 进到这里，由 Hono 分发（路由在 server/）
import { handle } from 'hono/vercel'
import { createApp } from '../server/app.js'
import { loadConfig } from '../server/config.js'
import { neonDb } from '../server/db.js'
import { judgeFromEnv } from '../server/judge.js'
import { mailerFromEnv } from '../server/mailer.js'

const config = loadConfig(process.env)
const app = createApp({
  db: neonDb(process.env.DATABASE_URL ?? ''),
  mailer: mailerFromEnv(process.env, config.brand),
  config,
  judge: judgeFromEnv(process.env),
})

const handler = handle(app)
export const GET = handler
export const POST = handler
export const PATCH = handler
export const DELETE = handler
