import type { RunResponse } from '../comments/api'

/** 一组测试输入。expected 为 null 表示自定义输入（只看输出，不比对） */
export interface RunCase {
  label: string
  input: string
  expected: string | null
  /** 来自第几个样例；改过输入后不再与样例的期望输出比对 */
  sample: number | null
  sampleInput?: string
}

/** 一次运行：发出去的那批输入（快照）+ 结果 */
export interface RunRecord {
  cases: RunCase[]
  response: RunResponse
}
