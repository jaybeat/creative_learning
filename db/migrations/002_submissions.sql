-- 练习题的代码提交。本期只保存，评测（status / result / judged_at）留给第二期

CREATE TABLE submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  problem_id text NOT NULL,               -- 如 ch02-ex-1，与题目页 frontmatter 的 problemId 一致
  language text NOT NULL DEFAULT 'c',
  code text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | judging | accepted | wrong_answer | compile_error | runtime_error | time_limit
  result jsonb,                           -- 评测明细（第二期）
  created_at timestamptz NOT NULL DEFAULT now(),
  judged_at timestamptz
);

CREATE INDEX submissions_user_problem_idx ON submissions (user_id, problem_id, created_at DESC);
