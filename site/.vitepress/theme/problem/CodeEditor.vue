<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { EditorView } from '@codemirror/view'

/**
 * C 代码编辑器（CodeMirror 6）。编辑器代码在挂载后动态加载，只有题目页才下载；
 * SSR 与加载完成前显示同样内容的 <pre>，避免 hydration 不一致和布局跳动。
 */
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const host = ref<HTMLElement>()
const ready = ref(false)
const view = shallowRef<EditorView>()

onMounted(async () => {
  const [{ EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection }, { EditorState }, commands, language, { closeBrackets, closeBracketsKeymap }, { cpp }, { tags }] =
    await Promise.all([
      import('@codemirror/view'),
      import('@codemirror/state'),
      import('@codemirror/commands'),
      import('@codemirror/language'),
      import('@codemirror/autocomplete'),
      import('@codemirror/lang-cpp'),
      import('@lezer/highlight'),
    ])
  if (!host.value) return
  const { HighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching, indentUnit } = language
  // 颜色取 CSS 变量（problem.css），深浅色切换时无需重建编辑器
  const style = HighlightStyle.define([
    { tag: [tags.keyword, tags.controlKeyword, tags.modifier, tags.operatorKeyword], color: 'var(--pe-keyword)' },
    { tag: [tags.typeName, tags.standard(tags.typeName)], color: 'var(--pe-type)' },
    { tag: [tags.string, tags.character], color: 'var(--pe-string)' },
    { tag: [tags.number, tags.bool, tags.null], color: 'var(--pe-number)' },
    { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--pe-comment)' },
    { tag: [tags.processingInstruction, tags.macroName], color: 'var(--pe-macro)' },
    { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--pe-function)' },
  ])
  const v = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        commands.history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightActiveLine(),
        indentUnit.of('    '),
        EditorState.tabSize.of(4),
        keymap.of([...closeBracketsKeymap, ...commands.defaultKeymap, ...commands.historyKeymap, commands.indentWithTab]),
        cpp(),
        syntaxHighlighting(style),
        EditorView.contentAttributes.of({ 'aria-label': 'C 代码编辑器', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) emit('update:modelValue', u.state.doc.toString())
        }),
      ],
    }),
  })
  view.value = v
  ready.value = true
})

// 外部替换代码（重置、载入上一问 / 历史提交）时同步进编辑器
watch(
  () => props.modelValue,
  (code) => {
    const v = view.value
    if (v && code !== v.state.doc.toString()) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: code } })
    }
  },
)

onBeforeUnmount(() => view.value?.destroy())

defineExpose({ focus: () => view.value?.focus() })
</script>

<template>
  <div class="code-editor">
    <pre v-if="!ready" class="code-editor-fallback">{{ modelValue }}</pre>
    <div ref="host" class="code-editor-host" :class="{ 'is-ready': ready }"></div>
  </div>
</template>
