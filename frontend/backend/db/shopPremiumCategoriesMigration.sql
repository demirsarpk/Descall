-- Three premium interactive cosmetic categories:
-- typing_flare, reaction_burst, call_overlay.
-- Applied via Supabase MCP; kept here for local reference.

ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_typing_flare_id UUID REFERENCES shop_items(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_reaction_burst_id UUID REFERENCES shop_items(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_call_overlay_id UUID REFERENCES shop_items(id) ON DELETE SET NULL;

ALTER TABLE shop_items DROP CONSTRAINT IF EXISTS shop_items_category_check;
ALTER TABLE shop_items ADD CONSTRAINT shop_items_category_check
  CHECK (category IN (
    'banner','avatar_frame','profile_background','theme',
    'profile_badge','profile_title','name_effect','avatar_effect','chat_bubble',
    'presence_flare','profile_aura','sound_pack',
    'typing_flare','reaction_burst','call_overlay'
  ));
