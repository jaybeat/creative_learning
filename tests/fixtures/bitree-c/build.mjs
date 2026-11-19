// 「二叉树的结点表」三问的标准 C 解答，给 scripts/judge-check.ts 提交到评测机用
import fs from 'node:fs'
import path from 'node:path'
const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8')
export const solutions = {
  'ch04-ex-1': read('ex-1.c'),
  'ch04-ex-2': read('ex-2.c'),
  'ch04-ex-3': read('ex-3.c'),
}
