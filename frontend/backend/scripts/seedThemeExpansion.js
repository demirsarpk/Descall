"use strict";

/**
 * Seeds 24 brand-new premium app themes (gradient / neon / glow families),
 * on top of the existing 6 (midnight, crimson, ocean, emerald, sakura,
 * solar) — bringing the sellable theme catalog to 30. Also adds a handful
 * of extra banners, avatar frames, profile backgrounds, badges and titles
 * to further round out the catalog. Idempotent — upserts by `sku`, so
 * re-running only fills in items that don't exist yet.
 *
 * Usage: node scripts/seedThemeExpansion.js
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

function frame(id, stops) {
  const grad = stops.map((s) => `<stop offset="${s.o}" stop-color="${s.c}" />`).join("");
  return b64svg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">` +
      `<defs><linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">${grad}</linearGradient></defs>` +
      `<circle cx="128" cy="128" r="118" fill="none" stroke="url(#${id})" stroke-width="14" />` +
      `</svg>`
  );
}

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

function themeAsset(s0, s3, primary) {
  return theme("g", [{ o: "0%", c: s0 }, { o: "50%", c: s3 }, { o: "100%", c: primary }]);
}

const THEME_ITEMS = [
  // ── Gradient family (8) — smooth two-tone hues ──
  { key: "aurora", name: "Aurora", price: 340, colors: ["#091315", "#1A373D", "#A96AF0"], desc: "A teal-to-violet aurora gradient washes over the whole app." },
  { key: "sunset", name: "Sunset Boulevard", price: 350, colors: ["#150913", "#3D1A36", "#F59247"], desc: "Warm sunset orange fading into dusky violet." },
  { key: "cottoncandy", name: "Cotton Candy", price: 320, colors: ["#110A15", "#311C3B", "#F094F0"], desc: "A playful pink-and-lavender gradient, soft and sweet." },
  { key: "peach", name: "Peach Fizz", price: 320, colors: ["#160B09", "#3E1E19", "#F59166"], desc: "Bright peach and coral tones for a warm, cheerful look." },
  { key: "lavender", name: "Lavender Dream", price: 330, colors: ["#0E0A15", "#271D3A", "#B190EA"], desc: "A dreamy purple-and-lilac gradient, calm and elegant." },
  { key: "mint", name: "Mint Breeze", price: 330, colors: ["#091514", "#1B3C3A", "#5CE0BD"], desc: "Cool mint and teal tones for a fresh, breezy feel." },
  { key: "rosegold", name: "Rose Gold", price: 360, colors: ["#150E0A", "#3A271D", "#E88273"], desc: "A refined rose-and-gold gradient with a luxe finish." },
  { key: "deepspace", name: "Deep Space", price: 350, colors: ["#0A0916", "#1C183E", "#6E56E6"], desc: "Indigo and violet like the depths of open space." },

  // ── Neon family (8) — vivid saturated accents on near-black ──
  { key: "neontokyo", name: "Neon Tokyo", price: 420, colors: ["#0C0C13", "#222235", "#FB41B7"], desc: "Blazing magenta neon against a near-black skyline." },
  { key: "cyberpunk", name: "Cyberpunk", price: 430, colors: ["#130C13", "#362136", "#FDE12B"], desc: "Electric yellow neon over a magenta-tinted dark base." },
  { key: "vaporwave", name: "Vaporwave", price: 400, colors: ["#130B13", "#372037", "#45DAF7"], desc: "Retro cyan neon on a moody purple backdrop." },
  { key: "neonjungle", name: "Neon Jungle", price: 410, colors: ["#0C130D", "#223525", "#51F628"], desc: "An acid-green neon glow, sharp and electric." },
  { key: "electricviolet", name: "Electric Violet", price: 420, colors: ["#0F0C13", "#2B2136", "#AB41FB"], desc: "A striking violet neon that crackles with energy." },
  { key: "toxicgreen", name: "Toxic Green", price: 400, colors: ["#0F120C", "#2B3423", "#82FA19"], desc: "A radioactive green glow, bold and unmistakable." },
  { key: "neonblaze", name: "Neon Blaze", price: 420, colors: ["#130D0C", "#362421", "#FB5D2D"], desc: "Fiery orange-red neon, hot and high-contrast." },
  { key: "hyperdrive", name: "Hyperdrive", price: 430, colors: ["#0C0E13", "#212836", "#37A0FB"], desc: "A crisp electric-blue neon that feels fast and futuristic." },

  // ── Glowing / special family (6) — animated pulsing glow across the UI ──
  { key: "phoenixfire", name: "Phoenix Fire", price: 600, colors: ["#160C08", "#3F2117", "#F66631"], desc: "Glowing embers that pulse across buttons and active tabs, like the app itself is breathing fire.", rarity: "mythic" },
  { key: "frostbite", name: "Frostbite", price: 580, colors: ["#091115", "#1A313D", "#5CCCF5"], desc: "An icy shimmer that gently pulses through primary surfaces.", rarity: "mythic" },
  { key: "voidwalker", name: "Voidwalker", price: 650, colors: ["#0A050F", "#261339", "#B73FF3"], desc: "A near-black void theme with a slow violet pulse radiating from key elements.", rarity: "mythic" },
  { key: "starlight", name: "Starlight", price: 600, colors: ["#090B16", "#191F3E", "#F6D25A"], desc: "A radiant gold glow that pulses like distant starlight.", rarity: "mythic" },
  { key: "plasmastorm", name: "Plasma Storm", price: 620, colors: ["#0B0816", "#1E173F", "#455DF7"], desc: "Blue-violet plasma that pulses through the interface like an electric storm.", rarity: "mythic" },
  { key: "moltencore", name: "Molten Core", price: 650, colors: ["#130706", "#3E1614", "#F33520"], desc: "A lava-red pulse that surges through the app's core surfaces.", rarity: "mythic" },

  // ── Earthy gradient bonus (2) ──
  { key: "goldenhour", name: "Golden Hour", price: 380, colors: ["#150F09", "#3D2A1A", "#EEB94F"], desc: "The warm golden glow of a perfect sunset." },
  { key: "desertbloom", name: "Desert Bloom", price: 360, colors: ["#150E0A", "#3A281D", "#DC7A56"], desc: "Terracotta and sand tones inspired by a blooming desert." },
];

const EXTRA_ITEMS = [
  // ── A few more banners ──
  { sku: "banner-frostfire-split", name: "Frostfire Split", category: "banner", rarity: "epic", price_descoin: 380, description: "Ice-blue meets ember-orange in one dramatic split banner.", asset_url: banner("frostfiresplit", [{ o: "0%", c: "#062d3d" }, { o: "50%", c: "#0d3b3f" }, { o: "100%", c: "#ff6a00" }]) },
  { sku: "banner-neon-dusk", name: "Neon Dusk", category: "banner", rarity: "epic", price_descoin: 360, description: "A dusky purple sky lit by streaks of neon pink.", asset_url: banner("neondusk", [{ o: "0%", c: "#1a0e2e" }, { o: "55%", c: "#5c1a63" }, { o: "100%", c: "#ff2ea6" }]) },
  { sku: "banner-golden-hour-glow", name: "Golden Hour Glow", category: "banner", rarity: "rare", price_descoin: 280, description: "Soft warm gold fading into deep amber.", asset_url: banner("goldenhourglow", [{ o: "0%", c: "#3a2408" }, { o: "50%", c: "#a5691a" }, { o: "100%", c: "#ffd166" }]) },

  // ── A few more avatar frames ──
  { sku: "frame-aurora-halo", name: "Aurora Halo", category: "avatar_frame", rarity: "legendary", price_descoin: 460, description: "A shifting teal-violet aurora ring around your avatar.", asset_url: frame("aurorahalo", [{ o: "0%", c: "#22c7d6" }, { o: "50%", c: "#a96af0" }, { o: "100%", c: "#22c7d6" }]) },
  { sku: "frame-molten-ring", name: "Molten Ring", category: "avatar_frame", rarity: "epic", price_descoin: 360, description: "A glowing lava-red ring, always simmering.", asset_url: frame("moltenring", [{ o: "0%", c: "#3d0c02" }, { o: "50%", c: "#f33520" }, { o: "100%", c: "#3d0c02" }]) },
  { sku: "frame-hyperdrive-ring", name: "Hyperdrive Ring", category: "avatar_frame", rarity: "epic", price_descoin: 340, description: "A sharp electric-blue ring with a futuristic edge.", asset_url: frame("hyperdrivering", [{ o: "0%", c: "#0c0e13" }, { o: "50%", c: "#37a0fb" }, { o: "100%", c: "#0c0e13" }]) },

  // ── A few more profile backgrounds ──
  { sku: "background-nebula-drift", name: "Nebula Drift", category: "profile_background", rarity: "legendary", price_descoin: 460, description: "A drifting violet-and-cyan nebula scattered with stars.", asset_url: background("nebuladrift", [{ o: "0%", c: "#0a0918" }, { o: "50%", c: "#432a7a" }, { o: "100%", c: "#22c7d6" }]) },
  { sku: "background-coral-reef", name: "Coral Reef", category: "profile_background", rarity: "rare", price_descoin: 300, description: "Vivid coral pinks and reef teals for a vibrant profile.", asset_url: background("coralreef", [{ o: "0%", c: "#012a2e" }, { o: "50%", c: "#0f6f66" }, { o: "100%", c: "#ff6f61" }], false) },
  { sku: "background-molten-canyon", name: "Molten Canyon", category: "profile_background", rarity: "epic", price_descoin: 380, description: "Deep canyon shadows glowing with molten light.", asset_url: background("moltencanyon", [{ o: "0%", c: "#120604" }, { o: "50%", c: "#4a1208" }, { o: "100%", c: "#f33520" }], false) },

  // ── A few more profile badges (emoji, no CSS needed) ──
  { sku: "badge-phoenix", name: "Phoenix", category: "profile_badge", rarity: "legendary", price_descoin: 480, badge_icon: "🔥🕊️", description: "A rare badge for those who always rise again." },
  { sku: "badge-wizard", name: "Wizard", category: "profile_badge", rarity: "epic", price_descoin: 360, badge_icon: "🧙", description: "For the certified masters of the arcane." },
  { sku: "badge-shield", name: "Guardian Shield", category: "profile_badge", rarity: "rare", price_descoin: 260, badge_icon: "🛡️", description: "A badge of protection and loyalty." },

  // ── A few more profile titles ──
  { sku: "title-speedrunner", name: "Speedrunner", category: "profile_title", rarity: "epic", price_descoin: 340, title_text: "⏱️ Speedrunner", description: "Always first, always fast." },
  { sku: "title-guardian", name: "Guardian", category: "profile_title", rarity: "rare", price_descoin: 270, title_text: "🛡️ Guardian", description: "Watches over friends and community alike." },
  { sku: "title-star-collector", name: "Star Collector", category: "profile_title", rarity: "legendary", price_descoin: 470, title_text: "🌟 Star Collector", description: "Collects moments worth remembering." },
];

async function upsert(item, sortOrder) {
  const { data: existing } = await supabase.from("shop_items").select("id").eq("sku", item.sku).maybeSingle();
  if (existing) return "skipped";
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
    sort_order: sortOrder,
    active: true,
  });
  if (error) {
    console.error(`FAILED: ${item.sku} — ${error.message}`);
    return "failed";
  }
  return "created";
}

async function main() {
  let created = 0;
  let skipped = 0;
  let failed = 0;

  const themeRows = THEME_ITEMS.map((t, i) => ({
    sku: `theme-${t.key}`,
    name: t.name,
    description: t.desc,
    category: "theme",
    theme_key: t.key,
    price_descoin: t.price,
    rarity: t.rarity || (t.price >= 400 ? "legendary" : "rare"),
    asset_url: themeAsset(...t.colors),
    sortOrder: 100 + i,
  }));

  for (const row of themeRows) {
    const result = await upsert(row, row.sortOrder);
    if (result === "created") created += 1;
    else if (result === "skipped") skipped += 1;
    else failed += 1;
  }

  for (const [i, item] of EXTRA_ITEMS.entries()) {
    const result = await upsert(item, 200 + i);
    if (result === "created") created += 1;
    else if (result === "skipped") skipped += 1;
    else failed += 1;
  }

  console.log(`Seed complete: ${created} created, ${skipped} already existed, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
