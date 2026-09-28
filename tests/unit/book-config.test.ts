import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'
import { parseBookConfig } from '../../scripts/lib/book-config'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'book-config-'))
fs.writeFileSync(path.join(dir, 'ch01.md'), '# 第1章 绪论\n')
fs.writeFileSync(path.join(dir, 'ch02.md'), '# 第2章 线性表\n')
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
    expect(book.chapters[0]).toEqual({ file: 'ch01.md', draft: false, question: '' })
  })
})
