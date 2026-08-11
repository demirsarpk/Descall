-- Growth pack: referral DesCoin rewards, daily/streak claims, native FCM tokens.
ALTER TABLE public.descoin_ledger DROP CONSTRAINT IF EXISTS descoin_ledger_reason_check;
ALTER TABLE public.descoin_ledger ADD CONSTRAINT descoin_ledger_reason_check
  CHECK (reason IN (
    'voice_activity', 'screenshare_activity', 'message_activity',
    'shop_purchase', 'admin_grant', 'admin_revoke',
    'referral_invite', 'referral_welcome', 'daily_claim', 'streak_bonus'
  ));

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS descoin_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS descoin_last_daily_claim DATE;

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  inviter_amount INTEGER NOT NULL DEFAULT 0,
  invitee_amount INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (invitee_id)
);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_inviter ON public.referral_rewards(inviter_id);
ALTER TABLE public.referral_rewards DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android',
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (token)
);
CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user ON public.device_push_tokens(user_id);
ALTER TABLE public.device_push_tokens DISABLE ROW LEVEL SECURITY;
