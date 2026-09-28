import type { Deps } from './app.js'
import type { Api } from './auth.js'
import { safeEqual, verifyUserToken } from './crypto.js'
import { fail } from './http.js'
import { sendDigest } from './notify.js'
import { buildThreads, SELECT_ROWS, type Row } from './comments.js'

const PAGE_SIZE = 30

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)

function page(title: string, body: string) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>body{font:16px/1.7 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.25rem;color:#222}button{font:inherit;padding:.5rem 1.25rem;cursor:pointer}</style></head>
<body>${body}</body></html>`
}

export function adminRoutes(app: Api, { db, mailer, config }: Deps) {
  /** 全站评论流（顶层评论 + 其回复）。filter=unreplied：没有管理员回复过的顶层评论 */
  app.get('/admin/comments', async (c) => {
    const u = c.get('user')
    if (!u) return fail(c, 401, 'login_required')
    if (!u.isAdmin) return fail(c, 403, 'forbidden')
    const unreplied = c.req.query('filter') !== 'all'
    const before = c.req.query('before')
    const beforeDate = before && !Number.isNaN(Date.parse(before)) ? new Date(before).toISOString() : null

    const tops = await db.query<Row>(
      `${SELECT_ROWS}
        WHERE c.parent_id IS NULL AND c.deleted_at IS NULL
          AND ($1::timestamptz IS NULL OR c.created_at < $1::timestamptz)
          ${
            unreplied
              ? `AND u.role <> 'admin' AND NOT EXISTS (
                   SELECT 1 FROM comments r JOIN users ru ON ru.id = r.user_id
                    WHERE r.parent_id = c.id AND r.deleted_at IS NULL AND ru.role = 'admin')`
              : ''
          }
        ORDER BY c.created_at DESC LIMIT ${PAGE_SIZE + 1}`,
      [beforeDate],
    )
    const more = tops.length > PAGE_SIZE
    const slice = tops.slice(0, PAGE_SIZE)
    const ids = slice.map((t) => t.id)
    const replies = ids.length ? await db.query<Row>(`${SELECT_ROWS} WHERE c.parent_id = ANY($1::uuid[])`, [ids]) : []
    const threads = buildThreads([...slice, ...replies], u).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return c.json({ threads, next: more ? threads[threads.length - 1].createdAt : null })
  })

  /** 邮件里的退订链接：GET 只显示确认按钮（邮箱的链接预扫描不会误触发），POST 才真正关闭 */
  app.get('/unsubscribe', (c) => {
    const t = c.req.query('t') ?? ''
    if (!verifyUserToken(t, config.unsubscribeSecret)) return c.html(page('链接无效', '<p>这个退订链接无效或已过期。</p>'), 400)
    return c.html(
      page(
        '关闭回复通知',
        `<h1>关闭回复通知</h1><p>关闭后，有人回复你的评论时不再发邮件。以后可以在网站右上角的账号菜单里重新打开。</p>
<form method="post"><input type="hidden" name="t" value="${escapeHtml(t)}"><button type="submit">确认关闭</button></form>`,
      ),
    )
  })

  app.post('/unsubscribe', async (c) => {
    const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>)
    const userId = verifyUserToken(String(form.t ?? ''), config.unsubscribeSecret)
    if (!userId) return c.html(page('链接无效', '<p>这个退订链接无效或已过期。</p>'), 400)
    await db.query('UPDATE users SET notify_replies = false WHERE id = $1', [userId])
    return c.html(page('已关闭', `<h1>已关闭回复通知</h1><p><a href="${escapeHtml(config.siteUrl)}/">返回 ${escapeHtml(config.brand)}</a></p>`))
  })

  /** Vercel Cron 每日调用；配置了 CRON_SECRET 时 Vercel 会带上 Authorization: Bearer <secret> */
  app.get('/cron/digest', async (c) => {
    const auth = c.req.header('authorization') ?? ''
    if (!config.cronSecret || !safeEqual(auth, `Bearer ${config.cronSecret}`)) return fail(c, 401, 'unauthorized')
    const sent = await sendDigest(db, mailer, config)
    return c.json({ ok: true, sent })
  })
}
