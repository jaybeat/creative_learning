-- 数据迁移（不改表结构）：2026-10-27 第3章表达式两节重排。
-- 改版前：3.6「后缀表达式求值」7 页（算一个式子、把运算符写在后面、读到哪算到哪、先弹出的是右边的数、写成函数、练习1、练习2）；
--         3.7「中缀表达式转后缀表达式」6 页（人写的是中缀式、运算符什么时候写出去、括号、写成函数接上Eval、练习1、练习2）。
-- 改版后：3.6「中缀表达式转后缀表达式」8 页（算一个式子、后缀表达式、手工转换：加括号法、练习1（写成后缀式）、程序转换：从左往右读、程序转换：括号、写成程序、练习2（栈里是什么））；
--         3.7「后缀表达式求值」6 页（读到哪算到哪、先弹出的是右边的数、写成函数、接成计算器、练习1、练习2）。
-- 页的去向：
--   原 3.6 第1、2页不动；第3–5页 → 3.7 第1–3页；练习1（第6页）→ 3.7 第5页；
--   原 3.6 练习2（中缀式写成后缀式，已删）→ 3.6 第4页（同类的手工转换练习）；
--   原 3.7 第1、2页 → 3.6 第5页；第3页 → 第6页；第4页（写成函数）→ 第7页；练习1（栈里是什么）→ 第8页；练习2（写成后缀式）→ 第4页；
--   挂在节上（heading_id 为空或等于节号）的评论都留在 3.6：两节的问题都在 3.6 开头。
-- 原 3.6 要挪去 3.7、原 3.7 要挪来 3.6，先把原 3.6 的那几页挪到临时路径，保证一条评论不会被挪两次。

-- 1. 原 3.6 的求值页 → 临时路径
UPDATE comments
SET page_path = '/ch03/_3-7',
    heading_id = CASE heading_id WHEN '3-6-p3' THEN '3-7-p1' WHEN '3-6-p4' THEN '3-7-p2' WHEN '3-6-p5' THEN '3-7-p3' ELSE '3-7-p5' END
WHERE page_path = '/ch03/3-6' AND heading_id IN ('3-6-p3', '3-6-p4', '3-6-p5', '3-6-p6');

-- 2. 原 3.6 练习2 → 3.6 第4页（原 3.6 第4页已在第1步挪走）
UPDATE comments SET heading_id = '3-6-p4' WHERE page_path = '/ch03/3-6' AND heading_id = '3-6-p7';

-- 3. 原 3.7 → 3.6
UPDATE comments
SET page_path = '/ch03/3-6',
    heading_id = CASE heading_id
      WHEN '3-7-p1' THEN '3-6-p5' WHEN '3-7-p2' THEN '3-6-p5' WHEN '3-7-p3' THEN '3-6-p6'
      WHEN '3-7-p4' THEN '3-6-p7' WHEN '3-7-p5' THEN '3-6-p8' WHEN '3-7-p6' THEN '3-6-p4'
      WHEN '3-7' THEN '3-6' ELSE heading_id END
WHERE page_path = '/ch03/3-7';

-- 4. 临时路径 → 3.7
UPDATE comments SET page_path = '/ch03/3-7' WHERE page_path = '/ch03/_3-7';

-- 5. 标题跟着换
UPDATE comments SET page_title = '3.6 栈的应用：中缀表达式转后缀表达式' WHERE page_path = '/ch03/3-6';
UPDATE comments SET page_title = '3.7 栈的应用：后缀表达式求值' WHERE page_path = '/ch03/3-7';

-- 6. 回复跟着顶层评论走：上面只按页号挪了顶层评论，回复（没有 heading_id）的页要对齐到它的上级
UPDATE comments c
SET page_path = p.page_path, page_title = p.page_title
FROM comments p
WHERE c.parent_id = p.id AND c.page_path <> p.page_path;
