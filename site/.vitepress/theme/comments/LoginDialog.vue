<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { api, ApiError } from './api'
import { login, loginCancelled, loginFinished, me } from './store'

/**
 * 登录框：邮箱 → 验证码 → （首次）设置昵称。首次登录即注册，没有密码。
 */
const step = ref<'email' | 'code' | 'name'>('email')
const email = ref('')
const code = ref('')
const name = ref('')
const busy = ref(false)
const error = ref('')
const countdown = ref(0)
let timer: number | undefined
const dialog = ref<HTMLElement>()

const brand = 'Creative Learning'

watch(
  () => login.open,
  async (open) => {
    if (!open) return
    error.value = ''
    code.value = ''
    step.value = login.startAtName ? 'name' : step.value === 'code' && countdown.value > 0 ? 'code' : 'email'
    name.value = me.value?.name ?? ''
    await nextTick()
    dialog.value?.querySelector<HTMLInputElement>('input')?.focus()
  },
)

function tick(seconds: number): void {
  countdown.value = seconds
  window.clearInterval(timer)
  timer = window.setInterval(() => {
    if (--countdown.value <= 0) window.clearInterval(timer)
  }, 1000)
}

async function run(fn: () => Promise<void>): Promise<void> {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await fn()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '操作失败，请重试'
    if (e instanceof ApiError && e.code === 'too_soon' && typeof e.data.retryAfter === 'number') tick(e.data.retryAfter)
    if (e instanceof ApiError && e.code === 'code_invalid' && typeof e.data.attemptsLeft === 'number') {
      error.value = e.data.attemptsLeft > 0 ? `验证码不对，还能再试 ${e.data.attemptsLeft} 次` : '验证码已失效，请重新获取'
    }
  } finally {
    busy.value = false
  }
}

const sendCode = () =>
  run(async () => {
    const r = await api.sendCode(email.value)
    step.value = 'code'
    tick(r.resendAfter)
    await nextTick()
    dialog.value?.querySelector<HTMLInputElement>('input')?.focus()
  })

const verify = () =>
  run(async () => {
    const r = await api.verify(email.value, code.value.replace(/\s/g, ''))
    me.value = r.user
    if (r.user.name) return loginFinished(r.user)
    step.value = 'name'
    await nextTick()
    dialog.value?.querySelector<HTMLInputElement>('input')?.focus()
  })

const saveName = () =>
  run(async () => {
    const r = await api.updateMe({ name: name.value })
    loginFinished(r.user)
  })

function cancel(): void {
  loginCancelled()
}

const title = computed(() => (step.value === 'name' ? '设置昵称' : `登录 ${brand}`))

onUnmounted(() => window.clearInterval(timer))
</script>

<template>
  <Teleport to="body">
    <div v-if="login.open" class="cl-modal" @click.self="cancel" @keydown.esc="cancel">
      <div ref="dialog" class="cl-dialog" role="dialog" aria-modal="true" :aria-label="title">
        <button type="button" class="cl-close" aria-label="关闭" @click="cancel">×</button>
        <h2 class="cl-dialog-title">{{ title }}</h2>

        <form v-if="step === 'email'" @submit.prevent="sendCode">
          <p class="cl-hint">登录后可以划选正文发表评论。第一次登录会自动注册。</p>
          <label class="cl-field">
            <span>邮箱</span>
            <input v-model.trim="email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" required />
          </label>
          <button class="cl-btn cl-btn-primary cl-btn-block" type="submit" :disabled="busy || !email">
            {{ busy ? '发送中…' : '获取验证码' }}
          </button>
        </form>

        <form v-else-if="step === 'code'" @submit.prevent="verify">
          <p class="cl-hint">验证码已发送到 <b>{{ email }}</b>，10 分钟内有效。没收到的话看看垃圾邮件箱。</p>
          <label class="cl-field">
            <span>验证码</span>
            <input
              v-model="code"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="7"
              placeholder="6 位数字"
              required
            />
          </label>
          <button class="cl-btn cl-btn-primary cl-btn-block" type="submit" :disabled="busy || code.replace(/\s/g, '').length !== 6">
            {{ busy ? '验证中…' : '登录' }}
          </button>
          <p class="cl-row">
            <button type="button" class="cl-link" @click="step = 'email'">换个邮箱</button>
            <button type="button" class="cl-link" :disabled="countdown > 0 || busy" @click="sendCode">
              {{ countdown > 0 ? `${countdown} 秒后可重新发送` : '重新发送' }}
            </button>
          </p>
        </form>

        <form v-else @submit.prevent="saveName">
          <p class="cl-hint">给自己起个昵称，会显示在你的评论旁边（2–20 个字）。</p>
          <label class="cl-field">
            <span>昵称</span>
            <input v-model="name" maxlength="20" autocomplete="nickname" required />
          </label>
          <button class="cl-btn cl-btn-primary cl-btn-block" type="submit" :disabled="busy || !name.trim()">
            {{ busy ? '保存中…' : '保存' }}
          </button>
        </form>

        <p v-if="error" class="cl-error" role="alert">{{ error }}</p>
        <p class="cl-privacy">邮箱只用于登录和回复通知，不会公开显示。</p>
      </div>
    </div>
  </Teleport>
</template>
