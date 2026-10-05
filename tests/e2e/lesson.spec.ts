import { expect, test } from '@playwright/test'

// 节内分页与练习题：用 2.1（五页：问题 / 概念 / 例题 / 练习1 / 练习2）
const PAGE = 'ch02/2-1'
const pages = '.lesson-page'
const next = '.lesson-nav .lesson-btn.primary'

test('翻页：继续 → #p2…#p5，刷新后停在原页；页底上一节/下一节只在最后一页出现', async ({ page }) => {
  await page.goto(PAGE)
  await expect(page.locator(pages)).toHaveCount(5)
  await expect(page.locator(pages).nth(0)).toBeVisible()
  await expect(page.locator(pages).nth(1)).toBeHidden()
  await expect(page.locator('.VPDocFooter')).toBeHidden()

  for (const n of [2, 3, 4]) {
    await page.locator(next).click()
    await expect(page).toHaveURL(new RegExp(`/ch02/2-1#p${n}$`))
    await expect(page.locator(pages).nth(n - 1)).toBeVisible()
    await expect(page.locator('.VPDocFooter')).toBeHidden()
  }
  await page.locator(next).click()
  await expect(page).toHaveURL(/\/ch02\/2-1#p5$/)
  await expect(page.locator(next)).toHaveCount(0)
  await expect(page.locator('.VPDocFooter')).toBeVisible()

  await page.reload()
  await expect(page.locator(pages).nth(4)).toBeVisible()

  await page.locator('.lesson-nav .lesson-btn', { hasText: '上一页' }).click()
  await expect(page).toHaveURL(/#p4$/)
  await expect(page.locator(pages).nth(3)).toBeVisible()
})

test('← → 先翻页，翻到最后一页再翻节', async ({ page }) => {
  await page.goto(PAGE)
  await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(/#p2$/)
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator(pages).nth(0)).toBeVisible()
  await expect(page).toHaveURL(/\/ch02\/2-1$/)
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(/#p5$/)
  await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(/\/ch02\/2-2$/)
})

test('每页一个标题，进右栏目录；地址是 #p3 或指向某页标题时直接打开那一页', async ({ page }) => {
  await page.goto(`${PAGE}#p3`)
  await expect(page.locator(pages).nth(2)).toBeVisible()

  for (let i = 0; i < 5; i++) await expect(page.locator(pages).nth(i).locator('h3.para-title')).toHaveCount(1)
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

  await page.goto('ch02/2-8')
  await expect(page.locator('.vp-doc h1')).not.toHaveClass(/lesson-section-title/)
  expect((await page.locator('.vp-doc h1').boundingBox())!.width).toBeGreaterThan(100)
})

test('例题页：题目卡片 → 分析 → 答案卡片', async ({ page }) => {
  await page.goto(`${PAGE}#p3`)
  const ex = page.locator(pages).nth(2)
  await expect(ex.locator('blockquote.milestone-problem')).toHaveCount(1)
  await expect(ex.locator('blockquote.milestone-answer')).toHaveCount(1)
  await expect(ex.locator('blockquote.milestone-answer')).toBeVisible()
  // 「分析」是段首加粗，不进右栏目录：本页只有页标题一个小标题
  await expect(ex.locator('h3')).toHaveCount(1)
})

test('多选题：选错 → 只标出选错的并给解析；看答案 → 标出全部正确选项和整题解析', async ({ page }) => {
  await page.goto(`${PAGE}#p4`)
  const quiz = page.locator(pages).nth(3).locator('.quiz')
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
  await page.goto(`${PAGE}#p5`)
  const quiz = page.locator(pages).nth(4).locator('.quiz')
  await expect(quiz.locator('.quiz-badge')).toHaveText('单选')
  await quiz.locator('.quiz-option').nth(1).click()
  await quiz.locator('.lesson-btn', { hasText: '检查' }).click()
  await expect(quiz.locator('.quiz-feedback')).toHaveText('答对了。')
  await page.reload()
  await expect(page.locator(pages).nth(4).locator('.quiz')).toHaveClass(/is-right/)
})

test('2.2：六页，节名隐藏；例题有题目卡片和答案卡片，第5、6页各一道题', async ({ page }) => {
  await page.goto('ch02/2-2')
  await expect(page.locator(pages)).toHaveCount(6)
  await expect(page.locator('.vp-doc h1')).toHaveClass(/lesson-section-title/)
  for (let i = 0; i < 6; i++) await expect(page.locator(pages).nth(i).locator('h3.para-title')).toHaveCount(1)
  const ex = page.locator(pages).nth(3)
  await expect(ex.locator('blockquote.milestone-problem')).toHaveCount(1)
  await expect(ex.locator('blockquote.milestone-answer')).toHaveCount(1)
  await expect(page.locator(pages).nth(4).locator('.quiz-badge')).toHaveText('单选')
  await expect(page.locator(pages).nth(5).locator('.quiz-badge')).toHaveText('多选')
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
