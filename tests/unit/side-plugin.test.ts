import { describe, expect, test } from 'vitest'
import { createMd } from '../../scripts/lib/md'
import { sidePlugin } from '../../scripts/lib/side-plugin'
import { lessonPlugin } from '../../scripts/lib/lesson-plugin'

const md = createMd().use(sidePlugin).use(lessonPlugin)
const env = () => ({ relativePath: 'ch04/4-5.md' })
const render = (src: string) => md.render(src, env())

describe('sidePlugin', () => {
  test('每张图和它前面的文字配成一行', () => {
    const html = render(
      '::: side\n**根**。A 是根。\n\n<TreeFigure tree="A" />\n\n**左子树**。第一段。\n\n第二段。\n\n<TreeFigure tree="B" />\n:::\n',
    )
    const rows = html.split('<div class="side-row">').slice(1)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatch(/<div class="side-text">\s*<p><strong>根<\/strong>。A 是根。<\/p>\s*<\/div>\s*<div class="side-fig">\s*<TreeFigure tree="A" \/>/)
    expect(rows[1]).toContain('第一段')
    expect(rows[1]).toContain('第二段')
    expect(rows[1]).toContain('<TreeFigure tree="B" />')
    expect(html).not.toContain(':::')
  })

  test('figure-pair 也算一张图', () => {
    const html = render('::: side\n文字\n\n<div class="figure-pair">\n<TreeFigure tree="A" />\n<TreeFigure tree="B" />\n</div>\n:::\n')
    expect(html).toMatch(/<div class="side-fig">\s*<div class="figure-pair">/)
  })

  test('最后一张图后面的文字单独成一行', () => {
    const html = render('::: side\n文字\n\n<TreeFigure tree="A" />\n\n结论。\n:::\n')
    expect(html).toMatch(/<div class="side-row side-row-text">\s*<p>结论。<\/p>/)
  })

  test('列表里的内容留在文字格里', () => {
    const html = render('::: side\n- 第一条\n- 第二条\n\n<TreeFigure tree="A" />\n:::\n')
    expect(html).toMatch(/<div class="side-text">\s*<ul>[\s\S]*第二条[\s\S]*<\/ul>\s*<\/div>\s*<div class="side-fig">/)
  })

  test('VitePress 的渲染器里也能认出图（组件是 html_inline）', async () => {
    const { createMarkdownRenderer } = await import('vitepress')
    const vp = await createMarkdownRenderer('site', { config: (m: typeof md) => m.use(sidePlugin) } as never)
    const html = vp.render('::: side\n文字\n\n<TreeFigure tree="A" />\n:::\n', {})
    expect(html).toMatch(/<div class="side-fig">\s*<TreeFigure tree="A" \/>/)
  })

  test('容器外的图不受影响', () => {
    const html = render('文字\n\n<TreeFigure tree="A" />\n')
    expect(html).not.toContain('side-row')
  })
})
