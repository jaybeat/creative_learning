<script setup lang="ts">
import { computed, onMounted, ref, useSlots } from 'vue'

/**
 * 单选 / 多选练习题（构建期由 lesson-plugin 从 `::: quiz` 生成）。
 * 插槽：stem 题干；o0、o1… 选项；x0、x1… 选项解析（可选）；explain 整题解析（可选）。
 *
 * 流程：选 → 检查。答对：标出全部正确选项，显示所有解析。答错：只标出选错的那几个和它们的解析，
 * 可以再试一次，也可以直接看答案。答对过的题记在本地，下次打开直接显示答案。
 */
// index：本页第几题。编号由作者写在页标题里（「练习1：…」），这里不显示，只随 qid 一起由插件生成
const props = defineProps<{ kind: 'single' | 'multi'; correct: number[]; count: number; index: number; qid: string }>()
const slots = useSlots()

type Status = 'idle' | 'wrong' | 'right' | 'revealed'
const status = ref<Status>('idle')
const picked = ref<number[]>([])

const KEY = `ds-book:quiz:${props.qid}`
const LETTERS = 'ABCDEFGHIJ'
const options = computed(() => Array.from({ length: props.count }, (_, i) => i))
const locked = computed(() => status.value !== 'idle')
const answered = computed(() => status.value === 'right' || status.value === 'revealed')

const isCorrect = (i: number) => props.correct.includes(i)
const isPicked = (i: number) => picked.value.includes(i)

function toggle(i: number): void {
  if (locked.value) return
  if (props.kind === 'single') picked.value = [i]
  else picked.value = isPicked(i) ? picked.value.filter((x) => x !== i) : [...picked.value, i].sort((a, b) => a - b)
}

const missed = computed(() => props.correct.filter((i) => !isPicked(i)).length)
const wrongPicked = computed(() => picked.value.filter((i) => !isCorrect(i)).length)

function check(): void {
  if (!picked.value.length) return
  if (wrongPicked.value === 0 && missed.value === 0) {
    status.value = 'right'
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* ignore */
    }
  } else {
    status.value = 'wrong'
  }
}

function retry(): void {
  status.value = 'idle'
}

function reveal(): void {
  picked.value = [...props.correct]
  status.value = 'revealed'
}

function redo(): void {
  picked.value = []
  status.value = 'idle'
}

/** 选项的状态 class：答对 / 看答案后标全部；答错时只标选错的 */
function optionClass(i: number): Record<string, boolean> {
  return {
    picked: isPicked(i),
    right: answered.value && isCorrect(i),
    wrong: (status.value === 'wrong' && isPicked(i) && !isCorrect(i)) || (answered.value && isPicked(i) && !isCorrect(i)),
  }
}

function showWhy(i: number): boolean {
  if (!slots[`x${i}`]) return false
  return answered.value || (status.value === 'wrong' && isPicked(i) && !isCorrect(i))
}

const feedback = computed(() => {
  if (status.value === 'right') return '答对了。'
  if (status.value === 'revealed') return '正确答案已标出。'
  if (status.value !== 'wrong') return ''
  if (props.kind === 'single') return '不对，看看下面的解析，再想想。'
  const parts: string[] = []
  if (wrongPicked.value) parts.push(`选错了 ${wrongPicked.value} 个`)
  if (missed.value) parts.push('还有漏选的')
  return `还不对：${parts.join('，')}。`
})

function onKey(e: KeyboardEvent, i: number): void {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    toggle(i)
  }
}

onMounted(() => {
  try {
    if (localStorage.getItem(KEY) === '1') {
      picked.value = [...props.correct]
      status.value = 'right'
    }
  } catch {
    /* ignore */
  }
})
</script>

<template>
  <section class="quiz" :class="`is-${status}`">
    <div class="quiz-badge" data-comment-ignore>{{ kind === 'single' ? '单选' : '多选' }}</div>
    <div class="quiz-stem"><slot name="stem" /></div>
    <div class="quiz-options" :role="kind === 'single' ? 'radiogroup' : 'group'">
      <div
        v-for="i in options"
        :key="i"
        class="quiz-option"
        :class="optionClass(i)"
        :role="kind === 'single' ? 'radio' : 'checkbox'"
        :aria-checked="isPicked(i)"
        :aria-disabled="locked"
        :tabindex="locked ? -1 : 0"
        @click="toggle(i)"
        @keydown="onKey($event, i)"
      >
        <span class="quiz-letter" data-comment-ignore>{{ LETTERS[i] }}</span>
        <div class="quiz-text">
          <slot :name="`o${i}`" />
          <div v-show="showWhy(i)" class="quiz-why"><slot :name="`x${i}`" /></div>
        </div>
      </div>
    </div>
    <div class="quiz-actions" data-comment-ignore>
      <p v-if="feedback" class="quiz-feedback" role="status">{{ feedback }}</p>
      <button v-if="status === 'idle'" type="button" class="lesson-btn primary" :disabled="!picked.length" @click="check">检查</button>
      <template v-else-if="status === 'wrong'">
        <button type="button" class="lesson-btn primary" @click="retry">再试一次</button>
        <button type="button" class="lesson-btn" @click="reveal">看答案</button>
      </template>
      <button v-else type="button" class="lesson-btn" @click="redo">重做</button>
    </div>
    <div v-if="slots.explain" v-show="answered" class="quiz-explain"><slot name="explain" /></div>
  </section>
</template>
