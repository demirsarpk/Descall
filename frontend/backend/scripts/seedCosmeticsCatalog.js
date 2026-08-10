"use strict";

/**
 * Seeds the expanded cosmetics catalog: many more banners / avatar frames /
 * profile backgrounds / themes, plus five brand-new categories (badges,
 * titles, name effects, avatar effects, chat bubble skins). Idempotent —
 * upserts by `sku`, so re-running only fills in items that don't exist yet.
 *
 * Usage: node scripts/seedCosmeticsCatalog.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function b64svg(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function stars(count, w, h) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const cx = Math.round(Math.random() * w);
    const cy = Math.round(Math.random() * h);
    const r = (Math.random() * 1.4 + 0.4).toFixed(1);
    const o = (Math.random() * 0.5 + 0.35).toFixed(2);
    out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" opacity="${o}" />`;
  }
  return out;
}

/** A wide banner gradient (600x200), optionally sprinkled with stars. */
function banner(id, stops, withStars = false) {
  const grad = stops.map((s) => `<stop offset="${s.o}" stop-color="${s.c}" />`).join("");
  return b64svg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200" viewBox="0 0 600 200">` +
      `<defs><linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">${grad}</linearGradient></defs>` +
      `<rect width="600" height="200" fill="url(#${id})" />` +
      (withStars ? stars(60, 600, 200) : "") +
      `</svg>`
  );
}

/** A circular ring frame (256x256, 118 radius, 14 stroke) for avatars. */
function frame(id, stops) {
  const grad = stops.map((s) => `<stop offset="${s.o}" stop-color="${s.c}" />`).join("");
  return b64svg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">` +
      `<defs><linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">${grad}</linearGradient></defs>` +
      `<circle cx="128" cy="128" r="118" fill="none" stroke="url(#${id})" stroke-width="14" />` +
      `</svg>`
  );
}

/** A full-page background gradient (800x600), optionally sprinkled with stars. */
function background(id, stops, withStars = true) {
  const grad = stops.map((s) => `<stop offset="${s.o}" stop-color="${s.c}" />`).join("");
  return b64svg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">` +
      `<defs><linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">${grad}</linearGradient></defs>` +
      `<rect width="800" height="600" fill="url(#${id})" />` +
      (withStars ? stars(90, 800, 600) : "") +
      `</svg>`
  );
}

/** A UI theme swatch preview (400x150) — matches the existing theme items' style. */
function theme(id, stops) {
  const grad = stops.map((s) => `<stop offset="${s.o}" stop-color="${s.c}" />`).join("");
  return b64svg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="150" viewBox="0 0 400 150">` +
      `<defs><linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">${grad}</linearGradient></defs>` +
      `<rect width="400" height="150" fill="url(#${id})" />` +
      `</svg>`
  );
}

const ITEMS = [
  // ── Banners (profile) ───────────────────────────────────────────────
  {
    sku: "banner-emerald-forest", name: "Emerald Forest", category: "banner", rarity: "rare", price_descoin: 280,
    description: "Deep, mossy greens for a nature-inspired banner.",
    asset_url: banner("emerald", [{ o: "0%", c: "#013220" }, { o: "50%", c: "#0b6b3a" }, { o: "100%", c: "#2ecc71" }]),
  },
  {
    sku: "banner-royal-velvet", name: "Royal Velvet", category: "banner", rarity: "epic", price_descoin: 380,
    description: "Regal purple and gold for a luxurious profile banner.",
    asset_url: banner("velvet", [{ o: "0%", c: "#1a0933" }, { o: "55%", c: "#4b1d8f" }, { o: "100%", c: "#d4af37" }]),
  },
  {
    sku: "banner-cherry-blossom", name: "Cherry Blossom", category: "banner", rarity: "rare", price_descoin: 260,
    description: "Soft pink petals drifting across a pale gradient.",
    asset_url: banner("cherry", [{ o: "0%", c: "#ffb7c5" }, { o: "50%", c: "#ff8fab" }, { o: "100%", c: "#fff0f5" }], true),
  },
  {
    sku: "banner-solar-flare", name: "Solar Flare", category: "banner", rarity: "epic", price_descoin: 400,
    description: "An intense burst of orange and red, like a solar storm.",
    asset_url: banner("solarflare", [{ o: "0%", c: "#3d0000" }, { o: "45%", c: "#ff3c00" }, { o: "100%", c: "#ffcc00" }]),
  },
  {
    sku: "banner-arctic-frost", name: "Arctic Frost", category: "banner", rarity: "common", price_descoin: 220,
    description: "Cool icy blues for a clean, crisp banner.",
    asset_url: banner("arctic", [{ o: "0%", c: "#0b2545" }, { o: "60%", c: "#13315c" }, { o: "100%", c: "#8ecae6" }]),
  },
  {
    sku: "banner-toxic-slime", name: "Toxic Slime", category: "banner", rarity: "rare", price_descoin: 300,
    description: "A radioactive green glow with a dark, gritty base.",
    asset_url: banner("toxic", [{ o: "0%", c: "#0d1a0d" }, { o: "50%", c: "#1f4d1f" }, { o: "100%", c: "#7fff00" }]),
  },
  {
    sku: "banner-galaxy-swirl", name: "Galaxy Swirl", category: "banner", rarity: "legendary", price_descoin: 500,
    description: "A swirling galaxy of violet and blue, dusted with stars.",
    asset_url: banner("galaxyswirl", [{ o: "0%", c: "#0f0026" }, { o: "50%", c: "#3a0ca3" }, { o: "100%", c: "#4361ee" }], true),
  },

  // ── Avatar frames ────────────────────────────────────────────────────
  {
    sku: "frame-emerald-loop", name: "Emerald Loop", category: "avatar_frame", rarity: "rare", price_descoin: 280,
    description: "A polished emerald-green ring around your avatar.",
    asset_url: frame("emerald-ring", [{ o: "0%", c: "#00c853" }, { o: "50%", c: "#00e676" }, { o: "100%", c: "#00c853" }]),
  },
  {
    sku: "frame-crimson-blaze", name: "Crimson Blaze", category: "avatar_frame", rarity: "epic", price_descoin: 340,
    description: "A fiery red-to-orange ring that looks like it's burning.",
    asset_url: frame("crimson-ring", [{ o: "0%", c: "#8b0000" }, { o: "50%", c: "#ff4500" }, { o: "100%", c: "#8b0000" }]),
  },
  {
    sku: "frame-silver-chain", name: "Silver Chain", category: "avatar_frame", rarity: "common", price_descoin: 200,
    description: "A clean brushed-silver ring for a classic look.",
    asset_url: frame("silver-ring", [{ o: "0%", c: "#c0c0c0" }, { o: "50%", c: "#eeeeee" }, { o: "100%", c: "#a9a9a9" }]),
  },
  {
    sku: "frame-royal-purple", name: "Royal Purple", category: "avatar_frame", rarity: "epic", price_descoin: 340,
    description: "A deep violet ring fit for royalty.",
    asset_url: frame("royal-ring", [{ o: "0%", c: "#4b0082" }, { o: "50%", c: "#9370db" }, { o: "100%", c: "#4b0082" }]),
  },
  {
    sku: "frame-toxic-ring", name: "Toxic Ring", category: "avatar_frame", rarity: "rare", price_descoin: 280,
    description: "A glowing acid-green ring with a dark edge.",
    asset_url: frame("toxic-ring", [{ o: "0%", c: "#0d1a0d" }, { o: "50%", c: "#7fff00" }, { o: "100%", c: "#0d1a0d" }]),
  },
  {
    sku: "frame-rainbow-prism", name: "Rainbow Prism", category: "avatar_frame", rarity: "legendary", price_descoin: 480,
    description: "A full-spectrum gradient ring that shifts through every color.",
    asset_url: frame("rainbow-ring", [
      { o: "0%", c: "#ff0000" }, { o: "20%", c: "#ff9900" }, { o: "40%", c: "#33ff00" },
      { o: "60%", c: "#00ffff" }, { o: "80%", c: "#3300ff" }, { o: "100%", c: "#ff00cc" },
    ]),
  },

  // ── Profile backgrounds ──────────────────────────────────────────────
  {
    sku: "background-ocean-depths", name: "Ocean Depths", category: "profile_background", rarity: "epic", price_descoin: 350,
    description: "Deep blue waters with drifting bubbles for your profile page.",
    asset_url: background("oceandepths", [{ o: "0%", c: "#00131f" }, { o: "50%", c: "#023e5c" }, { o: "100%", c: "#0582ca" }]),
  },
  {
    sku: "background-cherry-grove", name: "Cherry Grove", category: "profile_background", rarity: "rare", price_descoin: 300,
    description: "A dreamy pink-and-white grove full of falling petals.",
    asset_url: background("cherrygrove", [{ o: "0%", c: "#3d1f2b" }, { o: "50%", c: "#a4536b" }, { o: "100%", c: "#ffc2d1" }]),
  },
  {
    sku: "background-neon-city", name: "Neon City", category: "profile_background", rarity: "epic", price_descoin: 380,
    description: "A cyberpunk skyline of magenta and violet neon.",
    asset_url: background("neoncity", [{ o: "0%", c: "#0a001f" }, { o: "50%", c: "#5b0e8b" }, { o: "100%", c: "#ff00c8" }]),
  },
  {
    sku: "background-forest-canopy", name: "Forest Canopy", category: "profile_background", rarity: "rare", price_descoin: 300,
    description: "Sun-dappled greens beneath a dense forest canopy.",
    asset_url: background("forestcanopy", [{ o: "0%", c: "#0b1f0d" }, { o: "50%", c: "#1f4d2e" }, { o: "100%", c: "#4caf50" }]),
  },
  {
    sku: "background-desert-dusk", name: "Desert Dusk", category: "profile_background", rarity: "common", price_descoin: 240,
    description: "Warm oranges fading into dusky purple, like a desert sunset.",
    asset_url: background("desertdusk", [{ o: "0%", c: "#2b1055" }, { o: "50%", c: "#7b3f61" }, { o: "100%", c: "#f6a35c" }], false),
  },
  {
    sku: "background-aurora-sky", name: "Aurora Sky", category: "profile_background", rarity: "legendary", price_descoin: 480,
    description: "A shimmering teal-to-violet sky lit by aurora and stars.",
    asset_url: background("aurorasky", [{ o: "0%", c: "#001219" }, { o: "45%", c: "#005f73" }, { o: "100%", c: "#94d2bd" }]),
  },
  {
    sku: "background-volcanic-ash", name: "Volcanic Ash", category: "profile_background", rarity: "epic", price_descoin: 360,
    description: "Smouldering embers drifting over a bed of volcanic ash.",
    asset_url: background("volcanicash", [{ o: "0%", c: "#0a0a0a" }, { o: "50%", c: "#4a0e0e" }, { o: "100%", c: "#ff5722" }]),
  },

  // ── Premium themes (whole-app) ───────────────────────────────────────
  {
    sku: "theme-emerald", name: "Emerald", category: "theme", rarity: "epic", price_descoin: 450, theme_key: "emerald",
    description: "A rich emerald-green and black look for the whole app.",
    asset_url: theme("g", [{ o: "0%", c: "#031f13" }, { o: "50%", c: "#0f3d24" }, { o: "100%", c: "#2ecc71" }]),
  },
  {
    sku: "theme-sakura", name: "Sakura", category: "theme", rarity: "epic", price_descoin: 450, theme_key: "sakura",
    description: "A soft, blossom-pink look for the whole app.",
    asset_url: theme("g", [{ o: "0%", c: "#1a1015" }, { o: "50%", c: "#3d2531" }, { o: "100%", c: "#ff8fab" }]),
  },
  {
    sku: "theme-solar", name: "Solar", category: "theme", rarity: "epic", price_descoin: 450, theme_key: "solar",
    description: "A warm amber-and-charcoal look for the whole app.",
    asset_url: theme("g", [{ o: "0%", c: "#1a1207" }, { o: "50%", c: "#3d2b0f" }, { o: "100%", c: "#f9a826" }]),
  },

  // ── Profile badges (small icon next to display name) ─────────────────
  { sku: "badge-crown", name: "Crown", category: "profile_badge", rarity: "legendary", price_descoin: 500, badge_icon: "👑", description: "A golden crown badge for the truly elite." },
  { sku: "badge-diamond", name: "Diamond", category: "profile_badge", rarity: "epic", price_descoin: 400, badge_icon: "💎", description: "A sparkling diamond badge." },
  { sku: "badge-star", name: "Star", category: "profile_badge", rarity: "rare", price_descoin: 250, badge_icon: "⭐", description: "A shining star badge." },
  { sku: "badge-flame", name: "Flame", category: "profile_badge", rarity: "rare", price_descoin: 250, badge_icon: "🔥", description: "A blazing flame badge." },
  { sku: "badge-skull", name: "Skull", category: "profile_badge", rarity: "epic", price_descoin: 350, badge_icon: "💀", description: "A fearless skull badge." },
  { sku: "badge-rocket", name: "Rocket", category: "profile_badge", rarity: "rare", price_descoin: 280, badge_icon: "🚀", description: "A rocket badge for the ambitious." },
  { sku: "badge-trophy", name: "Trophy", category: "profile_badge", rarity: "epic", price_descoin: 380, badge_icon: "🏆", description: "A champion's trophy badge." },
  { sku: "badge-ghost", name: "Ghost", category: "profile_badge", rarity: "rare", price_descoin: 260, badge_icon: "👻", description: "A playful ghost badge." },
  { sku: "badge-butterfly", name: "Butterfly", category: "profile_badge", rarity: "common", price_descoin: 180, badge_icon: "🦋", description: "A delicate butterfly badge." },
  { sku: "badge-comet", name: "Comet", category: "profile_badge", rarity: "legendary", price_descoin: 450, badge_icon: "☄️", description: "A blazing comet badge for legends." },

  // ── Profile titles (flair text under display name) ───────────────────
  { sku: "title-elite", name: "Elite", category: "profile_title", rarity: "epic", price_descoin: 350, title_text: "🔥 Elite", description: "Show everyone you're among the elite." },
  { sku: "title-legend", name: "Legend", category: "profile_title", rarity: "legendary", price_descoin: 500, title_text: "⚡ Legend", description: "For those who've earned legendary status." },
  { sku: "title-royalty", name: "Royalty", category: "profile_title", rarity: "legendary", price_descoin: 480, title_text: "👑 Royalty", description: "Wear your crown with this title." },
  { sku: "title-night-owl", name: "Night Owl", category: "profile_title", rarity: "rare", price_descoin: 260, title_text: "🌙 Night Owl", description: "For the ones always online at 3am." },
  { sku: "title-diamond-hands", name: "Diamond Hands", category: "profile_title", rarity: "epic", price_descoin: 360, title_text: "💎 Diamond Hands", description: "Never folds, never sells." },
  { sku: "title-rocket-rider", name: "Rocket Rider", category: "profile_title", rarity: "rare", price_descoin: 280, title_text: "🚀 Rocket Rider", description: "Always aiming for the moon." },
  { sku: "title-sharpshooter", name: "Sharpshooter", category: "profile_title", rarity: "rare", price_descoin: 270, title_text: "🎯 Sharpshooter", description: "Precise, and proud of it." },
  { sku: "title-lone-wolf", name: "Lone Wolf", category: "profile_title", rarity: "epic", price_descoin: 340, title_text: "🐺 Lone Wolf", description: "Runs solo, hits hard." },
  { sku: "title-social-butterfly", name: "Social Butterfly", category: "profile_title", rarity: "common", price_descoin: 200, title_text: "🦋 Social Butterfly", description: "Knows everyone, everywhere." },
  { sku: "title-comet-chaser", name: "Comet Chaser", category: "profile_title", rarity: "legendary", price_descoin: 460, title_text: "☄️ Comet Chaser", description: "Chasing greatness across the sky." },

  // ── Name effects (animated display-name styling) ─────────────────────
  { sku: "name-effect-fire", name: "Fire Gradient", category: "name_effect", rarity: "epic", price_descoin: 380, effect_key: "fire", description: "Your name burns in a shifting red-orange gradient." },
  { sku: "name-effect-rainbow", name: "Rainbow Shift", category: "name_effect", rarity: "legendary", price_descoin: 500, effect_key: "rainbow", description: "Your name cycles smoothly through every color." },
  { sku: "name-effect-neon", name: "Neon Glow", category: "name_effect", rarity: "epic", price_descoin: 360, effect_key: "neon", description: "A pulsing cyan neon glow around your name." },
  { sku: "name-effect-gold-shimmer", name: "Golden Shimmer", category: "name_effect", rarity: "rare", price_descoin: 300, effect_key: "gold-shimmer", description: "A shimmering gold sheen sweeps across your name." },
  { sku: "name-effect-ice", name: "Ice Frost", category: "name_effect", rarity: "rare", price_descoin: 280, effect_key: "ice", description: "A frosty blue-white gradient, cool and crisp." },
  { sku: "name-effect-void", name: "Void Static", category: "name_effect", rarity: "legendary", price_descoin: 480, effect_key: "void", description: "A flickering violet-black glitch effect." },

  // ── Avatar effects (animated ring/overlay around your avatar) ────────
  { sku: "avatar-effect-pulse", name: "Pulse Glow", category: "avatar_effect", rarity: "rare", price_descoin: 300, effect_key: "pulse", description: "A soft glow that pulses around your avatar." },
  { sku: "avatar-effect-orbit", name: "Particle Orbit", category: "avatar_effect", rarity: "legendary", price_descoin: 500, effect_key: "orbit", description: "Tiny particles orbit continuously around your avatar." },
  { sku: "avatar-effect-spark", name: "Electric Spark", category: "avatar_effect", rarity: "epic", price_descoin: 380, effect_key: "spark", description: "Crackling electric sparks circle your avatar." },
  { sku: "avatar-effect-aurora", name: "Aurora Ring", category: "avatar_effect", rarity: "epic", price_descoin: 400, effect_key: "aurora", description: "A shifting aurora-colored ring wraps your avatar." },
  { sku: "avatar-effect-flame", name: "Flame Aura", category: "avatar_effect", rarity: "legendary", price_descoin: 480, effect_key: "flame", description: "A flickering flame aura surrounds your avatar." },
  { sku: "avatar-effect-frost", name: "Frost Aura", category: "avatar_effect", rarity: "rare", price_descoin: 320, effect_key: "frost", description: "An icy shimmer surrounds your avatar." },

  // ── Chat bubble skins (own message bubble styling) ────────────────────
  { sku: "chat-bubble-glass", name: "Glass", category: "chat_bubble", rarity: "rare", price_descoin: 260, effect_key: "glass", description: "A frosted-glass bubble with subtle blur." },
  { sku: "chat-bubble-neon-outline", name: "Neon Outline", category: "chat_bubble", rarity: "epic", price_descoin: 340, effect_key: "neon-outline", description: "A glowing neon border around your messages." },
  { sku: "chat-bubble-sunset", name: "Sunset Gradient", category: "chat_bubble", rarity: "epic", price_descoin: 360, effect_key: "sunset", description: "A warm sunset gradient fills your message bubbles." },
  { sku: "chat-bubble-carbon", name: "Carbon", category: "chat_bubble", rarity: "common", price_descoin: 200, effect_key: "carbon", description: "A sleek matte-black carbon-fiber texture." },
  { sku: "chat-bubble-holo", name: "Holographic", category: "chat_bubble", rarity: "legendary", price_descoin: 480, effect_key: "holo", description: "An iridescent holographic sheen on every message." },
  { sku: "chat-bubble-royal-purple", name: "Royal Purple", category: "chat_bubble", rarity: "rare", price_descoin: 280, effect_key: "royal-purple", description: "A rich royal-purple gradient bubble." },
];

async function main() {
  let created = 0;
  let skipped = 0;
  for (const [i, item] of ITEMS.entries()) {
    const { data: existing } = await supabase.from("shop_items").select("id").eq("sku", item.sku).maybeSingle();
    if (existing) {
      skipped += 1;
      continue;
    }
    const { error } = await supabase.from("shop_items").insert({
      sku: item.sku,
      name: item.name,
      description: item.description || null,
      category: item.category,
      asset_url: item.asset_url || "data:,",
      preview_url: item.asset_url || null,
      price_descoin: item.price_descoin,
      theme_key: item.theme_key || null,
      badge_icon: item.badge_icon || null,
      title_text: item.title_text || null,
      effect_key: item.effect_key || null,
      rarity: item.rarity || "common",
      sort_order: i,
      active: true,
    });
    if (error) {
      console.error(`FAILED: ${item.sku} — ${error.message}`);
    } else {
      created += 1;
    }
  }
  console.log(`Seed complete: ${created} created, ${skipped} already existed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
