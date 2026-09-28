import { createHmac, randomUUID } from 'node:crypto'

export interface Mail {
  to: string
  subject: string
  /** 纯文本正文：不拼 HTML，避免把用户输入注入邮件 */
  text: string
}

export interface Mailer {
  send(mail: Mail): Promise<void>
}

/* ---------- 阿里云邮件推送 SingleSendMail（RPC 签名 v1，HMAC-SHA1） ---------- */

/** 阿里云要求的 URL 编码：在 encodeURIComponent 基础上再编码 !'()*，空格为 %20 */
export function percentEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

export function signRpc(method: 'GET' | 'POST', params: Record<string, string>, secret: string): string {
  const canonical = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join('&')
  const stringToSign = `${method}&${percentEncode('/')}&${percentEncode(canonical)}`
  return createHmac('sha1', secret + '&').update(stringToSign).digest('base64')
}

export interface AliyunOptions {
  accessKeyId: string
  accessKeySecret: string
  /** 发信地址，如 noreply@mail.riverlin.me */
  from: string
  /** 收件人看到的发件人名 */
  fromAlias: string
  /** 华东1（杭州）：dm.aliyuncs.com */
  endpoint?: string
  fetch?: typeof fetch
}

export function aliyunMailer(o: AliyunOptions): Mailer {
  const endpoint = o.endpoint ?? 'https://dm.aliyuncs.com/'
  const doFetch = o.fetch ?? fetch
  return {
    async send(mail) {
      const params: Record<string, string> = {
        Format: 'JSON',
        Version: '2015-11-23',
        AccessKeyId: o.accessKeyId,
        SignatureMethod: 'HMAC-SHA1',
        SignatureVersion: '1.0',
        SignatureNonce: randomUUID(),
        Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        Action: 'SingleSendMail',
        AccountName: o.from,
        AddressType: '1',
        ReplyToAddress: 'false',
        ToAddress: mail.to,
        FromAlias: o.fromAlias,
        Subject: mail.subject,
        TextBody: mail.text,
      }
      params.Signature = signRpc('POST', params, o.accessKeySecret)
      const body = Object.entries(params)
        .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
        .join('&')
      const res = await doFetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`阿里云发信失败 HTTP ${res.status}: ${text.slice(0, 300)}`)
      }
    },
  }
}

/* ---------- 开发与测试：不发信，记下来并打印 ---------- */

export interface MemoryMailer extends Mailer {
  sent: Mail[]
}

export function memoryMailer(print = false): MemoryMailer {
  const sent: Mail[] = []
  return {
    sent,
    async send(mail) {
      sent.push(mail)
      if (print) console.log(`\n[mail] 收件人 ${mail.to}\n[mail] 标题 ${mail.subject}\n${mail.text}\n`)
    },
  }
}

export function mailerFromEnv(env: Record<string, string | undefined>, fromAlias: string): Mailer {
  const { ALIYUN_ACCESS_KEY_ID: id, ALIYUN_ACCESS_KEY_SECRET: secret, MAIL_FROM: from } = env
  if (id && secret && from) return aliyunMailer({ accessKeyId: id, accessKeySecret: secret, from, fromAlias })
  if (env.VERCEL_ENV) throw new Error('缺少发信配置：ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET / MAIL_FROM')
  return memoryMailer(true)
}
