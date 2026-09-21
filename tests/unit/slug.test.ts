import { describe, expect, test } from 'vitest'
import { chapterSlug, slugify } from '../../scripts/lib/slug'

describe('slugify', () => {
  test('编号开头的标题用编号做 slug', () => {
    expect(slugify('2.8 链表：关系存哪里，用C怎么表示')).toBe('2-8')
    expect(slugify('2.8.1 放弃"相邻"约定，关系存哪里')).toBe('2-8-1')
    expect(slugify('2.12.4 双向链表')).toBe('2-12-4')
  })

  test('章标题 → chNN', () => {
    expect(slugify('第2章 线性表')).toBe('ch02')
    expect(slugify('第12章 图')).toBe('ch12')
    expect(chapterSlug(3)).toBe('ch03')
  })

  test('无编号回退到通用规则', () => {
    expect(slugify('Hello World!')).toBe('hello-world')
    expect(slugify('附录 参考资料')).toBe('附录-参考资料')
  })

  test('版本号不是节号：「编辑器2.2」不以编号开头', () => {
    expect(slugify('编辑器2.2')).toBe('编辑器22')
  })
})
