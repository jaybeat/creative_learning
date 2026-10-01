<script setup lang="ts">
import type { Submission } from '../comments/api'
import DiffView from './DiffView.vue'
import { VERDICT_HINT, verdictText, verdictTone } from './verdict'

/** 一次提交的评测结果：结论、x/y、每个测试点的小方块、第一个没过的测试点 */
defineProps<{ s: Submission }>()
</script>

<template>
  <div class="verdict-view">
    <div class="vv-top">
      <span class="vv-status" :class="`tone-${verdictTone(s.status)}`">{{ verdictText(s.status) }}</span>
      <span v-if="s.total" class="vv-count">通过 {{ s.passed }} / {{ s.total }} 个测试点</span>
    </div>
    <div v-if="s.result?.tests?.length && s.status !== 'compile_error'" class="vv-cells" aria-hidden="true">
      <span
        v-for="(t, i) in s.result.tests"
        :key="i"
        class="vv-cell"
        :class="`tone-${verdictTone(t.status)}`"
        :title="`测试点 ${i + 1}：${verdictText(t.status)}（${t.timeMs} ms）`"
      ></span>
    </div>
    <p v-if="VERDICT_HINT[s.status]" class="vv-hint">{{ VERDICT_HINT[s.status] }}</p>
    <pre v-if="s.result?.compileMessage" class="vv-compile">{{ s.result.compileMessage }}</pre>
    <template v-if="s.result?.firstFail">
      <p class="vv-fail-title">
        第 {{ s.result.firstFail.index }} 个测试点：{{ verdictText(s.result.firstFail.status) }}
        <span v-if="s.result.firstFail.exitStatus" class="vv-exit">（退出码 {{ s.result.firstFail.exitStatus }}）</span>
      </p>
      <DiffView :input="s.result.firstFail.input" :expected="s.result.firstFail.expected" :actual="s.result.firstFail.actual" :line="s.result.firstFail.line" />
    </template>
  </div>
</template>
