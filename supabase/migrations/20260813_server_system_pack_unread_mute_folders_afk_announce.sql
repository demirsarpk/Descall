-- Server system pack: unread, mutes, folders, AFK/welcome, announcement channels
-- Applied remotely via Supabase MCP (2026-08-13).

CREATE TABLE IF NOT EXISTS server_channel_mutes (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES server_channels(id) ON DELETE CASCADE,
  muted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, channel_id)
);
CREATE INDEX IF NOT EXISTS server_channel_mutes_user_idx ON server_channel_mutes(user_id);

CREATE TABLE IF NOT EXISTS server_channel_reads (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES server_channels(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_message_id UUID NULL,
  unread_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, channel_id)
);
CREATE INDEX IF NOT EXISTS server_channel_reads_user_idx ON server_channel_reads(user_id);

CREATE TABLE IF NOT EXISTS server_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 40),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS server_folders_user_pos_idx ON server_folders(user_id, position);

ALTER TABLE server_members
  ADD COLUMN IF NOT EXISTS folder_id UUID NULL REFERENCES server_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS temporary BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS afk_channel_id UUID NULL,
  ADD COLUMN IF NOT EXISTS afk_timeout_seconds INTEGER NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS system_channel_id UUID NULL,
  ADD COLUMN IF NOT EXISTS welcome_channel_id UUID NULL;

ALTER TABLE server_channels DROP CONSTRAINT IF EXISTS server_channels_type_check;
ALTER TABLE server_channels
  ADD CONSTRAINT server_channels_type_check
  CHECK (type = ANY (ARRAY['text'::text, 'voice'::text, 'stage'::text, 'category'::text, 'announcement'::text]));
