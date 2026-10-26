-- 数据迁移（不改表结构）：2026-10-20 第2章链表部分改结构。按改版前的节号、页号映射到改版后的：
--   2.9「链式存储与链表」只讲概念和得失：原第3页（用C语言表示链表）、第4页（输出链表）和练习2、3（第6、7页）
--     移到新插入的 2.10「链表的C语言实现」（第1、3、4、5页）；原练习1（第5页）成为 2.9 第4页；
--   原 2.10–2.14 内容不变，顺延成 2.11–2.15，小节号和页号跟着换；
--   原 2.15「链表的时间复杂度」删掉：它的练习2（第5页）成为 2.16 第5页，其余并进 2.16 问题页（第1页）；
--   2.16 在练习前多了一题，原第5–7页（练习1–3）顺延成第6–8页；2.17–2.20 不变。
-- 评论按 page_path（/ch02/2-12）和 heading_id（2-12、2-12-1、2-12-p1）挂在节上，要跟着内容一起挪；
-- page_title 是发评论时页面的标题（「2.12 链表的插入」），回复提醒邮件里会显示，一起改成新标题。
-- 步骤顺序不能换，保证一条评论不会被挪两次：
--   先给 2.16 的练习页腾位置，再把原 2.15 挪进 2.16，再按节号从大到小顺延 2.14…2.10，
--   最后把原 2.9 的代码页挪进（已经空出来的）2.10。

-- 1. 2.16 练习页顺延：p7→p8、p6→p7、p5→p6（从大到小）
UPDATE comments SET heading_id = '2-16-p8' WHERE page_path = '/ch02/2-16' AND heading_id = '2-16-p7';
UPDATE comments SET heading_id = '2-16-p7' WHERE page_path = '/ch02/2-16' AND heading_id = '2-16-p6';
UPDATE comments SET heading_id = '2-16-p6' WHERE page_path = '/ch02/2-16' AND heading_id = '2-16-p5';

-- 2. 原 2.15（链表的时间复杂度）→ 2.16：练习2（第5页）→ 2.16 第5页，其余 → 2.16 第1页
UPDATE comments
SET page_path = '/ch02/2-16', heading_id = CASE WHEN heading_id = '2-15-p5' THEN '2-16-p5' ELSE '2-16-p1' END, page_title = '2.16 按结点操作'
WHERE page_path = '/ch02/2-15';

-- 3. 原 2.10–2.14 → 2.11–2.15
UPDATE comments
SET page_path = '/ch02/2-15', heading_id = regexp_replace(heading_id, '^2-14', '2-15'), page_title = '2.15 用链表实现编辑器'
WHERE page_path = '/ch02/2-14';

UPDATE comments
SET page_path = '/ch02/2-14', heading_id = regexp_replace(heading_id, '^2-13', '2-14'), page_title = '2.14 头结点'
WHERE page_path = '/ch02/2-13';

UPDATE comments
SET page_path = '/ch02/2-13', heading_id = regexp_replace(heading_id, '^2-12', '2-13'), page_title = '2.13 链表的删除'
WHERE page_path = '/ch02/2-12';

UPDATE comments
SET page_path = '/ch02/2-12', heading_id = regexp_replace(heading_id, '^2-11', '2-12'), page_title = '2.12 链表的插入'
WHERE page_path = '/ch02/2-11';

UPDATE comments
SET page_path = '/ch02/2-11', heading_id = regexp_replace(heading_id, '^2-10', '2-11'), page_title = '2.11 链表的初始化与读取'
WHERE page_path = '/ch02/2-10';

-- 4. 原 2.9 的代码页和后两道练习 → 新 2.10；原练习1 → 2.9 第4页（先挪走第4页再挪第5页）
UPDATE comments
SET page_path = '/ch02/2-10',
    heading_id = CASE heading_id WHEN '2-9-p3' THEN '2-10-p1' WHEN '2-9-p4' THEN '2-10-p3' WHEN '2-9-p6' THEN '2-10-p4' ELSE '2-10-p5' END,
    page_title = '2.10 链表的C语言实现'
WHERE page_path = '/ch02/2-9' AND heading_id IN ('2-9-p3', '2-9-p4', '2-9-p6', '2-9-p7');

UPDATE comments SET heading_id = '2-9-p4' WHERE page_path = '/ch02/2-9' AND heading_id = '2-9-p5';

-- 5. 回复跟着顶层评论走：第4步只按页号挪了顶层评论，回复（没有 heading_id）的页要对齐到它的上级
UPDATE comments c
SET page_path = p.page_path, page_title = p.page_title
FROM comments p
WHERE c.parent_id = p.id AND c.page_path <> p.page_path;
