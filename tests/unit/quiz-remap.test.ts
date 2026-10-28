import { expect, test } from 'vitest'
import { REMAP_FLAG, remapQuizKeys } from '../../site/.vitepress/theme/lesson/quiz-remap'

function store(init: Record<string, string>) {
  const m = new Map(Object.entries(init))
  return {
    m,
    get length() {
      return m.size
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

const K = (s: string) => `ds-book:quiz:ch02-${s}`

test('练习题记录跟着第2章链表部分改结构挪到新位置，只跑一次', () => {
  const s = store({
    [K('2-1-q1')]: '1',
    [K('2-9-q1')]: 'a', // 这一行是什么：不动
    [K('2-9-q2')]: 'b', // 漏接 → 2.10 q1
    [K('2-9-q3')]: 'c', // C 表示 → 2.10 q2
    [K('2-10-q1')]: 'd', // 原 2.10 → 2.11
    [K('2-13-q2')]: 'e',
    [K('2-14-q1')]: 'f',
    [K('2-15-q1')]: 'g', // 删掉
    [K('2-15-q2')]: 'h', // 行首和行尾 → 2.16 q1
    [K('2-15-q3')]: 'i', // 删掉
    [K('2-16-q1')]: 'j', // → q2
    [K('2-16-q3')]: 'k', // → q4
    [K('2-17-q1')]: 'l',
    'ds-book:font-size': 'large',
  })
  remapQuizKeys(s)
  expect(Object.fromEntries(s.m)).toEqual({
    [K('2-1-q1')]: '1',
    [K('2-9-q1')]: 'a',
    [K('2-10-q1')]: 'b',
    [K('2-10-q2')]: 'c',
    [K('2-11-q1')]: 'd',
    [K('2-14-q2')]: 'e',
    [K('2-15-q1')]: 'f',
    [K('2-16-q1')]: 'h',
    [K('2-16-q2')]: 'j',
    [K('2-16-q4')]: 'k',
    [K('2-17-q1')]: 'l',
    'ds-book:font-size': 'large',
    [REMAP_FLAG]: '2026-10-ch03-postfix',
  })
  // 已经挪过：之后新答的题不会再被挪走
  s.setItem(K('2-9-q2'), 'new')
  remapQuizKeys(s)
  expect(s.getItem(K('2-9-q2'))).toBe('new')
  expect(s.getItem(K('2-10-q1'))).toBe('b')
})

const K3 = (s: string) => `ds-book:quiz:ch03-${s}`

test('第3章表达式两节互换：原 3.6 求值题 → 3.7，原 3.7 转换题 → 3.6；第2章已经挪过的不再挪', () => {
  const s = store({
    [REMAP_FLAG]: '2026-10-ch02-linked',
    [K('2-9-q2')]: '第2章挪过以后新答的', // 不能再被第2章那一步挪走
    [K3('3-5-q1')]: 'p',
    [K3('3-6-q1')]: 'a', // 栈里是什么（求值）→ 3.7 q1
    [K3('3-6-q2')]: 'b', // 写成后缀式：删掉
    [K3('3-7-q1')]: 'c', // 转换填空（栈里是什么）→ 3.6 q2
    [K3('3-7-q2')]: 'd', // 转换单选（写成后缀式）→ 3.6 q1
    [K3('3-8-q1')]: 'r',
  })
  remapQuizKeys(s)
  expect(Object.fromEntries(s.m)).toEqual({
    [REMAP_FLAG]: '2026-10-ch03-postfix',
    [K('2-9-q2')]: '第2章挪过以后新答的',
    [K3('3-5-q1')]: 'p',
    [K3('3-6-q1')]: 'd',
    [K3('3-6-q2')]: 'c',
    [K3('3-7-q1')]: 'a',
    [K3('3-8-q1')]: 'r',
  })
  // 只跑一次
  s.setItem(K3('3-6-q2'), 'new')
  remapQuizKeys(s)
  expect(s.getItem(K3('3-6-q2'))).toBe('new')
})
