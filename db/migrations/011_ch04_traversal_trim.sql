-- 数据迁移（不改表结构）：2026-11-16 4.8 二叉树的遍历删掉两页。
-- 改版前 11 页：三种顺序从哪来、先序、中序、后序、绕一圈写出三种序列、算式树、写成函数、例题、练习1、练习2、练习3（算式）。
-- 改版后 9 页：前四页不动；删掉"绕一圈"和"算式树"；写成函数、例题、练习1、练习2、练习3（释放用哪种顺序）顺次前移两页。
-- 页的去向：第5、6页的评论改挂在 4.8 节上（heading_id 置空）；第7–11页 → 第5–9页。
-- 每条评论只按原页号算一次新位置，不会挪两次。

UPDATE comments
SET heading_id = CASE heading_id
      WHEN '4-8-p5' THEN NULL WHEN '4-8-p6' THEN NULL
      WHEN '4-8-p7' THEN '4-8-p5' WHEN '4-8-p8' THEN '4-8-p6' WHEN '4-8-p9' THEN '4-8-p7'
      WHEN '4-8-p10' THEN '4-8-p8' WHEN '4-8-p11' THEN '4-8-p9'
      ELSE heading_id END
WHERE page_path = '/ch04/4-8';
