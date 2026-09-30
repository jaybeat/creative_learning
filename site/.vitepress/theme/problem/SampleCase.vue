<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData } from 'vitepress'

/** 一组样例：输入 / 输出两个框，各带复制按钮。数据来自 frontmatter.samples（构建期从题目文件提取）。 */
const props = defineProps<{ n: number }>()
const { frontmatter } = useData()
const sample = computed(() => (frontmatter.value.samples as { input: string; output: string }[] | undefined)?.[props.n])
const copied = ref<'' | 'input' | 'output'>('')

async function copy(which: 'input' | 'output'): Promise<void> {
  const text = sample.value?.[which]
  if (text === undefined) return
  try {
    await navigator.clipboard.writeText(text + '\n')
    copied.value = which
    setTimeout(() => (copied.value = ''), 1500)
  } catch {
    /* 不支持剪贴板：读者可以手动选中 */
  }
}
</script>

<template>
  <div v-if="sample" class="sample-case">
    <div class="sample-title">样例 {{ n + 1 }}</div>
    <div class="sample-grid">
      <div v-for="which in (['input', 'output'] as const)" :key="which" class="sample-box">
        <div class="sample-head">
          <span>{{ which === 'input' ? '输入' : '输出' }}</span>
          <button type="button" class="sample-copy" @click="copy(which)">{{ copied === which ? '已复制' : '复制' }}</button>
        </div>
        <pre class="sample-pre"><code>{{ sample[which] }}</code></pre>
      </div>
    </div>
  </div>
</template>
