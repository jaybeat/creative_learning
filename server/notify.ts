import type { Config } from './config.js'
import type { Db } from './db.js'
import type { Mail, Mailer } from './mailer.js'
import { signUserId } from './crypto.js'

export type MailKind = 'code' | 'reply' | 'digest'

export async function mailQuotaLeft(db: Db, config: Config): Promise<number> {
  const [r] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM mail_log WHERE created_at > now() - interval '1 day'`)
  return config.dailyMailLimit - r.n
}

/** 发信并记账；发送失败时抛出，不记账 */
export async function sendLogged(db: Db, mailer: Mailer, kind: MailKind, mail: Mail, meta: { userId?: string; threadId?: string } = {}) {
  await mailer.send(mail)
  await db.query('INSERT INTO mail_log (kind, user_id, thread_id) VALUES ($1, $2, $3)', [kind, meta.userId ?? null, meta.threadId ?? null])
}

/** 同一讨论串给同一个人的回复通知，1 小时内最多一封 */
export const REPLY_NOTIFY_WINDOW = '1 hour'

export const excerpt = (s: string, n = 200) => ([...s].length > n ? [...s].slice(0, n).join('') + '…' : s)

export const threadUrl = (config: Config, page: string, threadId: string) => `${config.siteUrl}${page}?c=${threadId}`

/**
 * 有人回复了某条顶层评论：通知评论作者（不是自己回复自己、没关通知、没注销）。
 * 通知失败不影响回复本身，只记日志。
 */
export async function notifyReply(
  db: Db,
  mailer: Mailer,
  config: Config,
  r: { threadId: string; replierId: string; replierName: string; body: string },
): Promise<void> {
  try {
    const [t] = await db.query<{ user_id: string; email: string | null; notify_replies: boolean; page_path: string; page_title: string }>(
      `SELECT c.user_id, u.email, u.notify_replies, c.page_path, c.page_title
         FROM comments c JOIN users u ON u.id = c.user_id
        WHERE c.id = $1 AND u.deleted_at IS NULL`,
      [r.threadId],
    )
    if (!t || !t.email || !t.notify_replies || t.user_id === r.replierId) return
    const [recent] = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM mail_log
        WHERE kind = 'reply' AND user_id = $1 AND thread_id = $2 AND created_at > now() - interval '${REPLY_NOTIFY_WINDOW}'`,
      [t.user_id, r.threadId],
    )
    if (recent.n > 0) return
    if ((await mailQuotaLeft(db, config)) <= 0) return
    const title = t.page_title || t.page_path
    await sendLogged(
      db,
      mailer,
      'reply',
      {
        to: t.email,
        subject: `【${config.brand}】${r.replierName} 回复了你在「${title}」的评论`,
        text: [
          `${r.replierName} 回复了你在「${title}」的评论：`,
          '',
          excerpt(r.body),
          '',
          `查看讨论：${threadUrl(config, t.page_path, r.threadId)}`,
          '',
          '——',
          `不想再收到回复通知？打开这个链接关闭：${config.siteUrl}/api/unsubscribe?t=${encodeURIComponent(signUserId(t.user_id, config.unsubscribeSecret))}`,
        ].join('\n'),
      },
      { userId: t.user_id, threadId: r.threadId },
    )
  } catch (err) {
    console.error('[mail] 回复通知发送失败', err)
  }
}

/** 每日汇总：过去 24 小时读者（非管理员）的新评论与回复，发给每个管理员。没有新评论就不发。 */
export async function sendDigest(db: Db, mailer: Mailer, config: Config): Promise<number> {
  const rows = await db.query<{ id: string; parent_id: string | null; page_path: string; page_title: string; quote_exact: string | null; body: string; name: string | null }>(
    `SELECT c.id, c.parent_id, c.page_path, c.page_title, c.quote_exact, c.body, u.display_name AS name
       FROM comments c JOIN users u ON u.id = c.user_id
      WHERE c.created_at > now() - interval '1 day' AND c.deleted_at IS NULL AND u.role <> 'admin'
      ORDER BY c.page_path, c.created_at`,
  )
  if (rows.length === 0 || config.adminEmails.length === 0) return 0
  const lines: string[] = [`过去 24 小时有 ${rows.length} 条新评论与回复：`, '']
  for (const r of rows) {
    lines.push(`■ ${r.page_title || r.page_path}`)
    if (r.quote_exact) lines.push(`  原文：「${excerpt(r.quote_exact, 60)}」`)
    lines.push(`  ${r.name ?? '读者'}${r.parent_id ? '（回复）' : ''}：${excerpt(r.body, 300)}`)
    lines.push(`  ${threadUrl(config, r.page_path, r.parent_id ?? r.id)}`, '')
  }
  lines.push(`全部未回复的评论：${config.siteUrl}/admin`)
  let sent = 0
  for (const to of config.adminEmails) {
    if ((await mailQuotaLeft(db, config)) <= 0) break
    await sendLogged(db, mailer, 'digest', { to, subject: `【${config.brand}】今日新评论 ${rows.length} 条`, text: lines.join('\n') })
    sent++
  }
  return sent
}

/** 管理员静默回复后、还没合并通知的读者：每人一行（只算原评论作者还在、没删的回复） */
export async function listPendingNotify(db: Db) {
  return db.query<{ user_id: string; name: string | null; n: number; notify_replies: boolean }>(
    `SELECT t.user_id, u.display_name AS name, count(*)::int AS n, u.notify_replies
       FROM comments r
       JOIN comments t ON t.id = r.parent_id
       JOIN users u ON u.id = t.user_id
      WHERE r.notify_pending AND r.deleted_at IS NULL AND u.deleted_at IS NULL AND t.user_id <> r.user_id
      GROUP BY t.user_id, u.display_name, u.notify_replies
      ORDER BY min(r.created_at)`,
  )
}

/**
 * 把管理员给某位读者的静默回复合并成一封邮件：按页面列出原文、读者的评论、作者的回复和链接。
 * 读者关了通知时不发信，只清掉标记。返回是否发了信。
 */
export async function sendMergedReplies(db: Db, mailer: Mailer, config: Config, userId: string): Promise<boolean> {
  const rows = await db.query<{
    id: string; thread_id: string; page_path: string; page_title: string; quote_exact: string | null
    question: string; body: string; replier: string | null; email: string | null; notify_replies: boolean
  }>(
    `SELECT r.id, t.id AS thread_id, t.page_path, t.page_title, t.quote_exact, t.body AS question, r.body,
            ru.display_name AS replier, u.email, u.notify_replies
       FROM comments r
       JOIN comments t ON t.id = r.parent_id
       JOIN users u ON u.id = t.user_id
       JOIN users ru ON ru.id = r.user_id
      WHERE r.notify_pending AND r.deleted_at IS NULL AND t.user_id = $1 AND u.deleted_at IS NULL AND r.user_id <> t.user_id
      ORDER BY t.created_at, r.created_at`,
    [userId],
  )
  if (rows.length === 0) return false
  const ids = rows.map((r) => r.id)
  const { email, notify_replies } = rows[0]
  let sent = false
  if (email && notify_replies) {
    if ((await mailQuotaLeft(db, config)) <= 0) throw new Error('今日发信额度已用完')
    const replier = rows[0].replier ?? '作者'
    const threads = new Set(rows.map((r) => r.thread_id)).size
    const lines = [`${replier} 回复了你的 ${threads} 条评论：`, '']
    for (const r of rows) {
      lines.push(`■ ${r.page_title || r.page_path}`)
      if (r.quote_exact) lines.push(`  原文：「${excerpt(r.quote_exact, 60)}」`)
      lines.push(`  你：${excerpt(r.question, 300)}`)
      lines.push(`  ${r.replier ?? '作者'}：${excerpt(r.body, 600)}`)
      lines.push(`  ${threadUrl(config, r.page_path, r.thread_id)}`, '')
    }
    lines.push(
      '——',
      `不想再收到回复通知？打开这个链接关闭：${config.siteUrl}/api/unsubscribe?t=${encodeURIComponent(signUserId(userId, config.unsubscribeSecret))}`,
    )
    await sendLogged(
      db,
      mailer,
      'reply',
      { to: email, subject: `【${config.brand}】${replier} 回复了你的 ${threads} 条评论`, text: lines.join('\n') },
      { userId },
    )
    sent = true
  }
  await db.query('UPDATE comments SET notify_pending = false WHERE id = ANY($1::uuid[])', [ids])
  return sent
}
