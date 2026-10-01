/**
 * 判题的输出比对规则（服务端判提交、前端判「运行」共用）：
 * 统一换行符，每行去掉行尾空格与制表符，去掉末尾的空行，然后逐行完全相等。
 */
export function normalizeLines(s: string): string[] {
  const lines = s.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/[ \t]+$/, ''))
  while (lines.length && lines[lines.length - 1] === '') lines.pop()
  return lines
}

export type CompareResult = { ok: true } | { ok: false; /** 第一处不同的行号（1 起） */ line: number }

export function compareOutput(expected: string, actual: string): CompareResult {
  const e = normalizeLines(expected)
  const a = normalizeLines(actual)
  const n = Math.max(e.length, a.length)
  for (let i = 0; i < n; i++) {
    if (e[i] !== a[i]) return { ok: false, line: i + 1 }
  }
  return { ok: true }
}
