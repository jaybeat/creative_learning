/** 昵称规则：2–20 个字符；不能含保留词（防冒充作者）；管理员不受保留词限制 */

export const RESERVED = ['作者', '管理员', '官方', '站长', '林小川', '小川', 'admin', 'administrator', 'creativelearning']

export type NameError = 'name_length' | 'name_chars' | 'name_reserved'

/** 比较用的归一化：去空白与常见分隔符、转小写、全角转半角 */
export function normalizeName(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s_\-.·•]+/g, '')
}

export function checkName(raw: string, isAdmin: boolean): { name: string } | { error: NameError } {
  const name = raw.trim().replace(/\s+/g, ' ')
  const len = [...name].length
  if (len < 2 || len > 20) return { error: 'name_length' }
  if (/[\p{C}<>"'`]/u.test(name)) return { error: 'name_chars' }
  if (!isAdmin) {
    const n = normalizeName(name)
    if (RESERVED.some((r) => n.includes(normalizeName(r)))) return { error: 'name_reserved' }
  }
  return { name }
}
