import { describe, expect, it } from 'vitest'
import { ADMIN, setup } from './helpers'

const top = (over: Record<string, unknown> = {}) => ({
  page: '/ch02/2-8',
  pageTitle: '2.8 链表',
  headingId: '2-8-1',
  quote: { exact: '头结点', prefix: '为什么要', suffix: '？' },
  body: '这里没看懂',
  ...over,
})

describe('评论', () => {
  it('未登录能看不能发', async () => {
    const { client } = await setup()
    const a = client()
    expect((await a.get('/comments?page=/ch02/2-8')).json.threads).toEqual([])
    expect((await a.post('/comments', top())).status).toBe(401)
  })

  it('没设昵称不能发', async () => {
    const { client } = await setup()
    const a = client()
    await a.login('a@qq.com')
    expect((await a.post('/comments', top())).json.error).toBe('name_required')
  })

  it('发评论与回复，其他人和未登录都能看到', async () => {
    const { client } = await setup()
    const a = client()
    await a.login('a@qq.com', '读者甲')
    const { status, json } = await a.post('/comments', top())
    expect(status).toBe(201)
    const b = client()
    await b.login('b@qq.com', '读者乙')
    expect((await b.post('/comments', { parentId: json.id, body: '同问' })).status).toBe(201)

    const threads = (await client().get('/comments?page=/ch02/2-8')).json.threads
    expect(threads).toHaveLength(1)
    expect(threads[0]).toMatchObject({
      id: json.id,
      author: { name: '读者甲', isAdmin: false },
      mine: false,
      body: '这里没看懂',
      pageTitle: '2.8 链表',
      headingId: '2-8-1',
      quote: { exact: '头结点', prefix: '为什么要', suffix: '？' },
    })
    expect(threads[0].replies).toMatchObject([{ author: { name: '读者乙' }, body: '同问' }])
    expect((await a.get('/comments?page=/ch02/2-8')).json.threads[0].mine).toBe(true)
    // 响应里不含任何邮箱
    expect(JSON.stringify(threads)).not.toContain('@')
  })

  it('只允许一层回复', async () => {
    const { client } = await setup()
    const a = client()
    await a.login('a@qq.com', '读者甲')
    const t = (await a.post('/comments', top())).json.id
    const r = (await a.post('/comments', { parentId: t, body: '回复' })).json.id
    expect((await a.post('/comments', { parentId: r, body: '回复的回复' })).json.error).toBe('bad_parent')
  })

  it('参数校验：页面路径、引文、正文长度', async () => {
    const { client } = await setup()
    const a = client()
    await a.login('a@qq.com', '读者甲')
    expect((await a.post('/comments', top({ page: 'https://evil' }))).json.error).toBe('bad_page')
    expect((await a.post('/comments', top({ quote: { exact: '' } }))).json.error).toBe('bad_quote')
    expect((await a.post('/comments', top({ quote: { exact: '字'.repeat(501) } }))).json.error).toBe('bad_quote')
    expect((await a.post('/comments', top({ body: '   ' }))).json.error).toBe('bad_body')
    expect((await a.post('/comments', top({ body: '字'.repeat(2001) }))).json.error).toBe('bad_body')
    expect((await a.post('/comments', top({ body: '字'.repeat(2000) }))).status).toBe(201)
  })

  it('每分钟最多 10 条', async () => {
    const { client } = await setup()
    const a = client()
    await a.login('a@qq.com', '读者甲')
    for (let i = 0; i < 10; i++) expect((await a.post('/comments', top())).status).toBe(201)
    expect((await a.post('/comments', top())).json.error).toBe('comment_rate')
  })

  it('只能删自己的；管理员能删任何人的', async () => {
    const { client } = await setup()
    const a = client()
    await a.login('a@qq.com', '读者甲')
    const b = client()
    await b.login('b@qq.com', '读者乙')
    const admin = client()
    await admin.login(ADMIN, '作者')
    const id = (await a.post('/comments', top())).json.id
    expect((await b.del(`/comments/${id}`)).status).toBe(403)
    expect((await a.del(`/comments/${id}`)).status).toBe(200)
    expect((await client().get('/comments?page=/ch02/2-8')).json.threads).toEqual([])

    const id2 = (await b.post('/comments', top())).json.id
    expect((await admin.del(`/comments/${id2}`)).status).toBe(200)
    expect((await a.del(`/comments/${id2}`)).status).toBe(404)
  })

  it('删掉有回复的顶层评论：保留占位与回复；删掉的回复不显示', async () => {
    const { client } = await setup()
    const a = client()
    await a.login('a@qq.com', '读者甲')
    const b = client()
    await b.login('b@qq.com', '读者乙')
    const id = (await a.post('/comments', top())).json.id
    const r1 = (await b.post('/comments', { parentId: id, body: '回复一' })).json.id
    await b.post('/comments', { parentId: id, body: '回复二' })
    await b.del(`/comments/${r1}`)
    await a.del(`/comments/${id}`)
    const [t] = (await client().get('/comments?page=/ch02/2-8')).json.threads
    expect(t).toMatchObject({ deleted: true, body: '', author: { name: '' }, mine: false })
    expect(t.replies.map((x: { body: string }) => x.body)).toEqual(['回复二'])
    // 已删除的顶层评论不能再被回复
    expect((await b.post('/comments', { parentId: id, body: '回复三' })).status).toBe(404)
  })

  it('隐藏：普通读者看不到（连同整串），管理员能看到并能取消', async () => {
    const { client } = await setup()
    const a = client()
    await a.login('a@qq.com', '读者甲')
    const admin = client()
    await admin.login(ADMIN, '作者')
    const id = (await a.post('/comments', top())).json.id
    await a.post('/comments', { parentId: id, body: '回复' })

    expect((await a.post(`/comments/${id}/hide`, { hidden: true })).status).toBe(403)
    expect((await admin.post(`/comments/${id}/hide`, { hidden: true })).json.hidden).toBe(true)
    expect((await a.get('/comments?page=/ch02/2-8')).json.threads).toEqual([])
    expect((await client().get('/comments?page=/ch02/2-8')).json.threads).toEqual([])
    const seen = (await admin.get('/comments?page=/ch02/2-8')).json.threads
    expect(seen[0]).toMatchObject({ hidden: true, replies: [{ body: '回复' }] })
    expect((await a.post('/comments', { parentId: id, body: 'x' })).status).toBe(404)

    await admin.post(`/comments/${id}/hide`, { hidden: false })
    expect((await a.get('/comments?page=/ch02/2-8')).json.threads).toHaveLength(1)
  })

  it('管理员的评论带作者标记', async () => {
    const { client } = await setup()
    const a = client()
    await a.login('a@qq.com', '读者甲')
    const admin = client()
    await admin.login(ADMIN, '林小川')
    const id = (await a.post('/comments', top())).json.id
    await admin.post('/comments', { parentId: id, body: '已修改，谢谢' })
    const [t] = (await client().get('/comments?page=/ch02/2-8')).json.threads
    expect(t.replies[0].author).toEqual({ name: '林小川', isAdmin: true })
  })
})
