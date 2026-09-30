import type { Hono } from 'hono'
import type { AppEnv, Deps, SessionUser } from './app.js'
import { isUniqueViolation } from './db.js'
import { newCode, newToken, safeEqual, sha256 } from './crypto.js'
import { clearSessionCookie, clientIp, fail, SESSION_DAYS, writeSessionCookie } from './http.js'
import { checkName } from './names.js'
import { mailQuotaLeft, sendLogged } from './notify.js'

export type Api = Hono<AppEnv, {}, '/api'>

/** 防滥用的各项阈值（HANDOFF / 设计方案 §3） */
export const LIMITS = {
  codeTtlMinutes: 10,
  resendSeconds: 60,
  perEmailPerDay: 10,
  perIpPerHour: 10,
  perIpPerDay: 30,
  attemptsPerCode: 5,
  /** 同邮箱 1 小时内累计输错这么多次 → 锁定到这些错误滚出 1 小时窗口 */
  failuresPerHour: 10,
}

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const e = raw.trim().toLowerCase()
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null
}

const codeHash = (email: string, code: string) => sha256(`${email}:${code}`)

export function publicMe(u: SessionUser) {
  return { id: u.id, email: u.email, name: u.name, isAdmin: u.isAdmin, notifyReplies: u.notifyReplies }
}

async function body(c: { req: { json(): Promise<unknown> } }): Promise<Record<string, unknown>> {
  try {
    const b = await c.req.json()
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}
export { body as readJson }

export function authRoutes(app: Api, { db, mailer, config }: Deps) {
  async function failuresLastHour(email: string): Promise<number> {
    const [r] = await db.query<{ n: number }>(
      `SELECT coalesce(sum(attempts), 0)::int AS n FROM email_codes WHERE email = $1 AND created_at > now() - interval '1 hour'`,
      [email],
    )
    return r.n
  }

  app.post('/auth/code', async (c) => {
    const email = normalizeEmail((await body(c)).email)
    if (!email) return fail(c, 400, 'bad_email')
    const ip = clientIp(c)

    const [s] = await db.query<{ last_age: number | null; day: number }>(
      `SELECT extract(epoch FROM now() - max(created_at)) AS last_age,
              count(*) FILTER (WHERE created_at > now() - interval '1 day')::int AS day
         FROM email_codes WHERE email = $1`,
      [email],
    )
    if (s.last_age !== null && Number(s.last_age) < LIMITS.resendSeconds) {
      return fail(c, 429, 'too_soon', { retryAfter: Math.ceil(LIMITS.resendSeconds - Number(s.last_age)) })
    }
    if (s.day >= LIMITS.perEmailPerDay) return fail(c, 429, 'email_daily_limit')
    if ((await failuresLastHour(email)) >= LIMITS.failuresPerHour) return fail(c, 429, 'locked')

    const [ipc] = await db.query<{ hour: number; day: number }>(
      `SELECT count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS hour,
              count(*)::int AS day
         FROM email_codes WHERE ip = $1 AND created_at > now() - interval '1 day'`,
      [ip],
    )
    if (ipc.hour >= LIMITS.perIpPerHour || ipc.day >= LIMITS.perIpPerDay) return fail(c, 429, 'ip_limit')
    if ((await mailQuotaLeft(db, config)) <= 0) {
      console.warn('[mail] 已达全站每日发信上限 DAILY_MAIL_LIMIT，暂停发送验证码')
      return fail(c, 503, 'mail_quota')
    }

    const code = newCode()
    const [row] = await db.query<{ id: string }>(
      `INSERT INTO email_codes (email, code_hash, ip, expires_at)
       VALUES ($1, $2, $3, now() + interval '${LIMITS.codeTtlMinutes} minutes') RETURNING id`,
      [email, codeHash(email, code), ip],
    )
    try {
      await sendLogged(db, mailer, 'code', {
        to: email,
        subject: `【${config.brand}】你的登录验证码 ${code}`,
        text: `你的登录验证码是：${code}\n\n${LIMITS.codeTtlMinutes} 分钟内有效。如果不是你本人操作，忽略这封邮件即可。\n\n—— ${config.brand}`,
      })
    } catch (err) {
      console.error('[mail] 验证码发送失败', err)
      await db.query('DELETE FROM email_codes WHERE id = $1', [row.id])
      return fail(c, 502, 'mail_failed')
    }
    return c.json({ ok: true, resendAfter: LIMITS.resendSeconds })
  })

  app.post('/auth/verify', async (c) => {
    const b = await body(c)
    const email = normalizeEmail(b.email)
    const code = typeof b.code === 'string' ? b.code.trim() : ''
    if (!email || !/^\d{6}$/.test(code)) return fail(c, 400, 'code_invalid')
    if ((await failuresLastHour(email)) >= LIMITS.failuresPerHour) return fail(c, 429, 'locked')

    const [rec] = await db.query<{ id: string; code_hash: string; attempts: number }>(
      `SELECT id, code_hash, attempts FROM email_codes
        WHERE email = $1 AND consumed_at IS NULL AND expires_at > now()
        ORDER BY created_at DESC LIMIT 1`,
      [email],
    )
    if (!rec || rec.attempts >= LIMITS.attemptsPerCode) return fail(c, 400, 'code_expired')
    if (!safeEqual(rec.code_hash, codeHash(email, code))) {
      await db.query('UPDATE email_codes SET attempts = attempts + 1 WHERE id = $1', [rec.id])
      return fail(c, 400, 'code_invalid', { attemptsLeft: Math.max(0, LIMITS.attemptsPerCode - rec.attempts - 1) })
    }
    // 原子地作废：并发的两次提交只有一次成功
    const consumed = await db.query('UPDATE email_codes SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL RETURNING id', [rec.id])
    if (consumed.length === 0) return fail(c, 400, 'code_expired')

    const role = config.adminEmails.includes(email) ? 'admin' : 'reader'
    const [u] = await db.query<{ id: string; display_name: string | null; notify_replies: boolean }>(
      `INSERT INTO users (email, role) VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
       RETURNING id, display_name, notify_replies`,
      [email, role],
    )
    const token = newToken()
    await db.query(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`, [
      sha256(token),
      u.id,
    ])
    writeSessionCookie(c, config, token)
    return c.json({ user: publicMe({ id: u.id, email, name: u.display_name, isAdmin: role === 'admin', notifyReplies: u.notify_replies }) })
  })

  app.post('/auth/logout', async (c) => {
    const h = c.get('tokenHash')
    if (h) await db.query('DELETE FROM sessions WHERE token_hash = $1', [h])
    clearSessionCookie(c, config)
    return c.json({ ok: true })
  })

  app.get('/me', (c) => {
    const u = c.get('user')
    return c.json({ user: u ? publicMe(u) : null })
  })

  app.patch('/me', async (c) => {
    const u = c.get('user')
    if (!u) return fail(c, 401, 'login_required')
    const b = await body(c)
    let name = u.name
    let notifyReplies = u.notifyReplies
    if (b.name !== undefined) {
      if (typeof b.name !== 'string') return fail(c, 400, 'name_length')
      const r = checkName(b.name, u.isAdmin)
      if ('error' in r) return fail(c, 400, r.error)
      name = r.name
    }
    if (b.notifyReplies !== undefined) notifyReplies = b.notifyReplies === true
    try {
      await db.query('UPDATE users SET display_name = $2, notify_replies = $3 WHERE id = $1', [u.id, name, notifyReplies])
    } catch (err) {
      if (isUniqueViolation(err)) return fail(c, 409, 'name_taken')
      throw err
    }
    return c.json({ user: publicMe({ ...u, name, notifyReplies }) })
  })

  /** 注销：删除邮箱与会话、释放昵称；评论标为已删除（讨论串结构保留，别人的回复不丢）；练习提交直接删除 */
  app.delete('/me', async (c) => {
    const u = c.get('user')
    if (!u) return fail(c, 401, 'login_required')
    await db.query(`UPDATE comments SET body = '', deleted_at = coalesce(deleted_at, now()) WHERE user_id = $1`, [u.id])
    await db.query('DELETE FROM submissions WHERE user_id = $1', [u.id])
    await db.query('DELETE FROM sessions WHERE user_id = $1', [u.id])
    await db.query('DELETE FROM email_codes WHERE email = $1', [u.email])
    await db.query('UPDATE users SET email = NULL, display_name = NULL, notify_replies = false, deleted_at = now() WHERE id = $1', [u.id])
    clearSessionCookie(c, config)
    return c.json({ ok: true })
  })
}
