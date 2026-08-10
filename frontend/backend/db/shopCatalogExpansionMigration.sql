-- Expands the cosmetics catalog with 5 new categories beyond the original
-- banner / avatar_frame / profile_background / theme set, plus lets admin
-- DesCoin grants carry a message + celebratory popup like item gifts.
-- Applied directly to Supabase via MCP; kept here for local reference.

-- ── New equip slots on users ────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_badge_id UUID REFERENCES shop_items(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_title_id UUID REFERENCES shop_items(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_name_effect_id UUID REFERENCES shop_items(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_avatar_effect_id UUID REFERENCES shop_items(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_chat_bubble_id UUID REFERENCES shop_items(id) ON DELETE SET NULL;

-- ── New item metadata columns ───────────────────────────────────────────
-- badge_icon: emoji shown next to the display name (profile_badge items)
-- title_text: flair text shown under the display name (profile_title items)
-- effect_key: CSS animation/skin class key, reused across name_effect,
--             avatar_effect, and chat_bubble items (one item = one category,
--             so there's no ambiguity in sharing this column)
ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS badge_icon TEXT;
ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS title_text TEXT;
ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS effect_key TEXT;

ALTER TABLE shop_items DROP CONSTRAINT IF EXISTS shop_items_category_check;
ALTER TABLE shop_items ADD CONSTRAINT shop_items_category_check
  CHECK (category IN (
    'banner','avatar_frame','profile_background','theme',
    'profile_badge','profile_title','name_effect','avatar_effect','chat_bubble'
  ));

-- ── DesCoin grants with a message behave like item gifts ───────────────
-- notified_at mirrors user_inventory's deferred-gift-popup pattern: NULL
-- until the recipient's socket has actually shown the celebratory popup,
-- so an offline grant still gets a popup the moment they next connect.
ALTER TABLE descoin_ledger ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE descoin_ledger ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_descoin_ledger_unnotified
  ON descoin_ledger(user_id) WHERE notified_at IS NULL AND message IS NOT NULL;
