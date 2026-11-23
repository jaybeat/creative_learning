import { expect, test } from '@playwright/test'

// 节内分页与练习题：用 2.1（四页：概念 / 例题 / 练习1 / 练习2；问题在章首引言里）
const PAGE = 'ch02/2-1'
const pages = '.lesson-page'
const next = '.lesson-nav .lesson-btn.primary'

// 2.1 有课程动画，默认看动画、正文隐藏；本文件测的是正文的分页与练习题，先切到"读文字"（course.spec.ts 测动画）
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ds-book:course-mode', 'text'))
})

test('翻页：继续 → #p2…#p4，刷新后停在原页；页底上一节/下一节只在最后一页出现', async ({ page }) => {
  await page.goto(PAGE)
  await expect(page.locator(pages)).toHaveCount(4)
  await expect(page.locator(pages).nth(0)).toBeVisible()
  await expect(page.locator(pages).nth(1)).toBeHidden()
  await expect(page.locator('.VPDocFooter')).toBeHidden()

  for (const n of [2, 3]) {
    await page.locator(next).click()
    await expect(page).toHaveURL(new RegExp(`/ch02/2-1#p${n}$`))
    await expect(page.locator(pages).nth(n - 1)).toBeVisible()
    await expect(page.locator('.VPDocFooter')).toBeHidden()
  }
  await page.locator(next).click()
  await expect(page).toHaveURL(/\/ch02\/2-1#p4$/)
  await expect(page.locator(next)).toHaveCount(0)
  await expect(page.locator('.VPDocFooter')).toBeVisible()

  await page.reload()
  await expect(page.locator(pages).nth(3)).toBeVisible()

  await page.locator('.lesson-nav .lesson-btn', { hasText: '上一页' }).click()
  await expect(page).toHaveURL(/#p3$/)
  await expect(page.locator(pages).nth(2)).toBeVisible()
})

test('← → 先翻页，翻到最后一页再翻节', async ({ page }) => {
  await page.goto(PAGE)
  await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(/#p2$/)
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator(pages).nth(0)).toBeVisible()
  await expect(page).toHaveURL(/\/ch02\/2-1$/)
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(/#p4$/)
  await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(/\/ch02\/2-2$/)
})

test('每页一个标题，进右栏目录；地址是 #p3 或指向某页标题时直接打开那一页', async ({ page }) => {
  await page.goto(`${PAGE}#p3`)
  await expect(page.locator(pages).nth(2)).toBeVisible()

  for (let i = 0; i < 4; i++) await expect(page.locator(pages).nth(i).locator('h3.para-title')).toHaveCount(1)
  const id = await page.locator(pages).nth(1).locator('h3.para-title').getAttribute('id')
  await page.goto(`${PAGE}#${id}`)
  await expect(page.locator(pages).nth(1)).toBeVisible()
  await expect(page.locator(pages).nth(2)).toBeHidden()
})

test('分页的节不显示节名，页标题做大标题；没分页的节照常显示节名', async ({ page }) => {
  await page.goto(PAGE)
  const h1 = page.locator('.vp-doc h1')
  await expect(h1).toHaveClass(/lesson-section-title/)
  await expect(h1).toContainText('2.1 线性表') // 仍在结构里：读屏软件、评论定位用
  expect((await h1.boundingBox())!.width).toBeLessThanOrEqual(1)

  const title = page.locator(pages).nth(0).locator('h3.para-title')
  await expect(title).toBeVisible()
  const fontSize = (el: Element) => parseFloat(getComputedStyle(el).fontSize)
  const titleSize = await title.evaluate(fontSize)
  const bodySize = await page.locator(pages).nth(0).locator('p').first().evaluate(fontSize)
  expect(titleSize).toBeGreaterThan(bodySize)

  await page.goto('ch01/1-2')
  await expect(page.locator('.vp-doc h1')).not.toHaveClass(/lesson-section-title/)
  expect((await page.locator('.vp-doc h1').boundingBox())!.width).toBeGreaterThan(100)
})

test('例题页：题目卡片 → 分析 → 答案卡片', async ({ page }) => {
  await page.goto(`${PAGE}#p2`)
  const ex = page.locator(pages).nth(1)
  await expect(ex.locator('blockquote.milestone-problem')).toHaveCount(1)
  await expect(ex.locator('blockquote.milestone-answer')).toHaveCount(1)
  await expect(ex.locator('blockquote.milestone-answer')).toBeVisible()
  // 「分析」是段首加粗，不进右栏目录：本页只有页标题一个小标题
  await expect(ex.locator('h3')).toHaveCount(1)
})

test('多选题：选错 → 只标出选错的并给解析；看答案 → 标出全部正确选项和整题解析', async ({ page }) => {
  await page.goto(`${PAGE}#p3`)
  const quiz = page.locator(pages).nth(2).locator('.quiz')
  const opts = quiz.locator('.quiz-option')
  await expect(quiz.locator('.quiz-badge')).toHaveText('多选')
  await expect(quiz.locator('.lesson-btn', { hasText: '检查' })).toBeDisabled()

  await opts.nth(0).click() // 一行字：对
  await opts.nth(3).click() // 文件夹目录：错
  await quiz.locator('.lesson-btn', { hasText: '检查' }).click()
  await expect(quiz.locator('.quiz-feedback')).toContainText('选错了 1 个')
  await expect(quiz.locator('.quiz-feedback')).toContainText('还有漏选的')
  await expect(opts.nth(3)).toHaveClass(/wrong/)
  await expect(opts.nth(3).locator('.quiz-why')).toBeVisible()
  await expect(opts.nth(0)).not.toHaveClass(/right/) // 答错时不泄露哪些是对的
  await expect(quiz.locator('.quiz-explain')).toBeHidden()

  await quiz.locator('.lesson-btn', { hasText: '看答案' }).click()
  for (const i of [0, 1, 2]) await expect(opts.nth(i)).toHaveClass(/right/)
  await expect(quiz.locator('.quiz-explain')).toBeVisible()
})

test('单选题：答对后记住，刷新仍显示答对', async ({ page }) => {
  await page.goto(`${PAGE}#p4`)
  const quiz = page.locator(pages).nth(3).locator('.quiz')
  await expect(quiz.locator('.quiz-badge')).toHaveText('单选')
  await quiz.locator('.quiz-option').nth(1).click()
  await quiz.locator('.lesson-btn', { hasText: '检查' }).click()
  await expect(quiz.locator('.quiz-feedback')).toHaveText('答对了。')
  await page.reload()
  await expect(page.locator(pages).nth(3).locator('.quiz')).toHaveClass(/is-right/)
})

test('2.2：四页，节名隐藏；例题有题目卡片和答案卡片，第3、4页各一道填空题', async ({ page }) => {
  await page.goto('ch02/2-2')
  await expect(page.locator(pages)).toHaveCount(4)
  await expect(page.locator('.vp-doc h1')).toHaveClass(/lesson-section-title/)
  for (let i = 0; i < 4; i++) await expect(page.locator(pages).nth(i).locator('h3.para-title')).toHaveCount(1)
  const ex = page.locator(pages).nth(1)
  await expect(ex.locator('blockquote.milestone-problem')).toHaveCount(1)
  await expect(ex.locator('blockquote.milestone-answer')).toHaveCount(1)
  for (const i of [2, 3]) await expect(page.locator(pages).nth(i).locator('.fill-quiz')).toHaveCount(1)
})

test('2.3：六页，节名隐藏；例题有题目卡片和答案卡片，第5、6页各一道单选题', async ({ page }) => {
  await page.goto('ch02/2-3')
  await expect(page.locator(pages)).toHaveCount(6)
  await expect(page.locator('.vp-doc h1')).toHaveClass(/lesson-section-title/)
  for (let i = 0; i < 6; i++) await expect(page.locator(pages).nth(i).locator('h3.para-title')).toHaveCount(1)
  const ex = page.locator(pages).nth(3)
  await expect(ex.locator('blockquote.milestone-problem')).toHaveCount(1)
  await expect(ex.locator('blockquote.milestone-answer')).toHaveCount(1)
  await expect(ex.locator('.language-c')).toHaveCount(1)
  for (const i of [4, 5]) await expect(page.locator(pages).nth(i).locator('.quiz-badge')).toHaveText('单选')
})

test('2.4：七页，页标题是操作；前4页没有题目/答案卡片，第5–7页各一道题', async ({ page }) => {
  await page.goto('ch02/2-4')
  await expect(page.locator(pages)).toHaveCount(7)
  await expect(page.locator('.vp-doc h1')).toHaveClass(/lesson-section-title/)
  const titles = ['初始化、求长度、取元素', '在第i个位置插入', '删除第i个元素', '把五个操作合起来']
  for (const [i, text] of titles.entries()) {
    await expect(page.locator(pages).nth(i).locator('h3.para-title')).toContainText(text)
    await expect(page.locator(pages).nth(i).locator('blockquote.milestone-problem, blockquote.milestone-answer')).toHaveCount(0)
  }
  const kinds = ['单选', '单选', '多选']
  for (const [k, kind] of kinds.entries()) await expect(page.locator(pages).nth(4 + k).locator('.quiz-badge')).toHaveText(kind)
  // 练习1 的题干里带一段代码
  await expect(page.locator(pages).nth(4).locator('.quiz-stem .language-c')).toHaveCount(1)
})

test('2.5：九页，页标题依次是六个概念/操作页和三道练习；练习1是填空题', async ({ page }) => {
  await page.goto('ch02/2-5')
  await expect(page.locator(pages)).toHaveCount(9)
  await expect(page.locator('.vp-doc h1')).toHaveClass(/lesson-section-title/)
  await expect(page.locator(pages).nth(2).locator('.language-c')).toHaveCount(0) // 传地址一页只讲思路，不写C代码
  await expect(page.locator(pages).nth(3).locator('.diagram')).toHaveCount(5) // 地址与指针配5张格子图
  await expect(page.locator(pages).nth(6).locator('.quiz-badge')).toHaveText('填空')
  for (const i of [7, 8]) await expect(page.locator(pages).nth(i).locator('.quiz-badge')).toHaveText('单选')
})

test('填空题：点选项再点空、先点空再点选项都能放；填错标红可再试；答对记住', async ({ page }) => {
  // 本文件里步骤最多的一条（十几次点击加一次刷新）：并发跑 4 个浏览器配置时，WebKit 桌面版偶尔超过默认 30 秒
  test.slow()
  await page.goto('ch02/2-5#p7')
  const quiz = page.locator(pages).nth(6).locator('.fill-quiz')
  const chip = (t: string) => quiz.locator('.fill-chip', { hasText: new RegExp(`^\s*${t}\s*$`) })
  const blank = (n: number) => quiz.locator('.quiz-blank').nth(n)
  const check = quiz.locator('.lesson-btn', { hasText: '检查' })

  await expect(check).toBeDisabled()
  await chip('6').click()
  await blank(0).click()
  await blank(1).click()
  await chip('5').click()
  await expect(blank(0)).toHaveText('6')
  await expect(blank(1)).toHaveText('5')
  await expect(chip('5')).toBeDisabled()

  // 点已填的空把选项退回，再放回去
  await blank(1).click()
  await expect(chip('5')).toBeEnabled()
  await chip('5').click()
  await blank(1).click()

  await check.click()
  await expect(quiz.locator('.quiz-feedback')).toContainText('有 2 个空填错了')
  await expect(blank(0)).toHaveClass(/is-wrong/)
  await expect(quiz.locator('.quiz-explain')).toBeHidden()

  await quiz.locator('.lesson-btn', { hasText: '再试一次' }).click()
  await chip('5').click()
  await blank(0).click()
  await chip('6').click()
  await blank(1).click()
  await check.click()
  await expect(quiz.locator('.quiz-feedback')).toHaveText('答对了。')
  await expect(quiz.locator('.quiz-explain')).toBeVisible()

  await page.reload()
  await expect(page.locator(pages).nth(6).locator('.fill-quiz')).toHaveClass(/is-right/)
  await expect(page.locator(pages).nth(6).locator('.quiz-blank').nth(1)).toHaveText('6')
})

test('2.6：八页，每讲完一件事就给代码，最后一页只装配；练习1是填空题', async ({ page }) => {
  await page.goto('ch02/2-6')
  await expect(page.locator(pages)).toHaveCount(8)
  await expect(page.locator('.vp-doc h1')).toHaveClass(/lesson-section-title/)
  const titles = ['编辑器要做什么', '编辑器的初始化', '敲字符和退格', '移动光标、退出和显示', '把指令合在一起：编辑器1.0']
  for (const [i, text] of titles.entries()) await expect(page.locator(pages).nth(i).locator('h3.para-title')).toContainText(text)
  await expect(page.locator(pages).nth(1).locator('.diagram')).toHaveCount(2)
  // 每讲完一件事就给代码：初始化 1 段；敲字符、退格 2 段；左右移、Show 2 段；最后一页只有 main
  const codes = [0, 1, 2, 2, 1]
  for (const [i, n] of codes.entries()) await expect(page.locator(pages).nth(i).locator('.language-c')).toHaveCount(n)
  await expect(page.locator(pages).nth(2).locator('.diagram')).toHaveCount(2)
  await expect(page.locator('.lesson-page table')).toHaveCount(1) // 只剩第1页的指令表，没有汇总表
  await expect(page.locator(pages).nth(5).locator('.quiz-badge')).toHaveText('填空')
  await expect(page.locator(pages).nth(5).locator('.quiz-blank')).toHaveCount(4)
  for (const i of [6, 7]) await expect(page.locator(pages).nth(i).locator('.quiz-badge')).toHaveText('单选')
})

test('2.7：五页，三页讲解（含格子图和增长表）加两道练习', async ({ page }) => {
  await page.goto('ch02/2-7')
  await expect(page.locator(pages)).toHaveCount(5)
  await expect(page.locator('.vp-doc h1')).toHaveClass(/lesson-section-title/)
  const titles = ['时间复杂度看什么', '插入和删除的时间复杂度', '编辑器各条指令的时间复杂度']
  for (const [i, text] of titles.entries()) await expect(page.locator(pages).nth(i).locator('h3.para-title')).toContainText(text)
  await expect(page.locator(pages).nth(0).locator('.diagram')).toHaveCount(1)
  await expect(page.locator(pages).nth(1).locator('.diagram')).toHaveCount(5) // 问题图、尾部、头部前后、一般
  await expect(page.locator(pages).nth(1).locator('table')).toHaveCount(3) // 插入、删除各一张，五个操作汇总一张
  await expect(page.locator(pages).nth(3).locator('.quiz-badge')).toHaveText('填空')
  await expect(page.locator(pages).nth(4).locator('.quiz-badge')).toHaveText('单选')
})

test('2.8：九页，六页讲解加三道练习；动态数组的概念页不写C代码', async ({ page }) => {
  await page.goto('ch02/2-8')
  await expect(page.locator(pages)).toHaveCount(9)
  await expect(page.locator('.vp-doc h1')).toHaveClass(/lesson-section-title/)
  const titles = ['数组满了怎么办', '什么是动态数组', '向系统申请空间', '动态数组的定义和初始化', '动态数组的操作', '动态数组实现编辑器']
  for (const [i, text] of titles.entries()) await expect(page.locator(pages).nth(i).locator('h3.para-title')).toContainText(text)
  await expect(page.locator(pages).nth(1).locator('.language-c')).toHaveCount(0)
  await expect(page.locator(pages).nth(6).locator('.quiz-badge')).toHaveText('填空')
  for (const i of [7, 8]) await expect(page.locator(pages).nth(i).locator('.quiz-badge')).toHaveText('单选')
})

test('4.5：九页，概念页图文按行配对（宽屏左文右图）；练习是多选、填空、单选', async ({ page }) => {
  await page.goto('ch04/4-5')
  await expect(page.locator(pages)).toHaveCount(9)
  const titles = ['什么是二叉树', '左孩子和右孩子', '五种基本形态', '只有一个孩子的时候', '二叉树和度为2的有序树', '例题：3个结点']
  for (const [i, text] of titles.entries()) await expect(page.locator(pages).nth(i).locator('h3.para-title')).toContainText(text)
  const first = page.locator(pages).nth(0)
  await expect(first.locator('.side-row')).toHaveCount(4)
  await expect(first.locator('.side-row .side-fig .tree-figure')).toHaveCount(4)
  // 宽屏时图在文字右边（窄于 640px 时图落到文字下面，4.6 的用例查那一种）
  if ((page.viewportSize()?.width ?? 1280) >= 640) {
    const row = first.locator('.side-row').first()
    const t = await row.locator('.side-text').boundingBox()
    const f = await row.locator('.side-fig').boundingBox()
    expect(f!.x).toBeGreaterThan(t!.x + t!.width - 1)
  }
  await expect(page.locator(pages).nth(6).locator('.quiz-badge')).toHaveText('多选')
  await expect(page.locator(pages).nth(7).locator('.quiz-badge')).toHaveText('填空')
  await expect(page.locator(pages).nth(8).locator('.quiz-badge')).toHaveText('单选')
})

test('4.6：九页，先讲性质再讲满二叉树、完全二叉树；窄屏时图落到文字下面', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('ch04/4-6')
  await expect(page.locator(pages)).toHaveCount(9)
  const titles = ['第i层最多几个结点', '总共最多几个结点', '满二叉树', '完全二叉树', '叶子比度为2的结点多一个', '例题：8个人的淘汰赛']
  for (const [i, text] of titles.entries()) await expect(page.locator(pages).nth(i).locator('h3.para-title')).toContainText(text)
  const row = page.locator(pages).nth(0).locator('.side-row').first()
  const t = await row.locator('.side-text').boundingBox()
  const f = await row.locator('.side-fig').boundingBox()
  expect(f!.y).toBeGreaterThan(t!.y + t!.height - 1)
  await expect(page.locator(pages).nth(6).locator('.quiz-badge')).toHaveText('填空')
  await expect(page.locator(pages).nth(7).locator('.quiz-badge')).toHaveText('多选')
  await expect(page.locator(pages).nth(8).locator('.quiz-badge')).toHaveText('填空')
})

test('4.7：十一页，顺序存储和链式存储；数组图、二叉链表图的空指针个数对得上正文', async ({ page }) => {
  await page.goto('ch04/4-7')
  await expect(page.locator(pages)).toHaveCount(11)
  const titles = ['按编号放进数组', '从编号算出孩子和双亲', '不是完全二叉树的时候', '顺序存储：用C语言表示', '把关系记在结点里', '链式存储：用C语言表示', '空指针和双亲', '两种存法比一比']
  for (const [i, text] of titles.entries()) await expect(page.locator(pages).nth(i).locator('h3.para-title')).toContainText(text)
  // 4.5节那棵按编号存：7格，5号、6号空着
  await expect(page.locator(pages).nth(2).locator('.array-figure').nth(1).locator('.cell.empty:not(.zero)')).toHaveCount(2)
  // 二叉链表：5个结点，非空指针4个、空指针6个；三叉链表空指针7个
  const figs = page.locator(pages).nth(6).locator('.tree-figure')
  await expect(figs.nth(1).locator('.link.on')).toHaveCount(4)
  await expect(figs.nth(2).locator('.nil.on')).toHaveCount(6)
  await expect(figs.nth(3).locator('.nil')).toHaveCount(7)
  for (const i of [8, 9, 10]) await expect(page.locator(pages).nth(i).locator('.quiz-badge')).toHaveText('填空')
})

test('4.8：九页，先序、中序、后序按规则逐步走；写成函数一页讲三种顺序各有用处', async ({ page }) => {
  await page.goto('ch04/4-8')
  await expect(page.locator(pages)).toHaveCount(9)
  const titles = ['三种顺序从哪来', '先序遍历', '中序遍历', '后序遍历', '写成函数', '例题：6个结点', '练习1', '练习2', '练习3：释放']
  for (const [i, text] of titles.entries()) await expect(page.locator(pages).nth(i).locator('h3.para-title')).toContainText(text)
  // 先序逐步：最后一步的序列格子写满 ABDCG
  await expect(page.locator(pages).nth(1).locator('.array-figure').last().locator('.val')).toHaveText(['A', 'B', 'D', 'C', 'G'])
  // 不再有绕一圈的图
  await expect(page.locator('.lesson-page .tour-dot')).toHaveCount(0)
  // 例题按规则写出三种序列
  await expect(page.locator(pages).nth(5).locator('.array-figure').nth(2).locator('.val')).toHaveText(['D', 'E', 'B', 'F', 'C', 'A'])
  await expect(page.locator(pages).nth(6).locator('.quiz-badge')).toHaveText('填空')
  await expect(page.locator(pages).nth(7).locator('.quiz-badge')).toHaveText('单选')
  await expect(page.locator(pages).nth(8).locator('.quiz-badge')).toHaveText('单选')
})

test('4.9：八页，先往下交（虚线?）再往上合（实线带数字）；三问框架和函数', async ({ page }) => {
  await page.goto('ch04/4-9')
  await expect(page.locator(pages)).toHaveCount(8)
  const titles = ['结点数：先往下交，再往上合', '叶子数和高度', '递下去，归上来', '写成函数', '例题：度为2', '练习1', '练习2', '练习3']
  for (const [i, text] of titles.entries()) await expect(page.locator(pages).nth(i).locator('h3.para-title')).toContainText(text)
  const figs = page.locator(pages).nth(0).locator('.tree-figure')
  // 第一张只有往下交的问题：每条边一个"?"，没有带回的答案
  await expect(figs.nth(0).locator('.flow:not(.up)')).toHaveCount(10)
  await expect(figs.nth(0).locator('.flow.up')).toHaveCount(0)
  // 最后一张：B、C 各带回 2，A 标 5
  await expect(figs.nth(4).locator('.flow.up text').filter({ hasText: '2' })).toHaveCount(2)
  await expect(figs.nth(4).locator('.tag')).toHaveText('5')
  for (const i of [5, 7]) await expect(page.locator(pages).nth(i).locator('.quiz-badge')).toHaveText('填空')
  await expect(page.locator(pages).nth(6).locator('.quiz-badge')).toHaveText('单选')
})

test('4.10：九页，先序定根、中序分左右；序列分段着色，待定子树画成虚线框', async ({ page }) => {
  await page.goto('ch04/4-10')
  await expect(page.locator(pages)).toHaveCount(9)
  const titles = ['只有先序，定不出这棵树', '第一步：先序定根，中序分左右', '左子树', '右子树和整棵树', '后序加中序', '写成函数', '练习1', '练习2', '练习3']
  for (const [i, text] of titles.entries()) await expect(page.locator(pages).nth(i).locator('h3.para-title')).toContainText(text)
  const step1 = page.locator(pages).nth(1)
  // 中序按 左 / 根 / 右 分成三段：左 4 格、根 1 格、右 2 格
  const inorder = step1.locator('.array-figure').nth(1)
  await expect(inorder.locator('.group text')).toHaveText(['左', '根', '右'])
  await expect(inorder.locator('.cell.g-left')).toHaveCount(4)
  await expect(inorder.locator('.cell.g-right')).toHaveCount(2)
  // 还没拆开的两棵子树
  await expect(step1.locator('.tree-figure').nth(1).locator('.node.dim')).toHaveCount(2)
  for (const i of [6, 7]) await expect(page.locator(pages).nth(i).locator('.quiz-badge')).toHaveText('填空')
  await expect(page.locator(pages).nth(8).locator('.quiz-badge')).toHaveText('单选')
})

test('4.11：十一页，从定长编码推到哈夫曼树；编码树边上标 0/1，合并逐步画出森林', async ({ page }) => {
  await page.goto('ch04/4-11')
  await expect(page.locator(pages)).toHaveCount(11)
  const titles = ['一段文字要多少位', '常用的字用短码', '前缀编码', '前缀编码就是一棵二叉树', '总长度就是带权路径长度', '哈夫曼的办法', '哈夫曼编码', '写成函数']
  for (const [i, text] of titles.entries()) await expect(page.locator(pages).nth(i).locator('h3.para-title')).toContainText(text)
  // 编码树：4 个内部结点、8 条边，左 0 右 1
  const code = page.locator(pages).nth(3).locator('.tree-figure').first()
  await expect(code.locator('.bit')).toHaveCount(8)
  // 合并：最后一步只剩一棵树，根是 11
  const merge = page.locator(pages).nth(5).locator('.tree-figure').last()
  await expect(merge.locator('.node.hi .name')).toHaveText('11')
  // 解码 B：路径 11 → 6 → 4 → B
  await expect(page.locator(pages).nth(6).locator('.tree-figure').nth(2).locator('.node.on .name')).toHaveText(['11', '6', '4', 'B'])
  await expect(page.locator(pages).nth(8).locator('.quiz-badge')).toHaveText('填空')
  await expect(page.locator(pages).nth(9).locator('.quiz-badge')).toHaveText('单选')
  await expect(page.locator(pages).nth(10).locator('.quiz-badge')).toHaveText('填空')
})

test('5.1：十页，好友网（无向）和关注网（有向）对照；度、路径画在同一张好友网上', async ({ page }) => {
  await page.goto('ch05/5-1')
  await expect(page.locator(pages)).toHaveCount(10)
  const titles = ['什么是图', '无向图和有向图', '邻接点和度', '入度和出度', '权', '路径和环', '连通', '例题：同桌和借钱', '练习1', '练习2']
  for (const [i, text] of titles.entries()) await expect(page.locator(pages).nth(i).locator('h3.para-title')).toContainText(text)
  // 关注网 5 条弧，各带一个箭头；小王和小李互相关注
  const follow = page.locator(pages).nth(1).locator('.graph-figure').nth(1)
  await expect(follow.locator('.edge polygon')).toHaveCount(5)
  await expect(follow.locator('.edge.on')).toHaveCount(2)
  // 度：小李连着 3 条边，五个人都标了度
  const deg = page.locator(pages).nth(2).locator('.graph-figure').first()
  await expect(deg.locator('.edge.on')).toHaveCount(3)
  await expect(deg.locator('.tag')).toHaveText(['2', '2', '3', '2', '1'])
  // 路径：小王 → 小李 → 小赵 → 小陈
  await expect(page.locator(pages).nth(5).locator('.graph-figure').first().locator('.node.on .name')).toHaveText(['小王', '小李', '小赵', '小陈'])
  await expect(page.locator(pages).nth(8).locator('.quiz-badge')).toHaveText('多选')
  await expect(page.locator(pages).nth(9).locator('.quiz-badge')).toHaveText('填空')
})

test('5.2：十页，邻接矩阵和邻接表各配一道例题；矩阵里 1 的个数、邻接表边结点个数对得上正文', async ({ page }) => {
  await page.goto('ch05/5-2')
  await expect(page.locator(pages)).toHaveCount(10)
  const titles = ['要记下什么', '邻接矩阵', '例题：统计每个顶点的度', '大多是0的时候', '邻接表', '例题：有向图的出度和入度', '其他存法', '两种存法比一比', '练习1', '练习2']
  for (const [i, text] of titles.entries()) await expect(page.locator(pages).nth(i).locator('h3.para-title')).toContainText(text)
  // 6 条边的无向图：矩阵 12 个 1，每行的度 2 3 3 2 2
  const mats = page.locator(pages).nth(1).locator('.matrix-figure')
  await expect(mats.first().locator('text.one')).toHaveCount(12)
  await expect(mats.nth(2).locator('.sum')).toHaveText(['2', '3', '3', '2', '2'])
  // 邻接表 12 个边结点；有向图里指向 2 的边结点有 2 个
  const lists = page.locator(pages).nth(4).locator('.adjlist-figure')
  await expect(lists.first().locator('.enode')).toHaveCount(12)
  await expect(lists.last().locator('.enode.on')).toHaveCount(2)
  await expect(page.locator(pages).nth(8).locator('.quiz-badge')).toHaveText('填空')
  await expect(page.locator(pages).nth(9).locator('.quiz-badge')).toHaveText('单选')
})

test('5.3：六页，深度优先、广度优先各一步一图；两种序列的访问序号对得上正文', async ({ page }) => {
  await page.goto('ch05/5-3')
  await expect(page.locator(pages)).toHaveCount(6)
  const titles = ['走遍一张图', '深度优先遍历', '广度优先遍历', '例题：输出深度优先和广度优先序列', '练习1', '练习2']
  for (const [i, text] of titles.entries()) await expect(page.locator(pages).nth(i).locator('h3.para-title')).toContainText(text)
  // 深度优先 0 1 3 2 5 4：最后一张图里，顶点 0～5 依次是第 1 2 4 3 6 5 个，走过 5 条边
  const dfs = page.locator(pages).nth(1).locator('.graph-figure').last()
  await expect(dfs.locator('.tag')).toHaveText(['1', '2', '4', '3', '6', '5'])
  await expect(dfs.locator('.edge.on')).toHaveCount(5)
  // 广度优先 0 1 2 3 5 4：顶点 0～5 依次是第 1 2 3 4 6 5 个
  const bfs = page.locator(pages).nth(2).locator('.graph-figure').last()
  await expect(bfs.locator('.tag')).toHaveText(['1', '2', '3', '4', '6', '5'])
  await expect(page.locator(pages).nth(4).locator('.quiz-badge')).toHaveText('填空')
  await expect(page.locator(pages).nth(5).locator('.quiz-badge')).toHaveText('单选')
})
