-- 管理员「先不发邮件」的回复：攒着，之后在 /admin 给每个读者合并成一封通知
ALTER TABLE comments ADD COLUMN IF NOT EXISTS notify_pending boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS comments_notify_pending_idx ON comments (notify_pending) WHERE notify_pending;
