<script setup lang="ts">
import { onMounted, ref } from 'vue'

/**
 * 字号三档。状态存在 <html data-font-size> 上（由 head 里的内联脚本在首屏前恢复，避免闪动），
 * 持久化到 localStorage。挂载前高亮「中」，与 SSR 一致。
 */
const KEY = 'ds-book:font-size'
const sizes = [
  { v: 's', label: '小', title: '小字号' },
  { v: 'm', label: '中', title: '标准字号' },
  { v: 'l', label: '大', title: '大字号' },
] as const
const current = ref<string>('m')

function apply(v: string): void {
  current.value = v
  const el = document.documentElement
  if (v === 'm') el.removeAttribute('data-font-size')
  else el.setAttribute('data-font-size', v)
  try {
    if (v === 'm') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, v)
  } catch {
    /* ignore */
  }
}

onMounted(() => {
  current.value = document.documentElement.getAttribute('data-font-size') || 'm'
})
</script>

<template>
  <div class="font-size-switch" role="group" aria-label="字号">
    <button
      v-for="s in sizes"
      :key="s.v"
      type="button"
      :class="{ active: current === s.v }"
      :aria-pressed="current === s.v"
      :title="s.title"
      @click="apply(s.v)"
    >
      {{ s.label }}
    </button>
  </div>
</template>
