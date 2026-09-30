import type { Deps } from './app.js'
import type { Api } from './auth.js'
import { readJson } from './auth.js'
import { fail } from './http.js'

export const LIMITS = {
  /** 代码最大字节数（UTF-8） */
  codeBytes: 64 * 1024,
  perMinute: 10,
  list: 20,
}

export const PROBLEM_RE = /^ch\d{2}-ex-\d{1,2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Row {
  id: string
  problem_id: string
  language: string
  status: string
  created_at: string | Date
  code?: string
}

const toPublic = (r: Row) => ({
  id: r.id,
  problemId: r.problem_id,
  language: r.language,
  status: r.status,
  createdAt: new Date(r.created_at).toISOString(),
  ...(r.code !== undefined ? { code: r.code } : {}),
})

/** 提交记录只给本人看；本期不评测，新提交一律 pending */
export function submissionRoutes(app: Api, { db }: Deps) {
  app.post('/submissions', async (c) => {
    const u = c.get('user')
    if (!u) return fail(c, 401, 'login_required')
    const b = await readJson(c)
    if (typeof b.problemId !== 'string' || !PROBLEM_RE.test(b.problemId)) return fail(c, 400, 'bad_problem')
    const code = typeof b.code === 'string' ? b.code : ''
    if (!code.trim() || Buffer.byteLength(code, 'utf8') > LIMITS.codeBytes) return fail(c, 400, 'bad_code')

    const [rate] = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM submissions WHERE user_id = $1 AND created_at > now() - interval '1 minute'`,
      [u.id],
    )
    if (rate.n >= LIMITS.perMinute) return fail(c, 429, 'submit_rate')

    const [row] = await db.query<Row>(
      `INSERT INTO submissions (user_id, problem_id, code) VALUES ($1, $2, $3)
       RETURNING id, problem_id, language, status, created_at`,
      [u.id, b.problemId, code],
    )
    return c.json(toPublic(row), 201)
  })

  app.get('/submissions', async (c) => {
    const u = c.get('user')
    if (!u) return fail(c, 401, 'login_required')
    const problem = c.req.query('problem') ?? ''
    if (!PROBLEM_RE.test(problem)) return fail(c, 400, 'bad_problem')
    const rows = await db.query<Row>(
      `SELECT id, problem_id, language, status, created_at FROM submissions
        WHERE user_id = $1 AND problem_id = $2 ORDER BY created_at DESC LIMIT ${LIMITS.list}`,
      [u.id, problem],
    )
    return c.json({ submissions: rows.map(toPublic) })
  })

  app.get('/submissions/:id', async (c) => {
    const u = c.get('user')
    if (!u) return fail(c, 401, 'login_required')
    const id = c.req.param('id')
    if (!UUID_RE.test(id)) return fail(c, 404, 'not_found')
    const [row] = await db.query<Row>(
      'SELECT id, problem_id, language, status, created_at, code FROM submissions WHERE id = $1 AND user_id = $2',
      [id, u.id],
    )
    if (!row) return fail(c, 404, 'not_found')
    return c.json(toPublic(row))
  })
}
