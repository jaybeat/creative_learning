import type { Deps } from './app.js'
import type { Api } from './auth.js'
import { readJson } from './auth.js'
import { fail } from './http.js'
import { notifyReply } from './notify.js'

export const LIMITS = {
  body: 2000,
  quote: 500,
  context: 64,
  perMinute: 10,
}

const PAGE_RE = /^\/[A-Za-z0-9\-_/]{0,200}$/
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface Row {
  id: string
  user_id: string
  parent_id: string | null
  page_path: string
  page_title: string
  heading_id: string | null
  quote_exact: string | null
  quote_prefix: string | null
  quote_suffix: string | null
  body: string
  created_at: string | Date
  deleted_at: string | Date | null
  hidden_at: string | Date | null
  author_name: string | null
  author_role: string
  author_deleted: boolean
}

export const SELECT_ROWS = `
  SELECT c.id, c.user_id, c.parent_id, c.page_path, c.page_title, c.heading_id,
         c.quote_exact, c.quote_prefix, c.quote_suffix, c.body, c.created_at, c.deleted_at, c.hidden_at,
         u.display_name AS author_name, u.role AS author_role, (u.deleted_at IS NOT NULL) AS author_deleted
    FROM comments c JOIN users u ON u.id = c.user_id`

export interface PublicComment {
  id: string
  author: { name: string; isAdmin: boolean }
  mine: boolean
  body: string
  createdAt: string
  deleted: boolean
  hidden: boolean
}

export interface PublicThread extends PublicComment {
  pagePath: string
  pageTitle: string
  headingId: string | null
  quote: { exact: string; prefix: string; suffix: string }
  replies: PublicComment[]
}

const iso = (d: string | Date) => new Date(d).toISOString()

function toPublic(r: Row, viewer: { id: string } | null): PublicComment {
  const deleted = !!r.deleted_at
  return {
    id: r.id,
    author: { name: deleted ? '' : r.author_deleted ? '已注销用户' : (r.author_name ?? '读者'), isAdmin: !deleted && r.author_role === 'admin' },
    mine: !deleted && viewer?.id === r.user_id,
    body: deleted ? '' : r.body,
    createdAt: iso(r.created_at),
    deleted,
    hidden: !!r.hidden_at,
  }
}

/**
 * 按可见性规则把行组装成讨论串：
 * - 已删除的回复不返回；已删除的顶层评论只在还有可见回复时保留占位（「该评论已删除」）
 * - 隐藏的评论（及隐藏顶层下的整串）只对管理员返回
 */
export function buildThreads(rows: Row[], viewer: { id: string; isAdmin: boolean } | null): PublicThread[] {
  const admin = !!viewer?.isAdmin
  const visible = (r: Row) => admin || !r.hidden_at
  const replies = new Map<string, PublicComment[]>()
  for (const r of rows) {
    if (!r.parent_id || r.deleted_at || !visible(r)) continue
    const list = replies.get(r.parent_id) ?? []
    list.push(toPublic(r, viewer))
    replies.set(r.parent_id, list)
  }
  const threads: PublicThread[] = []
  for (const r of rows) {
    if (r.parent_id || !visible(r)) continue
    const rs = (replies.get(r.id) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    if (r.deleted_at && rs.length === 0) continue
    threads.push({
      ...toPublic(r, viewer),
      pagePath: r.page_path,
      pageTitle: r.page_title,
      headingId: r.heading_id,
      quote: { exact: r.quote_exact ?? '', prefix: r.quote_prefix ?? '', suffix: r.quote_suffix ?? '' },
      replies: rs,
    })
  }
  return threads.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

const str = (v: unknown, max: number): string | null => (typeof v === 'string' && [...v].length <= max ? v : null)

export function commentRoutes(app: Api, { db, mailer, config }: Deps) {
  app.get('/comments', async (c) => {
    const page = c.req.query('page') ?? ''
    if (!PAGE_RE.test(page)) return fail(c, 400, 'bad_page')
    const rows = await db.query<Row>(`${SELECT_ROWS} WHERE c.page_path = $1 ORDER BY c.created_at`, [page])
    return c.json({ threads: buildThreads(rows, c.get('user')) })
  })

  app.post('/comments', async (c) => {
    const u = c.get('user')
    if (!u) return fail(c, 401, 'login_required')
    if (!u.name) return fail(c, 400, 'name_required')
    const b = await readJson(c)
    const text = typeof b.body === 'string' ? b.body.trim() : ''
    if (!text || [...text].length > LIMITS.body) return fail(c, 400, 'bad_body')

    if (!u.isAdmin) {
      const [rate] = await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM comments WHERE user_id = $1 AND created_at > now() - interval '1 minute'`,
        [u.id],
      )
      if (rate.n >= LIMITS.perMinute) return fail(c, 429, 'comment_rate')
    }

    if (b.parentId !== undefined) {
      if (typeof b.parentId !== 'string' || !UUID_RE.test(b.parentId)) return fail(c, 400, 'bad_parent')
      const [p] = await db.query<{ id: string; parent_id: string | null; page_path: string; page_title: string; deleted_at: unknown; hidden_at: unknown }>(
        'SELECT id, parent_id, page_path, page_title, deleted_at, hidden_at FROM comments WHERE id = $1',
        [b.parentId],
      )
      if (!p || p.deleted_at || (p.hidden_at && !u.isAdmin)) return fail(c, 404, 'not_found')
      if (p.parent_id) return fail(c, 400, 'bad_parent')
      // 管理员可以先不发邮件，之后在 /admin 合并成一封（见 sendMergedReplies）
      const silent = u.isAdmin && b.silent === true
      const [row] = await db.query<{ id: string }>(
        `INSERT INTO comments (user_id, parent_id, page_path, page_title, body, notify_pending) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [u.id, p.id, p.page_path, p.page_title, text, silent],
      )
      if (!silent) await notifyReply(db, mailer, config, { threadId: p.id, replierId: u.id, replierName: u.name, body: text })
      return c.json({ id: row.id }, 201)
    }

    const page = typeof b.page === 'string' && PAGE_RE.test(b.page) ? b.page : null
    const title = str(b.pageTitle ?? '', 200)
    const heading = b.headingId == null ? null : str(b.headingId, 100)
    const q = (b.quote ?? {}) as Record<string, unknown>
    const exact = str(q.exact, LIMITS.quote)
    const prefix = str(q.prefix ?? '', LIMITS.context)
    const suffix = str(q.suffix ?? '', LIMITS.context)
    if (!page || title === null || (b.headingId != null && heading === null)) return fail(c, 400, 'bad_page')
    if (!exact || !exact.trim() || prefix === null || suffix === null) return fail(c, 400, 'bad_quote')
    const [row] = await db.query<{ id: string }>(
      `INSERT INTO comments (user_id, page_path, page_title, heading_id, quote_exact, quote_prefix, quote_suffix, body)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [u.id, page, title, heading, exact, prefix, suffix, text],
    )
    return c.json({ id: row.id }, 201)
  })

  app.delete('/comments/:id', async (c) => {
    const u = c.get('user')
    if (!u) return fail(c, 401, 'login_required')
    const id = c.req.param('id')
    if (!UUID_RE.test(id)) return fail(c, 404, 'not_found')
    const [row] = await db.query<{ user_id: string; deleted_at: unknown }>('SELECT user_id, deleted_at FROM comments WHERE id = $1', [id])
    if (!row || row.deleted_at) return fail(c, 404, 'not_found')
    if (row.user_id !== u.id && !u.isAdmin) return fail(c, 403, 'forbidden')
    await db.query('UPDATE comments SET deleted_at = now() WHERE id = $1', [id])
    return c.json({ ok: true })
  })

  app.post('/comments/:id/hide', async (c) => {
    const u = c.get('user')
    if (!u) return fail(c, 401, 'login_required')
    if (!u.isAdmin) return fail(c, 403, 'forbidden')
    const id = c.req.param('id')
    if (!UUID_RE.test(id)) return fail(c, 404, 'not_found')
    const hidden = (await readJson(c)).hidden !== false
    const rows = await db.query(`UPDATE comments SET hidden_at = ${hidden ? 'now()' : 'NULL'} WHERE id = $1 RETURNING id`, [id])
    if (rows.length === 0) return fail(c, 404, 'not_found')
    return c.json({ ok: true, hidden })
  })
}
