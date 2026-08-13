-- Server channel message edit/pin + allow reactions on server channels
ALTER TABLE public.server_messages
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_server_messages_pinned
  ON public.server_messages(channel_id)
  WHERE pinned_at IS NOT NULL;

ALTER TABLE public.reactions DROP CONSTRAINT IF EXISTS reactions_conversation_type_check;
ALTER TABLE public.reactions
  ADD CONSTRAINT reactions_conversation_type_check
  CHECK (conversation_type IN ('dm', 'group', 'server'));

COMMENT ON COLUMN public.server_messages.edited_at IS 'Set when author edits a channel message';
COMMENT ON COLUMN public.server_messages.pinned_at IS 'Set when a message is pinned in the channel';
