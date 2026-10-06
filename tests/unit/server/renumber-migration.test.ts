import { afterAll, expect, test } from 'vitest'
import { pgliteDb } from '../../../server/db-pglite'
import { migrate } from '../../../server/migrate'
import { readMigrations } from '../../../server/migrations-fs'

const NAME = '005_ch02_renumber.sql'
const all = readMigrations()
let db: Awaited<ReturnType<typeof pgliteDb>>

afterAll(() => db?.close())

test('005：评论跟着第2章的改版挪到新的节和页', async () => {
  db = await pgliteDb()
  await migrate(db, all.filter((m) => m.name < NAME))
  const [{ id: uid }] = await db.query<{ id: string }>(`INSERT INTO users (email) VALUES ('a@e.test') RETURNING id`)

  // 改版前的节号：2.1 任务与分解，2.2 顺序表，2.3 初始化插入取元素，2.4 删除，2.5 把L变成参数，2.6 编辑器1.0 …
  const rows: [string, string | null, string][] = [
    ['/ch02/2-1', '2-1-1', '空格用_输入'],
    ['/ch02/2-1', '2-1-2', 'Insert允许i=n'],
    ['/ch02/2-1', '2-1-2', '字符可以重复'],
    ['/ch02/2-1', '2-1-3', '光标减1'],
    ['/ch02/2-1', '2-1-4', '纸上'],
    ['/ch02/2-1', null, '本节问题'],
    ['/ch02/2-2', null, '内存'],
    ['/ch02/2-2', '2-2-p5', '结构体'],
    ['/ch02/2-3', '2-3-2', '倒着往后挪'],
    ['/ch02/2-4', '2-4-1', 'data[3]里还留着一个t'],
    ['/ch02/2-5', '2-5-2', '指针'],
    ['/ch02/2-6', '2-6-p2', '读指令'],
    ['/ch02/2-7', '2-7-p4', '行首打字'],
    ['/ch02/2-8', '2-8-p1', '满了就把数组变长'],
    ['/ch02/2-15', '2-15-3', '双向'],
    ['/ch01/1-2', '1-2-1', '第1章不动'],
    ['/ch02/ex-1', null, '题目页不动'],
  ]
  for (const [page, heading, quote] of rows) {
    await db.query('INSERT INTO comments (user_id, page_path, heading_id, quote_exact, body) VALUES ($1, $2, $3, $4, $5)', [uid, page, heading, quote, 'x'])
  }

  await migrate(db, all)
  const got = await db.query<{ quote_exact: string; page_path: string; heading_id: string | null }>(
    'SELECT quote_exact, page_path, heading_id FROM comments',
  )
  const at = (q: string) => {
    const r = got.find((g) => g.quote_exact === q)!
    return [r.page_path, r.heading_id]
  }
  // 原 2.1 拆开
  expect(at('空格用_输入')).toEqual(['/ch02/2-6', '2-6-p1'])
  expect(at('光标减1')).toEqual(['/ch02/2-6', null])
  expect(at('纸上')).toEqual(['/ch02/2-2', null])
  expect(at('Insert允许i=n')).toEqual(['/ch02/2-2', null])
  expect(at('字符可以重复')).toEqual(['/ch02/2-1', null])
  expect(at('本节问题')).toEqual(['/ch02/2-1', null])
  // 原 2.2 → 2.3，加粗段落按页对应
  expect(at('内存')).toEqual(['/ch02/2-3', null])
  expect(at('结构体')).toEqual(['/ch02/2-3', '2-3-p3'])
  // 原 2.3、2.4 合成 2.4（没有被步骤 2 再挪一次）
  expect(at('倒着往后挪')).toEqual(['/ch02/2-4', null])
  expect(at('data[3]里还留着一个t')).toEqual(['/ch02/2-4', null])
  // 2.5 以后节号不变；原 2.5 分页改写（原 2.5.2 → 第4页）；原 2.6 的加粗段落都到第5页
  expect(at('指针')).toEqual(['/ch02/2-5', '2-5-p4'])
  expect(at('读指令')).toEqual(['/ch02/2-6', '2-6-p5'])
  expect(at('行首打字')).toEqual(['/ch02/2-7', '2-7-p3'])
  expect(at('满了就把数组变长')).toEqual(['/ch02/2-8', '2-8-p1'])
  expect(at('双向')).toEqual(['/ch02/2-15', '2-15-3'])
  expect(at('第1章不动')).toEqual(['/ch01/1-2', '1-2-1'])
  expect(at('题目页不动')).toEqual(['/ch02/ex-1', null])
}, 30_000)
