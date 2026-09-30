import { describe, expect, it } from 'vitest'
import { setup } from './helpers'

const code = '#include <stdio.h>\nint main(void) { return 0; }\n'

describe('练习提交', () => {
  it('未登录不能提交、不能看记录', async () => {
    const { client } = await setup()
    const a = client()
    expect((await a.post('/submissions', { problemId: 'ch02-ex-1', code })).status).toBe(401)
    expect((await a.get('/submissions?problem=ch02-ex-1')).status).toBe(401)
  })

  it('提交后出现在自己的记录里，状态为 pending；点开能取回代码', async () => {
    const { client } = await setup()
    const a = client()
    await a.login('a@qq.com')
    const r = await a.post('/submissions', { problemId: 'ch02-ex-1', code })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ problemId: 'ch02-ex-1', language: 'c', status: 'pending' })

    const list = (await a.get('/submissions?problem=ch02-ex-1')).json.submissions
    expect(list).toHaveLength(1)
    expect(list[0]).not.toHaveProperty('code')
    expect((await a.get('/submissions?problem=ch02-ex-2')).json.submissions).toEqual([])
    expect((await a.get(`/submissions/${r.json.id}`)).json.code).toBe(code)
  })

  it('看不到别人的提交', async () => {
    const { client } = await setup()
    const a = client()
    await a.login('a@qq.com')
    const id = (await a.post('/submissions', { problemId: 'ch02-ex-1', code })).json.id
    const b = client()
    await b.login('b@qq.com')
    expect((await b.get('/submissions?problem=ch02-ex-1')).json.submissions).toEqual([])
    expect((await b.get(`/submissions/${id}`)).status).toBe(404)
  })

  it('参数校验：题号、空代码、超长代码', async () => {
    const { client } = await setup()
    const a = client()
    await a.login('a@qq.com')
    expect((await a.post('/submissions', { problemId: '../x', code })).json.error).toBe('bad_problem')
    expect((await a.post('/submissions', { problemId: 'ch02-ex-1', code: '  \n' })).json.error).toBe('bad_code')
    expect((await a.post('/submissions', { problemId: 'ch02-ex-1', code: '中'.repeat(22000) })).json.error).toBe('bad_code')
    expect((await a.get('/submissions?problem=x')).status).toBe(400)
    expect((await a.get('/submissions/not-a-uuid')).status).toBe(404)
  })

  it('每分钟最多 10 次', async () => {
    const { client } = await setup()
    const a = client()
    await a.login('a@qq.com')
    for (let i = 0; i < 10; i++) expect((await a.post('/submissions', { problemId: 'ch02-ex-1', code })).status).toBe(201)
    expect((await a.post('/submissions', { problemId: 'ch02-ex-1', code })).json.error).toBe('submit_rate')
  })

  it('注销账号后提交记录被删除', async () => {
    const { client, db } = await setup()
    const a = client()
    await a.login('a@qq.com')
    await a.post('/submissions', { problemId: 'ch02-ex-1', code })
    expect((await a.del('/me')).status).toBe(200)
    expect(await db.query('SELECT id FROM submissions')).toEqual([])
  })
})
