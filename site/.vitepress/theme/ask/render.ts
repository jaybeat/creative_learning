/**
 * 把模型回答（Markdown 子集）渲染成 HTML。只认这几种：``` 代码块、`行内代码`、**加粗**、- / 1. 列表、段落。
 * 先整体转义再加标签，模型输出里的 HTML 一律当文字显示；不引入 markdown-it，免得前端包变大。
 * 流式输出时代码块可能还没闭合：未闭合的围栏照样当代码块显示。
 */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function inline(s: string): string {
  return esc(s)
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
}

export function renderAnswer(md: string): string {
  const out: string[] = []
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  let para: string[] = []
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null
  const flush = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`)
    para = []
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`)
    list = null
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fence = /^\s*```\s*(\w*)/.exec(line)
    if (fence) {
      flush()
      const code: string[] = []
      while (++i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i])
      out.push(`<pre><code${fence[1] ? ` class="language-${fence[1]}"` : ''}>${esc(code.join('\n'))}</code></pre>`)
      continue
    }
    const ul = /^\s*[-*]\s+(.*)$/.exec(line)
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    const item = ul ?? ol
    if (item) {
      const tag = ul ? 'ul' : 'ol'
      if (para.length || (list && list.tag !== tag)) flush()
      list ??= { tag, items: [] }
      list.items.push(item[1])
      continue
    }
    const h = /^#{1,6}\s+(.*)$/.exec(line)
    if (h) {
      flush()
      out.push(`<p><strong>${inline(h[1])}</strong></p>`)
      continue
    }
    if (!line.trim()) {
      flush()
      continue
    }
    if (list) flush()
    para.push(line)
  }
  flush()
  return out.join('')
}
