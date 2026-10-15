/** 问 AI 背后的大模型：生产用 DeepSeek（OpenAI 兼容的流式接口），测试与 e2e 用假模型 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** 流里的一块：一段新文字，或最后一块的用量 */
export type ModelChunk = { delta: string } | { usage: { in: number; out: number } }

export interface AskModel {
  stream(messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<ModelChunk>
}

export class ModelUnavailable extends Error {}

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

export function deepseekModel(key: string, model = 'deepseek-chat'): AskModel {
  return {
    async *stream(messages, signal) {
      const res = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: true, max_tokens: 1200, temperature: 0.5, stream_options: { include_usage: true } }),
        signal,
      })
      if (!res.ok || !res.body) throw new ModelUnavailable(`deepseek ${res.status}: ${(await res.text()).slice(0, 200)}`)

      // SSE：每个事件一行 `data: {...}`，以 `data: [DONE]` 结束
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += value
        let nl: number
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim()
          buf = buf.slice(nl + 1)
          if (!line.startsWith('data:')) continue
          const data = line.slice(5).trim()
          if (data === '[DONE]') return
          let j: any
          try {
            j = JSON.parse(data)
          } catch {
            continue
          }
          const delta = j.choices?.[0]?.delta?.content
          if (typeof delta === 'string' && delta) yield { delta }
          if (j.usage) yield { usage: { in: j.usage.prompt_tokens ?? 0, out: j.usage.completion_tokens ?? 0 } }
        }
      }
    },
  }
}

/** 本地 .env 和 Vercel 里的变量名都是 DEEPSEEK_API */
export function askModelFromEnv(env: Record<string, string | undefined>): AskModel | null {
  const key = env.DEEPSEEK_API?.trim()
  return key ? deepseekModel(key) : null
}

/** 测试与 e2e 用的假模型：把问题原样复述回来，分几块吐出，最后报用量 */
export function fakeModel(reply: (messages: ChatMessage[]) => string = (m) => `你问的是：${m[m.length - 1].content}`): AskModel {
  return {
    async *stream(messages) {
      const text = reply(messages)
      for (let i = 0; i < text.length; i += 4) yield { delta: text.slice(i, i + 4) }
      yield { usage: { in: 100, out: text.length } }
    },
  }
}
