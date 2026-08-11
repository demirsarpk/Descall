-- Supabase SQL Editor — paste & run once
-- Makes user status (Online / Idle / DND / Invisible) persist across reconnects.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS presence_status TEXT DEFAULT 'online';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_presence_status_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_presence_status_check
      CHECK (presence_status IS NULL OR presence_status IN ('online', 'idle', 'dnd', 'invisible'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_presence_status ON users (presence_status);
