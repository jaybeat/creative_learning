/** 评论与登录接口的客户端封装。所有请求同域、带 Cookie；失败统一抛 ApiError（message 是给读者看的中文）。 */

export interface Me {
  id: string
  email: string
  name: string | null
  isAdmin: boolean
  notifyReplies: boolean
}

export interface Comment {
  id: string
  author: { name: string; isAdmin: boolean }
  mine: boolean
  body: string
  createdAt: string
  deleted: boolean
  hidden: boolean
}

export interface Thread extends Comment {
  pagePath: string
  pageTitle: string
  headingId: string | null
  quote: { exact: string; prefix: string; suffix: string }
  replies: Comment[]
}

const MESSAGES: Record<string, string> = {
  bad_email: '邮箱格式不对',
  too_soon: '发送太频繁，请稍后再试',
  email_daily_limit: '这个邮箱今天获取验证码的次数太多了，明天再试',
  ip_limit: '当前网络获取验证码的次数太多了，请稍后再试',
  locked: '验证码输错次数太多，请 1 小时后再试',
  mail_quota: '今天的邮件额度已用完，请明天再试',
  mail_failed: '邮件发送失败，请检查邮箱地址后重试',
  code_invalid: '验证码不对',
  code_expired: '验证码已失效，请重新获取',
  login_required: '请先登录',
  name_length: '昵称需要 2–20 个字',
  name_chars: '昵称里不能有特殊符号',
  name_reserved: '这个昵称不能使用',
  name_taken: '这个昵称已经有人用了',
  name_required: '请先设置昵称',
  bad_body: '评论内容不能为空，最多 2000 字',
  bad_quote: '选中的文字太长了（最多 500 字）',
  comment_rate: '发得太快了，歇一会儿再发',
  not_found: '这条评论已不存在',
  forbidden: '没有权限',
}

export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    public data: Record<string, unknown> = {},
  ) {
    super(MESSAGES[code] ?? (status >= 500 || status === 0 ? '服务暂时不可用，请稍后再试' : '操作失败，请重试'))
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${import.meta.env.BASE_URL}api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('network', 0)
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new ApiError(String(data.error ?? 'unknown'), res.status, data)
  return data as T
}

export const api = {
  me: () => request<{ user: Me | null }>('GET', '/me'),
  sendCode: (email: string) => request<{ ok: true; resendAfter: number }>('POST', '/auth/code', { email }),
  verify: (email: string, code: string) => request<{ user: Me }>('POST', '/auth/verify', { email, code }),
  logout: () => request<{ ok: true }>('POST', '/auth/logout', {}),
  updateMe: (patch: { name?: string; notifyReplies?: boolean }) => request<{ user: Me }>('PATCH', '/me', patch),
  deleteMe: () => request<{ ok: true }>('DELETE', '/me', {}),
  comments: (page: string) => request<{ threads: Thread[] }>('GET', `/comments?page=${encodeURIComponent(page)}`),
  createThread: (t: { page: string; pageTitle: string; headingId: string | null; quote: Thread['quote']; body: string }) =>
    request<{ id: string }>('POST', '/comments', t),
  reply: (parentId: string, body: string) => request<{ id: string }>('POST', '/comments', { parentId, body }),
  remove: (id: string) => request<{ ok: true }>('DELETE', `/comments/${id}`, {}),
  hide: (id: string, hidden: boolean) => request<{ ok: true }>('POST', `/comments/${id}/hide`, { hidden }),
  adminComments: (filter: 'unreplied' | 'all', before?: string) =>
    request<{ threads: Thread[]; next: string | null }>(
      'GET',
      `/admin/comments?filter=${filter}${before ? `&before=${encodeURIComponent(before)}` : ''}`,
    ),
}

/** 评论时间：今天显示时刻，今年显示月日，否则显示完整日期 */
export function formatTime(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (d.toDateString() === now.toDateString()) return hm
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}
