import fs from 'node:fs'
import path from 'node:path'

export interface TestCase {
  input: string
  output: string
}

/**
 * 读取某题的测试数据：book/problems/tests/<题号>/NN.in 与 NN.out，按文件名排序。
 * Vercel 上由 vercel.json 的 includeFiles 打进函数包，相对路径与仓库一致。结果缓存在进程里。
 */
const cache = new Map<string, TestCase[]>()

export function testsDir(root = process.cwd()): string {
  return path.join(root, 'book', 'problems', 'tests')
}

export function loadTests(problemId: string, dir = testsDir()): TestCase[] {
  const key = `${dir}|${problemId}`
  const hit = cache.get(key)
  if (hit) return hit
  const d = path.join(dir, problemId)
  if (!fs.existsSync(d)) return []
  const tests = fs
    .readdirSync(d)
    .filter((f) => f.endsWith('.in'))
    .sort()
    .map((f) => ({
      input: fs.readFileSync(path.join(d, f), 'utf8'),
      output: fs.readFileSync(path.join(d, f.replace(/\.in$/, '.out')), 'utf8'),
    }))
  cache.set(key, tests)
  return tests
}
