-- 数据迁移（不改表结构）：2026-11-09 第4章树的存储拆成两节。
-- 改版前：4.3「树的存储与实现」10 页（记双亲、记孩子、孩子兄弟表示法、三种存法比一比、用C语言表示树、
--         InsertChild、DeleteSubtree、把八个操作合起来、练习1（存一棵小树）、练习2（摘下来时少了一步））。
-- 改版后：4.3「树的存储结构」8 页（记双亲、记孩子、下一个兄弟记在哪里、一步一步变过去、两个指针就够了、
--         三种存法比一比、练习1（存一棵小树）、练习2（绿色、紫色、橙色各几条））；
--         4.4「树的存储结构的实现」8 页（双亲表示法、孩子表示法、孩子兄弟表示法（结构体和读操作）、InsertChild、
--         DeleteSubtree、把八个操作合起来、练习1（加两个孩子之后）、练习2（摘下来时少了一步））。
-- 页的去向：
--   第1、2页不动；第3页（孩子兄弟表示法：数指针、parent、教材的写法）→ 4.3 第5页；第4页 → 4.3 第6页；
--   第5–8页 → 4.4 第3–6页；练习1 → 4.3 第7页；练习2 → 4.4 第8页；
--   挂在节上（heading_id 为空或等于节号）的评论留在 4.3。
-- 原来没有 4.4，一条 UPDATE 按原页号算出新位置，不会挪两次。

-- 1. 按页挪
UPDATE comments
SET page_path = CASE WHEN heading_id IN ('4-3-p5', '4-3-p6', '4-3-p7', '4-3-p8', '4-3-p10') THEN '/ch04/4-4' ELSE '/ch04/4-3' END,
    heading_id = CASE heading_id
      WHEN '4-3-p3' THEN '4-3-p5' WHEN '4-3-p4' THEN '4-3-p6'
      WHEN '4-3-p5' THEN '4-4-p3' WHEN '4-3-p6' THEN '4-4-p4' WHEN '4-3-p7' THEN '4-4-p5' WHEN '4-3-p8' THEN '4-4-p6'
      WHEN '4-3-p9' THEN '4-3-p7' WHEN '4-3-p10' THEN '4-4-p8'
      ELSE heading_id END
WHERE page_path = '/ch04/4-3';

-- 2. 标题跟着换
UPDATE comments SET page_title = '4.3 树的存储结构' WHERE page_path = '/ch04/4-3';
UPDATE comments SET page_title = '4.4 树的存储结构的实现' WHERE page_path = '/ch04/4-4';

-- 3. 回复跟着顶层评论走：上面只按页号挪了顶层评论，回复（没有 heading_id）的页要对齐到它的上级
UPDATE comments c
SET page_path = p.page_path, page_title = p.page_title
FROM comments p
WHERE c.parent_id = p.id AND c.page_path <> p.page_path;
