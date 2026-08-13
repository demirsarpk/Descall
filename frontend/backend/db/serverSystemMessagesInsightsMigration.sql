-- Persistent system messages + voice sessions for Server Insights
-- Mirror of supabase/migrations/20260814_server_system_messages_insights.sql

ALTER TABLE public.server_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS system_kind TEXT NULL,
  ADD COLUMN IF NOT EXISTS system_meta JSONB NULL;

ALTER TABLE public.server_messages
  ALTER COLUMN sender_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_server_messages_server_type_created
  ON public.server_messages(server_id, message_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_server_messages_system_kind
  ON public.server_messages(server_id, system_kind, created_at DESC)
  WHERE message_type = 'system';

CREATE TABLE IF NOT EXISTS public.server_voice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.server_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL,
  left_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_seconds INTEGER NOT NULL DEFAULT 0
    CHECK (duration_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS idx_server_voice_sessions_server_joined
  ON public.server_voice_sessions(server_id, joined_at DESC);

CREATE INDEX IF NOT EXISTS idx_server_voice_sessions_user_joined
  ON public.server_voice_sessions(user_id, joined_at DESC);

ALTER TABLE public.server_voice_sessions DISABLE ROW LEVEL SECURITY;
