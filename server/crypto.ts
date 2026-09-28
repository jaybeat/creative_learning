import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

export const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex')

export const newToken = (): string => randomBytes(32).toString('base64url')

export const newCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0')

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** 退订链接用的签名：userId.签名。密钥为空时拒绝签发和校验。 */
export function signUserId(userId: string, secret: string): string {
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET 未配置')
  return `${userId}.${createHmac('sha256', secret).update(userId).digest('base64url')}`
}

export function verifyUserToken(token: string, secret: string): string | null {
  if (!secret) return null
  const i = token.lastIndexOf('.')
  if (i <= 0) return null
  const userId = token.slice(0, i)
  return safeEqual(signUserId(userId, secret), token) ? userId : null
}
