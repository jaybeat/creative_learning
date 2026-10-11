/**
 * 用真实评测机检查测试数据：把 tests/fixtures/poly-c 里的标准 C 解答提交给评测机，三问的每个测试点都应通过，
 * 并打印各测试点用时（看时间限制是否宽裕）。需要环境变量 JUDGE_URL、JUDGE_SECRET，不进 CI。
 *   npx tsx scripts/judge-check.ts
 */
import { randomUUID } from 'node:crypto'
import { httpJudge } from '../server/judge'
import { grade } from '../server/grading'
import { loadTests } from '../server/problem-tests'
// @ts-expect-error 纯 JS 的测试夹具
import { solutions } from '../tests/fixtures/poly-c/build.mjs'

const { JUDGE_URL, JUDGE_SECRET } = process.env
if (!JUDGE_URL || !JUDGE_SECRET) throw new Error('需要 JUDGE_URL 与 JUDGE_SECRET')
const judge = httpJudge({ url: JUDGE_URL, secret: JUDGE_SECRET })

let bad = 0
for (const [id, code] of Object.entries(solutions as Record<string, string>)) {
  const tests = loadTests(id)
  const t0 = Date.now()
  const g = grade(tests, await judge.run(`check-${randomUUID()}`, code, tests.map((t) => t.input)))
  const times = g.tests.map((t) => t.timeMs)
  console.log(`${id}: ${g.status} ${g.passed}/${g.total}，最慢 ${Math.max(...times)} ms，往返 ${Date.now() - t0} ms`)
  if (g.status !== 'accepted') {
    bad++
    console.log(JSON.stringify(g.compileMessage ?? g.firstFail, null, 2).slice(0, 1500))
  }
}
process.exit(bad ? 1 : 0)
