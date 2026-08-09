-- Real-money cosmetics shop: catalog, ownership, purchases, and equip state.
-- Applied directly to Supabase via MCP; kept here for local reference.

CREATE TABLE IF NOT EXISTS shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('banner','avatar_frame','profile_background')),
  asset_url TEXT NOT NULL,
  preview_url TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  rarity TEXT DEFAULT 'common',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  acquired_via TEXT NOT NULL CHECK (acquired_via IN ('purchase','gift')),
  gifted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  gift_message TEXT,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id)
);

CREATE TABLE IF NOT EXISTS shop_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_frame_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_background_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_avatar_frame_id UUID REFERENCES shop_items(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_banner_id UUID REFERENCES shop_items(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_background_id UUID REFERENCES shop_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_inventory_user ON user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_purchases_user ON shop_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_items_category ON shop_items(category) WHERE active = TRUE;

-- Consistent with this app's other backend-only tables (e.g. dm_messages):
-- all access goes through the Express service-role backend, never the
-- client-side anon key, so RLS is disabled rather than half-configured.
ALTER TABLE shop_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE shop_purchases DISABLE ROW LEVEL SECURITY;
