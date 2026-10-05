import { describe, expect, test } from 'vitest'
import { createMd } from '../../scripts/lib/md'
import { lessonPlugin } from '../../scripts/lib/lesson-plugin'
import { milestonePlugin } from '../../scripts/lib/milestone-plugin'

const md = createMd().use(milestonePlugin).use(lessonPlugin)
const env = () => ({ relativePath: 'ch02/2-1.md', frontmatter: { srcFile: 'ch02.md', srcLine: 3 } })
const render = (src: string) => md.render(src, env())

const QUIZ = `::: quiz 多选
下面哪些是**线性表**？

- [x] 一行字\`cat\`
  都是字符，有先后。
- [ ] 文件夹目录
  一对多。
- [X] 一周七天

判断的办法：能不能数到最后一个。
:::
`

describe('分页', () => {
  test('没有分页标记：原样输出，不包 <Lesson>，节标题照常显示', () => {
    const html = render('# 2.1 标题\n\n正文\n')
    expect(html).not.toContain('<Lesson')
    expect(html).toContain('<h1>2.1 标题</h1>')
  })

  test('两个分页标记 → 三页；节标题留在外面，标上视觉隐藏的 class', () => {
    const html = render('# 2.1 标题\n\n第一页\n\n<!-- 分页 -->\n\n第二页\n\n<!-- 分页 -->\n\n第三页\n')
    expect(html).toMatch(/<h1 class="lesson-section-title">2\.1 标题<\/h1>\n<Lesson :pages="3">\n<template #p1>\n<p>第一页<\/p>/)
    expect(html).toContain('</template>\n<template #p2>\n<p>第二页</p>')
    expect(html).toContain('<template #p3>\n<p>第三页</p>\n</template>\n</Lesson>')
    expect(html).not.toContain('分页 -->')
  })

  test('引用块里的分页注释不算', () => {
    expect(render('正文\n\n> <!-- 分页 -->\n')).not.toContain('<Lesson')
  })
})

describe('练习题', () => {
  test('多选：正确选项下标、选项个数、题号与 id', () => {
    const html = render(QUIZ)
    expect(html).toContain('<Quiz kind="multi" :correct="[0,2]" :count="3" :index="1" qid="ch02-2-1-q1">')
  })

  test('题干、选项、选项解析、整题解析各进各的插槽，[x] 标记去掉', () => {
    const html = render(QUIZ)
    expect(html).toMatch(/<template #stem>\n<p>下面哪些是<strong>线性表<\/strong>？<\/p>\n<\/template>/)
    expect(html).toMatch(/<template #o0>\n一行字<code>cat<\/code><\/template>/)
    expect(html).toMatch(/<template #x0>\n<p>都是字符，有先后。<\/p>\n<\/template>/)
    expect(html).toMatch(/<template #o2>\n一周七天<\/template>/)
    expect(html).not.toContain('#x2')
    expect(html).toMatch(/<template #explain>\n<p>判断的办法：能不能数到最后一个。<\/p>\n<\/template>\n<\/Quiz>/)
    expect(html).not.toContain('[x]')
    expect(html).not.toContain(':::')
  })

  test('不写题型时按正确选项个数判断；同页题号递增', () => {
    const one = '::: quiz\n题\n\n- [ ] 甲\n- [x] 乙\n:::\n'
    const html = render(one + '\n' + one)
    expect(html).toContain('<Quiz kind="single" :correct="[1]" :count="2" :index="1" qid="ch02-2-1-q1">')
    expect(html).toContain(':index="2" qid="ch02-2-1-q2"')
  })

  test('练习题可以放在分页里', () => {
    const html = render('# 标题\n\n正文\n\n<!-- 分页 -->\n\n' + QUIZ)
    expect(html).toMatch(/<template #p2>\n<Quiz /)
  })

  test('写法错误时报出源文件行号', () => {
    expect(() => render('正文\n\n::: quiz 单选\n题\n\n- [x] 甲\n- [x] 乙\n:::\n')).toThrow(/ch02\.md:5 练习题：单选题只能有一个正确选项/)
    expect(() => render('::: quiz\n题\n\n- 甲\n- [x] 乙\n:::\n')).toThrow(/缺少 \[x\] 或 \[ \]/)
    expect(() => render('::: quiz\n题\n:::\n')).toThrow(/没有找到选项列表/)
    expect(() => render('::: quiz 判断\n题\n\n- [ ] 甲\n- [x] 乙\n:::\n')).toThrow(/题型「判断」不认识/)
  })

  test('填空：[[答案]] 换成空位，答案按出现顺序，其他选项进选项池，解析在后', () => {
    const src = [
      '::: quiz 填空',
      '```c',
      'void Inc1(int x) { x = x + 1; }',
      '```',
      'a 原来是5。',
      '',
      '- `Inc1(a);` 之后，a 是 [[5]]',
      '- `Inc2(&a);` 之后，a 是 [[6]]',
      '',
      '**其他选项**：不确定、程序出错',
      '',
      'Inc1 改的是复制品。',
      ':::',
      '',
    ].join('\n')
    const html = render(src)
    expect(html).toContain(':answers="[&quot;5&quot;,&quot;6&quot;]"')
    const opts = JSON.parse(html.match(/:options="([^"]*)"/)![1].replace(/&quot;/g, '"')) as string[]
    expect(opts.slice().sort()).toEqual(['5', '6', '不确定', '程序出错'].sort())
    expect(html).toContain('a 是 <QuizBlank :n="0" />')
    expect(html).toContain('a 是 <QuizBlank :n="1" />')
    expect(html).toMatch(/<template #explain>\n<p>Inc1 改的是复制品。<\/p>\n<\/template>\n<\/FillQuiz>/)
    expect(html).not.toContain('其他选项')
    expect(html).not.toContain('[[')
    // 代码块里的文字不受影响，题目部分在 body 里
    expect(html).toMatch(/<template #body>\n[\s\S]*void Inc1[\s\S]*<\/template>\n<template #explain>/)
  })

  test('填空：选项顺序每次构建都一样', () => {
    const src = '::: quiz 填空\n甲 [[1]]，乙 [[2]]，丙 [[3]]\n\n**其他选项**：4、5\n:::\n'
    const a = render(src).match(/:options="([^"]*)"/)![1]
    const b = render(src).match(/:options="([^"]*)"/)![1]
    expect(a).toBe(b)
  })

  test('填空：选项不会恰好按答案的顺序排在最前面', () => {
    for (let k = 0; k < 30; k++) {
      const html = md.render('::: quiz 填空\n甲 [[1]]，乙 [[2]]\n\n**其他选项**：3、4\n:::\n', { relativePath: `ch02/2-${k}.md` })
      const opts = JSON.parse(html.match(/:options="([^"]*)"/)![1].replace(/&quot;/g, '"')) as string[]
      expect(opts.slice(0, 2)).not.toEqual(['1', '2'])
    }
  })

  test('填空：没有空时报错', () => {
    expect(() => render('::: quiz 填空\n没有空\n:::\n')).toThrow(/填空题：没有找到空/)
  })

  test('紧跟在段落后面的 ::: quiz 也能识别', () => {
    expect(render('正文\n::: quiz\n题\n\n- [ ] 甲\n- [x] 乙\n:::\n')).toContain('<Quiz ')
  })
})
