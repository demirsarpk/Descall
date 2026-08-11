-- Mega catalog expansion: 3 new advanced cosmetic categories + equip slots.
-- Applied via Supabase MCP; kept here for local reference.

ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_presence_flare_id UUID REFERENCES shop_items(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_profile_aura_id UUID REFERENCES shop_items(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_sound_pack_id UUID REFERENCES shop_items(id) ON DELETE SET NULL;

ALTER TABLE shop_items DROP CONSTRAINT IF EXISTS shop_items_category_check;
ALTER TABLE shop_items ADD CONSTRAINT shop_items_category_check
  CHECK (category IN (
    'banner','avatar_frame','profile_background','theme',
    'profile_badge','profile_title','name_effect','avatar_effect','chat_bubble',
    'presence_flare','profile_aura','sound_pack'
  ));
