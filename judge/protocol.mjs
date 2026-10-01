// 评测机签名协议：gateway（评测机上）与 Vercel 函数（server/judge.ts）共用这一份实现。
// 只用 Node 自带模块，兼容 Node 18（Ubuntu 24.04 apt 里的版本）。
//
// 请求：x-judge-ts（Unix 秒）、x-judge-nonce（随机 32 位十六进制）、
//       x-judge-sig = HMAC-SHA256(secret, "REQ\n" + 方法 + "\n" + 路径 + "\n" + ts + "\n" + nonce + "\n" + sha256(body))
// 响应：x-judge-ts、x-judge-sig = HMAC-SHA256(secret, "RES\n" + 状态码 + "\n" + 请求的 nonce + "\n" + ts + "\n" + sha256(body))
//       响应签名绑定请求的 nonce：中间人既不能改结果，也不能拿旧响应冒充新响应。
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/** 允许的时钟偏差（秒） */
export const MAX_SKEW = 60

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex')
const hmac = (secret, s) => createHmac('sha256', secret).update(s, 'utf8').digest('hex')

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export function newNonce() {
  return randomBytes(16).toString('hex')
}

export function requestSignature(secret, { method, path, ts, nonce, body }) {
  return hmac(secret, `REQ\n${method.toUpperCase()}\n${path}\n${ts}\n${nonce}\n${sha256(body)}`)
}

export function responseSignature(secret, { status, nonce, ts, body }) {
  return hmac(secret, `RES\n${status}\n${nonce}\n${ts}\n${sha256(body)}`)
}

/** 生成请求头 */
export function signRequest(secret, { method, path, body, now = Date.now() }) {
  const ts = String(Math.floor(now / 1000))
  const nonce = newNonce()
  return { nonce, headers: { 'x-judge-ts': ts, 'x-judge-nonce': nonce, 'x-judge-sig': requestSignature(secret, { method, path, ts, nonce, body }) } }
}

/** 窗口期内见过的 nonce。只在内存里：gateway 重启后清空，但重启前签发的请求 60 秒内就过期，影响可忽略 */
export class NonceCache {
  constructor() {
    this.seen = new Map()
  }
  /** 记录 nonce；已见过返回 false */
  add(nonce, nowSec) {
    for (const [n, exp] of this.seen) if (exp < nowSec) this.seen.delete(n)
    if (this.seen.has(nonce)) return false
    this.seen.set(nonce, nowSec + MAX_SKEW * 2)
    return true
  }
}

/**
 * 校验请求。返回 null 表示通过，否则返回拒绝原因。
 * headers 的键须为小写（node:http 与 fetch 的 Headers 都是）。
 */
export function verifyRequest(secret, { method, path, headers, body, nonces, now = Date.now() }) {
  const ts = headers['x-judge-ts']
  const nonce = headers['x-judge-nonce']
  const sig = headers['x-judge-sig']
  if (typeof ts !== 'string' || !/^\d{1,12}$/.test(ts)) return 'bad_ts'
  if (typeof nonce !== 'string' || !/^[0-9a-f]{32}$/.test(nonce)) return 'bad_nonce'
  const nowSec = Math.floor(now / 1000)
  if (Math.abs(nowSec - Number(ts)) > MAX_SKEW) return 'expired'
  if (!safeEqual(sig, requestSignature(secret, { method, path, ts, nonce, body }))) return 'bad_sig'
  // 签名通过后才记录 nonce，避免未签名的垃圾请求挤占缓存
  if (!nonces.add(nonce, nowSec)) return 'replay'
  return null
}

/** 生成响应头 */
export function signResponse(secret, { status, nonce, body, now = Date.now() }) {
  const ts = String(Math.floor(now / 1000))
  return { 'x-judge-ts': ts, 'x-judge-sig': responseSignature(secret, { status, nonce, ts, body }) }
}

/** 校验响应。返回 null 表示通过 */
export function verifyResponse(secret, { status, nonce, headers, body, now = Date.now() }) {
  const ts = headers['x-judge-ts']
  const sig = headers['x-judge-sig']
  if (typeof ts !== 'string' || !/^\d{1,12}$/.test(ts)) return 'bad_ts'
  if (Math.abs(Math.floor(now / 1000) - Number(ts)) > MAX_SKEW) return 'expired'
  if (!safeEqual(sig, responseSignature(secret, { status, nonce, ts, body }))) return 'bad_sig'
  return null
}
