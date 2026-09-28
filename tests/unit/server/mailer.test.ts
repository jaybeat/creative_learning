import { describe, expect, it } from 'vitest'
import { aliyunMailer, percentEncode, signRpc } from '../../../server/mailer'

describe('阿里云 RPC 签名', () => {
  it('与官方文档示例一致', () => {
    // 阿里云「RPC 风格签名」文档的示例（AccessKeySecret = testsecret）
    const params = {
      AccessKeyId: 'testid',
      Action: 'DescribeRegions',
      Format: 'XML',
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: '3ee8c1b8-83d3-44af-a94f-4e0ad82fd6cf',
      SignatureVersion: '1.0',
      Timestamp: '2016-02-23T12:46:24Z',
      Version: '2014-05-26',
    }
    expect(signRpc('GET', params, 'testsecret')).toBe('OLeaidS1JvxuMvnyHOwuJ+uX5qY=')
  })

  it('percentEncode 编码 !\'()* 与空格，保留 ~', () => {
    expect(percentEncode("a b!'()*~")).toBe('a%20b%21%27%28%29%2A~')
    expect(percentEncode('中')).toBe('%E4%B8%AD')
  })

  it('发信请求带上签名与收件信息', async () => {
    let captured = ''
    const mailer = aliyunMailer({
      accessKeyId: 'id',
      accessKeySecret: 'secret',
      from: 'noreply@mail.example.com',
      fromAlias: 'Creative Learning',
      fetch: (async (_url: string, init: RequestInit) => {
        captured = String(init.body)
        return new Response('{"RequestId":"x"}', { status: 200 })
      }) as typeof fetch,
    })
    await mailer.send({ to: 'a@qq.com', subject: '验证码', text: '123456' })
    const p = new URLSearchParams(captured)
    expect(p.get('Action')).toBe('SingleSendMail')
    expect(p.get('ToAddress')).toBe('a@qq.com')
    expect(p.get('AccountName')).toBe('noreply@mail.example.com')
    expect(p.get('Signature')).toBeTruthy()
  })

  it('接口返回错误时抛出', async () => {
    const mailer = aliyunMailer({
      accessKeyId: 'id',
      accessKeySecret: 'secret',
      from: 'f@x.com',
      fromAlias: 'x',
      fetch: (async () => new Response('{"Code":"InvalidMailAddress"}', { status: 400 })) as unknown as typeof fetch,
    })
    await expect(mailer.send({ to: 'a@qq.com', subject: 's', text: 't' })).rejects.toThrow(/InvalidMailAddress/)
  })
})
