-- DesCoin in-app currency: server-authoritative wallet + audit ledger.
-- Replaces the abandoned Stripe real-money shop with an earn-by-activity
-- economy (voice talk time, messaging, screen sharing). Applied directly to
-- Supabase via MCP; kept here for local reference.

ALTER TABLE users ADD COLUMN IF NOT EXISTS descoin_balance INTEGER NOT NULL DEFAULT 0 CHECK (descoin_balance >= 0);
ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_theme_id UUID REFERENCES shop_items(id) ON DELETE SET NULL;

-- Every balance change (credit or debit) is logged here — this is the
-- anti-cheat backbone: earning routes sum recent rows before crediting more,
-- so a client can never push its own balance up without a matching,
-- rate-limited, server-verified ledger entry.
CREATE TABLE IF NOT EXISTS descoin_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- positive = credit, negative = debit
  reason TEXT NOT NULL CHECK (reason IN (
    'voice_activity', 'screenshare_activity', 'message_activity',
    'shop_purchase', 'admin_grant', 'admin_revoke'
  )),
  meta JSONB,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_descoin_ledger_user_created ON descoin_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_descoin_ledger_user_reason_created ON descoin_ledger(user_id, reason, created_at DESC);

ALTER TABLE descoin_ledger DISABLE ROW LEVEL SECURITY;

-- Shop: add DesCoin pricing + a 'theme' category for premium UI themes.
-- price_cents/currency/stripe_* columns stay for historical rows but are no
-- longer written by the app — everything new goes through price_descoin.
ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS price_descoin INTEGER NOT NULL DEFAULT 0 CHECK (price_descoin >= 0);
ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS theme_key TEXT;

ALTER TABLE shop_items DROP CONSTRAINT IF EXISTS shop_items_category_check;
ALTER TABLE shop_items ADD CONSTRAINT shop_items_category_check
  CHECK (category IN ('banner','avatar_frame','profile_background','theme'));

ALTER TABLE shop_purchases ALTER COLUMN amount_cents DROP NOT NULL;
ALTER TABLE shop_purchases ADD COLUMN IF NOT EXISTS amount_descoin INTEGER;

-- New items (esp. premium themes) are created without a USD price at all —
-- price_cents predates DesCoin and must stop being required.
ALTER TABLE shop_items ALTER COLUMN price_cents DROP NOT NULL;
ALTER TABLE shop_items ALTER COLUMN currency DROP NOT NULL;
