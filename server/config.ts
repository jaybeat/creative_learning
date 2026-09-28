/** 服务端配置，全部来自环境变量（见 README「评论与登录」一节） */
export interface Config {
  /** 邮件里链接指向的站点地址，不带结尾斜杠 */
  siteUrl: string
  /** 平台名：邮件标题、发件人名 */
  brand: string
  adminEmails: string[]
  /** 生产环境用 __Host- 前缀 + Secure；本地 http 开发时关闭 */
  secureCookie: boolean
  /** 全站 24 小时内最多发多少封邮件（验证码 + 通知 + 汇总），保护邮件额度 */
  dailyMailLimit: number
  unsubscribeSecret: string
  cronSecret: string
}

type Env = Record<string, string | undefined>

export function siteUrlFrom(env: Env): string {
  if (env.SITE_URL) return env.SITE_URL.replace(/\/+$/, '')
  if (env.VERCEL_ENV === 'production') return 'https://learn.riverlin.me'
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`
  return 'http://localhost:5173'
}

export function loadConfig(env: Env): Config {
  return {
    siteUrl: siteUrlFrom(env),
    brand: env.BRAND ?? 'Creative Learning',
    adminEmails: (env.ADMIN_EMAILS ?? '')
      .split(/[,\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    secureCookie: env.INSECURE_COOKIE !== '1',
    dailyMailLimit: Number(env.DAILY_MAIL_LIMIT) || 300,
    unsubscribeSecret: env.UNSUBSCRIBE_SECRET ?? '',
    cronSecret: env.CRON_SECRET ?? '',
  }
}
