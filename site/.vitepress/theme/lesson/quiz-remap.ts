/**
 * 练习题「答对过」的记录按 qid 存在本地（ds-book:quiz:ch02-2-12-q1），qid 是"节 + 第几题"。
 * 书稿重排后节号、题号变了，要把记录跟着挪到新位置，否则答过的题又显示成没答，或者别的题被错标成答过。
 * 服务端评论的同类迁移见 db/migrations/。
 *
 * 2026-10-20 第2章链表部分改结构（和 007 迁移一一对应）：
 *   - 2.16 在练习前多了一题：原 q1–q3 → q2–q4；
 *   - 原 2.15（时间复杂度）删掉：它的 q2（行首和行尾，哪个快）→ 2.16 q1，其余的题不再存在，记录删掉；
 *   - 原 2.10–2.14 顺延成 2.11–2.15，题号不变；
 *   - 原 2.9 的 q2、q3（漏接、C 表示）→ 新 2.10 的 q1、q2；2.9 q1 不动，2.9 q2 是新题，原记录不能留在这个位置。
 * 2026-10-27 第3章表达式两节重排（和 008 迁移对应）：
 *   - 原 3.6（后缀式求值）q1（栈里是什么）→ 3.7 q1；原 3.6 q2（写成后缀式）删掉，3.7 q2 是新题；
 *   - 原 3.7（中缀转后缀）q1、q2 → 3.6 q1、q2。
 * 每次重排是一步，带一个版本标记；记下跑到了哪一步，以后只跑后面的步。
 */

const PREFIX = 'ds-book:quiz:'
export const REMAP_FLAG = 'ds-book:quiz-remap'

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

const move = (s: Store, from: string, to: string) => {
  const v = s.getItem(from)
  if (v === null) return
  s.removeItem(from)
  s.setItem(to, v)
}
// 本节有哪些题号（按现有记录找，题号不止个位数也能挪）
const qsOf = (s: Store, head: string) => {
  const out: number[] = []
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i)
    if (k?.startsWith(head) && /^\d+$/.test(k.slice(head.length))) out.push(Number(k.slice(head.length)))
  }
  return out.sort((a, b) => b - a) // 从大到小，一条记录不会被挪两次
}

function ch02Linked(s: Store) {
  const qk = (sec: number, q: number) => `${PREFIX}ch02-2-${sec}-q${q}`
  const qs = (sec: number) => qsOf(s, `${PREFIX}ch02-2-${sec}-q`)
  // 1. 2.16 给新 q1 腾位置
  for (const q of qs(16)) move(s, qk(16, q), qk(16, q + 1))
  // 2. 原 2.15：q2 → 2.16 q1，其余删掉
  move(s, qk(15, 2), qk(16, 1))
  for (const q of qs(15)) s.removeItem(qk(15, q))
  // 3. 原 2.10–2.14 → 2.11–2.15（节号从大到小）
  for (let sec = 14; sec >= 10; sec--) for (const q of qs(sec)) move(s, qk(sec, q), qk(sec + 1, q))
  // 4. 原 2.9 的 q2、q3 → 新 2.10 的 q1、q2（2.10 已经空出来）；2.9 更后面的题号不存在了
  move(s, qk(9, 2), qk(10, 1))
  move(s, qk(9, 3), qk(10, 2))
  for (const q of qs(9)) if (q > 1) s.removeItem(qk(9, q))
}

function ch03Postfix(s: Store) {
  const qk = (sec: number, q: number) => `${PREFIX}ch03-3-${sec}-q${q}`
  // 两节互换，先把原 3.6 的记录取出来，再挪原 3.7
  const old6q1 = s.getItem(qk(6, 1))
  for (const q of qsOf(s, `${PREFIX}ch03-3-6-q`)) s.removeItem(qk(6, q)) // 原 3.6 q2 删掉
  move(s, qk(7, 1), qk(6, 1))
  move(s, qk(7, 2), qk(6, 2))
  for (const q of qsOf(s, `${PREFIX}ch03-3-7-q`)) s.removeItem(qk(7, q))
  if (old6q1 !== null) s.setItem(qk(7, 1), old6q1)
}

// 按时间顺序排列；新加的重排接在最后
const STEPS: [string, (s: Store) => void][] = [
  ['2026-10-ch02-linked', ch02Linked],
  ['2026-10-ch03-postfix', ch03Postfix],
]

export function remapQuizKeys(s: Store): void {
  const done = STEPS.findIndex(([v]) => v === s.getItem(REMAP_FLAG))
  if (done === STEPS.length - 1) return
  for (const [, step] of STEPS.slice(done + 1)) step(s)
  s.setItem(REMAP_FLAG, STEPS[STEPS.length - 1][0])
}

/** 客户端启动时调用一次（练习题在 onMounted 里才读记录）；存储不可用时什么也不做 */
export function remapQuizStorage(): void {
  try {
    remapQuizKeys(localStorage)
  } catch {
    /* ignore */
  }
}
