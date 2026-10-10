import { describe, expect, it } from 'vitest'
import { ADMIN, setup } from './helpers'
import { signUserId } from '../../../server/crypto'

const top = { page: '/ch02/2-8', pageTitle: '2.8 链表', quote: { exact: '头结点' }, body: '为什么需要头结点' }

describe('回复通知', () => {
  it('别人回复我的评论 → 给我发邮件，带直达链接和退订链接', async () => {
    const { client, mailer } = await setup()
    const a = client()
    await a.login('a@qq.com', '读者甲')
    const b = client()
    await b.login('b@qq.com', '读者乙')
    const id = (await a.post('/comments', top)).json.id
    const before = mailer.sent.length

    await b.post('/comments', { parentId: id, body: '我也想知道' })
    const mail = mailer.sent.slice(before)
    expect(mail).toHaveLength(1)
    expect(mail[0].to).toBe('a@qq.com')
    expect(mail[0].subject).toContain('读者乙 回复了你在「2.8 链表」的评论')
    expect(mail[0].text).toContain('我也想知道')
    expect(mail[0].text).toContain(`https://site.test/ch02/2-8?c=${id}`)
    expect(mail[0].text).toContain('https://site.test/api/unsubscribe?t=')
  })

  it('自己回复自己不通知；1 小时内同一讨论串只通知一次', async () => {
    const { client, mailer } = await setup()
    const a = client()
    await a.login('a@qq.com', '读者甲')
    const b = client()
    await b.login('b@qq.com', '读者乙')
    const id = (await a.post('/comments', top)).json.id
    const before = mailer.sent.length
    await a.post('/comments', { parentId: id, body: '补充一下' })
    expect(mailer.sent.length).toBe(before)
    await b.post('/comments', { parentId: id, body: '一' })
    await b.post('/comments', { parentId: id, body: '二' })
    expect(mailer.sent.length).toBe(before + 1)
  })

  it('关闭通知后不再发', async () => {
    const { client, mailer } = await setup()
    const a = client()
    await a.login('a@qq.com', '读者甲')
    await a.patch('/me', { notifyReplies: false })
    const b = client()
    await b.login('b@qq.com', '读者乙')
    const id = (await a.post('/comments', top)).json.id
    const before = mailer.sent.length
    await b.post('/comments', { parentId: id, body: '回复' })
    expect(mailer.sent.length).toBe(before)
  })

  it('通知发送失败不影响回复本身', async () => {
    const s = await setup()
    const a = s.client()
    await a.login('a@qq.com', '读者甲')
    const b = s.client()
    await b.login('b@qq.com', '读者乙')
    const id = (await a.post('/comments', top)).json.id
    s.mailer.send = async () => {
      throw new Error('boom')
    }
    expect((await b.post('/comments', { parentId: id, body: '回复' })).status).toBe(201)
  })
})

describe('退订链接', () => {
  it('GET 只显示确认页，POST 才关闭；伪造的 token 无效', async () => {
    const { client, config } = await setup()
    const a = client()
    const me = await a.login('a@qq.com', '读者甲')
    const t = signUserId(me.id, config.unsubscribeSecret)

    const page = await client().get(`/unsubscribe?t=${encodeURIComponent(t)}`)
    expect(page.status).toBe(200)
    expect(page.text).toContain('确认关闭')
    expect((await a.get('/me')).json.user.notifyReplies).toBe(true)

    const done = await client().post('/unsubscribe', `t=${encodeURIComponent(t)}`, { 'content-type': 'application/x-www-form-urlencoded' })
    expect(done.status).toBe(200)
    expect((await a.get('/me')).json.user.notifyReplies).toBe(false)

    const forged = `${me.id}.AAAA`
    expect((await client().get(`/unsubscribe?t=${encodeURIComponent(forged)}`)).status).toBe(400)
  })
})

describe('每日汇总', () => {
  it('需要 CRON_SECRET；汇总读者的新评论发给管理员，没有新评论不发', async () => {
    const { client, mailer } = await setup()
    const cron = client()
    expect((await cron.get('/cron/digest')).status).toBe(401)
    expect((await cron.get('/cron/digest', { authorization: 'Bearer wrong' })).status).toBe(401)

    const auth = { authorization: 'Bearer cron-secret' }
    expect((await cron.get('/cron/digest', auth)).json.sent).toBe(0)

    const a = client()
    await a.login('a@qq.com', '读者甲')
    const admin = client()
    await admin.login(ADMIN, '作者')
    const id = (await a.post('/comments', top)).json.id
    await admin.post('/comments', { parentId: id, body: '作者的回复不进汇总' })

    const before = mailer.sent.length
    expect((await cron.get('/cron/digest', auth)).json.sent).toBe(1)
    const mail = mailer.sent[before]
    expect(mail.to).toBe(ADMIN)
    expect(mail.subject).toContain('今日新评论 1 条')
    expect(mail.text).toContain('为什么需要头结点')
    expect(mail.text).not.toContain('作者的回复不进汇总')
  })
})

describe('管理页评论流', () => {
  it('只有管理员能看；默认只列作者未回复的顶层评论', async () => {
    const { client } = await setup()
    const a = client()
    await a.login('a@qq.com', '读者甲')
    const admin = client()
    await admin.login(ADMIN, '作者')
    const t1 = (await a.post('/comments', { ...top, body: '一' })).json.id
    await a.post('/comments', { ...top, page: '/ch01/1-1', body: '二' })
    await admin.post('/comments', { parentId: t1, body: '回复了' })

    expect((await a.get('/admin/comments')).status).toBe(403)
    expect((await client().get('/admin/comments')).status).toBe(401)

    const unreplied = (await admin.get('/admin/comments')).json.threads
    expect(unreplied.map((t: { body: string }) => t.body)).toEqual(['二'])
    const all = (await admin.get('/admin/comments?filter=all')).json.threads
    expect(all.map((t: { body: string }) => t.body)).toEqual(['二', '一'])
    expect(all[1].replies[0].body).toBe('回复了')
    expect(all[0].pagePath).toBe('/ch01/1-1')
  })

  it('分页', async () => {
    const { client, db } = await setup()
    const a = client()
    await a.login('a@qq.com', '读者甲')
    const admin = client()
    await admin.login(ADMIN, '作者')
    for (let i = 0; i < 10; i++) await a.post('/comments', { ...top, body: `c${i}` })
    await db.query(`UPDATE comments SET created_at = created_at - (substring(body from 2)::int * interval '1 minute')`)
    const a2 = client('7.7.7.7')
    await a2.login('b@qq.com', '读者乙')
    for (let i = 10; i < 35; i++) {
      if (i % 10 === 0) await db.query(`UPDATE comments SET created_at = created_at - interval '2 minutes' WHERE created_at > now() - interval '1 minute'`)
      await a2.post('/comments', { ...top, body: `d${i}` })
    }
    const p1 = (await admin.get('/admin/comments')).json
    expect(p1.threads).toHaveLength(30)
    expect(p1.next).toBeTruthy()
    const p2 = (await admin.get(`/admin/comments?before=${encodeURIComponent(p1.next)}`)).json
    expect(p2.threads).toHaveLength(5)
    expect(p2.next).toBeNull()
  })
})

describe('静默回复与合并通知', () => {
  it('管理员勾选静默：回复不发信，记为待通知；读者的 silent 无效', async () => {
    const { client, mailer } = await setup()
    const a = client()
    await a.login('a@qq.com', '读者甲')
    const b = client()
    await b.login('b@qq.com', '读者乙')
    const admin = client()
    await admin.login(ADMIN, '作者')
    const id = (await a.post('/comments', top)).json.id
    const before = mailer.sent.length

    expect((await admin.post('/comments', { parentId: id, body: '先不通知', silent: true })).status).toBe(201)
    expect(mailer.sent.length).toBe(before)
    await b.post('/comments', { parentId: id, body: '读者乙也说一句', silent: true })
    expect(mailer.sent.length).toBe(before + 1)

    expect((await a.get('/admin/pending-notify')).status).toBe(403)
    const users = (await admin.get('/admin/pending-notify')).json.users
    expect(users).toEqual([{ userId: expect.any(String), name: '读者甲', count: 1, notifyReplies: true }])
  })

  it('合并发送：多条回复只发一封，按评论先后列出，发完清掉标记', async () => {
    const { client, mailer, db } = await setup()
    const a = client()
    await a.login('a@qq.com', '读者甲')
    const admin = client()
    await admin.login(ADMIN, '作者')
    const t1 = (await a.post('/comments', { ...top, page: '/ch02/2-10', pageTitle: '2.10 链表', body: '第一条' })).json.id
    const t2 = (await a.post('/comments', { ...top, page: '/ch02/2-2', pageTitle: '2.2 顺序表', body: '第二条' })).json.id
    await db.query(`UPDATE comments SET created_at = created_at - interval '1 hour' WHERE id = $1`, [t1])
    await admin.post('/comments', { parentId: t1, body: '回复一', silent: true })
    await admin.post('/comments', { parentId: t2, body: '回复二', silent: true })

    const [p] = (await admin.get('/admin/pending-notify')).json.users
    expect(p.count).toBe(2)
    const before = mailer.sent.length
    expect((await a.post(`/admin/pending-notify/${p.userId}/send`)).status).toBe(403)
    expect((await admin.post(`/admin/pending-notify/${p.userId}/send`)).json).toEqual({ ok: true, sent: true })
    const mail = mailer.sent.slice(before)
    expect(mail).toHaveLength(1)
    expect(mail[0].to).toBe('a@qq.com')
    expect(mail[0].subject).toContain('作者 回复了你的 2 条评论')
    expect(mail[0].text.indexOf('回复一')).toBeLessThan(mail[0].text.indexOf('回复二'))
    expect(mail[0].text).toContain('你：第一条')
    expect(mail[0].text).toContain(`https://site.test/ch02/2-2?c=${t2}`)
    expect(mail[0].text).toContain('https://site.test/api/unsubscribe?t=')

    expect((await admin.get('/admin/pending-notify')).json.users).toEqual([])
    expect((await admin.post(`/admin/pending-notify/${p.userId}/send`)).json.sent).toBe(false)
    expect(mailer.sent.length).toBe(before + 1)
  })

  it('读者关了通知：不发信，只清标记', async () => {
    const { client, mailer } = await setup()
    const a = client()
    await a.login('a@qq.com', '读者甲')
    await a.patch('/me', { notifyReplies: false })
    const admin = client()
    await admin.login(ADMIN, '作者')
    const id = (await a.post('/comments', top)).json.id
    await admin.post('/comments', { parentId: id, body: '回复', silent: true })
    const [p] = (await admin.get('/admin/pending-notify')).json.users
    expect(p.notifyReplies).toBe(false)
    const before = mailer.sent.length
    expect((await admin.post(`/admin/pending-notify/${p.userId}/send`)).json.sent).toBe(false)
    expect(mailer.sent.length).toBe(before)
    expect((await admin.get('/admin/pending-notify')).json.users).toEqual([])
  })

  it('管理员不受每分钟 10 条的限制', async () => {
    const { client } = await setup()
    const a = client()
    await a.login('a@qq.com', '读者甲')
    const admin = client()
    await admin.login(ADMIN, '作者')
    const id = (await a.post('/comments', top)).json.id
    for (let i = 0; i < 12; i++) expect((await admin.post('/comments', { parentId: id, body: `回复${i}`, silent: true })).status).toBe(201)
  })
})
