import { Hono } from 'hono'
import type { Config } from './config.js'
import type { Db } from './db.js'
import type { Mailer } from './mailer.js'
import { sha256 } from './crypto.js'
import { clearSessionCookie, fail, readSessionCookie, sameOrigin, SESSION_DAYS, writeSessionCookie } from './http.js'
import { authRoutes } from './auth.js'
import { commentRoutes } from './comments.js'
import { adminRoutes } from './admin.js'
import { submissionRoutes } from './submissions.js'
import { runRoutes } from './run.js'
import type { Judge } from './judge.js'

export interface Deps {
  db: Db
  mailer: Mailer
  config: Config
  /** 评测机；没配置时为 null（提交只保存、「运行」不可用） */
  judge: Judge | null
  /** 在响应之后继续执行的任务（Vercel 上是 waitUntil；本地直接让它跑完） */
  defer: (p: Promise<unknown>) => void
}

export type DepsInput = Omit<Deps, 'judge' | 'defer'> & Partial<Pick<Deps, 'judge' | 'defer'>>

const runInBackground = (p: Promise<unknown>) => void p.catch((e) => console.error('[defer]', e))

export interface SessionUser {
  id: string
  email: string
  name: string | null
  isAdmin: boolean
  notifyReplies: boolean
}

export type AppEnv = { Variables: { user: SessionUser | null; tokenHash: string | null } }

/** 会话剩余不足这么多天时顺延到满 30 天（滑动续期） */
const RENEW_BELOW_DAYS = 15

export function createApp(input: DepsInput) {
  const deps: Deps = { judge: null, defer: runInBackground, ...input }
  const { db, config } = deps
  const app = new Hono<AppEnv>().basePath('/api')

  app.use('*', async (c, next) => {
    c.header('cache-control', 'no-store')
    // 写请求：只接受本站页面发出的 JSON（退订表单是唯一例外，见 admin.ts）
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      if (!sameOrigin(c)) return fail(c, 403, 'bad_origin')
      const form = c.req.path === '/api/unsubscribe'
      if (!form && !c.req.header('content-type')?.startsWith('application/json')) return fail(c, 400, 'bad_content_type')
    }

    c.set('user', null)
    c.set('tokenHash', null)
    const token = readSessionCookie(c, config)
    if (token) {
      const tokenHash = sha256(token)
      const rows = await db.query<{ id: string; email: string; display_name: string | null; role: string; notify_replies: boolean; days_left: number }>(
        `SELECT u.id, u.email, u.display_name, u.role, u.notify_replies,
                extract(epoch FROM s.expires_at - now()) / 86400 AS days_left
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = $1 AND s.expires_at > now() AND u.deleted_at IS NULL`,
        [tokenHash],
      )
      const r = rows[0]
      if (r) {
        c.set('user', { id: r.id, email: r.email, name: r.display_name, isAdmin: r.role === 'admin', notifyReplies: r.notify_replies })
        c.set('tokenHash', tokenHash)
        if (Number(r.days_left) < RENEW_BELOW_DAYS) {
          await db.query(`UPDATE sessions SET expires_at = now() + interval '${SESSION_DAYS} days' WHERE token_hash = $1`, [tokenHash])
          writeSessionCookie(c, config, token)
        }
      } else {
        clearSessionCookie(c, config)
      }
    }
    await next()
  })

  authRoutes(app, deps)
  commentRoutes(app, deps)
  adminRoutes(app, deps)
  submissionRoutes(app, deps)
  runRoutes(app, deps)

  app.notFound((c) => fail(c, 404, 'not_found'))
  app.onError((err, c) => {
    console.error('[api]', c.req.method, c.req.path, err)
    return c.json({ error: 'server_error' }, 500)
  })
  return app
}

export type App = ReturnType<typeof createApp>
