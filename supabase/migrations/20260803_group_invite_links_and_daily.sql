-- Group invite links + daily casino claim
CREATE TABLE IF NOT EXISTS group_invite_links (
  code TEXT PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL,
  max_uses INTEGER,
  uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_invite_links_group ON group_invite_links(group_id);

ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS last_daily_claim TIMESTAMPTZ;
