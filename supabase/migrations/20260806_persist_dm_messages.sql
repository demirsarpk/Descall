-- Persist direct-message history independently of the backend process.
CREATE TABLE IF NOT EXISTS public.dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  mime_type TEXT,
  file_size BIGINT,
  original_name TEXT,
  duration INTEGER,
  reply_to JSONB,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  edited_at TIMESTAMPTZ,
  edit_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Existing deployments may have the legacy table from migration_v2.sql.
ALTER TABLE public.dm_messages ADD COLUMN IF NOT EXISTS duration INTEGER;
ALTER TABLE public.dm_messages ADD COLUMN IF NOT EXISTS reply_to JSONB;
ALTER TABLE public.dm_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE public.dm_messages ADD COLUMN IF NOT EXISTS edit_history JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_dm_messages_sender_recipient_created
  ON public.dm_messages (from_user_id, to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_messages_recipient_sender_created
  ON public.dm_messages (to_user_id, from_user_id, created_at DESC);

ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dm_messages FROM anon, authenticated;
