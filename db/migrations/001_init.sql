-- 账号、验证码、会话、评论、发信记录。迁移只做加法（向后兼容），见 server/migrate.ts

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,                      -- 小写；注销后置空
  display_name text,                      -- 首次登录后填写
  role text NOT NULL DEFAULT 'reader',    -- reader | admin（按 ADMIN_EMAILS 每次登录同步）
  notify_replies boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX users_display_name_key ON users (lower(display_name));

CREATE TABLE email_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  ip text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE INDEX email_codes_email_idx ON email_codes (email, created_at DESC);

CREATE INDEX email_codes_ip_idx ON email_codes (ip, created_at DESC);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  parent_id uuid REFERENCES comments (id),  -- 回复指向顶层评论，只允许一层
  page_path text NOT NULL,
  page_title text NOT NULL DEFAULT '',
  heading_id text,
  quote_exact text,
  quote_prefix text,
  quote_suffix text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  hidden_at timestamptz
);

CREATE INDEX comments_page_idx ON comments (page_path, created_at);

CREATE INDEX comments_parent_idx ON comments (parent_id);

CREATE INDEX comments_created_idx ON comments (created_at DESC);

-- 每封发出的邮件一行：全站每日发信熔断、回复通知节流都靠它
CREATE TABLE mail_log (
  id bigserial PRIMARY KEY,
  kind text NOT NULL,                     -- code | reply | digest
  user_id uuid,
  thread_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mail_log_created_idx ON mail_log (created_at DESC);
