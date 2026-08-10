-- Records when a user accepted the Terms of Service / Privacy Policy at
-- registration, so we have an auditable consent timestamp per account.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
