import { compareOutput } from '../scripts/lib/compare.js'
import type { JudgeResult, RunResult } from './judge.js'
import type { TestCase } from './problem-tests.js'

export type Verdict = 'accepted' | 'wrong_answer' | 'compile_error' | 'time_limit' | 'memory_limit' | 'runtime_error' | 'output_limit'

export interface FirstFail {
  /** 第几个测试点（1 起） */
  index: number
  status: Verdict
  input: string
  expected: string
  actual: string
  /** 答案错误时第一处不同的行号 */
  line?: number
  /** 运行出错时的退出码 */
  exitStatus?: number
}

export interface Grade {
  status: Verdict
  passed: number
  total: number
  tests: { status: Verdict; timeMs: number }[]
  compileMessage?: string
  firstFail?: FirstFail
}

/** 展示给读者的测试点数据上限（字符） */
export const SHOW_MAX = 2000

export function clip(s: string, max = SHOW_MAX): string {
  return s.length > max ? s.slice(0, max) + '\n…（已截断）' : s
}

const RUN_STATUS: Record<RunResult['status'], Verdict> = {
  ok: 'accepted',
  time_limit: 'time_limit',
  memory_limit: 'memory_limit',
  runtime_error: 'runtime_error',
  output_limit: 'output_limit',
}

/** 把评测机的运行结果与测试数据比对，得出结论。结论取第一个没通过的测试点 */
export function grade(tests: TestCase[], r: JudgeResult): Grade {
  if (!r.compile.ok) {
    return {
      status: 'compile_error',
      passed: 0,
      total: tests.length,
      tests: tests.map(() => ({ status: 'compile_error', timeMs: 0 })),
      compileMessage: r.compile.message,
    }
  }
  let firstFail: FirstFail | undefined
  const results = tests.map((t, i) => {
    const run = r.runs[i]
    let status: Verdict = run ? RUN_STATUS[run.status] : 'runtime_error'
    let line: number | undefined
    if (status === 'accepted') {
      const c = compareOutput(t.output, run.stdout)
      if (!c.ok) {
        status = 'wrong_answer'
        line = c.line
      }
    }
    if (status !== 'accepted' && !firstFail) {
      firstFail = {
        index: i + 1,
        status,
        input: clip(t.input),
        expected: clip(t.output),
        actual: clip(run?.stdout ?? ''),
        ...(line ? { line } : {}),
        ...(status === 'runtime_error' && run ? { exitStatus: run.exitStatus } : {}),
      }
    }
    return { status, timeMs: run?.timeMs ?? 0 }
  })
  const passed = results.filter((x) => x.status === 'accepted').length
  return {
    status: firstFail?.status ?? 'accepted',
    passed,
    total: tests.length,
    tests: results,
    ...(firstFail ? { firstFail } : {}),
  }
}
