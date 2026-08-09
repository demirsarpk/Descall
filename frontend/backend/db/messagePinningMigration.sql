-- Message pinning — pin/unpin metadata for DM and group messages.
-- Applied directly to Supabase via MCP; kept here for local reference.

ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;
ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;
ALTER TABLE group_messages ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dm_messages_pinned ON dm_messages(pinned_at) WHERE pinned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_group_messages_pinned ON group_messages(pinned_at) WHERE pinned_at IS NOT NULL;
