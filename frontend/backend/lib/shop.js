"use strict";

/**
 * Shop cosmetics catalog: items, inventory (ownership), and equip state.
 * Backed by shop_items / user_inventory tables + equipped_* columns on users
 * (see db/shopMigration.sql). All access goes through this service-role
 * backend module, matching the rest of the app's data-access pattern.
 */

const supabase = require("../db/supabase");

const EQUIP_COLUMN_BY_CATEGORY = {
  banner: "equipped_banner_id",
  avatar_frame: "equipped_avatar_frame_id",
  profile_background: "equipped_background_id",
  theme: "equipped_theme_id",
  profile_badge: "equipped_badge_id",
  profile_title: "equipped_title_id",
  name_effect: "equipped_name_effect_id",
  avatar_effect: "equipped_avatar_effect_id",
  chat_bubble: "equipped_chat_bubble_id",
  presence_flare: "equipped_presence_flare_id",
  profile_aura: "equipped_profile_aura_id",
  sound_pack: "equipped_sound_pack_id",
  typing_flare: "equipped_typing_flare_id",
  reaction_burst: "equipped_reaction_burst_id",
  call_overlay: "equipped_call_overlay_id",
};

const ITEM_COLUMNS =
  "id, sku, name, description, category, asset_url, preview_url, price_cents, currency, price_descoin, theme_key, badge_icon, title_text, effect_key, active, rarity, sort_order, created_at";

/** Browsers reject the non-standard `;utf8` data-URI parameter — normalize. */
function normalizeAssetUrl(url) {
  if (typeof url !== "string") return url;
  return url.replace(/^data:image\/svg\+xml;utf8,/i, "data:image/svg+xml;charset=utf-8,");
}

function normalizeItem(item) {
  if (!item) return item;
  return {
    ...item,
    asset_url: normalizeAssetUrl(item.asset_url),
    preview_url: normalizeAssetUrl(item.preview_url),
  };
}

async function listActiveItems() {
  const { data, error } = await supabase
    .from("shop_items")
    .select(ITEM_COLUMNS)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []).map(normalizeItem);
}

async function listAllItems() {
  const { data, error } = await supabase
    .from("shop_items")
    .select(ITEM_COLUMNS)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []).map(normalizeItem);
}

async function getItemById(itemId) {
  if (!itemId) return null;
  const { data, error } = await supabase
    .from("shop_items")
    .select(ITEM_COLUMNS)
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw error;
  return normalizeItem(data || null);
}

async function createItem(fields) {
  const payload = {
    ...fields,
    asset_url: normalizeAssetUrl(fields.asset_url),
    preview_url: normalizeAssetUrl(fields.preview_url),
  };
  const { data, error } = await supabase.from("shop_items").insert(payload).select(ITEM_COLUMNS).single();
  if (error) throw error;
  return normalizeItem(data);
}

async function updateItem(itemId, fields) {
  const payload = { ...fields };
  if ("asset_url" in payload) payload.asset_url = normalizeAssetUrl(payload.asset_url);
  if ("preview_url" in payload) payload.preview_url = normalizeAssetUrl(payload.preview_url);
  const { data, error } = await supabase
    .from("shop_items")
    .update(payload)
    .eq("id", itemId)
    .select(ITEM_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return normalizeItem(data);
}

async function getUserInventory(userId) {
  const { data, error } = await supabase
    .from("user_inventory")
    .select("id, item_id, acquired_via, gifted_by, gift_message, acquired_at")
    .eq("user_id", userId)
    .order("acquired_at", { ascending: false });
  if (error) throw error;
  const rows = data || [];
  if (!rows.length) return [];

  // Two-step fetch (instead of a Postgrest embed) keeps this portable across
  // both the real supabase-js client and the lightweight fake used in tests.
  const itemIds = [...new Set(rows.map((r) => r.item_id))];
  const { data: items, error: itemsError } = await supabase
    .from("shop_items")
    .select(ITEM_COLUMNS)
    .in("id", itemIds);
  if (itemsError) throw itemsError;
  const itemById = new Map((items || []).map((i) => [i.id, normalizeItem(i)]));

  return rows.map((row) => ({
    id: row.id,
    itemId: row.item_id,
    acquiredVia: row.acquired_via,
    giftedBy: row.gifted_by,
    giftMessage: row.gift_message,
    acquiredAt: row.acquired_at,
    item: itemById.get(row.item_id) || null,
  }));
}

async function userOwnsItem(userId, itemId) {
  const { data, error } = await supabase
    .from("user_inventory")
    .select("id")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/**
 * Add an item to a user's inventory. Idempotent — re-granting an item the
 * user already owns (e.g. a duplicate webhook delivery) is a harmless no-op.
 */
async function grantItem(userId, itemId, { acquiredVia = "purchase", giftedBy = null, giftMessage = null } = {}) {
  // Gifts get notified_at = null so the recipient's next connect (whether
  // that's right now or days later) delivers the celebratory popup exactly
  // once. Purchases don't need it -- the buyer already sees a live toast.
  const notifiedAt = acquiredVia === "gift" ? null : new Date().toISOString();
  const { data, error } = await supabase
    .from("user_inventory")
    .upsert(
      {
        user_id: userId,
        item_id: itemId,
        acquired_via: acquiredVia,
        gifted_by: giftedBy,
        gift_message: giftMessage,
        notified_at: notifiedAt,
      },
      { onConflict: "user_id,item_id", ignoreDuplicates: true }
    )
    .select("id, item_id, acquired_via, gifted_by, gift_message, acquired_at")
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Gifts granted while the recipient was offline (or gifts predating this
 * feature) that haven't been shown as a popup yet. Called on every socket
 * connect so the celebratory popup surfaces on the next login, not just
 * for admins gifting an already-online user.
 */
async function getUnnotifiedGifts(userId) {
  const { data, error } = await supabase
    .from("user_inventory")
    .select("id, item_id, gifted_by, gift_message, acquired_at")
    .eq("user_id", userId)
    .eq("acquired_via", "gift")
    .is("notified_at", null)
    .order("acquired_at", { ascending: true });
  if (error) throw error;
  const rows = data || [];
  if (!rows.length) return [];

  const itemIds = [...new Set(rows.map((r) => r.item_id))];
  const gifterIds = [...new Set(rows.map((r) => r.gifted_by).filter(Boolean))];
  const [{ data: items }, { data: gifters }] = await Promise.all([
    supabase.from("shop_items").select(ITEM_COLUMNS).in("id", itemIds),
    gifterIds.length
      ? supabase.from("users").select("id, username").in("id", gifterIds)
      : Promise.resolve({ data: [] }),
  ]);
  const itemById = new Map((items || []).map((i) => [i.id, i]));
  const gifterById = new Map((gifters || []).map((u) => [u.id, u]));

  return rows.map((row) => ({
    inventoryId: row.id,
    item: itemById.get(row.item_id) || null,
    message: row.gift_message || null,
    from: row.gifted_by ? gifterById.get(row.gifted_by) || null : null,
  }));
}

async function markGiftsNotified(inventoryIds) {
  if (!inventoryIds || !inventoryIds.length) return;
  const { error } = await supabase
    .from("user_inventory")
    .update({ notified_at: new Date().toISOString() })
    .in("id", inventoryIds);
  if (error) throw error;
}

async function equipItem(userId, category, itemId) {
  const column = EQUIP_COLUMN_BY_CATEGORY[category];
  if (!column) throw new Error(`Invalid shop category: ${category}`);
  const { error } = await supabase
    .from("users")
    .update({ [column]: itemId || null })
    .eq("id", userId);
  if (error) throw error;
}

const EQUIPPED_USER_COLUMNS =
  "equipped_avatar_frame_id, equipped_banner_id, equipped_background_id, equipped_theme_id, " +
  "equipped_badge_id, equipped_title_id, equipped_name_effect_id, equipped_avatar_effect_id, equipped_chat_bubble_id, " +
  "equipped_presence_flare_id, equipped_profile_aura_id, equipped_sound_pack_id, " +
  "equipped_typing_flare_id, equipped_reaction_burst_id, equipped_call_overlay_id";

const EMPTY_EQUIPPED = {
  avatarFrame: null,
  banner: null,
  background: null,
  theme: null,
  badge: null,
  title: null,
  nameEffect: null,
  avatarEffect: null,
  chatBubble: null,
  presenceFlare: null,
  profileAura: null,
  soundPack: null,
  typingFlare: null,
  reactionBurst: null,
  callOverlay: null,
};

/** Resolves one user's equip slots (all cosmetic categories) into full item records. */
async function getEquippedCosmeticsForUser(userId) {
  const { data: user, error } = await supabase
    .from("users")
    .select(EQUIPPED_USER_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  if (error || !user) return { ...EMPTY_EQUIPPED };

  const ids = [
    user.equipped_avatar_frame_id,
    user.equipped_banner_id,
    user.equipped_background_id,
    user.equipped_theme_id,
    user.equipped_badge_id,
    user.equipped_title_id,
    user.equipped_name_effect_id,
    user.equipped_avatar_effect_id,
    user.equipped_chat_bubble_id,
    user.equipped_presence_flare_id,
    user.equipped_profile_aura_id,
    user.equipped_sound_pack_id,
    user.equipped_typing_flare_id,
    user.equipped_reaction_burst_id,
    user.equipped_call_overlay_id,
  ].filter(Boolean);
  if (!ids.length) return { ...EMPTY_EQUIPPED };

  const { data: shopRows } = await supabase.from("shop_items").select(ITEM_COLUMNS).in("id", ids);
  const byId = new Map((shopRows || []).map((i) => [i.id, normalizeItem(i)]));
  return {
    avatarFrame: byId.get(user.equipped_avatar_frame_id) || null,
    banner: byId.get(user.equipped_banner_id) || null,
    background: byId.get(user.equipped_background_id) || null,
    theme: byId.get(user.equipped_theme_id) || null,
    badge: byId.get(user.equipped_badge_id) || null,
    title: byId.get(user.equipped_title_id) || null,
    nameEffect: byId.get(user.equipped_name_effect_id) || null,
    avatarEffect: byId.get(user.equipped_avatar_effect_id) || null,
    chatBubble: byId.get(user.equipped_chat_bubble_id) || null,
    presenceFlare: byId.get(user.equipped_presence_flare_id) || null,
    profileAura: byId.get(user.equipped_profile_aura_id) || null,
    soundPack: byId.get(user.equipped_sound_pack_id) || null,
    typingFlare: byId.get(user.equipped_typing_flare_id) || null,
    reactionBurst: byId.get(user.equipped_reaction_burst_id) || null,
    callOverlay: byId.get(user.equipped_call_overlay_id) || null,
  };
}

async function getEquippedForUsers(userIds) {
  if (!userIds || !userIds.length) return new Map();
  const { data, error } = await supabase
    .from("users")
    .select(`id, ${EQUIPPED_USER_COLUMNS}`)
    .in("id", userIds);
  if (error) throw error;
  const map = new Map();
  (data || []).forEach((u) => {
    map.set(u.id, {
      avatarFrameId: u.equipped_avatar_frame_id,
      bannerId: u.equipped_banner_id,
      backgroundId: u.equipped_background_id,
      themeId: u.equipped_theme_id,
      badgeId: u.equipped_badge_id,
      titleId: u.equipped_title_id,
      nameEffectId: u.equipped_name_effect_id,
      avatarEffectId: u.equipped_avatar_effect_id,
      chatBubbleId: u.equipped_chat_bubble_id,
      presenceFlareId: u.equipped_presence_flare_id,
      profileAuraId: u.equipped_profile_aura_id,
      soundPackId: u.equipped_sound_pack_id,
      typingFlareId: u.equipped_typing_flare_id,
      reactionBurstId: u.equipped_reaction_burst_id,
      callOverlayId: u.equipped_call_overlay_id,
    });
  });
  return map;
}

module.exports = {
  EQUIP_COLUMN_BY_CATEGORY,
  listActiveItems,
  listAllItems,
  getItemById,
  createItem,
  updateItem,
  getUserInventory,
  userOwnsItem,
  grantItem,
  getUnnotifiedGifts,
  markGiftsNotified,
  equipItem,
  getEquippedCosmeticsForUser,
  getEquippedForUsers,
};
