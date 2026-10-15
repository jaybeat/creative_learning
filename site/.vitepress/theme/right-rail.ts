import { ref } from 'vue'

/**
 * 节页右侧只有一条栏：本节目录（LessonBar.vue）、评论（comments/CommentLayer.vue）、问 AI（ask/AskPanel.vue）同一时间只开一个。
 * 谁打开就 claimRight(自己)；其余面板 watch rightOpen，发现不是自己就关上。固定住的本节目录不算"打开"，不参与互斥。
 */
export type RightPanel = 'outline' | 'comments' | 'ask'

export const rightOpen = ref<RightPanel | null>(null)

export function claimRight(p: RightPanel): void {
  rightOpen.value = p
}

export function releaseRight(p: RightPanel): void {
  if (rightOpen.value === p) rightOpen.value = null
}
