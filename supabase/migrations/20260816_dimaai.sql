-- DimaAI conversations, messages, and server-side provider key pool.
-- Backend uses the Supabase service role; RLS stays on with no anon policies.

CREATE TABLE IF NOT EXISTS public.dimaai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dimaai_conversations_user_updated
  ON public.dimaai_conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.dimaai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.dimaai_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dimaai_messages_conversation_created
  ON public.dimaai_messages (conversation_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.dimaai_provider_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL DEFAULT 'Provider key',
  encrypted_secret TEXT NOT NULL,
  key_prefix TEXT NOT NULL DEFAULT '',
  key_suffix TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_preferred BOOLEAN NOT NULL DEFAULT FALSE,
  failover_order INTEGER NOT NULL DEFAULT 100,
  last_ok_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dimaai_provider_keys_order
  ON public.dimaai_provider_keys (enabled DESC, is_preferred DESC, failover_order ASC, created_at ASC);

ALTER TABLE public.dimaai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dimaai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dimaai_provider_keys ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.dimaai_conversations FROM anon, authenticated;
REVOKE ALL ON TABLE public.dimaai_messages FROM anon, authenticated;
REVOKE ALL ON TABLE public.dimaai_provider_keys FROM anon, authenticated;
GRANT ALL ON TABLE public.dimaai_conversations TO service_role;
GRANT ALL ON TABLE public.dimaai_messages TO service_role;
GRANT ALL ON TABLE public.dimaai_provider_keys TO service_role;
