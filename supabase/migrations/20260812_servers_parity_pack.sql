-- Discord parity pack: app commands, moderation, hierarchy support, community fields.

ALTER TABLE public.server_members
  ADD COLUMN IF NOT EXISTS timeout_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS timeout_reason TEXT,
  ADD COLUMN IF NOT EXISTS timed_out_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notification_level TEXT NOT NULL DEFAULT 'all'
    CHECK (notification_level IN ('all', 'mentions', 'muted')),
  ADD COLUMN IF NOT EXISTS rules_accepted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_server_members_timeout_until
  ON public.server_members(server_id, timeout_until)
  WHERE timeout_until IS NOT NULL;

ALTER TABLE public.servers
  ADD COLUMN IF NOT EXISTS community_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rules_channel_id UUID REFERENCES public.server_channels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rules_text TEXT,
  ADD COLUMN IF NOT EXISTS splash_url TEXT,
  ADD COLUMN IF NOT EXISTS verification_level TEXT NOT NULL DEFAULT 'none'
    CHECK (verification_level IN ('none', 'low', 'medium', 'high', 'highest'));

ALTER TABLE public.server_channels
  DROP CONSTRAINT IF EXISTS server_channels_type_check;

ALTER TABLE public.server_channels
  ADD CONSTRAINT server_channels_type_check
  CHECK (type IN ('text', 'voice', 'stage', 'category'));
