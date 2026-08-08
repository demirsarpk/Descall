ALTER TABLE public.user_feedback
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS app_version TEXT,
  ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS email_provider_id TEXT,
  ADD COLUMN IF NOT EXISTS email_error TEXT,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_feedback_email_status_created
  ON public.user_feedback (email_status, created_at DESC);

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_feedback FROM anon, authenticated;
