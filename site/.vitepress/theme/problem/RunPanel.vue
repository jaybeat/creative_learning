<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { compareOutput } from '../../../../scripts/lib/compare'
import type { RunCase, RunRecord } from './run-types'
import DiffView from './DiffView.vue'
import { VERDICT_HINT, verdictText, verdictTone } from './verdict'

const props = defineProps<{
  mode: 'cases' | 'result'
  cases: RunCase[]
  record: RunRecord | null
  running: boolean
  error: string
}>()
const emit = defineEmits<{ add: []; remove: [i: number]; input: [i: number, value: string]; reset: [i: number] }>()

const active = ref(0)
watch(
  () => props.cases.length,
  (n) => {
    if (active.value >= n) active.value = Math.max(0, n - 1)
  },
)
const current = computed(() => props.cases[active.value])
const modified = (c: RunCase) => c.sample !== null && c.input !== c.sampleInput

/** 每组的结论：样例比对期望输出；自定义输入只看能否正常运行 */
const outcomes = computed(() => {
  const r = props.record
  if (!r || !r.response.compile.ok) return []
  return r.cases.map((c, i) => {
    const run = r.response.runs[i]
    if (!run) return { status: 'runtime_error', line: null as number | null }
    if (run.status !== 'ok') return { status: run.status, line: null }
    if (c.expected === null) return { status: 'ok', line: null }
    const cmp = compareOutput(c.expected, run.stdout)
    return cmp.ok ? { status: 'accepted', line: null } : { status: 'wrong_answer', line: cmp.line }
  })
})
const activeResult = ref(0)
watch(
  () => props.record,
  () => {
    // 新结果出来时，默认停在第一组没通过的
    const i = outcomes.value.findIndex((o) => o.status !== 'accepted' && o.status !== 'ok')
    activeResult.value = i < 0 ? 0 : i
  },
)
const summary = computed(() => {
  const o = outcomes.value
  const compared = o.filter((_, i) => props.record!.cases[i].expected !== null)
  const passed = compared.filter((x) => x.status === 'accepted').length
  return { passed, total: compared.length }
})
</script>

<template>
  <div class="run-panel">
    <!-- 测试用例 -->
    <template v-if="mode === 'cases'">
      <div class="rp-chips" role="tablist" aria-label="测试用例">
        <button
          v-for="(c, i) in cases"
          :key="i"
          type="button"
          role="tab"
          class="rp-chip"
          :class="{ active: i === active }"
          :aria-selected="i === active"
          @click="active = i"
        >
          {{ c.label }}<span v-if="modified(c)" class="rp-dot" title="输入已修改">•</span>
          <span v-if="c.sample === null" class="rp-x" title="删除这组" @click.stop="emit('remove', i)">×</span>
        </button>
        <button v-if="cases.length < 5" type="button" class="rp-chip rp-add" @click="emit('add'); active = cases.length">+ 自定义</button>
      </div>
      <div v-if="current" class="rp-case">
        <label class="rp-label" :for="`rp-input-${active}`">输入</label>
        <textarea
          :id="`rp-input-${active}`"
          class="rp-input"
          spellcheck="false"
          rows="3"
          :value="current.input"
          @input="emit('input', active, ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
        <template v-if="current.expected !== null && !modified(current)">
          <div class="rp-label">期望输出</div>
          <pre class="rp-expected">{{ current.expected }}</pre>
        </template>
        <p v-else-if="modified(current)" class="rp-note">
          输入改过了，运行时只显示输出、不和期望比对。
          <button type="button" class="pw-link" @click="emit('reset', active)">恢复样例</button>
        </p>
        <p v-else class="rp-note">自定义输入：运行时只显示输出，不比对。</p>
      </div>
    </template>

    <!-- 运行结果 -->
    <template v-else>
      <p v-if="running" class="rp-note">运行中…（编译并运行，通常几秒内完成）</p>
      <p v-else-if="error" class="rp-error" role="alert">{{ error }}</p>
      <p v-else-if="!record" class="rp-note">点「运行」，用上面的测试用例跑一遍你的代码。</p>
      <template v-else-if="!record.response.compile.ok">
        <div class="vv-top"><span class="vv-status tone-bad">编译错误</span></div>
        <p class="vv-hint">{{ VERDICT_HINT.compile_error }}</p>
        <pre class="vv-compile">{{ record.response.compile.message }}</pre>
      </template>
      <template v-else>
        <div class="vv-top">
          <span v-if="summary.total" class="vv-status" :class="summary.passed === summary.total ? 'tone-good' : 'tone-bad'">
            {{ summary.passed === summary.total ? '样例全部通过' : '有样例没通过' }}
          </span>
          <span v-if="summary.total" class="vv-count">{{ summary.passed }} / {{ summary.total }}</span>
          <span class="vv-count">提交后还会用更多隐藏的测试点检查</span>
        </div>
        <div class="rp-chips" role="tablist" aria-label="各组结果">
          <button
            v-for="(c, i) in record.cases"
            :key="i"
            type="button"
            role="tab"
            class="rp-chip"
            :class="[{ active: i === activeResult }, `tone-${verdictTone(outcomes[i].status)}`]"
            :aria-selected="i === activeResult"
            @click="activeResult = i"
          >
            {{ outcomes[i].status === 'accepted' ? '✓' : outcomes[i].status === 'ok' ? '•' : '✗' }} {{ c.label }}
          </button>
        </div>
        <template v-if="record.cases[activeResult]">
          <p class="rp-note">
            {{ verdictText(outcomes[activeResult].status) }} · {{ record.response.runs[activeResult]?.timeMs ?? 0 }} ms
            <template v-if="VERDICT_HINT[outcomes[activeResult].status] && outcomes[activeResult].status !== 'wrong_answer'"
              >。{{ VERDICT_HINT[outcomes[activeResult].status] }}</template
            >
          </p>
          <DiffView
            :input="record.cases[activeResult].input"
            :expected="record.cases[activeResult].expected"
            :actual="record.response.runs[activeResult]?.stdout ?? ''"
            :line="outcomes[activeResult].line"
          />
        </template>
      </template>
    </template>
  </div>
</template>
