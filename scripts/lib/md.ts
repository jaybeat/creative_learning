import MarkdownIt from 'markdown-it'

export type MdToken = ReturnType<MarkdownIt['parse']>[number]

/**
 * 共享的 markdown-it 实例（与 VitePress 的基础设置一致：允许 HTML、不自动链接）。
 * 切页、字符集扫描都用它解析 token 流，而不是对源码跑正则。
 */
export function createMd(): MarkdownIt {
  return new MarkdownIt({ html: true, linkify: false })
}
