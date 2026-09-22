import { describe, expect, test } from 'vitest'
import { tokenize } from '../../scripts/lib/search-tokenize'

describe('tokenize', () => {
  test('中文二元切分，ASCII 单词整体保留并小写', () => {
    expect(tokenize('头结点和malloc')).toEqual(['头结', '结点', '点和', 'malloc'])
    expect(tokenize('头结点 malloc')).toEqual(['头结', '结点', 'malloc'])
    expect(tokenize('SeqList 的 Insert')).toEqual(['seqlist', '的', 'insert'])
  })

  test('单个孤立汉字保留', () => {
    expect(tokenize('把L变成参数')).toEqual(['把', 'l', '变成', '成参', '参数'])
  })

  test('标点与空白被丢弃', () => {
    expect(tokenize('值传递、指针与地址传递！')).toEqual(['值传', '传递', '指针', '针与', '与地', '地址', '址传', '传递'])
    expect(tokenize('   ')).toEqual([])
  })

  test('查询词与正文用同一规则：查询「扩容」的词条出现在含「动态扩容」的正文词条里', () => {
    const doc = new Set(tokenize('2.7 动态扩容：编辑器1.1'))
    for (const t of tokenize('扩容')) expect(doc.has(t)).toBe(true)
  })

  test('函数自包含：源码里不引用外部标识符（会被序列化到浏览器）', () => {
    const src = tokenize.toString()
    expect(src).not.toMatch(/\b(require|import|exports)\b/)
  })
})
