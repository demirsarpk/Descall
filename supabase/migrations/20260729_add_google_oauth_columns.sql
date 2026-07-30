-- Google OAuth support for custom JWT auth (Descall)
-- password_hash must be nullable for Google-only accounts

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS google_id TEXT,
  ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'local';

ALTER TABLE public.users
  ALTER COLUMN password_hash DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_uidx
  ON public.users (google_id)
  WHERE google_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_uidx
  ON public.users (lower(email))
  WHERE email IS NOT NULL;
