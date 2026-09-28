import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { Config } from './config.js'

/** 错误码：前端据此显示中文提示（见 site/.vitepress/theme/comments/api.ts） */
export function fail(c: Context, status: 400 | 401 | 403 | 404 | 409 | 429 | 502 | 503, error: string, extra: Record<string, unknown> = {}) {
  return c.json({ error, ...extra }, status)
}

/** Vercel 会覆写 x-forwarded-for / x-real-ip，客户端无法伪造 */
export function clientIp(c: Context): string {
  return c.req.header('x-real-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
}

/** 写请求必须来自本站页面：Origin 的 host 与请求的 host 一致 */
export function sameOrigin(c: Context): boolean {
  const origin = c.req.header('origin')
  if (!origin) return false
  const host = c.req.header('x-forwarded-host') ?? c.req.header('host')
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export const SESSION_DAYS = 30
const COOKIE = 'cl_session'

export function readSessionCookie(c: Context, config: Config): string | undefined {
  return config.secureCookie ? getCookie(c, COOKIE, 'host') : getCookie(c, COOKIE)
}

export function writeSessionCookie(c: Context, config: Config, token: string): void {
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
    ...(config.secureCookie ? { secure: true, prefix: 'host' as const } : {}),
  })
}

export function clearSessionCookie(c: Context, config: Config): void {
  deleteCookie(c, COOKIE, { path: '/', ...(config.secureCookie ? { secure: true, prefix: 'host' as const } : {}) })
}
