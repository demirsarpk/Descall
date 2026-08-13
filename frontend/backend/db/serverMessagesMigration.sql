-- Server channel text messages (Step 4)
CREATE TABLE IF NOT EXISTS public.server_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.server_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  reply_to JSONB,
  edited_at TIMESTAMPTZ,
  pinned_at TIMESTAMPTZ,
  pinned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_server_messages_channel_created
  ON public.server_messages(channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_server_messages_server_created
  ON public.server_messages(server_id, created_at DESC);

ALTER TABLE public.server_messages DISABLE ROW LEVEL SECURITY;
