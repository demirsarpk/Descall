-- Create reactions table for message emoji reactions (DM + group)
CREATE TABLE IF NOT EXISTS public.reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT NOT NULL,
  conversation_type TEXT NOT NULL CHECK (conversation_type IN ('dm', 'group')),
  conversation_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON public.reactions (message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_conversation ON public.reactions (conversation_id, conversation_type);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON public.reactions (user_id);

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reactions_select_dm" ON public.reactions;
DROP POLICY IF EXISTS "reactions_select_group" ON public.reactions;
DROP POLICY IF EXISTS "reactions_insert" ON public.reactions;
DROP POLICY IF EXISTS "reactions_delete" ON public.reactions;
DROP POLICY IF EXISTS reactions_select_all ON public.reactions;
DROP POLICY IF EXISTS reactions_insert_own ON public.reactions;
DROP POLICY IF EXISTS reactions_delete_own ON public.reactions;
DROP POLICY IF EXISTS reactions_update_own ON public.reactions;

-- Backend uses service role (bypasses RLS). Keep permissive policies for safety.
CREATE POLICY reactions_select_all ON public.reactions FOR SELECT USING (true);
CREATE POLICY reactions_insert_own ON public.reactions FOR INSERT WITH CHECK (true);
CREATE POLICY reactions_delete_own ON public.reactions FOR DELETE USING (true);
CREATE POLICY reactions_update_own ON public.reactions FOR UPDATE USING (true);
