import { describe, expect, test } from 'vitest'
import { createMd } from '../../scripts/lib/md'
import { lessonPlugin } from '../../scripts/lib/lesson-plugin'
import { parseQuizText, type FillQuiz } from '../../scripts/lib/course-quiz'

// 和书稿 2.2 节练习1 同型：选项里带逗号，干扰项只按顿号分
const SECTION = `## 2.1 上一节

::: quiz 单选
不算在 2.2 里
- [x] 甲
:::

## 2.2 线性表的操作

::: quiz 单选
先来一道选择题
- [ ] 甲
  不对。
- [x] 乙

乙是对的。
:::

::: quiz 填空
表是(c, a, t)。依次调用下面两个操作。

- Insert(L, 1, x)之后，表是 [[(c, x, a, t)]]
- 接着Delete(L, 3)之后，表是 [[(c, x, a)]]

**其他选项**：(c, a, x, t)、(c, x, t)、(c, a, t)

Insert(L, 1, x)把x放在**第1个**位置。

所以不是(c, a, x, t)。
:::

## 2.3 下一节
`

const quizzes = parseQuizText(SECTION, '2.2', 'ch02')
const fill = quizzes[1] as FillQuiz

describe('课程播放器的练习题', () => {
  test('只读这一节；选择题照旧', () => {
    expect(quizzes.map((q) => q.kind)).toEqual(['single', 'fill'])
    expect(quizzes[0]).toEqual({
      kind: 'single',
      stem: '先来一道选择题',
      options: [
        { html: '甲', correct: false, why: '不对。' },
        { html: '乙', correct: true, why: '' },
      ],
      explain: '乙是对的。',
    })
  })

  test('填空：答案按出现顺序，干扰项只按顿号分（选项里可以带逗号）', () => {
    expect(fill.answers).toEqual(['(c, x, a, t)', '(c, x, a)'])
    expect([...fill.options].sort()).toEqual(['(c, a, t)', '(c, a, x, t)', '(c, x, a)', '(c, x, a, t)', '(c, x, t)'].sort())
  })

  test('填空：题干里的空换成空位按钮，列表保留；解析是最后一个空之后的段落', () => {
    expect(fill.stem).toBe(
      '<p>表是(c, a, t)。依次调用下面两个操作。</p><ul>' +
        '<li>Insert(L, 1, x)之后，表是 <button type="button" class="c-blank fq-b" data-n="0"></button></li>' +
        '<li>接着Delete(L, 3)之后，表是 <button type="button" class="c-blank fq-b" data-n="1"></button></li></ul>',
    )
    expect(fill.stem).not.toContain('其他选项')
    expect(fill.explain).toBe('<p>Insert(L, 1, x)把x放在<b>第1个</b>位置。</p><p>所以不是(c, a, x, t)。</p>')
  })

  test('填空：选项顺序和网站上同一道题一样（同一个种子：页面 ch02/2-2.md 的第几题）', () => {
    // 选项不带逗号：网站插件分干扰项的规则正在改成只按顿号，这里只比打乱顺序
    const src = '## 2.2 x\n\n::: quiz 单选\n题\n- [x] 甲\n- [ ] 乙\n:::\n\n::: quiz 填空\n甲 [[1]]，乙 [[2]]，丙 [[3]]\n\n**其他选项**：4、5\n:::\n'
    const html = createMd().use(lessonPlugin).render(src.slice(src.indexOf(':::')), { relativePath: 'ch02/2-2.md' })
    const site = JSON.parse(/<FillQuiz [^>]*:options="([^"]*)"/.exec(html)![1].replace(/&quot;/g, '"'))
    expect((parseQuizText(src, '2.2', 'ch02')[1] as FillQuiz).options).toEqual(site)
  })

  test('填空：没有空时报错', () => {
    expect(() => parseQuizText('## 2.2 x\n\n::: quiz 填空\n没有空\n:::\n', '2.2', 'ch02')).toThrow(/没有找到空/)
  })
})
