import { signRequest, verifyResponse } from '../judge/protocol.mjs'

/** 单组运行的结果（与评测机 gateway 的返回一致，见 judge/gateway.mjs） */
export interface RunResult {
  status: 'ok' | 'time_limit' | 'memory_limit' | 'runtime_error' | 'output_limit'
  stdout: string
  stderr: string
  exitStatus: number
  timeMs: number
  memoryKb: number
}

export interface JudgeResult {
  compile: { ok: boolean; message: string }
  runs: RunResult[]
}

/** 评测机：编译 code，并把每组输入各运行一次。key 用于幂等（同一个 key 的重试不会重复运行） */
export interface Judge {
  run(key: string, code: string, inputs: string[]): Promise<JudgeResult>
}

export class JudgeUnavailable extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface HttpJudgeOptions {
  url: string
  secret: string
  /** 每次请求的超时（毫秒） */
  timeoutMs?: number
  /** 失败后的重试间隔；长度即重试次数 */
  retryDelays?: number[]
  fetch?: typeof fetch
}

/**
 * 调用评测机。网络错误、超时、503（忙）、5xx、响应验签失败时按 retryDelays 重试；
 * 4xx（请求本身有问题，如验签失败、参数不对）不重试。全部失败抛 JudgeUnavailable。
 */
export function httpJudge(o: HttpJudgeOptions): Judge {
  const doFetch = o.fetch ?? fetch
  const url = o.url.replace(/\/+$/, '') + '/judge'
  const delays = o.retryDelays ?? [1000, 3000]
  return {
    async run(key, code, inputs) {
      const body = JSON.stringify({ key, code, inputs })
      let last = ''
      for (let attempt = 0; attempt <= delays.length; attempt++) {
        if (attempt > 0) await sleep(delays[attempt - 1])
        // 每次重试都重新签名（新的时间戳与随机数），评测机按 key 去重
        const { nonce, headers } = signRequest(o.secret, { method: 'POST', path: '/judge', body })
        let res: Response
        let text: string
        try {
          res = await doFetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...headers },
            body,
            signal: AbortSignal.timeout(o.timeoutMs ?? 15_000),
          })
          text = await res.text()
        } catch (e) {
          last = `network: ${e instanceof Error ? e.message : String(e)}`
          continue
        }
        const respHeaders = { 'x-judge-ts': res.headers.get('x-judge-ts'), 'x-judge-sig': res.headers.get('x-judge-sig') }
        if (res.status === 401 || res.status === 400 || res.status === 413) {
          // 请求被拒：密钥或时钟不对、参数不对。重试也没用
          throw new JudgeUnavailable(`judge rejected ${res.status}: ${text.slice(0, 200)}`)
        }
        const bad = verifyResponse(o.secret, { status: res.status, nonce, headers: respHeaders, body: text })
        if (bad) {
          last = `response ${bad}`
          continue
        }
        if (res.status !== 200) {
          last = `status ${res.status}`
          continue
        }
        return JSON.parse(text) as JudgeResult
      }
      throw new JudgeUnavailable(`judge unavailable after ${delays.length + 1} attempts: ${last}`)
    },
  }
}

/** 没配评测机时返回 null（本地开发、CI） */
export function judgeFromEnv(env: Record<string, string | undefined>): Judge | null {
  if (!env.JUDGE_URL || !env.JUDGE_SECRET) return null
  return httpJudge({ url: env.JUDGE_URL, secret: env.JUDGE_SECRET })
}

/**
 * 测试与 e2e 用的假评测机：代码里含 `COMPILE_ERROR` 视为编译错误；
 * 否则对每组输入调用 behave(code, input) 得到输出（或指定状态）。
 */
export function fakeJudge(
  behave: (code: string, input: string) => string | { status: RunResult['status']; stdout?: string },
): Judge & { calls: { key: string; code: string; inputs: string[] }[]; failNext: number } {
  const j = {
    calls: [] as { key: string; code: string; inputs: string[] }[],
    /** 接下来几次调用直接抛 JudgeUnavailable（模拟评测机连不上） */
    failNext: 0,
    async run(key: string, code: string, inputs: string[]): Promise<JudgeResult> {
      j.calls.push({ key, code, inputs })
      if (j.failNext > 0) {
        j.failNext--
        throw new JudgeUnavailable('fake: unavailable')
      }
      if (code.includes('COMPILE_ERROR')) return { compile: { ok: false, message: "main.c:1:1: error: expected ';'" }, runs: [] }
      return {
        compile: { ok: true, message: '' },
        runs: inputs.map((input) => {
          const r = behave(code, input)
          const o = typeof r === 'string' ? { status: 'ok' as const, stdout: r } : r
          return { status: o.status, stdout: o.stdout ?? '', stderr: '', exitStatus: 0, timeMs: 1, memoryKb: 1024 }
        }),
      }
    },
  }
  return j
}
