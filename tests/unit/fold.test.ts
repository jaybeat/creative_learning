import { describe, expect, test } from 'vitest'
import { createMd } from '../../scripts/lib/md'
import { FOLD_THRESHOLD, countLines, fenceKindPlugin, foldPlugin } from '../../scripts/lib/md-plugins'

const cBlock = (n: number) => '```c\n' + Array.from({ length: n }, (_, i) => `int v${i};`).join('\n') + '\n```\n'
const plainBlock = (n: number) => '```\n' + Array.from({ length: n }, () => '│').join('\n') + '\n```\n'

describe('foldPlugin', () => {
  test('阈值为 40', () => expect(FOLD_THRESHOLD).toBe(40))

  test('countLines 不把末尾换行算成一行', () => {
    expect(countLines('a\nb\n')).toBe(2)
    expect(countLines('a')).toBe(1)
  })

  test('41 行 c 块带 data-fold，40 行不带', () => {
    const md = createMd().use(foldPlugin)
    expect(md.render(cBlock(41))).toContain('class="language-c" data-fold="41"')
    expect(md.render(cBlock(40))).not.toContain('data-fold')
  })

  test('无语言标记的图示块再长也不折叠（两种注册顺序都成立）', () => {
    const a = createMd().use(fenceKindPlugin).use(foldPlugin)
    const b = createMd().use(foldPlugin).use(fenceKindPlugin)
    for (const md of [a, b]) {
      const html = md.render(plainBlock(100), { relativePath: 'x.md' })
      expect(html).toContain('diagram')
      expect(html).not.toContain('data-fold')
    }
  })

  test('与 fenceKindPlugin 同时使用时 c 块仍能折叠', () => {
    const md = createMd().use(fenceKindPlugin).use(foldPlugin)
    expect(md.render(cBlock(80), { relativePath: 'x.md' })).toContain('data-fold="80"')
  })
})
