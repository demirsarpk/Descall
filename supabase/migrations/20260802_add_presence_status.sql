-- Persist Discord-style presence (online / idle / dnd / invisible)
-- Run in Supabase SQL Editor if not applied via migrations.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS presence_status TEXT DEFAULT 'online';

-- Optional: constrain allowed values (safe if column already exists)
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

COMMENT ON COLUMN users.presence_status IS
  'Realtime presence shown to friends: online | idle | dnd | invisible';
