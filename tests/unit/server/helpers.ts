import { createApp } from '../../../server/app'
import { loadConfig, type Config } from '../../../server/config'
import { pgliteDb } from '../../../server/db-pglite'
import { memoryMailer } from '../../../server/mailer'
import { migrate } from '../../../server/migrate'
import { readMigrations } from '../../../server/migrations-fs'

export const ADMIN = 'author@example.com'

/** 每个测试文件共用一个内存库（建库约 2 秒），用例之间清空数据 */
let shared: ReturnType<typeof pgliteDb> | null = null

async function freshDb() {
  shared ??= pgliteDb().then(async (db) => {
    await migrate(db, readMigrations())
    return db
  })
  const db = await shared
  await db.query('TRUNCATE users, email_codes, sessions, comments, mail_log RESTART IDENTITY CASCADE')
  return db
}

export async function setup(over: Partial<Config> = {}) {
  const db = await freshDb()
  const mailer = memoryMailer()
  const config: Config = {
    ...loadConfig({ ADMIN_EMAILS: ADMIN, UNSUBSCRIBE_SECRET: 'unsub-secret', CRON_SECRET: 'cron-secret', SITE_URL: 'https://site.test' }),
    secureCookie: false,
    ...over,
  }
  const app = createApp({ db, mailer, config })

  /** 模拟一个浏览器：记住 Cookie，写请求自动带同源 Origin */
  function client(ip = '1.1.1.1') {
    let cookie = ''
    async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
      const h: Record<string, string> = { host: 'site.test', 'x-real-ip': ip, ...headers }
      if (cookie) h.cookie = cookie
      if (method !== 'GET') {
        h.origin ??= 'https://site.test'
        if (body !== undefined) h['content-type'] ??= 'application/json'
      }
      const res = await app.request(`https://site.test/api${path}`, {
        method,
        headers: h,
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      })
      const set = res.headers.get('set-cookie')
      if (set) {
        const m = /cl_session=([^;]*)/.exec(set)
        if (m) cookie = m[1] ? `cl_session=${m[1]}` : ''
        if (/Max-Age=0/i.test(set)) cookie = ''
      }
      const text = await res.text()
      let json: any = null
      try {
        json = JSON.parse(text)
      } catch {
        /* HTML 响应 */
      }
      return { status: res.status, json, text, headers: res.headers }
    }
    const lastCode = (email: string) => {
      const m = [...mailer.sent].reverse().find((x) => x.to === email)
      return m ? /(\d{6})/.exec(m.text)![1] : ''
    }
    return {
      get: (p: string, headers?: Record<string, string>) => call('GET', p, undefined, headers),
      post: (p: string, b?: unknown, headers?: Record<string, string>) => call('POST', p, b ?? {}, headers),
      patch: (p: string, b: unknown) => call('PATCH', p, b),
      del: (p: string) => call('DELETE', p, {}),
      get cookie() {
        return cookie
      },
      async login(email: string, name?: string) {
        const r = await call('POST', '/auth/code', { email })
        if (r.status !== 200) throw new Error(`发码失败 ${r.status} ${r.text}`)
        const v = await call('POST', '/auth/verify', { email, code: lastCode(email) })
        if (v.status !== 200) throw new Error(`验证失败 ${v.status} ${v.text}`)
        if (name) {
          const p = await call('PATCH', '/me', { name })
          if (p.status !== 200) throw new Error(`设置昵称失败 ${p.status} ${p.text}`)
        }
        return v.json.user
      },
    }
  }

  /** 把某邮箱的验证码与发信记录往前挪，模拟时间流逝 */
  async function age(email: string, seconds: number) {
    await db.query(`UPDATE email_codes SET created_at = created_at - ($2 || ' seconds')::interval WHERE email = $1`, [email, String(seconds)])
    await db.query(`UPDATE mail_log SET created_at = created_at - ($1 || ' seconds')::interval`, [String(seconds)])
  }

  return { db, mailer, config, app, client, age }
}
