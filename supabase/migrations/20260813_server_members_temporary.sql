-- Temporary invite membership: removed when user goes fully offline.
ALTER TABLE public.server_members
  ADD COLUMN IF NOT EXISTS temporary BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_server_members_temporary
  ON public.server_members(server_id, user_id)
  WHERE temporary = TRUE;
