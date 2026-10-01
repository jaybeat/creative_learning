import { describe, expect, it } from 'vitest'
import { createGateway, mapStatus } from '../../judge/gateway.mjs'
import { signRequest, verifyResponse } from '../../judge/protocol.mjs'

const SECRET = 's'.repeat(40)
const T0 = 1_800_000_000_000

/** 假 go-judge：编译成功（含 main 的缓存 id），运行时把输入原样当输出；记录每次调用 */
function fakeGoJudge(opts: { compileStatus?: string; runStatus?: string; delay?: Promise<void> } = {}) {
  const calls: { path: string; body: any; method: string }[] = []
  const goJudge = async (path: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null
    calls.push({ path, body, method: init?.method ?? 'GET' })
    if (init?.method === 'DELETE') return new Response(null, { status: 200 })
    await opts.delay
    const cmd = body.cmd
    if (cmd[0].args[0] === '/usr/bin/gcc') {
      const ok = (opts.compileStatus ?? 'Accepted') === 'Accepted'
      return Response.json([
        { status: opts.compileStatus ?? 'Accepted', exitStatus: ok ? 0 : 1, files: { stdout: '', stderr: ok ? '' : '/w/main.c:1: error: x' }, fileIds: ok ? { main: 'EXE1' } : {} },
      ])
    }
    return Response.json(
      cmd.map((c: any) => ({ status: opts.runStatus ?? 'Accepted', exitStatus: 0, time: 2e6, memory: 1 << 20, files: { stdout: c.files[0].content, stderr: '' } })),
    )
  }
  return { goJudge, calls }
}

function setup(opts: Parameters<typeof fakeGoJudge>[0] = {}, now = () => T0) {
  const fake = fakeGoJudge(opts)
  const handle = createGateway({ secret: SECRET, goJudge: fake.goJudge, now })
  /** 发一个签名请求；over 可以篡改各部分 */
  async function send(payload: unknown, over: { path?: string; signPath?: string; body?: string; now?: number; headers?: Record<string, string> } = {}) {
    const body = JSON.stringify(payload)
    const signed = signRequest(SECRET, { method: 'POST', path: over.signPath ?? '/judge', body, now: over.now ?? T0 })
    const headers = { ...signed.headers, ...over.headers }
    const res = await handle({ method: 'POST', path: over.path ?? '/judge', headers, body: over.body ?? body })
    return { ...res, json: JSON.parse(res.body), nonce: signed.nonce, headers: res.headers, reqHeaders: headers }
  }
  return { ...fake, handle, send }
}

const job = (over: Record<string, unknown> = {}) => ({ key: 'sub-1', code: 'int main(){}', inputs: ['1 2', '3'], ...over })

describe('评测机网关：验签', () => {
  it('正确签名：编译、逐组运行、删除可执行文件；响应签名能通过校验', async () => {
    const g = setup()
    const r = await g.send(job())
    expect(r.status).toBe(200)
    expect(r.json.compile.ok).toBe(true)
    expect(r.json.runs.map((x: any) => [x.status, x.stdout])).toEqual([
      ['ok', '1 2'],
      ['ok', '3'],
    ])
    expect(g.calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /run', 'POST /run', 'DELETE /file/EXE1'])
    // 运行限制由网关决定：1 个进程、禁止再开子进程
    expect(g.calls[1].body.cmd[0].procLimit).toBe(1)
    expect(verifyResponse(SECRET, { status: 200, nonce: r.nonce, headers: r.headers, body: r.body, now: T0 })).toBeNull()
  })

  it('响应被篡改、或拿去冒充另一个请求的响应：校验失败', async () => {
    const g = setup()
    const r = await g.send(job())
    expect(verifyResponse(SECRET, { status: 200, nonce: r.nonce, headers: r.headers, body: r.body.replace('"ok"', '"no"'), now: T0 })).toBe('bad_sig')
    expect(verifyResponse(SECRET, { status: 200, nonce: 'f'.repeat(32), headers: r.headers, body: r.body, now: T0 })).toBe('bad_sig')
    expect(verifyResponse(SECRET, { status: 502, nonce: r.nonce, headers: r.headers, body: r.body, now: T0 })).toBe('bad_sig')
  })

  it('过期、篡改请求体、换路径签名、错误密钥、缺头：拒绝且不执行', async () => {
    const g = setup()
    expect((await g.send(job(), { now: T0 - 61_000 })).json.error).toBe('expired')
    expect((await g.send(job(), { now: T0 + 61_000 })).json.error).toBe('expired')
    expect((await g.send(job(), { body: JSON.stringify(job({ code: 'evil' })) })).json.error).toBe('bad_sig')
    expect((await g.send(job(), { signPath: '/other' })).json.error).toBe('bad_sig')
    expect((await g.send(job(), { headers: { 'x-judge-sig': 'a'.repeat(64) } })).json.error).toBe('bad_sig')
    expect((await g.send(job(), { headers: { 'x-judge-nonce': 'xyz' } })).json.error).toBe('bad_nonce')
    const r = await g.handle({ method: 'POST', path: '/judge', headers: {}, body: '{}' })
    expect(r.status).toBe(401)
    // 验签失败的响应不带签名
    expect(r.headers['x-judge-sig']).toBeUndefined()
    expect(g.calls).toEqual([])
  })

  it('同一个请求原样重放：第二次被拒', async () => {
    const g = setup()
    const first = await g.send(job())
    expect(first.status).toBe(200)
    const again = await g.handle({ method: 'POST', path: '/judge', headers: first.reqHeaders, body: JSON.stringify(job()) })
    expect(again.status).toBe(401)
    expect(JSON.parse(again.body).error).toBe('replay')
  })

  it('其他路径 404；/health 不需要签名', async () => {
    const g = setup()
    expect((await g.handle({ method: 'POST', path: '/run', headers: {}, body: '' })).status).toBe(404)
    expect((await g.handle({ method: 'GET', path: '/health', headers: {}, body: '' })).status).toBe(200)
  })

  it('密钥太短拒绝启动', () => {
    expect(() => createGateway({ secret: 'short', goJudge: async () => new Response() })).toThrow(/至少 32/)
  })
})

describe('评测机网关：评测', () => {
  it('参数校验', async () => {
    const g = setup()
    expect((await g.send(job({ key: '../x' }))).json.error).toBe('bad_key')
    expect((await g.send(job({ code: ' ' }))).json.error).toBe('bad_code')
    expect((await g.send(job({ inputs: [] }))).json.error).toBe('bad_inputs')
    expect((await g.send(job({ inputs: Array(31).fill('1') }))).json.error).toBe('bad_inputs')
  })

  it('编译错误：返回去掉路径的信息，不运行', async () => {
    const g = setup({ compileStatus: 'Nonzero Exit Status' })
    const r = await g.send(job())
    expect(r.json).toEqual({ compile: { ok: false, message: 'main.c:1: error: x' }, runs: [] })
    expect(g.calls).toHaveLength(1)
  })

  it('幂等：同一个 key 的重试（新签名）直接返回缓存结果，不重复运行', async () => {
    const g = setup()
    const a = await g.send(job())
    const b = await g.send(job())
    expect(b.status).toBe(200)
    expect(b.json).toEqual(a.json)
    expect(g.calls.filter((c) => c.path === '/run')).toHaveLength(2)
  })

  it('超过 10 分钟后同一个 key 重新评测', async () => {
    let t = T0
    const g = setup({}, () => t)
    await g.send(job())
    t += 11 * 60 * 1000
    await g.send(job(), { now: t })
    expect(g.calls.filter((c) => c.path === '/run')).toHaveLength(4)
  })

  it('同时最多 2 个评测，第 3 个返回 503（已签名，客户端会重试）', async () => {
    let release!: () => void
    const g = setup({ delay: new Promise<void>((r) => (release = r)) })
    const p1 = g.send(job({ key: 'a' }))
    const p2 = g.send(job({ key: 'b' }))
    const r3 = await g.send(job({ key: 'c' }))
    expect(r3.status).toBe(503)
    expect(verifyResponse(SECRET, { status: 503, nonce: r3.nonce, headers: r3.headers, body: r3.body, now: T0 })).toBeNull()
    release()
    expect((await p1).status).toBe(200)
    expect((await p2).status).toBe(200)
  })

  it('go-judge 内部错误：502，不缓存（重试会重新评测）', async () => {
    const g = setup({ runStatus: 'Internal Error' })
    expect((await g.send(job())).status).toBe(502)
    expect((await g.send(job())).status).toBe(502)
    expect(g.calls.filter((c) => c.method === 'DELETE')).toHaveLength(2)
  })
})

describe('mapStatus', () => {
  it('go-judge 状态映射', () => {
    expect(mapStatus({ status: 'Accepted' })).toBe('ok')
    expect(mapStatus({ status: 'Time Limit Exceeded' })).toBe('time_limit')
    expect(mapStatus({ status: 'Memory Limit Exceeded' })).toBe('memory_limit')
    expect(mapStatus({ status: 'Signalled' })).toBe('runtime_error')
    expect(mapStatus({ status: 'Nonzero Exit Status' })).toBe('runtime_error')
    expect(mapStatus({ status: 'File Error', fileError: [{ type: 'CollectSizeExceeded' }] })).toBe('output_limit')
    expect(mapStatus({ status: 'Internal Error' })).toBe('system_error')
  })
})
