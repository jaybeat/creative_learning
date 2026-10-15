import { stream } from 'hono/streaming'
import type { Deps } from './app.js'
import type { Api } from './auth.js'
import { readJson } from './auth.js'
import { fail } from './http.js'
import type { ChatMessage } from './ask-model.js'
import { PAGE_RE, pageContext, type PageContext } from './book-context.js'

export const LIMITS = {
  questionChars: 1000,
  /** 带上的历史消息条数（一问一答算两条） */
  historyMessages: 12,
  historyChars: 4000,
}

const KIND_LABEL: Record<PageContext['kind'], string> = { section: '这一节', exercise: '这道练习题', chapter: '这一章的开头' }

/** system prompt：作者的讲法 + 本页原文。挑战题、练习题只引导不给答案 */
export function systemPrompt(ctx: PageContext | null): string {
  const rules = [
    '你是《数据结构：从问题到表示》（C 语言版，作者林小川）的学习助手，在读者看课程时回答提问。',
    '讲法：先说这个知识要解决什么问题，再讲它怎么解决；多用具体的小例子和类比；先让读者明白"为什么"，再讲"怎么写"。',
    '回答用中文，简短直接：一般 3 到 8 句话，需要时给一小段 C 代码或字符画。不要客套，不要重复问题。',
    '只回答和这本书、数据结构、C 语言、编程学习有关的问题；其他话题礼貌地说明你只管这门课。',
    '读者问的是本页的随堂测验（:::quiz 块）、练习题或者"挑战"类题目的答案时：不给答案。即使读者说"直接告诉我"，也不要说出选项对不对、结论是什么（连"都不能""选 A"这种一句话结论也不说），不给完整代码。改用反问和提示，一次只推一小步，引导读者自己想出来；读者先说出自己的判断和理由，再告诉他对在哪、错在哪。',
    '如果本页原文里已经讲过，就按原文的说法和例子讲，术语和原文保持一致；原文没讲到的，可以补充，但要说明这是补充。',
  ]
  if (ctx) rules.push('', `读者现在在看${KIND_LABEL[ctx.kind]}「${ctx.title}」，原文如下（Markdown）：`, '<<<', ctx.text, '>>>')
  return rules.join('\n')
}

function cleanHistory(raw: unknown): ChatMessage[] | null {
  if (raw === undefined) return []
  if (!Array.isArray(raw) || raw.length > LIMITS.historyMessages) return null
  const out: ChatMessage[] = []
  for (const m of raw) {
    if (!m || typeof m !== 'object') return null
    const { role, content } = m as Record<string, unknown>
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string' || content.length > LIMITS.historyChars) return null
    out.push({ role, content })
  }
  return out
}

/**
 * 「问 AI」：登录后才能问，每人每天、全站每天各有上限。
 * 回答按 NDJSON 流式返回：`{"d":"一段文字"}` 若干行，最后一行 `{"done":true,"left":剩余次数}` 或 `{"error":"..."}`。
 */
export function askRoutes(app: Api, { db, config, ai }: Deps) {
  async function usedToday(userId: string) {
    const [r] = await db.query<{ mine: number; all: number }>(
      `SELECT count(*) FILTER (WHERE user_id = $1)::int AS mine, count(*)::int AS all
         FROM ask_log WHERE created_at > now() - interval '1 day'`,
      [userId],
    )
    return r
  }

  app.get('/ask/quota', async (c) => {
    const u = c.get('user')
    if (!u) return fail(c, 401, 'login_required')
    const used = await usedToday(u.id)
    return c.json({ enabled: !!ai, left: Math.max(0, config.askPerUserDaily - used.mine), limit: config.askPerUserDaily })
  })

  app.post('/ask', async (c) => {
    const u = c.get('user')
    if (!u) return fail(c, 401, 'login_required')
    const b = await readJson(c)
    if (typeof b.page !== 'string' || !PAGE_RE.test(b.page)) return fail(c, 400, 'bad_page')
    const question = typeof b.question === 'string' ? b.question.trim() : ''
    if (!question || question.length > LIMITS.questionChars) return fail(c, 400, 'bad_question')
    const history = cleanHistory(b.history)
    if (!history) return fail(c, 400, 'bad_history')
    if (!ai) return fail(c, 503, 'ask_unconfigured')

    const used = await usedToday(u.id)
    if (used.mine >= config.askPerUserDaily) return fail(c, 429, 'ask_daily_limit')
    if (used.all >= config.askSiteDaily) return fail(c, 429, 'ask_site_limit')
    // 先记一行再调用模型：并发连发也会被额度挡住
    const [log] = await db.query<{ id: string }>(`INSERT INTO ask_log (user_id, page) VALUES ($1, $2) RETURNING id`, [u.id, b.page])
    const left = config.askPerUserDaily - used.mine - 1

    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt(pageContext(b.page)) }, ...history, { role: 'user', content: question }]
    c.header('content-type', 'application/x-ndjson; charset=utf-8')
    return stream(c, async (s) => {
      const abort = new AbortController()
      s.onAbort(() => abort.abort())
      try {
        for await (const chunk of ai.stream(messages, abort.signal)) {
          if ('delta' in chunk) await s.write(JSON.stringify({ d: chunk.delta }) + '\n')
          else await db.query(`UPDATE ask_log SET tokens_in = $2, tokens_out = $3 WHERE id = $1`, [log.id, chunk.usage.in, chunk.usage.out])
        }
        await s.write(JSON.stringify({ done: true, left }) + '\n')
      } catch (e) {
        if (abort.signal.aborted) return
        console.error('[ask]', e)
        await s.write(JSON.stringify({ error: 'ask_unavailable' }) + '\n')
      }
    })
  })
}
