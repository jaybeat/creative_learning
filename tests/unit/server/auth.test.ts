import { describe, expect, it } from 'vitest'
import { ADMIN, setup } from './helpers'

describe('验证码登录', () => {
  it('发码 → 验证 → 登录，首次登录即注册', async () => {
    const { client, mailer } = await setup()
    const a = client()
    expect((await a.get('/me')).json.user).toBeNull()

    const r = await a.post('/auth/code', { email: '  Reader@QQ.com ' })
    expect(r.status).toBe(200)
    expect(mailer.sent).toHaveLength(1)
    expect(mailer.sent[0].to).toBe('reader@qq.com')
    expect(mailer.sent[0].subject).toContain('Creative Learning')

    const code = /(\d{6})/.exec(mailer.sent[0].text)![1]
    const v = await a.post('/auth/verify', { email: 'reader@qq.com', code })
    expect(v.status).toBe(200)
    expect(v.json.user).toMatchObject({ email: 'reader@qq.com', name: null, isAdmin: false })
    expect((await a.get('/me')).json.user.email).toBe('reader@qq.com')
  })

  it('ADMIN_EMAILS 里的邮箱登录后是管理员', async () => {
    const { client } = await setup()
    expect((await client().login(ADMIN)).isAdmin).toBe(true)
  })

  it('错误的码累计次数，第 5 次错后该码作废', async () => {
    const { client, mailer } = await setup()
    const a = client()
    await a.post('/auth/code', { email: 'x@163.com' })
    const code = /(\d{6})/.exec(mailer.sent[0].text)![1]
    const wrong = code === '000000' ? '111111' : '000000'
    for (let i = 4; i >= 0; i--) {
      const r = await a.post('/auth/verify', { email: 'x@163.com', code: wrong })
      expect(r.status).toBe(400)
      expect(r.json).toMatchObject({ error: 'code_invalid', attemptsLeft: i })
    }
    expect((await a.post('/auth/verify', { email: 'x@163.com', code })).json.error).toBe('code_expired')
  })

  it('验证码只能用一次，过期无效', async () => {
    const { client, mailer, db } = await setup()
    const a = client()
    await a.post('/auth/code', { email: 'x@163.com' })
    const code = /(\d{6})/.exec(mailer.sent[0].text)![1]
    expect((await a.post('/auth/verify', { email: 'x@163.com', code })).status).toBe(200)
    expect((await client().post('/auth/verify', { email: 'x@163.com', code })).json.error).toBe('code_expired')

    const b = client()
    await db.query(`UPDATE email_codes SET created_at = now() - interval '2 minutes'`)
    await b.post('/auth/code', { email: 'y@163.com' })
    const code2 = /(\d{6})/.exec(mailer.sent[1].text)![1]
    await db.query(`UPDATE email_codes SET expires_at = now() - interval '1 second' WHERE email = 'y@163.com'`)
    expect((await b.post('/auth/verify', { email: 'y@163.com', code: code2 })).json.error).toBe('code_expired')
  })

  it('同邮箱 60 秒内不能重发，每天最多 10 次', async () => {
    const { client, age } = await setup()
    const a = client()
    expect((await a.post('/auth/code', { email: 'z@qq.com' })).status).toBe(200)
    const again = await a.post('/auth/code', { email: 'z@qq.com' })
    expect(again.status).toBe(429)
    expect(again.json.error).toBe('too_soon')
    expect(again.json.retryAfter).toBeGreaterThan(0)
    for (let i = 1; i < 10; i++) {
      await age('z@qq.com', 61)
      expect((await client(`9.9.9.${i}`).post('/auth/code', { email: 'z@qq.com' })).status).toBe(200)
    }
    await age('z@qq.com', 61)
    expect((await client('8.8.8.8').post('/auth/code', { email: 'z@qq.com' })).json.error).toBe('email_daily_limit')
  })

  it('同 IP 每小时最多 10 次', async () => {
    const { client } = await setup()
    const a = client('2.2.2.2')
    for (let i = 0; i < 10; i++) expect((await a.post('/auth/code', { email: `u${i}@qq.com` })).status).toBe(200)
    expect((await a.post('/auth/code', { email: 'u10@qq.com' })).json.error).toBe('ip_limit')
  })

  it('同邮箱 1 小时内累计输错 10 次后锁定（换新码也不行）', async () => {
    const { client, mailer, age } = await setup()
    const a = client()
    for (let round = 0; round < 2; round++) {
      if (round) await age('lock@qq.com', 61)
      await a.post('/auth/code', { email: 'lock@qq.com' })
      const code = /(\d{6})/.exec(mailer.sent.at(-1)!.text)![1]
      const wrong = code === '000000' ? '111111' : '000000'
      for (let i = 0; i < 5; i++) await a.post('/auth/verify', { email: 'lock@qq.com', code: wrong })
    }
    await age('lock@qq.com', 61)
    expect((await a.post('/auth/code', { email: 'lock@qq.com' })).json.error).toBe('locked')
    expect((await a.post('/auth/verify', { email: 'lock@qq.com', code: '123456' })).json.error).toBe('locked')
  })

  it('全站每日发信达到上限后暂停发码', async () => {
    const { client } = await setup({ dailyMailLimit: 2 })
    expect((await client('1.0.0.1').post('/auth/code', { email: 'a@qq.com' })).status).toBe(200)
    expect((await client('1.0.0.2').post('/auth/code', { email: 'b@qq.com' })).status).toBe(200)
    const r = await client('1.0.0.3').post('/auth/code', { email: 'c@qq.com' })
    expect(r.status).toBe(503)
    expect(r.json.error).toBe('mail_quota')
  })

  it('发信失败时删掉这条验证码，不占用重发间隔', async () => {
    const s = await setup()
    s.mailer.send = async () => {
      throw new Error('boom')
    }
    const a = s.client()
    expect((await a.post('/auth/code', { email: 'f@qq.com' })).json.error).toBe('mail_failed')
    const [r] = await s.db.query<{ n: number }>('SELECT count(*)::int AS n FROM email_codes')
    expect(r.n).toBe(0)
  })

  it('非法邮箱被拒', async () => {
    const { client } = await setup()
    for (const email of ['', 'abc', 'a@b', '<a@b.com>', 42]) {
      expect((await client().post('/auth/code', { email })).json.error).toBe('bad_email')
    }
  })

  it('退出后会话失效', async () => {
    const { client } = await setup()
    const a = client()
    await a.login('out@qq.com')
    const cookie = a.cookie
    await a.post('/auth/logout')
    expect((await a.get('/me')).json.user).toBeNull()
    expect((await client().get('/me', { cookie })).json.user).toBeNull()
  })

  it('过期会话无效；快过期的会话自动续期', async () => {
    const { client, db } = await setup()
    const a = client()
    await a.login('s@qq.com')
    await db.query(`UPDATE sessions SET expires_at = now() + interval '3 days'`)
    const r = await a.get('/me')
    expect(r.json.user).not.toBeNull()
    expect(r.headers.get('set-cookie')).toContain('cl_session=')
    const [s] = await db.query<{ days: number }>(`SELECT extract(epoch FROM expires_at - now()) / 86400 AS days FROM sessions`)
    expect(Number(s.days)).toBeGreaterThan(29)

    await db.query(`UPDATE sessions SET expires_at = now() - interval '1 second'`)
    expect((await a.get('/me')).json.user).toBeNull()
  })
})

describe('写请求的来源校验', () => {
  it('没有 Origin 或跨站 Origin 被拒', async () => {
    const { client } = await setup()
    const a = client()
    expect((await a.post('/auth/code', { email: 'a@qq.com' }, { origin: 'https://evil.test' })).json.error).toBe('bad_origin')
  })

  it('非 JSON 的写请求被拒（表单 CSRF）', async () => {
    const { client } = await setup()
    const r = await client().post('/auth/code', 'email=a@qq.com', { 'content-type': 'application/x-www-form-urlencoded' })
    expect(r.json.error).toBe('bad_content_type')
  })
})

describe('昵称与账号', () => {
  it('设置昵称；长度、保留词、重名', async () => {
    const { client } = await setup()
    const a = client()
    await a.login('n1@qq.com')
    expect((await a.patch('/me', { name: 'a' })).json.error).toBe('name_length')
    expect((await a.patch('/me', { name: '我是作者本人' })).json.error).toBe('name_reserved')
    expect((await a.patch('/me', { name: '林 小川' })).json.error).toBe('name_reserved')
    expect((await a.patch('/me', { name: 'ＡＤＭＩＮ' })).json.error).toBe('name_reserved')
    expect((await a.patch('/me', { name: '小明' })).json.user.name).toBe('小明')

    const b = client()
    await b.login('n2@qq.com')
    expect((await b.patch('/me', { name: '小明' })).status).toBe(409)
  })

  it('管理员可以用保留词作昵称', async () => {
    const { client } = await setup()
    const a = client()
    await a.login(ADMIN)
    expect((await a.patch('/me', { name: '林小川' })).json.user.name).toBe('林小川')
  })

  it('关闭回复通知', async () => {
    const { client } = await setup()
    const a = client()
    await a.login('n@qq.com', '读者甲')
    expect((await a.patch('/me', { notifyReplies: false })).json.user.notifyReplies).toBe(false)
    expect((await a.get('/me')).json.user.notifyReplies).toBe(false)
  })

  it('注销：邮箱、会话、验证码清空，昵称释放，评论显示为已删除但回复保留', async () => {
    const { client, db } = await setup()
    const a = client()
    await a.login('bye@qq.com', '要走的人')
    const { json } = await a.post('/comments', { page: '/ch02/2-1', pageTitle: '2.1', quote: { exact: '线性表' }, body: '有问题' })
    const b = client()
    await b.login('stay@qq.com', '留下的人')
    await b.post('/comments', { parentId: json.id, body: '同问' })

    expect((await a.del('/me')).status).toBe(200)
    expect((await a.get('/me')).json.user).toBeNull()
    const [u] = await db.query<{ email: string | null; display_name: string | null }>(`SELECT email, display_name FROM users WHERE deleted_at IS NOT NULL`)
    expect(u).toEqual({ email: null, display_name: null })
    const [codes] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM email_codes WHERE email = 'bye@qq.com'`)
    expect(codes.n).toBe(0)

    const t = (await b.get('/comments?page=/ch02/2-1')).json.threads
    expect(t).toHaveLength(1)
    expect(t[0]).toMatchObject({ deleted: true, body: '' })
    expect(t[0].replies[0].body).toBe('同问')

    // 昵称已释放；同一邮箱可以重新注册成新账号
    expect((await b.patch('/me', { name: '要走的人' })).status).toBe(200)
    const again = await client('3.3.3.3').login('bye@qq.com')
    expect(again.name).toBeNull()
  })
})
