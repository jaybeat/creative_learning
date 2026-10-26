import { afterAll, expect, test } from 'vitest'
import { pgliteDb } from '../../../server/db-pglite'
import { migrate } from '../../../server/migrate'
import { readMigrations } from '../../../server/migrations-fs'

const NAME = '005_ch02_renumber.sql'
const all = readMigrations()
let db: Awaited<ReturnType<typeof pgliteDb>>
let db7: Awaited<ReturnType<typeof pgliteDb>>

afterAll(async () => {
  await db?.close()
  await db7?.close()
})

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
    ['/ch02/2-9', '2-9-2', '手工搭'],
    ['/ch02/2-10', '2-10-1', 'LinkList'],
    ['/ch02/2-10', '2-10-2', '求长度'],
    ['/ch02/2-10', '2-10-3', '三种位置'],
    ['/ch02/2-11', '2-11-1', '删除第i个'],
    ['/ch02/2-11', '2-11-3', '头结点'],
    ['/ch02/2-12', null, 'main一行不改'],
    ['/ch02/2-12', '2-12-p1', '一个预测'],
    ['/ch02/2-12', '2-12-p3', '逐行相同'],
    ['/ch02/2-13', '2-13-1', '复杂度'],
    ['/ch02/2-13', '2-13-p4', '回到编辑器'],
    ['/ch02/2-13', '2-13-p2', '逐个操作'],
    ['/ch02/2-14', '2-14-2', '接口要跟着变'],
    ['/ch02/2-14', '2-14-4', '验证编辑器2.1'],
    ['/ch02/2-15', '2-15-3', '双向'],
    ['/ch01/1-2', '1-2-1', '第1章不动'],
    ['/ch02/ex-1', null, '题目页不动'],
  ]
  for (const [page, heading, quote] of rows) {
    await db.query('INSERT INTO comments (user_id, page_path, heading_id, quote_exact, body) VALUES ($1, $2, $3, $4, $5)', [uid, page, heading, quote, 'x'])
  }

  // 只跑到 005：后面的迁移（007 链表部分改结构）会再挪一次，各自单独测
  await migrate(db, all.filter((m) => m.name <= NAME))
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
  // 链表部分：原 2.10 拆成 2.10/2.11（LinkList 移到 2.9），原 2.11 的删除并入 2.12、头结点成为 2.13，原 2.12–2.15 顺延两节
  expect(at('手工搭')).toEqual(['/ch02/2-9', null])
  expect(at('LinkList')).toEqual(['/ch02/2-9', null])
  expect(at('求长度')).toEqual(['/ch02/2-10', null])
  expect(at('三种位置')).toEqual(['/ch02/2-11', null])
  expect(at('删除第i个')).toEqual(['/ch02/2-12', null])
  expect(at('头结点')).toEqual(['/ch02/2-13', null])
  expect(at('main一行不改')).toEqual(['/ch02/2-14', null])
  expect(at('一个预测')).toEqual(['/ch02/2-14', '2-14-p2'])
  expect(at('逐行相同')).toEqual(['/ch02/2-14', '2-14-p3'])
  expect(at('复杂度')).toEqual(['/ch02/2-15', '2-15-1'])
  expect(at('回到编辑器')).toEqual(['/ch02/2-15', '2-15-p3'])
  expect(at('逐个操作')).toEqual(['/ch02/2-15', '2-15-p1'])
  expect(at('接口要跟着变')).toEqual(['/ch02/2-16', '2-16-p3'])
  expect(at('验证编辑器2.1')).toEqual(['/ch02/2-16', '2-16-p4'])
  expect(at('双向')).toEqual(['/ch02/2-17', '2-17-p5'])
  expect(at('第1章不动')).toEqual(['/ch01/1-2', '1-2-1'])
  expect(at('题目页不动')).toEqual(['/ch02/ex-1', null])
}, 30_000)

const NAME7 = '007_ch02_linked_list_restructure.sql'

test('007：链表部分改结构，评论跟着内容挪到新的节和页', async () => {
  db7 = await pgliteDb()
  await migrate(db7, all.filter((m) => m.name < NAME7))
  const [{ id: uid }] = await db7.query<{ id: string }>(`INSERT INTO users (email) VALUES ('a@e.test') RETURNING id`)

  // 改结构前：2.9 链表，2.10 初始化与读取，2.11 插入，2.12 删除，2.13 头结点，2.14 用链表实现编辑器，2.15 时间复杂度，2.16 按结点操作
  const rows: [string, string, string | null, string][] = [
    ['/ch02/2-9', '2.9 链表', '2-9-p1', '结点'],
    ['/ch02/2-9', '2.9 链表', '2-9-p3', '用C表示'],
    ['/ch02/2-9', '2.9 链表', '2-9-p4', '输出'],
    ['/ch02/2-9', '2.9 链表', '2-9-p5', '这一行'],
    ['/ch02/2-9', '2.9 链表', '2-9-p6', '漏接'],
    ['/ch02/2-9', '2.9 链表', '2-9-p7', 'C表示填空'],
    ['/ch02/2-10', '2.10 链表的初始化与读取', '2-10-p2', '求长度'],
    ['/ch02/2-10', '2.10 链表的初始化与读取', null, '本节问题'],
    ['/ch02/2-11', '2.11 链表的插入', '2-11-p3', '三种位置'],
    ['/ch02/2-12', '2.12 链表的删除', '2-12', '删除第i个'],
    ['/ch02/2-13', '2.13 头结点', '2-13-p1', '头结点'],
    ['/ch02/2-14', '2.14 用链表实现编辑器', '2-14-p2', '一个预测'],
    ['/ch02/2-15', '2.15 链表的时间复杂度', '2-15-p3', '回到编辑器'],
    ['/ch02/2-15', '2.15 链表的时间复杂度', null, '复杂度'],
    ['/ch02/2-15', '2.15 链表的时间复杂度', '2-15-p5', '行首行尾'],
    ['/ch02/2-16', '2.16 按结点操作', '2-16-p3', '接口要跟着变'],
    ['/ch02/2-16', '2.16 按结点操作', '2-16-p5', '光标记哪个'],
    ['/ch02/2-16', '2.16 按结点操作', '2-16-p7', '退格少一行'],
    ['/ch02/2-17', '2.17 双向链表', '2-17-p5', '双向'],
    ['/ch01/1-2', '1.2 第1章', '1-2-1', '第1章不动'],
    ['/ch02/ex-1', '练习', null, '题目页不动'],
  ]
  for (const [page, title, heading, quote] of rows) {
    await db7.query('INSERT INTO comments (user_id, page_path, page_title, heading_id, quote_exact, body) VALUES ($1, $2, $3, $4, $5, $6)', [uid, page, title, heading, quote, 'x'])
  }
  // 回复和顶层评论在同一页，跟着一起挪
  const [{ id: parent }] = await db7.query<{ id: string }>(`SELECT id FROM comments WHERE quote_exact = '复杂度'`)
  await db7.query('INSERT INTO comments (user_id, parent_id, page_path, page_title, body) VALUES ($1, $2, $3, $4, $5)', [uid, parent, '/ch02/2-15', '2.15 链表的时间复杂度', '回复'])
  // 原 2.9 代码页上的评论挪到 2.10，它的回复也要跟过去
  const [{ id: p9 }] = await db7.query<{ id: string }>(`SELECT id FROM comments WHERE quote_exact = '用C表示'`)
  await db7.query('INSERT INTO comments (user_id, parent_id, page_path, page_title, body) VALUES ($1, $2, $3, $4, $5)', [uid, p9, '/ch02/2-9', '2.9 链表', '回复2.9'])

  await migrate(db7, all)
  const got = await db7.query<{ quote_exact: string | null; body: string; page_path: string; page_title: string; heading_id: string | null }>(
    'SELECT quote_exact, body, page_path, page_title, heading_id FROM comments',
  )
  const at = (q: string) => {
    const r = got.find((g) => g.quote_exact === q)!
    return [r.page_path, r.heading_id, r.page_title]
  }
  expect(at('结点')).toEqual(['/ch02/2-9', '2-9-p1', '2.9 链表'])
  // 原 2.9 的代码页、练习2/3 → 新 2.10；练习1 → 2.9 第4页
  expect(at('用C表示')).toEqual(['/ch02/2-10', '2-10-p1', '2.10 链表的C语言实现'])
  expect(at('输出')).toEqual(['/ch02/2-10', '2-10-p3', '2.10 链表的C语言实现'])
  expect(at('漏接')).toEqual(['/ch02/2-10', '2-10-p4', '2.10 链表的C语言实现'])
  expect(at('C表示填空')).toEqual(['/ch02/2-10', '2-10-p5', '2.10 链表的C语言实现'])
  expect(at('这一行')).toEqual(['/ch02/2-9', '2-9-p4', '2.9 链表'])
  const r9 = got.find((g) => g.body === '回复2.9')!
  expect([r9.page_path, r9.page_title]).toEqual(['/ch02/2-10', '2.10 链表的C语言实现'])
  expect(at('求长度')).toEqual(['/ch02/2-11', '2-11-p2', '2.11 链表的初始化与读取'])
  expect(at('本节问题')).toEqual(['/ch02/2-11', null, '2.11 链表的初始化与读取'])
  expect(at('三种位置')).toEqual(['/ch02/2-12', '2-12-p3', '2.12 链表的插入'])
  expect(at('删除第i个')).toEqual(['/ch02/2-13', '2-13', '2.13 链表的删除'])
  expect(at('头结点')).toEqual(['/ch02/2-14', '2-14-p1', '2.14 头结点'])
  // 原 2.14 → 2.15，没有被第 1 步当成原 2.15 再挪到 2.16
  expect(at('一个预测')).toEqual(['/ch02/2-15', '2-15-p2', '2.15 用链表实现编辑器'])
  expect(at('回到编辑器')).toEqual(['/ch02/2-16', '2-16-p1', '2.16 按结点操作'])
  expect(at('复杂度')).toEqual(['/ch02/2-16', '2-16-p1', '2.16 按结点操作'])
  const reply = got.find((g) => g.body === '回复')!
  expect([reply.page_path, reply.page_title]).toEqual(['/ch02/2-16', '2.16 按结点操作'])
  expect(at('接口要跟着变')).toEqual(['/ch02/2-16', '2-16-p3', '2.16 按结点操作'])
  // 原 2.15 练习2 → 2.16 第5页；2.16 原练习页顺延一页
  expect(at('行首行尾')).toEqual(['/ch02/2-16', '2-16-p5', '2.16 按结点操作'])
  expect(at('光标记哪个')).toEqual(['/ch02/2-16', '2-16-p6', '2.16 按结点操作'])
  expect(at('退格少一行')).toEqual(['/ch02/2-16', '2-16-p8', '2.16 按结点操作'])
  expect(at('双向')).toEqual(['/ch02/2-17', '2-17-p5', '2.17 双向链表'])
  expect(at('第1章不动')).toEqual(['/ch01/1-2', '1-2-1', '1.2 第1章'])
  expect(at('题目页不动')).toEqual(['/ch02/ex-1', null, '练习'])
}, 30_000)
