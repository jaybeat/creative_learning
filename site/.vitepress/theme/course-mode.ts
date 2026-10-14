import { ref } from 'vue'

/**
 * 有课程动画的节：看动画 / 读文字。选择记在 localStorage，第一次默认看动画。
 * 当前模式挂在 <html data-course-mode="text"> 上（看动画时没有这个属性）：
 * config.ts 的 head 脚本在首屏前恢复它，CSS 据此隐藏正文或播放器，不闪、不产生 hydration 不一致。
 */
export type CourseMode = 'video' | 'text'
export const MODE_KEY = 'ds-book:course-mode'

/** 组件之间共享的当前模式（CourseSwitch 改它，ReadTracker 跟着它决定要不要"翻到底就算已读"） */
export const courseMode = ref<CourseMode>('video')

export function readMode(): CourseMode {
  if (typeof document === 'undefined') return 'video'
  return document.documentElement.getAttribute('data-course-mode') === 'text' ? 'text' : 'video'
}

export function setMode(m: CourseMode): void {
  courseMode.value = m
  if (m === 'text') document.documentElement.setAttribute('data-course-mode', 'text')
  else document.documentElement.removeAttribute('data-course-mode')
  try {
    localStorage.setItem(MODE_KEY, m)
  } catch {
    /* ignore */
  }
}
