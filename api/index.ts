// Vercel 函数入口：所有 /api/* 请求经 vercel.json 的 rewrite 进到这里，由 Hono 分发（路由在 server/）
import { handle } from 'hono/vercel'
import { createApp } from '../server/app.js'
import { loadConfig } from '../server/config.js'
import { neonDb } from '../server/db.js'
import { judgeFromEnv } from '../server/judge.js'
import { mailerFromEnv } from '../server/mailer.js'

/**
 * 让任务在响应返回之后继续执行（提交的异步评测）。等同 @vercel/functions 的 waitUntil——
 * 那个包只为这几行就带来 25 个依赖：Vercel 在 globalThis 上挂了请求上下文，里面有 waitUntil。
 * 取不到时（非 Vercel 环境）直接让 Promise 自己跑完。
 */
function waitUntil(p: Promise<unknown>): void {
  const guarded = p.catch((e) => console.error('[waitUntil]', e))
  const ctx = (globalThis as Record<symbol, { get?: () => { waitUntil?: (p: Promise<unknown>) => void } } | undefined>)[
    Symbol.for('@vercel/request-context')
  ]?.get?.()
  ctx?.waitUntil?.(guarded)
}

const config = loadConfig(process.env)
const app = createApp({
  db: neonDb(process.env.DATABASE_URL ?? ''),
  mailer: mailerFromEnv(process.env, config.brand),
  config,
  judge: judgeFromEnv(process.env),
  defer: waitUntil,
})

const handler = handle(app)
export const GET = handler
export const POST = handler
export const PATCH = handler
export const DELETE = handler
