-- Advanced admin ban & timeout moderation
-- Adds category/message/expiry fields and an audit table for moderation actions.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ban_category text,
  ADD COLUMN IF NOT EXISTS ban_reason text,
  ADD COLUMN IF NOT EXISTS ban_message text,
  ADD COLUMN IF NOT EXISTS banned_at timestamptz,
  ADD COLUMN IF NOT EXISTS banned_by uuid,
  ADD COLUMN IF NOT EXISTS ban_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS timeout_until timestamptz,
  ADD COLUMN IF NOT EXISTS timeout_category text,
  ADD COLUMN IF NOT EXISTS timeout_reason text,
  ADD COLUMN IF NOT EXISTS timeout_message text,
  ADD COLUMN IF NOT EXISTS timed_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS timed_out_by uuid;

CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  target_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  category text,
  reason text,
  message text,
  duration_seconds integer,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS moderation_actions_created_at_idx
  ON public.moderation_actions (created_at DESC);

CREATE INDEX IF NOT EXISTS moderation_actions_target_idx
  ON public.moderation_actions (target_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS users_timeout_until_idx
  ON public.users (timeout_until)
  WHERE timeout_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_ban_expires_at_idx
  ON public.users (ban_expires_at)
  WHERE is_banned = true;
