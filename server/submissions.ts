import type { Deps } from './app.js'
import type { Api } from './auth.js'
import { readJson } from './auth.js'
import { fail } from './http.js'
import { grade, type Grade } from './grading.js'
import { JudgeUnavailable } from './judge.js'
import { loadTests } from './problem-tests.js'

export const LIMITS = {
  /** 代码最大字节数（UTF-8） */
  codeBytes: 64 * 1024,
  perMinute: 10,
  list: 20,
  /** 停在 judging 超过这么久（秒）视为评测中断，被查询时重评 */
  staleSeconds: 120,
  /** 最多评测几次（首次 + 兜底重评） */
  maxAttempts: 3,
  /** 全站每天评测机调用上限（运行 + 提交），保护小评测机 */
  dailyJudge: 3000,
}

export const PROBLEM_RE = /^ch\d{2}-ex-\d{1,2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Row {
  id: string
  user_id?: string
  problem_id: string
  language: string
  status: string
  created_at: string | Date
  code?: string
  result?: (Partial<Grade> & { message?: string }) | null
}

const toPublic = (r: Row, withDetail: boolean) => ({
  id: r.id,
  problemId: r.problem_id,
  language: r.language,
  status: r.status,
  createdAt: new Date(r.created_at).toISOString(),
  passed: r.result?.passed ?? null,
  total: r.result?.total ?? null,
  ...(withDetail ? { code: r.code, result: r.result ?? null } : {}),
})

/** 全站今天调用评测机的次数是否已到上限 */
export async function overDailyLimit(db: Deps['db']): Promise<boolean> {
  const [r] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM judge_log WHERE created_at > now() - interval '1 day'`)
  return r.n >= LIMITS.dailyJudge
}

/** 评测一次提交并写回结果。只更新仍处于 judging 的行（被并发重评抢先时不覆盖） */
export async function judgeSubmission({ db, judge }: Deps, id: string): Promise<void> {
  if (!judge) return
  const [row] = await db.query<{ problem_id: string; code: string }>(`SELECT problem_id, code FROM submissions WHERE id = $1 AND status = 'judging'`, [id])
  if (!row) return
  const tests = loadTests(row.problem_id)
  let status: string
  let result: unknown
  if (tests.length === 0) {
    status = 'system_error'
    result = { message: 'no_tests' }
  } else {
    try {
      const g = grade(
        tests,
        await judge.run(
          id,
          row.code,
          tests.map((t) => t.input),
        ),
      )
      status = g.status
      result = g
    } catch (e) {
      console.error('[judge]', id, e)
      status = 'system_error'
      result = { message: e instanceof JudgeUnavailable ? 'judge_unavailable' : 'judge_error' }
    }
  }
  await db.query(
    `UPDATE submissions SET status = $2, result = $3, judged_at = now(), updated_at = now() WHERE id = $1 AND status = 'judging'`,
    [id, status, JSON.stringify(result)],
  )
}

/**
 * 兜底：评测中途函数被回收等原因，提交一直停在 judging。查询时发现超时就抢占并重评一次；
 * 次数用完则标为 system_error。返回是否发起了重评。
 */
async function rescueStale(deps: Deps, id: string): Promise<boolean> {
  const { db } = deps
  const claimed = await db.query<{ id: string }>(
    `UPDATE submissions SET attempts = attempts + 1, updated_at = now()
      WHERE id = $1 AND status = 'judging' AND attempts < $2
        AND updated_at < now() - ($3 || ' seconds')::interval
      RETURNING id`,
    [id, LIMITS.maxAttempts, String(LIMITS.staleSeconds)],
  )
  if (claimed.length) {
    deps.defer(judgeSubmission(deps, id))
    return true
  }
  await db.query(
    `UPDATE submissions SET status = 'system_error', result = $4, updated_at = now()
      WHERE id = $1 AND status = 'judging' AND attempts >= $2
        AND updated_at < now() - ($3 || ' seconds')::interval`,
    [id, LIMITS.maxAttempts, String(LIMITS.staleSeconds), JSON.stringify({ message: 'judge_unavailable' })],
  )
  return false
}

/** 提交记录只给本人看。配了评测机时异步评测：先返回 judging，前端轮询结果 */
export function submissionRoutes(app: Api, deps: Deps) {
  const { db } = deps

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

    const judging = !!deps.judge
    if (judging) {
      if (await overDailyLimit(db)) return fail(c, 429, 'judge_daily_limit')
      await db.query(`INSERT INTO judge_log (user_id, kind) VALUES ($1, 'submit')`, [u.id])
    }
    const [row] = await db.query<Row>(
      `INSERT INTO submissions (user_id, problem_id, code, status, attempts) VALUES ($1, $2, $3, $4, $5)
       RETURNING id, problem_id, language, status, created_at`,
      [u.id, b.problemId, code, judging ? 'judging' : 'pending', judging ? 1 : 0],
    )
    if (judging) deps.defer(judgeSubmission(deps, row.id))
    return c.json(toPublic(row, false), 201)
  })

  app.get('/submissions', async (c) => {
    const u = c.get('user')
    if (!u) return fail(c, 401, 'login_required')
    const problem = c.req.query('problem') ?? ''
    if (!PROBLEM_RE.test(problem)) return fail(c, 400, 'bad_problem')
    const rows = await db.query<Row>(
      `SELECT id, problem_id, language, status, created_at, result FROM submissions
        WHERE user_id = $1 AND problem_id = $2 ORDER BY created_at DESC LIMIT ${LIMITS.list}`,
      [u.id, problem],
    )
    return c.json({ submissions: rows.map((r) => toPublic(r, false)) })
  })

  app.get('/submissions/:id', async (c) => {
    const u = c.get('user')
    if (!u) return fail(c, 401, 'login_required')
    const id = c.req.param('id')
    if (!UUID_RE.test(id)) return fail(c, 404, 'not_found')
    const sql = 'SELECT id, problem_id, language, status, created_at, code, result FROM submissions WHERE id = $1 AND user_id = $2'
    let [row] = await db.query<Row>(sql, [id, u.id])
    if (!row) return fail(c, 404, 'not_found')
    if (row.status === 'judging' && deps.judge) {
      await rescueStale(deps, id)
      ;[row] = await db.query<Row>(sql, [id, u.id])
    }
    return c.json(toPublic(row, true))
  })
}
