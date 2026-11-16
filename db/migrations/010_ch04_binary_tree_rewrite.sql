-- 数据迁移（不改表结构）：2026-11-16 第4章二叉树重写，拆成两节。
-- 改版前：4.5「二叉树」8 页（把树转成二叉树、什么是二叉树、只有一个孩子的时候、叶子比度为2的结点多一个、
--         例题（淘汰赛和文件夹）、练习1（哪些可以看成二叉树）、练习2（(5-2)*3）、练习3（3个结点的形态））。
-- 改版后：4.5「二叉树」9 页（什么是二叉树、左孩子和右孩子、五种基本形态、只有一个孩子的时候、
--         二叉树和度为2的有序树、例题（3个结点的形态）、练习1、练习2、练习3（4个结点排成一条链））；
--         4.6「二叉树的性质」9 页（第i层最多几个结点、总共最多几个结点、满二叉树、完全二叉树、
--         叶子比度为2的结点多一个、例题（8个人的淘汰赛）、练习1、练习2、练习3）。
-- 页的去向：
--   第1页（树转二叉树）挪到遍历之后再讲，评论改挂在 4.5 节上（heading_id 置空）；
--   第2页 → 4.5 第1页；第3页 → 4.5 第4页；第4页 → 4.6 第5页；第5页 → 4.6 第6页；
--   第6、7页 → 4.5 第7、8页；第8页（3个结点的形态）→ 4.5 第6页（改成了例题）。
-- 原来没有 4.6，一条 UPDATE 按原页号算出新位置，不会挪两次。

-- 1. 按页挪
UPDATE comments
SET page_path = CASE WHEN heading_id IN ('4-5-p4', '4-5-p5') THEN '/ch04/4-6' ELSE '/ch04/4-5' END,
    heading_id = CASE heading_id
      WHEN '4-5-p1' THEN NULL
      WHEN '4-5-p2' THEN '4-5-p1' WHEN '4-5-p3' THEN '4-5-p4'
      WHEN '4-5-p4' THEN '4-6-p5' WHEN '4-5-p5' THEN '4-6-p6'
      WHEN '4-5-p6' THEN '4-5-p7' WHEN '4-5-p7' THEN '4-5-p8' WHEN '4-5-p8' THEN '4-5-p6'
      ELSE heading_id END
WHERE page_path = '/ch04/4-5';

-- 2. 标题跟着换（4.5 的标题没变）
UPDATE comments SET page_title = '4.6 二叉树的性质' WHERE page_path = '/ch04/4-6';

-- 3. 回复跟着顶层评论走
UPDATE comments c
SET page_path = p.page_path, page_title = p.page_title
FROM comments p
WHERE c.parent_id = p.id AND c.page_path <> p.page_path;
