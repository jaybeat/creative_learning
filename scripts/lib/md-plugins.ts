import type MarkdownIt from 'markdown-it'

/** 列数超过这个值的表格加 `wide-table` class（单元格不换行、内边距收紧）。 */
export const WIDE_TABLE_COLS = 8

/** Unicode Box Drawing 区：U+2500–U+257F */
const BOX_DRAWING = /[─-╿]/

export type FenceKind = 'diagram' | 'session'

/**
 * 无语言标记的围栏按内容分类：含制表符 → diagram（字符画），否则 → session（终端会话）。
 * 有语言标记的一律不分类。
 */
export function classifyFence(info: string, content: string): FenceKind | null {
  if (info.trim()) return null
  return BOX_DRAWING.test(content) ? 'diagram' : 'session'
}

/**
 * 给分类后的围栏加 class 与 data 属性。diagram 块还带一个稳定 id：
 * `ch02-2-9-d03` = 页面路径 + 本页第几个图示，供将来做步进动画时挂载。
 */
export function fenceKindPlugin(md: MarkdownIt): void {
  const orig = md.renderer.rules.fence
  if (!orig) throw new Error('fenceKindPlugin: 需要已有 fence 渲染规则')

  md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
    const t = tokens[idx]
    const kind = classifyFence(t.info, t.content)
    if (kind) {
      t.info = 'text' // 让 Shiki 按纯文本处理，避免「未知语言」告警
      t.meta = { ...(t.meta ?? {}), kind }
    }

    const html = orig(tokens, idx, opts, env, self)
    if (!kind) return html

    let attrs = ` data-kind="${kind}"`
    if (kind === 'diagram') {
      const e = (env ?? {}) as { relativePath?: string; __diagramSeq?: number }
      const page = String(e.relativePath ?? 'page')
        .replace(/\.md$/, '')
        .replace(/[\\/]/g, '-')
        .replace(/-index$/, '')
      e.__diagramSeq = (e.__diagramSeq ?? 0) + 1
      attrs += ` data-diagram-id="${page}-d${String(e.__diagramSeq).padStart(2, '0')}"`
    }
    // VitePress 输出 <div class="language-text ...">…；裸 markdown-it 输出 <pre><code class="language-text">。
    // 两种情况下第一个 language- class 都是要加类的元素。
    return html.replace(/class="(language-[^"]*)"/, (_m, cls: string) => `class="${cls} ${kind}"${attrs}`)
  }
}

/** 超过这个行数的有语言标记代码块默认折叠（作者已确认 40）。 */
export const FOLD_THRESHOLD = 40
/** 折叠时露出的行数 */
export const FOLD_PREVIEW_LINES = 20

export function countLines(content: string): number {
  return content.replace(/\n$/, '').split('\n').length
}

/**
 * 给超长的、有语言标记的代码块加 `data-fold="<总行数>"`。图示 / 会话块不折叠。
 * 折叠本身由客户端脚本（theme/fold.ts）加 class 实现，无 JS 时默认全部展开。
 * 与 fenceKindPlugin 的注册顺序无关：无论先后，都能通过 meta.kind 或原始 info 判断出图示块。
 */
export function foldPlugin(md: MarkdownIt): void {
  const orig = md.renderer.rules.fence
  if (!orig) throw new Error('foldPlugin: 需要已有 fence 渲染规则')
  md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
    const t = tokens[idx]
    const isPlain = Boolean((t.meta as { kind?: string } | null)?.kind) || classifyFence(t.info, t.content) !== null
    const html = orig(tokens, idx, opts, env, self)
    if (isPlain) return html
    const n = countLines(t.content)
    if (n <= FOLD_THRESHOLD) return html
    return html.replace(/class="(language-[^"]*)"/, (m) => `${m} data-fold="${n}"`)
  }
}

/**
 * 表头列数 > WIDE_TABLE_COLS 的表格加 `wide-table` class。
 * VitePress 自己把 table_open 写死成 `<table tabindex="0">`（忽略 token 属性），
 * 所以这里同时覆盖渲染规则：保留 tabindex，并输出 token 上的属性。
 */
export function wideTablePlugin(md: MarkdownIt): void {
  md.core.ruler.push('wide_table', (state) => {
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'table_open') continue
      let cols = 0
      for (let j = i + 1; j < tokens.length && tokens[j].type !== 'tr_close'; j++) {
        if (tokens[j].type === 'th_open') cols++
      }
      if (cols > WIDE_TABLE_COLS) tokens[i].attrJoin('class', 'wide-table')
    }
  })
  md.renderer.rules.table_open = (tokens, idx, _opts, _env, self) => {
    const t = tokens[idx]
    if (t.attrGet('tabindex') === null) t.attrSet('tabindex', '0')
    return `<table${self.renderAttrs(t)}>\n`
  }
}
