<script setup lang="ts">
import { computed } from 'vue'
import { normalizeLines } from '../../../../scripts/lib/compare'

/**
 * 三栏对比：输入 / 期望输出 / 你的输出。line 是第一处不同的行（1 起），两边都高亮。
 * 运行（样例）与提交（第一个没过的测试点）共用。expected 为 null 时（自定义输入）只显示输入与输出。
 */
const props = defineProps<{ input: string; expected: string | null; actual: string; line?: number | null }>()

const view = (s: string) => {
  const lines = normalizeLines(s)
  return lines.length ? lines : ['']
}
const expectedLines = computed(() => (props.expected === null ? null : view(props.expected)))
const actualLines = computed(() => view(props.actual))
</script>

<template>
  <div class="diff-view" :class="{ 'no-expected': expectedLines === null }">
    <div class="dv-col">
      <div class="dv-head">输入</div>
      <pre class="dv-pre">{{ input.replace(/\n$/, '') }}</pre>
    </div>
    <div v-if="expectedLines" class="dv-col">
      <div class="dv-head">期望输出</div>
      <pre class="dv-pre"><span v-for="(l, i) in expectedLines" :key="i" class="dv-line" :class="{ 'is-diff': line === i + 1 }">{{ l }}
</span></pre>
    </div>
    <div class="dv-col">
      <div class="dv-head">你的输出<span v-if="line" class="dv-note">第 {{ line }} 行起不同</span></div>
      <pre class="dv-pre"><span v-for="(l, i) in actualLines" :key="i" class="dv-line" :class="{ 'is-diff': line === i + 1 }">{{ l }}
</span><span v-if="line && line > actualLines.length" class="dv-line is-diff dv-missing">（这里缺少输出）
</span></pre>
    </div>
  </div>
</template>
