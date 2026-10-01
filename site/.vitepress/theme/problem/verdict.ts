/** 结论 / 状态的显示文字与样式分类（运行与提交共用） */
export const VERDICT_TEXT: Record<string, string> = {
  pending: '已提交 · 等待评测',
  judging: '评测中…',
  accepted: '通过',
  wrong_answer: '答案错误',
  compile_error: '编译错误',
  time_limit: '超时',
  memory_limit: '超内存',
  runtime_error: '运行出错',
  output_limit: '输出过多',
  system_error: '评测失败',
  // 「运行」里单组的状态
  ok: '运行完成',
}

export function verdictText(s: string): string {
  return VERDICT_TEXT[s] ?? s
}

/** good / bad / warn / neutral */
export function verdictTone(s: string): string {
  if (s === 'accepted') return 'good'
  if (s === 'pending' || s === 'judging' || s === 'ok') return 'neutral'
  if (s === 'system_error') return 'warn'
  return 'bad'
}

/** 不通过时给初学者的一句话提示 */
export const VERDICT_HINT: Record<string, string> = {
  wrong_answer: '程序正常结束了，但输出和期望不一样。对照下面高亮的那一行找差别。',
  compile_error: '代码没能编译。看下面 gcc 给出的第一条 error，行号就在冒号后面。',
  time_limit: '程序运行超过了 1 秒：可能有死循环，或者在等永远不会来的输入。',
  memory_limit: '程序用了超过 128 MB 内存：检查是不是开了过大的数组，或者 malloc 没有停下来。',
  runtime_error: '程序运行中崩溃或返回了非 0：常见原因是访问了空指针、数组越界，或者 main 没有 return 0。',
  output_limit: '程序输出太多了：很可能是循环没有停下来。',
  system_error: '评测机暂时没有响应，这不是你代码的问题。请稍后重新提交。',
}
