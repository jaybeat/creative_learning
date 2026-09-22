/**
 * 本地搜索分词。VitePress 会把这个函数的源码序列化后下发到浏览器，
 * 因此它必须自包含：不引用模块内任何其他变量或函数。
 *
 * 规则：ASCII 单词（字母数字下划线）整体作为一个词；中文按二元切分（「头结点」→「头结」「结点」），
 * 单个孤立汉字保留为一个词。索引与查询两侧完全相同、不依赖上下文，所以只要原文里连续出现就必命中。
 */
export function tokenize(text: string): string[] {
  const out: string[] = []
  const lower = text.toLowerCase()
  const re = /[a-z0-9_]+|[一-鿿]+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(lower))) {
    const s = m[0]
    if (s.charCodeAt(0) < 0x4e00) {
      out.push(s)
      continue
    }
    if (s.length === 1) {
      out.push(s)
      continue
    }
    for (let i = 0; i + 1 < s.length; i++) out.push(s.slice(i, i + 2))
  }
  return out
}
