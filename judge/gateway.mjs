// 评测机网关：对外唯一的入口（默认 0.0.0.0:8443）。验签后在本机调用 go-judge（只监听 127.0.0.1:5050）
// 完成「编译 → 逐组运行 → 删除可执行文件」，把结果签名后返回。不存题目、不做比对。
// 无第三方依赖，兼容 Node 18。环境变量：JUDGE_SECRET（必填）、PORT、GO_JUDGE_URL。
import http from 'node:http'
import { pathToFileURL } from 'node:url'
import { NonceCache, signResponse, verifyRequest } from './protocol.mjs'

export const LIMITS = {
  bodyBytes: 256 * 1024,
  codeBytes: 64 * 1024,
  inputs: 30,
  inputBytes: 64 * 1024,
  /** 同时进行的评测数（2 核机器） */
  concurrent: 2,
  /** 幂等缓存保留时间 */
  cacheMs: 10 * 60 * 1000,
  compile: { cpu: 10e9, clock: 15e9, memory: 512 << 20, proc: 64, stderr: 64 * 1024, message: 4096 },
  // 输出上限 256 KB：乘法题最大的正确输出约 93 KB
  run: { cpu: 1e9, clock: 3e9, memory: 128 << 20, proc: 1, stdout: 256 * 1024, stderr: 4096 },
}

const KEY_RE = /^[A-Za-z0-9_-]{1,64}$/
const ENV = ['PATH=/usr/bin:/bin']

/** go-judge 的状态 → 本系统的运行状态 */
export function mapStatus(r) {
  switch (r.status) {
    case 'Accepted':
      return 'ok'
    case 'Time Limit Exceeded':
      return 'time_limit'
    case 'Memory Limit Exceeded':
      return 'memory_limit'
    case 'Output Limit Exceeded':
      return 'output_limit'
    case 'File Error':
      return (r.fileError ?? []).some((e) => e.type === 'CollectSizeExceeded') ? 'output_limit' : 'system_error'
    case 'Nonzero Exit Status':
    case 'Signalled':
    case 'Dangerous Syscall':
      return 'runtime_error'
    default:
      return 'system_error'
  }
}

/** 编译错误信息：去掉沙箱里的工作目录前缀，截断 */
export function cleanCompileMessage(s, max = LIMITS.compile.message) {
  const t = String(s ?? '').replace(/\/w\//g, '')
  return t.length > max ? t.slice(0, max) + '\n…（已截断）' : t
}

function validate(req) {
  if (!req || typeof req !== 'object') return 'bad_request'
  if (typeof req.key !== 'string' || !KEY_RE.test(req.key)) return 'bad_key'
  if (typeof req.code !== 'string' || !req.code.trim() || Buffer.byteLength(req.code) > LIMITS.codeBytes) return 'bad_code'
  if (!Array.isArray(req.inputs) || req.inputs.length < 1 || req.inputs.length > LIMITS.inputs) return 'bad_inputs'
  if (req.inputs.some((x) => typeof x !== 'string' || Buffer.byteLength(x) > LIMITS.inputBytes)) return 'bad_inputs'
  return null
}

/**
 * 纯逻辑部分（便于测试）：handle({ method, path, headers, body }) → { status, headers, body }。
 * goJudge(pathname, init) 用来访问 go-judge，测试里换成假的。
 */
export function createGateway({ secret, goJudge, now = () => Date.now() }) {
  if (!secret || secret.length < 32) throw new Error('JUDGE_SECRET 至少 32 个字符')
  const nonces = new NonceCache()
  /** key → { expires, promise }：同一个 key 的重试直接复用结果（含进行中的） */
  const cache = new Map()
  let active = 0

  async function gj(pathname, init) {
    const res = await goJudge(pathname, init)
    if (!res.ok) throw new Error(`go-judge ${pathname} → ${res.status}`)
    return init?.method === 'DELETE' ? null : res.json()
  }

  async function judge({ code, inputs }) {
    const C = LIMITS.compile
    const [compile] = await gj('/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cmd: [
          {
            args: ['/usr/bin/gcc', 'main.c', '-o', 'main', '-O2', '-std=c11', '-lm'],
            env: ENV,
            files: [{ content: '' }, { name: 'stdout', max: 10240 }, { name: 'stderr', max: C.stderr }],
            cpuLimit: C.cpu,
            clockLimit: C.clock,
            memoryLimit: C.memory,
            procLimit: C.proc,
            copyIn: { 'main.c': { content: code } },
            copyOut: ['stdout', 'stderr'],
            copyOutCached: ['main'],
          },
        ],
      }),
    })
    const exe = compile.fileIds?.main
    if (compile.status !== 'Accepted' || !exe) {
      if (exe) await gj(`/file/${exe}`, { method: 'DELETE' }).catch(() => {})
      if (compile.status === 'Internal Error') throw new Error(`go-judge 编译内部错误：${compile.error ?? ''}`)
      const why = compile.status === 'Accepted' ? '' : compile.status === 'Time Limit Exceeded' ? '编译超时\n' : ''
      return { compile: { ok: false, message: cleanCompileMessage(why + (compile.files?.stderr || compile.files?.stdout || compile.status)) }, runs: [] }
    }
    try {
      const R = LIMITS.run
      const results = await gj('/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cmd: inputs.map((input) => ({
            args: ['main'],
            env: ENV,
            files: [{ content: input }, { name: 'stdout', max: R.stdout }, { name: 'stderr', max: R.stderr }],
            cpuLimit: R.cpu,
            clockLimit: R.clock,
            memoryLimit: R.memory,
            procLimit: R.proc,
            copyIn: { main: { fileId: exe } },
            copyOut: ['stdout', 'stderr'],
          })),
        }),
      })
      const runs = results.map((r) => ({
        status: mapStatus(r),
        stdout: r.files?.stdout ?? '',
        stderr: (r.files?.stderr ?? '').slice(0, R.stderr),
        exitStatus: r.exitStatus ?? 0,
        timeMs: Math.round((r.time ?? 0) / 1e6),
        memoryKb: Math.round((r.memory ?? 0) / 1024),
      }))
      if (runs.some((r) => r.status === 'system_error')) throw new Error('go-judge 运行内部错误')
      return { compile: { ok: true, message: cleanCompileMessage(compile.files?.stderr ?? '') }, runs }
    } finally {
      await gj(`/file/${exe}`, { method: 'DELETE' }).catch(() => {})
    }
  }

  function reply(status, nonce, obj) {
    const body = JSON.stringify(obj)
    const headers = { 'content-type': 'application/json' }
    if (nonce) Object.assign(headers, signResponse(secret, { status, nonce, body, now: now() }))
    return { status, headers, body }
  }

  return async function handle({ method, path, headers, body, ip = '-' }) {
    if (method === 'GET' && path === '/health') return reply(200, null, { ok: true })
    if (method !== 'POST' || path !== '/judge') return reply(404, null, { error: 'not_found' })
    if (Buffer.byteLength(body) > LIMITS.bodyBytes) return reply(413, null, { error: 'too_large' })

    const why = verifyRequest(secret, { method, path, headers, body, nonces, now: now() })
    // 验签失败不签名响应（不给对方可用的签名样本），也不透露具体原因以外的信息
    if (why) {
      // 只记原因和来源，不记请求内容
      console.log(`[gateway] reject ${why} from ${ip}`)
      return reply(401, null, { error: why })
    }
    const nonce = headers['x-judge-nonce']

    let req
    try {
      req = JSON.parse(body)
    } catch {
      return reply(400, nonce, { error: 'bad_json' })
    }
    const bad = validate(req)
    if (bad) return reply(400, nonce, { error: bad })

    const t = now()
    for (const [k, v] of cache) if (v.expires < t) cache.delete(k)
    let entry = cache.get(req.key)
    if (!entry) {
      if (active >= LIMITS.concurrent) return reply(503, nonce, { error: 'busy' })
      active++
      const promise = judge(req).finally(() => {
        active--
      })
      entry = { expires: t + LIMITS.cacheMs, promise }
      cache.set(req.key, entry)
      // 失败的结果不缓存，重试时重新评测
      promise.catch(() => cache.delete(req.key))
    }
    try {
      const r = await entry.promise
      console.log(`[gateway] ok ${req.key} from ${ip} inputs=${req.inputs.length} ${now() - t}ms`)
      return reply(200, nonce, r)
    } catch (e) {
      console.error('[gateway]', req.key, e)
      return reply(502, nonce, { error: 'judge_failed' })
    }
  }
}

/** 启动 HTTP 服务 */
export function startServer({ secret, port = 8443, goJudgeUrl = 'http://127.0.0.1:5050' }) {
  const handle = createGateway({ secret, goJudge: (p, init) => fetch(goJudgeUrl + p, init) })
  const server = http.createServer((req, res) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > LIMITS.bodyBytes) {
        res.writeHead(413).end()
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', async () => {
      if (res.writableEnded) return
      const url = new URL(req.url ?? '/', 'http://x')
      try {
        const r = await handle({
          method: req.method ?? 'GET',
          path: url.pathname,
          headers: req.headers,
          body: Buffer.concat(chunks).toString('utf8'),
          ip: req.socket.remoteAddress ?? '-',
        })
        res.writeHead(r.status, r.headers).end(r.body)
      } catch (e) {
        console.error('[gateway]', e)
        res.writeHead(500).end()
      }
    })
  })
  server.requestTimeout = 30_000
  server.headersTimeout = 10_000
  server.listen(port, () => console.log(`[gateway] listening on :${port}, go-judge at ${goJudgeUrl}`))
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer({ secret: process.env.JUDGE_SECRET ?? '', port: Number(process.env.PORT) || 8443, goJudgeUrl: process.env.GO_JUDGE_URL })
}
