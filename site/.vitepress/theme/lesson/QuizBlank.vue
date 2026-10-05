<script setup lang="ts">
import { inject } from 'vue'
import { FILL_KEY } from './fill'

/** 填空题里的一个空。状态都在外层 FillQuiz 里；不在填空题里时（不该发生）显示成一个空框 */
const props = defineProps<{ n: number }>()
const ctx = inject(FILL_KEY, null)

function onDragOver(e: DragEvent): void {
  if (ctx && !ctx.locked() && !ctx.text(props.n)) e.preventDefault()
}
</script>

<template>
  <button
    type="button"
    class="quiz-blank"
    :class="ctx ? `is-${ctx.state(n)}` : 'is-empty'"
    :aria-label="ctx?.text(n) ? `第${n + 1}个空：${ctx.text(n)}` : `第${n + 1}个空`"
    @click="ctx?.click(n)"
    @dragover="onDragOver"
    @drop.prevent="ctx?.drop(n, $event)"
  >{{ ctx?.text(n) || '　　' }}</button>
</template>
