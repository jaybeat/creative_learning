import { randomUUID } from 'node:crypto'
import type { Deps } from './app.js'
import type { Api } from './auth.js'
import { readJson } from './auth.js'
import { fail } from './http.js'
import { clip } from './grading.js'
import { JudgeUnavailable } from './judge.js'
import { LIMITS as SUBMIT, PROBLEM_RE, overDailyLimit } from './submissions.js'

export const LIMITS = {
  inputs: 5,
  inputBytes: 16 * 1024,
  perMinute: 20,
  /** 返回给前端的每组输出上限（字符） */
  stdout: 16 * 1024,
  benchMax: 100,
}

/**
 * 「运行」：编译并用读者给的输入运行，原样返回输出；不比对、不存记录（期望输出在页面上，比对在前端做）。
 * 同步返回：读者本来就在等，评测机客户端自带重试。
 */
export function runRoutes(app: Api, { db, judge }: Deps) {
  app.post('/run', async (c) => {
    const u = c.get('user')
    if (!u) return fail(c, 401, 'login_required')
    const b = await readJson(c)
    if (typeof b.problemId !== 'string' || !PROBLEM_RE.test(b.problemId)) return fail(c, 400, 'bad_problem')
    const code = typeof b.code === 'string' ? b.code : ''
    if (!code.trim() || Buffer.byteLength(code, 'utf8') > SUBMIT.codeBytes) return fail(c, 400, 'bad_code')
    const inputs = b.inputs
    if (
      !Array.isArray(inputs) ||
      inputs.length < 1 ||
      inputs.length > LIMITS.inputs ||
      inputs.some((x) => typeof x !== 'string' || Buffer.byteLength(x, 'utf8') > LIMITS.inputBytes)
    ) {
      return fail(c, 400, 'bad_inputs')
    }
    if (!judge) return fail(c, 503, 'judge_unconfigured')

    const [rate] = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM judge_log WHERE user_id = $1 AND kind = 'run' AND created_at > now() - interval '1 minute'`,
      [u.id],
    )
    if (rate.n >= LIMITS.perMinute) return fail(c, 429, 'run_rate')
    if (await overDailyLimit(db)) return fail(c, 429, 'judge_daily_limit')
    await db.query(`INSERT INTO judge_log (user_id, kind) VALUES ($1, 'run')`, [u.id])

    try {
      const r = await judge.run(`run-${randomUUID()}`, code, inputs as string[])
      return c.json({
        compile: r.compile,
        runs: r.runs.map((x) => ({ status: x.status, stdout: clip(x.stdout, LIMITS.stdout), timeMs: x.timeMs, exitStatus: x.exitStatus })),
      })
    } catch (e) {
      console.error('[run]', e)
      return fail(c, 503, e instanceof JudgeUnavailable ? 'judge_unavailable' : 'judge_error')
    }
  })

  /**
   * 管理员：从本函数所在地域连续调用评测机 n 次（A+B，3 组输入），统计成功率与延迟。
   * 用来在晚高峰实测跨境链路（方案第 1 步）。不计入每日上限。
   */
  app.get('/admin/judge-bench', async (c) => {
    const u = c.get('user')
    if (!u) return fail(c, 401, 'login_required')
    if (!u.isAdmin) return fail(c, 403, 'forbidden')
    if (!judge) return fail(c, 503, 'judge_unconfigured')
    const n = Math.min(LIMITS.benchMax, Math.max(1, Number(c.req.query('n')) || 20))
    const code = '#include <stdio.h>\nint main(void){int a,b;scanf("%d %d",&a,&b);printf("%d\\n",a+b);return 0;}'
    const times: number[] = []
    const errors: string[] = []
    const started = Date.now()
    for (let i = 0; i < n; i++) {
      const t = Date.now()
      try {
        const r = await judge.run(`bench-${randomUUID()}`, code, ['1 2', '3 4', '5 6'])
        if (r.runs[2]?.stdout === '11\n') times.push(Date.now() - t)
        else errors.push(`wrong: ${JSON.stringify(r).slice(0, 120)}`)
      } catch (e) {
        errors.push(e instanceof Error ? e.message.slice(0, 160) : String(e))
      }
    }
    times.sort((a, b) => a - b)
    const q = (p: number) => times[Math.min(times.length - 1, Math.floor(p * times.length))] ?? null
    return c.json({
      region: process.env.VERCEL_REGION ?? 'local',
      at: new Date().toISOString(),
      n,
      ok: times.length,
      p50: q(0.5),
      p95: q(0.95),
      max: times.at(-1) ?? null,
      totalMs: Date.now() - started,
      errors: errors.slice(0, 10),
    })
  })
}
