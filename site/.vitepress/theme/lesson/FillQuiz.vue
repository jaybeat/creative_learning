<script setup lang="ts">
import { computed, onMounted, provide, ref } from 'vue'
import { FILL_KEY, type FillContext } from './fill'

/**
 * 填空题（构建期由 lesson-plugin 从 `::: quiz 填空` 生成）。
 * 题目里的每个空是一个 <QuizBlank>，通过 provide/inject 和这里共享状态。
 *
 * 操作：点选项块再点空（或先点空再点选项块）放进去；点已填的空把选项退回；桌面上也可以直接拖。
 * 用过的选项块变灰。全部填满后才能检查。答错只标出错的空，可以再试（错的空退回）或看答案。
 */
const props = defineProps<{ answers: string[]; options: string[]; index: number; qid: string }>()

type Status = 'idle' | 'wrong' | 'right' | 'revealed'
const status = ref<Status>('idle')
/** 每个空放的是第几个选项块 */
const filled = ref<(number | null)[]>(props.answers.map(() => null))
const pickedOption = ref<number | null>(null)
const pickedBlank = ref<number | null>(null)

const KEY = `ds-book:quiz:${props.qid}`
const locked = computed(() => status.value !== 'idle')
const answered = computed(() => status.value === 'right' || status.value === 'revealed')
const used = computed(() => new Set(filled.value.filter((x): x is number => x !== null)))
const allFilled = computed(() => filled.value.every((x) => x !== null))

const isRight = (n: number) => filled.value[n] !== null && props.options[filled.value[n]!] === props.answers[n]
const wrongCount = computed(() => props.answers.filter((_, n) => !isRight(n)).length)

function place(option: number, blank: number): void {
  if (locked.value || used.value.has(option)) return
  const next = filled.value.slice()
  next[blank] = option
  filled.value = next
  pickedOption.value = null
  pickedBlank.value = null
}

function clickOption(i: number): void {
  if (locked.value || used.value.has(i)) return
  if (pickedBlank.value !== null) return place(i, pickedBlank.value)
  pickedOption.value = pickedOption.value === i ? null : i
}

function clickBlank(n: number): void {
  if (locked.value) return
  if (filled.value[n] !== null) {
    // 退回选项
    const next = filled.value.slice()
    next[n] = null
    filled.value = next
    return
  }
  if (pickedOption.value !== null) return place(pickedOption.value, n)
  pickedBlank.value = pickedBlank.value === n ? null : n
}

function dropOn(n: number, e: DragEvent): void {
  const i = Number(e.dataTransfer?.getData('text/plain'))
  if (Number.isInteger(i) && filled.value[n] === null) place(i, n)
}

function onDragStart(i: number, e: DragEvent): void {
  if (locked.value || used.value.has(i)) return e.preventDefault()
  e.dataTransfer?.setData('text/plain', String(i))
  pickedOption.value = i
}

function blankState(n: number): 'empty' | 'filled' | 'picked' | 'right' | 'wrong' {
  if (answered.value) return 'right'
  if (status.value === 'wrong') return isRight(n) ? 'filled' : 'wrong'
  if (filled.value[n] !== null) return 'filled'
  return pickedBlank.value === n ? 'picked' : 'empty'
}

const ctx: FillContext = {
  text: (n) => (filled.value[n] === null ? '' : props.options[filled.value[n]!]),
  state: blankState,
  click: clickBlank,
  drop: dropOn,
  locked: () => locked.value,
}
provide(FILL_KEY, ctx)

function check(): void {
  if (!allFilled.value) return
  if (wrongCount.value === 0) {
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

/** 再试一次：错的空把选项退回，对的留着 */
function retry(): void {
  filled.value = filled.value.map((x, n) => (isRight(n) ? x : null))
  status.value = 'idle'
}

/** 每个空放上一个写着正确答案的选项块（答案相同的块可以互换） */
function fillAnswers(): void {
  const taken = new Set<number>()
  filled.value = props.answers.map((a) => {
    const i = props.options.findIndex((o, k) => o === a && !taken.has(k))
    taken.add(i)
    return i
  })
}

function reveal(): void {
  fillAnswers()
  status.value = 'revealed'
}

function redo(): void {
  filled.value = props.answers.map(() => null)
  pickedOption.value = null
  pickedBlank.value = null
  status.value = 'idle'
}

const feedback = computed(() => {
  if (status.value === 'right') return '答对了。'
  if (status.value === 'revealed') return '正确答案已填好。'
  if (status.value === 'wrong') return `还不对：有 ${wrongCount.value} 个空填错了。`
  return ''
})

onMounted(() => {
  try {
    if (localStorage.getItem(KEY) === '1') {
      fillAnswers()
      status.value = 'right'
    }
  } catch {
    /* ignore */
  }
})
</script>

<template>
  <section class="quiz fill-quiz" :class="`is-${status}`">
    <div class="quiz-badge" data-comment-ignore>填空</div>
    <div class="quiz-stem fill-body"><slot name="body" /></div>
    <div class="fill-options" data-comment-ignore role="group" aria-label="选项">
      <button
        v-for="(o, i) in options"
        :key="i"
        type="button"
        class="fill-chip"
        :class="{ used: used.has(i), picked: pickedOption === i }"
        :disabled="locked || used.has(i)"
        :draggable="!locked && !used.has(i)"
        @click="clickOption(i)"
        @dragstart="onDragStart(i, $event)"
      >
        {{ o }}
      </button>
    </div>
    <div class="quiz-actions" data-comment-ignore>
      <p v-if="feedback" class="quiz-feedback" role="status">{{ feedback }}</p>
      <button v-if="status === 'idle'" type="button" class="lesson-btn primary" :disabled="!allFilled" @click="check">检查</button>
      <template v-else-if="status === 'wrong'">
        <button type="button" class="lesson-btn primary" @click="retry">再试一次</button>
        <button type="button" class="lesson-btn" @click="reveal">看答案</button>
      </template>
      <button v-else type="button" class="lesson-btn" @click="redo">重做</button>
    </div>
    <div v-if="$slots.explain" v-show="answered" class="quiz-explain"><slot name="explain" /></div>
  </section>
</template>
