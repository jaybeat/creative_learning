-- 评测：提交异步评测（judging → 结论），兜底重评用 attempts / updated_at；judge_log 记录每次评测机调用，用于限流与全站每日上限

ALTER TABLE submissions ADD COLUMN attempts integer NOT NULL DEFAULT 0;

ALTER TABLE submissions ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE judge_log (
  id bigserial PRIMARY KEY,
  user_id uuid,
  kind text NOT NULL,                     -- run | submit
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX judge_log_user_idx ON judge_log (user_id, created_at DESC);

CREATE INDEX judge_log_created_idx ON judge_log (created_at DESC);
