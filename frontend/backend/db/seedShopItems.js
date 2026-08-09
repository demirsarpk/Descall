"use strict";

/**
 * Seeds a small starter cosmetics catalog (banners, avatar frames, profile
 * backgrounds). Assets are self-contained inline SVG data URIs — no external
 * image hosting/CDN needed, so this works in any environment without extra
 * setup. Safe to re-run: uses `sku` as the natural key and upserts.
 *
 * Usage: node db/seedShopItems.js
 */

if (require.main === module) {
  require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
}

const supabase = require("./supabase");

function svgDataUri(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function bannerSvg({ id, stops, pattern }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200" viewBox="0 0 600 200">
  <defs>
    <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      ${stops.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}" />`).join("")}
    </linearGradient>
  </defs>
  <rect width="600" height="200" fill="url(#${id})" />
  ${pattern || ""}
</svg>`;
}

function starsPattern(count, seedBase) {
  let out = "";
  let seed = seedBase;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < count; i++) {
    const x = Math.round(rand() * 600);
    const y = Math.round(rand() * 200);
    const r = (rand() * 1.4 + 0.4).toFixed(1);
    const o = (rand() * 0.6 + 0.3).toFixed(2);
    out += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o}" />`;
  }
  return out;
}

function ringFrameSvg({ id, stops }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      ${stops.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}" />`).join("")}
    </linearGradient>
  </defs>
  <circle cx="128" cy="128" r="118" fill="none" stroke="url(#${id})" stroke-width="14" />
</svg>`;
}

function backgroundSvg({ id, stops, pattern }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      ${stops.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}" />`).join("")}
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#${id})" />
  ${pattern || ""}
</svg>`;
}

const ITEMS = [
  {
    sku: "banner-aurora",
    name: "Aurora Borealis",
    description: "A shimmering aurora gradient for your profile banner.",
    category: "banner",
    price_cents: 399,
    currency: "usd",
    rarity: "rare",
    sort_order: 0,
    svg: bannerSvg({
      id: "aurora",
      stops: [
        { offset: "0%", color: "#0f2027" },
        { offset: "45%", color: "#2c5364" },
        { offset: "75%", color: "#38ef7d" },
        { offset: "100%", color: "#a8ff78" },
      ],
    }),
  },
  {
    sku: "banner-sunset",
    name: "Sunset Glow",
    description: "Warm sunset tones to make your profile stand out.",
    category: "banner",
    price_cents: 299,
    currency: "usd",
    rarity: "common",
    sort_order: 1,
    svg: bannerSvg({
      id: "sunset",
      stops: [
        { offset: "0%", color: "#ff512f" },
        { offset: "50%", color: "#f09819" },
        { offset: "100%", color: "#ff2d55" },
      ],
    }),
  },
  {
    sku: "banner-nebula",
    name: "Midnight Nebula",
    description: "A deep-space banner with a scattering of stars.",
    category: "banner",
    price_cents: 599,
    currency: "usd",
    rarity: "epic",
    sort_order: 2,
    svg: bannerSvg({
      id: "nebula",
      stops: [
        { offset: "0%", color: "#0f0c29" },
        { offset: "50%", color: "#302b63" },
        { offset: "100%", color: "#24243e" },
      ],
      pattern: starsPattern(60, 42),
    }),
  },
  {
    sku: "frame-gold",
    name: "Gold Ring",
    description: "An elegant gold ring around your avatar.",
    category: "avatar_frame",
    price_cents: 349,
    currency: "usd",
    rarity: "rare",
    sort_order: 0,
    svg: ringFrameSvg({
      id: "gold-ring",
      stops: [
        { offset: "0%", color: "#f6d365" },
        { offset: "50%", color: "#fda085" },
        { offset: "100%", color: "#f6d365" },
      ],
    }),
  },
  {
    sku: "frame-neon",
    name: "Neon Pulse",
    description: "A vivid cyan-to-magenta neon ring.",
    category: "avatar_frame",
    price_cents: 349,
    currency: "usd",
    rarity: "epic",
    sort_order: 1,
    svg: ringFrameSvg({
      id: "neon-ring",
      stops: [
        { offset: "0%", color: "#00f2fe" },
        { offset: "50%", color: "#4facfe" },
        { offset: "100%", color: "#ff00cc" },
      ],
    }),
  },
  {
    sku: "background-cosmic",
    name: "Cosmic Drift",
    description: "A full-page cosmic gradient with drifting stars for your profile background.",
    category: "profile_background",
    price_cents: 699,
    currency: "usd",
    rarity: "legendary",
    sort_order: 0,
    svg: backgroundSvg({
      id: "cosmic",
      stops: [
        { offset: "0%", color: "#000428" },
        { offset: "100%", color: "#004e92" },
      ],
      pattern: starsPattern(140, 7),
    }),
  },
];

async function seed() {
  for (const item of ITEMS) {
    const { svg, ...rest } = item;
    const assetUrl = svgDataUri(svg);
    const { error } = await supabase.from("shop_items").upsert(
      {
        ...rest,
        asset_url: assetUrl,
        preview_url: assetUrl,
        active: true,
      },
      { onConflict: "sku" }
    );
    if (error) {
      console.error(`[seedShopItems] Failed to upsert ${item.sku}:`, error.message);
    } else {
      console.log(`[seedShopItems] Upserted ${item.sku}`);
    }
  }
  console.log("[seedShopItems] Done.");
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seed, ITEMS };
