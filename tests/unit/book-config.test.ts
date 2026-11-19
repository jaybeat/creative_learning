import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'
import { parseBookConfig } from '../../scripts/lib/book-config'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'book-config-'))
fs.writeFileSync(path.join(dir, 'ch01.md'), '# 第1章 绪论\n')
fs.writeFileSync(path.join(dir, 'ch02.md'), '# 第2章 线性表\n')
fs.writeFileSync(path.join(dir, 'ch02-poly.md'), '# 多项式\n## 第一问\n')
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('parseBookConfig', () => {
  test('英文书名与每章的问题', () => {
    const yml = [
      'title: 数据结构',
      'subtitle: 从问题到表示',
      'titleEn: "Data Structures: From Problems to Representations"',
      'chapters:',
      '  - file: ch01.md',
      '    question: " 这门课到底在解决什么问题 "',
      '  - file: ch02.md',
    ].join('\n')
    const book = parseBookConfig(yml, dir)
    expect(book.titleEn).toBe('Data Structures: From Problems to Representations')
    expect(book.chapters.map((c) => c.question)).toEqual(['这门课到底在解决什么问题', ''])
  })

  test('缺省时为空字符串', () => {
    const book = parseBookConfig('title: 数据结构\nchapters:\n  - file: ch01.md\n', dir)
    expect(book.titleEn).toBe('')
    expect(book.chapters[0]).toEqual({ file: 'ch01.md', draft: false, question: '', problems: '', problemsAfter: [] })
  })

  test('练习题：文件名、章号、存在性', () => {
    const yml = (p: string) => `title: 数据结构\nchapters:\n  - file: ch02.md\n    problems: ${p}\n`
    expect(parseBookConfig(yml('ch02-poly.md'), dir, dir).chapters[0].problems).toBe('ch02-poly.md')
    expect(() => parseBookConfig(yml('poly.md'), dir, dir)).toThrow(/chNN-名字/)
    expect(() => parseBookConfig(yml('ch03-poly.md'), dir, dir)).toThrow(/章号不一致/)
    expect(() => parseBookConfig(yml('ch02-none.md'), dir, dir)).toThrow(/不存在/)
  })

  test('练习题：对象写法给出每问挂在哪节后面', () => {
    const yml = (after: string) =>
      ['title: 数据结构', 'chapters:', '  - file: ch02.md', '    problems:', '      file: ch02-poly.md', after].join('\n')
    const c = parseBookConfig(yml("      after: ['2.1', '2.10']"), dir, dir).chapters[0]
    expect(c.problems).toBe('ch02-poly.md')
    expect(c.problemsAfter).toEqual(['2.1', '2.10'])
    expect(parseBookConfig(yml(''), dir, dir).chapters[0].problemsAfter).toEqual([])
    // 不加引号，2.10 会被 YAML 读成数 2.1
    expect(() => parseBookConfig(yml('      after: [2.1, 2.10]'), dir, dir)).toThrow(/要加引号/)
    expect(() => parseBookConfig(yml("      after: '2.1'"), dir, dir)).toThrow(/节号列表/)
    expect(() =>
      parseBookConfig(['title: 数据结构', 'chapters:', '  - file: ch02.md', '    problems:', '      file: poly.md'].join('\n'), dir, dir),
    ).toThrow(/chNN-名字/)
  })
})
