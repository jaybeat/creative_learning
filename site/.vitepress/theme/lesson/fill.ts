import type { InjectionKey } from 'vue'

/** 填空题（FillQuiz）和题目里的空（QuizBlank）之间共享的状态与操作 */
export interface FillContext {
  /** 第 n 个空里现在放的文字，空着时为 '' */
  text(n: number): string
  state(n: number): 'empty' | 'filled' | 'picked' | 'right' | 'wrong'
  click(n: number): void
  drop(n: number, e: DragEvent): void
  locked(): boolean
}

export const FILL_KEY: InjectionKey<FillContext> = Symbol('fill-quiz')
