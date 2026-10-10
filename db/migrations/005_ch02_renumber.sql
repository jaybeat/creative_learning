-- 数据迁移（不改表结构）：2026-10 第2章按"每节一个概念"改版。按改版前的节号映射到改版后的节号：
--   原 2.1（任务与分解）拆成 2.1「线性表」、2.2「线性表的操作与抽象数据类型」，
--     其中指令格式（原 2.1.1）和光标（原 2.1.3）移到 2.6「用顺序表实现编辑器」，纸上跑一遍（原 2.1.4）改写成 2.2 的例题；
--   原 2.2（顺序表）→ 2.3「顺序存储与顺序表」；
--   原 2.3（初始化、插入、取元素）、原 2.4（删除）合成 2.4「顺序表操作的实现」；
--   原 2.5–2.9 节号不变（链表部分 2.10 以后的拆分与顺延见第 7 步）；原 2.5、2.6 按分页改写，小节和加粗段落标题对应到新的页。
-- 评论按 page_path（/ch02/2-8）和 heading_id（2-8、2-8-1、2-8-p1）挂在节上，要跟着内容一起挪，否则会出现在错误的页面上。
-- 分页改写后没有带编号的小节，挪进去的评论 heading_id 置空（它只是定位时的同分优先提示，置空后仍按引文定位）。
-- 步骤顺序不能换：每一步都只挪还没被挪过的评论（先把目标位置上的原评论挪走，再挪别处的评论进来）。

-- 1. 原 2.3、2.4 → 2.4
UPDATE comments
SET page_path = '/ch02/2-4', heading_id = NULL
WHERE page_path IN ('/ch02/2-3', '/ch02/2-4');

-- 2. 原 2.2 → 2.3。原加粗段落 p1–p6（内存长什么样 / 最直接的放法 / 还差一样东西 / 用C表示 / 装成一个整体 / 验证）
--    对应新的页标题 p1、p2、p2、p3、p3、p4
UPDATE comments
SET page_path = '/ch02/2-3',
    heading_id = CASE
      WHEN heading_id ~ '^2-2-p[1-6]$'
        THEN '2-3-p' || (ARRAY[1, 2, 2, 3, 3, 4])[substring(heading_id from '^2-2-p([1-6])$')::int]
      ELSE NULL
    END
WHERE page_path = '/ch02/2-2';

-- 2b. 原 2.5（把L变成参数）→ 2.5「传值与传地址」，节号不变，分页改写：
--     原 2.5.1（直接传结构体，跨第1–3页）→ 第1页，2.5.2（地址与指针）→ 第4页，2.5.3 → 第5页，2.5.4（两个表）→ 第6页
UPDATE comments
SET heading_id = CASE heading_id
      WHEN '2-5-1' THEN '2-5-p1'
      WHEN '2-5-2' THEN '2-5-p4'
      WHEN '2-5-3' THEN '2-5-p5'
      WHEN '2-5-4' THEN '2-5-p6'
    END
WHERE page_path = '/ch02/2-5' AND heading_id IN ('2-5-1', '2-5-2', '2-5-3', '2-5-4');

-- 3. 原 2.6（编辑器1.0）节号不变，分页改写成「用顺序表实现编辑器」：
--    原来的两个加粗段落（程序的骨架 p1、验证 p2）都在新的第5页「把指令合在一起」
UPDATE comments
SET heading_id = '2-6-p5'
WHERE page_path = '/ch02/2-6' AND heading_id ~ '^2-6-p[0-9]+$';

-- 3b. 原 2.7（顺序表的时间复杂度）节号不变，分页改写：原加粗段落
--     p1 先数一个例子 → 第2页（插入和删除），p2 只看趋势 → 第1页，p3 五个操作 → 第2页，p4 回到编辑器 → 第3页
UPDATE comments
SET heading_id = CASE heading_id
      WHEN '2-7-p1' THEN '2-7-p2'
      WHEN '2-7-p2' THEN '2-7-p1'
      WHEN '2-7-p3' THEN '2-7-p2'
      WHEN '2-7-p4' THEN '2-7-p3'
    END
WHERE page_path = '/ch02/2-7' AND heading_id IN ('2-7-p1', '2-7-p2', '2-7-p3', '2-7-p4');

-- 4. 原 2.1.1（指令）→ 2.6 第1页「编辑器要做什么」（2-6-p1）；原 2.1.3（光标、指令落到操作上）→ 2.6，跨第2–4页，heading 置空
UPDATE comments
SET page_path = '/ch02/2-6', heading_id = '2-6-p1'
WHERE page_path = '/ch02/2-1' AND heading_id = '2-1-1';

UPDATE comments
SET page_path = '/ch02/2-6', heading_id = NULL
WHERE page_path = '/ch02/2-1' AND heading_id = '2-1-3';

-- 5. 原 2.1.4（纸上跑一遍）→ 2.2（改写成例题）
UPDATE comments
SET page_path = '/ch02/2-2', heading_id = NULL
WHERE page_path = '/ch02/2-1' AND heading_id = '2-1-4';

-- 6. 原 2.1.2 前半（线性表的定义）留在 2.1，后半（五个操作、抽象数据类型）移到 2.2；按引文判断
UPDATE comments
SET page_path = '/ch02/2-2', heading_id = NULL
WHERE page_path = '/ch02/2-1' AND heading_id = '2-1-2'
  AND quote_exact ~ '(Init|Length|Get|Insert|Delete|操作|抽象数据类型|前提|追加)';

UPDATE comments
SET heading_id = NULL
WHERE page_path = '/ch02/2-1' AND heading_id = '2-1-2';

-- 7. 链表部分（2026-10-09）：原 2.10 拆成 2.10「链表的初始化与读取」、2.11「链表的插入」、2.12「链表的删除」；
--    原 2.11 的删除并入 2.12，头结点成为 2.13；原 2.12–2.15 内容不变，顺延成 2.14–2.17，小节号跟着换。
--    按节号从大到小挪，一条评论不会被挪两次。
UPDATE comments
SET page_path = '/ch02/2-17', heading_id = regexp_replace(heading_id, '^2-15', '2-17')
WHERE page_path = '/ch02/2-15';

UPDATE comments
SET page_path = '/ch02/2-16', heading_id = regexp_replace(heading_id, '^2-14', '2-16')
WHERE page_path = '/ch02/2-14';

UPDATE comments
SET page_path = '/ch02/2-15', heading_id = regexp_replace(heading_id, '^2-13', '2-15')
WHERE page_path = '/ch02/2-13';

UPDATE comments
SET page_path = '/ch02/2-14', heading_id = regexp_replace(heading_id, '^2-12', '2-14')
WHERE page_path = '/ch02/2-12';

-- 7b. 原 2.11：2.11.3 头结点 → 2.13（分页改写，heading 置空）；其余（删除、验证、没有小节的）→ 2.12（heading 置空）
UPDATE comments
SET page_path = '/ch02/2-13', heading_id = NULL
WHERE page_path = '/ch02/2-11' AND heading_id = '2-11-3';

UPDATE comments
SET page_path = '/ch02/2-12', heading_id = NULL
WHERE page_path = '/ch02/2-11';

-- 7c. 2.9 分页改写，原小节 2.9.1、2.9.2 的 heading 置空；原 2.10.1（LinkList）的内容已移到 2.9
UPDATE comments
SET heading_id = NULL
WHERE page_path = '/ch02/2-9';

UPDATE comments
SET page_path = '/ch02/2-9', heading_id = NULL
WHERE page_path = '/ch02/2-10' AND heading_id = '2-10-1';

-- 7d. 原 2.10.3、2.10.4（插入、验证）→ 2.11；其余留在 2.10（分页改写，heading 置空）
UPDATE comments
SET page_path = '/ch02/2-11', heading_id = NULL
WHERE page_path = '/ch02/2-10' AND heading_id IN ('2-10-3', '2-10-4');

UPDATE comments
SET heading_id = NULL
WHERE page_path = '/ch02/2-10';

-- 7e. 2.14「用链表实现编辑器」分页改写（原 2.12 编辑器2.0）。原加粗段落 p1 一个预测、p2 改动 → 第2页「先预测：只改类型名」，
--     p3 验证 → 第3页，p4 为什么能这样 → 第4页（第 7 步已把它们挪成 2-14-p1…p4）
UPDATE comments
SET heading_id = '2-14-p2'
WHERE page_path = '/ch02/2-14' AND heading_id IN ('2-14-p1', '2-14-p2');

-- 7f. 2.15「链表的时间复杂度」分页改写（原 2.13）。原加粗段落 p1 数什么、p2 逐个操作 → 第1页，
--     p3 和顺序表放在一起 → 第2页，p4 回到编辑器 → 第3页（第 7 步已把它们挪成 2-15-p1…p4）
UPDATE comments
SET heading_id = CASE heading_id
      WHEN '2-15-p1' THEN '2-15-p1'
      WHEN '2-15-p2' THEN '2-15-p1'
      WHEN '2-15-p3' THEN '2-15-p2'
      WHEN '2-15-p4' THEN '2-15-p3'
    END
WHERE page_path = '/ch02/2-15' AND heading_id IN ('2-15-p1', '2-15-p2', '2-15-p3', '2-15-p4');
