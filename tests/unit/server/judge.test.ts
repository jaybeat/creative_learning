import { describe, expect, it } from 'vitest'
import { ADMIN, setup } from './helpers'
import { fakeJudge, httpJudge, JudgeUnavailable } from '../../../server/judge'
import { grade } from '../../../server/grading'
import { loadTests } from '../../../server/problem-tests'
import { SOLVERS } from '../../../scripts/lib/poly-ref'
import { createGateway } from '../../../judge/gateway.mjs'

/** 假评测机：代码含 CORRECT 时按参考解输出，含 TLE 时超时，否则输出错误答案 */
const judgeFor = (problemId: string) =>
  fakeJudge((code, input) => {
    if (code.includes('TLE')) return { status: 'time_limit' }
    if (code.includes('CORRECT')) return SOLVERS[problemId](input)
    return 'nope\n'
  })

describe('grade', () => {
  const tests = [
    { input: '1\n', output: 'a\n' },
    { input: '2\n', output: 'b\nc\n' },
    { input: '3\n', output: 'd\n' },
  ]
  const run = (stdout: string, status: 'ok' | 'time_limit' = 'ok') => ({ status, stdout, stderr: '', exitStatus: 0, timeMs: 5, memoryKb: 1 })

  it('全部通过', () => {
    const g = grade(tests, { compile: { ok: true, message: '' }, runs: [run('a'), run('b \nc\n\n'), run('d\n')] })
    expect(g).toMatchObject({ status: 'accepted', passed: 3, total: 3 })
    expect(g.firstFail).toBeUndefined()
  })

  it('结论取第一个没过的测试点，并给出输入、期望、实际与第一处不同的行', () => {
    const g = grade(tests, { compile: { ok: true, message: '' }, runs: [run('a'), run('b\nx\n'), run('', 'time_limit')] })
    expect(g.status).toBe('wrong_answer')
    expect(g.passed).toBe(1)
    expect(g.tests.map((t) => t.status)).toEqual(['accepted', 'wrong_answer', 'time_limit'])
    expect(g.firstFail).toEqual({ index: 2, status: 'wrong_answer', input: '2\n', expected: 'b\nc\n', actual: 'b\nx\n', line: 2 })
  })

  it('编译错误', () => {
    const g = grade(tests, { compile: { ok: false, message: 'error: x' }, runs: [] })
    expect(g).toMatchObject({ status: 'compile_error', passed: 0, total: 3, compileMessage: 'error: x' })
  })

  it('过长的数据截断', () => {
    const long = 'x'.repeat(5000)
    const g = grade([{ input: long, output: 'a' }], { compile: { ok: true, message: '' }, runs: [run('b')] })
    expect(g.firstFail!.input.length).toBeLessThan(2100)
    expect(g.firstFail!.input).toContain('已截断')
  })
})

describe('提交：评测', () => {
  it('提交在请求里评测，直接返回结论与 x/y；之后也能查到', async () => {
    const judge = judgeFor('ch02-ex-1')
    const { client } = await setup({}, { judge })
    const a = client()
    await a.login('a@qq.com')
    const r = await a.post('/submissions', { problemId: 'ch02-ex-1', code: '/* CORRECT */' })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ status: 'accepted', passed: loadTests('ch02-ex-1').length })
    const d = (await a.get(`/submissions/${r.json.id}`)).json
    const total = loadTests('ch02-ex-1').length
    expect(d).toMatchObject({ status: 'accepted', passed: total, total })
    expect(d.result.firstFail).toBeUndefined()
    // 评测机收到的 key 就是提交 ID（重试时幂等）
    expect(judge.calls[0].key).toBe(r.json.id)
    expect((await a.get('/submissions?problem=ch02-ex-1')).json.submissions[0]).toMatchObject({ status: 'accepted', passed: total, total })
  })

  it('答案错误：显示第一个没过的测试点（第 1 个就是题面样例 1）', async () => {
    const { client } = await setup({}, { judge: judgeFor('ch02-ex-2') })
    const a = client()
    await a.login('a@qq.com')
    const id = (await a.post('/submissions', { problemId: 'ch02-ex-2', code: 'int main(){}' })).json.id
    const d = (await a.get(`/submissions/${id}`)).json
    expect(d.status).toBe('wrong_answer')
    expect(d.result.firstFail).toMatchObject({ index: 1, status: 'wrong_answer', input: '3 3 5 2 2 -1 0\n3 1 5 -2 2 4 1\n', actual: 'nope\n', line: 1 })
  })

  it('编译错误、超时', async () => {
    const { client } = await setup({}, { judge: judgeFor('ch02-ex-3') })
    const a = client()
    await a.login('a@qq.com')
    const ce = (await a.post('/submissions', { problemId: 'ch02-ex-3', code: 'COMPILE_ERROR' })).json.id
    const tle = (await a.post('/submissions', { problemId: 'ch02-ex-3', code: 'TLE' })).json.id
    expect((await a.get(`/submissions/${ce}`)).json).toMatchObject({ status: 'compile_error', result: { compileMessage: expect.stringContaining('error') } })
    expect((await a.get(`/submissions/${tle}`)).json.status).toBe('time_limit')
  })

  it('评测机连不上：system_error', async () => {
    const judge = judgeFor('ch02-ex-1')
    judge.failNext = 1
    const { client } = await setup({}, { judge })
    const a = client()
    await a.login('a@qq.com')
    const id = (await a.post('/submissions', { problemId: 'ch02-ex-1', code: '/* CORRECT */' })).json.id
    expect((await a.get(`/submissions/${id}`)).json).toMatchObject({ status: 'system_error', result: { message: 'judge_unavailable' } })
  })

  it('停在 judging 超过 2 分钟：被查询时重评一次（并发查询也只重评一次）', async () => {
    const judge = judgeFor('ch02-ex-1')
    const { client, db } = await setup({}, { judge })
    const a = client()
    await a.login('a@qq.com')
    const id = (await a.post('/submissions', { problemId: 'ch02-ex-1', code: '/* CORRECT */' })).json.id
    // 模拟请求中途断开：把行改回 judging 且时间往前挪
    await db.query(`UPDATE submissions SET status = 'judging', result = NULL, updated_at = now() - interval '3 minutes' WHERE id = $1`, [id])
    const before = judge.calls.length
    await Promise.all([a.get(`/submissions/${id}`), a.get(`/submissions/${id}`)])
    expect(judge.calls.length - before).toBe(1)
    expect((await a.get(`/submissions/${id}`)).json.status).toBe('accepted')
  })

  it('重评次数用完：标为 system_error，不再评测', async () => {
    const judge = judgeFor('ch02-ex-1')
    const { client, db } = await setup({}, { judge })
    const a = client()
    await a.login('a@qq.com')
    const id = (await a.post('/submissions', { problemId: 'ch02-ex-1', code: '/* CORRECT */' })).json.id
    await db.query(`UPDATE submissions SET status = 'judging', attempts = 3, updated_at = now() - interval '3 minutes' WHERE id = $1`, [id])
    const before = judge.calls.length
    expect((await a.get(`/submissions/${id}`)).json.status).toBe('system_error')
    expect(judge.calls.length).toBe(before)
  })

  it('没配评测机：仍然只保存（pending）', async () => {
    const { client } = await setup()
    const a = client()
    await a.login('a@qq.com')
    expect((await a.post('/submissions', { problemId: 'ch02-ex-1', code: 'x' })).json.status).toBe('pending')
  })
})

describe('运行', () => {
  const body = (over: Record<string, unknown> = {}) => ({ problemId: 'ch02-ex-1', code: '/* CORRECT */', inputs: ['3 4 5 4 1 -1 0\n'], ...over })

  it('未登录 401；没配评测机 503', async () => {
    const { client } = await setup()
    const a = client()
    expect((await a.post('/run', body())).status).toBe(401)
    await a.login('a@qq.com')
    expect((await a.post('/run', body())).json.error).toBe('judge_unconfigured')
  })

  it('原样返回每组输出，不留提交记录', async () => {
    const { client } = await setup({}, { judge: judgeFor('ch02-ex-1') })
    const a = client()
    await a.login('a@qq.com')
    const r = await a.post('/run', body({ inputs: ['3 4 5 4 1 -1 0\n', '0\n'] }))
    expect(r.status).toBe(200)
    expect(r.json.compile.ok).toBe(true)
    expect(r.json.runs.map((x: any) => x.stdout)).toEqual(['4x^5 + 4x - 1\n', '0\n'])
    expect((await a.get('/submissions?problem=ch02-ex-1')).json.submissions).toEqual([])
  })

  it('参数校验：组数、单组大小', async () => {
    const { client } = await setup({}, { judge: judgeFor('ch02-ex-1') })
    const a = client()
    await a.login('a@qq.com')
    expect((await a.post('/run', body({ inputs: [] }))).json.error).toBe('bad_inputs')
    expect((await a.post('/run', body({ inputs: Array(6).fill('1') }))).json.error).toBe('bad_inputs')
    expect((await a.post('/run', body({ inputs: ['1'.repeat(17000)] }))).json.error).toBe('bad_inputs')
  })

  it('每分钟最多 20 次；全站每日上限', async () => {
    const { client, db } = await setup({}, { judge: judgeFor('ch02-ex-1') })
    const a = client()
    await a.login('a@qq.com')
    for (let i = 0; i < 20; i++) expect((await a.post('/run', body())).status).toBe(200)
    expect((await a.post('/run', body())).json.error).toBe('run_rate')
    const b = client()
    await b.login('b@qq.com')
    await db.query(`INSERT INTO judge_log (kind) SELECT 'run' FROM generate_series(1, 3000)`)
    expect((await b.post('/run', body())).json.error).toBe('judge_daily_limit')
    expect((await b.post('/submissions', { problemId: 'ch02-ex-1', code: 'x' })).json.error).toBe('judge_daily_limit')
  })

  it('评测机连不上：503 judge_unavailable', async () => {
    const judge = judgeFor('ch02-ex-1')
    judge.failNext = 1
    const { client } = await setup({}, { judge })
    const a = client()
    await a.login('a@qq.com')
    const r = await a.post('/run', body())
    expect(r.status).toBe(503)
    expect(r.json.error).toBe('judge_unavailable')
  })
})

describe('管理员：评测机延迟测试', () => {
  it('普通读者 403；管理员拿到统计', async () => {
    const { client } = await setup({}, { judge: fakeJudge((_c, input) => `${input.split(' ').map(Number).reduce((x, y) => x + y)}\n`) })
    const a = client()
    await a.login('a@qq.com')
    expect((await a.get('/admin/judge-bench?n=3')).status).toBe(403)
    const admin = client()
    await admin.login(ADMIN)
    const r = (await admin.get('/admin/judge-bench?n=3')).json
    expect(r).toMatchObject({ n: 3, ok: 3, errors: [] })
  })
})

describe('httpJudge：经真实网关逻辑的签名、重试', () => {
  const SECRET = 'q'.repeat(48)
  /** 把 fetch 接到 createGateway（假 go-judge），可注入网络故障 */
  function wire(faults: ('network' | 'tamper' | null)[] = []) {
    const goJudge = async (path: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') return new Response(null)
      const cmd = JSON.parse(String(init!.body)).cmd
      if (cmd[0].args[0] === '/usr/bin/gcc') return Response.json([{ status: 'Accepted', files: { stderr: '' }, fileIds: { main: 'E' } }])
      return Response.json(cmd.map((c: any) => ({ status: 'Accepted', time: 1e6, memory: 1e6, files: { stdout: c.files[0].content.toUpperCase(), stderr: '' } })))
    }
    const handle = createGateway({ secret: SECRET, goJudge })
    let calls = 0
    const fetchImpl = (async (url: string, init: RequestInit) => {
      const fault = faults[calls++] ?? null
      if (fault === 'network') throw new TypeError('fetch failed')
      const headers: Record<string, string> = {}
      new Headers(init.headers).forEach((v, k) => (headers[k] = v))
      const r = await handle({ method: 'POST', path: new URL(url).pathname, headers, body: String(init.body) })
      const body = fault === 'tamper' ? r.body.replace('ABC', 'XYZ') : r.body
      return new Response(body, { status: r.status, headers: r.headers })
    }) as unknown as typeof fetch
    return { fetchImpl, count: () => calls }
  }

  it('正常调用：签名、验签通过', async () => {
    const w = wire()
    const j = httpJudge({ url: 'http://judge.test:8443', secret: SECRET, fetch: w.fetchImpl, retryDelays: [1, 1] })
    expect((await j.run('k1', 'int main(){}', ['abc'])).runs[0].stdout).toBe('ABC')
  })

  it('网络错误、响应被篡改：自动重试，第三次成功', async () => {
    const w = wire(['network', 'tamper'])
    const j = httpJudge({ url: 'http://judge.test:8443', secret: SECRET, fetch: w.fetchImpl, retryDelays: [1, 1] })
    expect((await j.run('k2', 'int main(){}', ['abc'])).runs[0].stdout).toBe('ABC')
    expect(w.count()).toBe(3)
  })

  it('三次都失败：JudgeUnavailable', async () => {
    const w = wire(['network', 'network', 'network'])
    const j = httpJudge({ url: 'http://judge.test:8443', secret: SECRET, fetch: w.fetchImpl, retryDelays: [1, 1] })
    await expect(j.run('k3', 'int main(){}', ['abc'])).rejects.toBeInstanceOf(JudgeUnavailable)
  })

  it('密钥不对：网关拒绝，不重试', async () => {
    const w = wire()
    const j = httpJudge({ url: 'http://judge.test:8443', secret: 'w'.repeat(48), fetch: w.fetchImpl, retryDelays: [1, 1] })
    await expect(j.run('k4', 'int main(){}', ['abc'])).rejects.toThrow(/rejected 401/)
    expect(w.count()).toBe(1)
  })
})
