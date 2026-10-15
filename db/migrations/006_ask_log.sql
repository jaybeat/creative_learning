-- 问 AI：每次提问记一行，用于每人每日额度、全站每日上限和成本核算；不存问答内容

CREATE TABLE ask_log (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  page text NOT NULL,
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ask_log_user_idx ON ask_log (user_id, created_at DESC);

CREATE INDEX ask_log_created_idx ON ask_log (created_at DESC);
