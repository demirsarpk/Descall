"use strict";

/**
 * Expands the shop catalog to ~4× current size with premium cosmetics and
 * three new categories: presence_flare, profile_aura, sound_pack.
 *
 * Idempotent upserts by `sku`.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seedCatalogMega.js
 *   node scripts/seedCatalogMega.js --sql-out /tmp/shop-mega-batches
 */

const fs = require("fs");
const path = require("path");

function sqlEscape(value) {
  if (value == null) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function svgUri(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function bannerSvg(id, colors, speckles = 0) {
  const stops = colors
    .map((c, i) => `<stop offset="${Math.round((i / Math.max(colors.length - 1, 1)) * 100)}%" stop-color="${c}"/>`)
    .join("");
  let dots = "";
  let seed = id.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0) || 1;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  for (let i = 0; i < speckles; i++) {
    dots += `<circle cx="${(rand() * 600).toFixed(1)}" cy="${(rand() * 200).toFixed(1)}" r="${(rand() * 1.6 + 0.3).toFixed(1)}" fill="#fff" opacity="${(rand() * 0.45 + 0.25).toFixed(2)}"/>`;
  }
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200" viewBox="0 0 600 200"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient></defs><rect width="600" height="200" fill="url(#${id})"/>${dots}</svg>`
  );
}

function frameSvg(id, colors, { dashed = false, double = false } = {}) {
  const stops = colors
    .map((c, i) => `<stop offset="${Math.round((i / Math.max(colors.length - 1, 1)) * 100)}%" stop-color="${c}"/>`)
    .join("");
  const dash = dashed ? ` stroke-dasharray="18 10"` : "";
  const inner = double
    ? `<circle cx="128" cy="128" r="102" fill="none" stroke="url(#${id})" stroke-width="6" opacity="0.75"/>`
    : "";
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient></defs><circle cx="128" cy="128" r="118" fill="none" stroke="url(#${id})" stroke-width="14"${dash}/>${inner}</svg>`
  );
}

function backgroundSvg(id, colors, speckles = 40) {
  const stops = colors
    .map((c, i) => `<stop offset="${Math.round((i / Math.max(colors.length - 1, 1)) * 100)}%" stop-color="${c}"/>`)
    .join("");
  let dots = "";
  let seed = id.split("").reduce((a, ch) => a + ch.charCodeAt(0), 7) || 7;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  for (let i = 0; i < speckles; i++) {
    dots += `<circle cx="${(rand() * 800).toFixed(1)}" cy="${(rand() * 600).toFixed(1)}" r="${(rand() * 1.8 + 0.3).toFixed(1)}" fill="#fff" opacity="${(rand() * 0.4 + 0.2).toFixed(2)}"/>`;
  }
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient></defs><rect width="800" height="600" fill="url(#${id})"/>${dots}</svg>`
  );
}

function item(partial, sortOrder) {
  return {
    price_descoin: 250,
    rarity: "rare",
    asset_url: "data:,",
    preview_url: null,
    theme_key: null,
    badge_icon: null,
    title_text: null,
    effect_key: null,
    active: true,
    sort_order: sortOrder,
    ...partial,
  };
}

function buildCatalog() {
  const items = [];
  let sort = 1000;

  const banners = [
    ["obsidian-rift", "Obsidian Rift", "legendary", 520, ["#050505", "#1a1033", "#7b2cbf"], 70],
    ["crimson-monolith", "Crimson Monolith", "epic", 400, ["#1a0000", "#8b0000", "#ff4d4d"], 0],
    ["jade-temple", "Jade Temple", "rare", 300, ["#022c22", "#059669", "#a7f3d0"], 20],
    ["azure-cathedral", "Azure Cathedral", "epic", 390, ["#020617", "#1d4ed8", "#93c5fd"], 40],
    ["amber-dunes", "Amber Dunes", "common", 220, ["#451a03", "#d97706", "#fde68a"], 0],
    ["violet-storm", "Violet Storm", "epic", 410, ["#1e0033", "#7c3aed", "#e9d5ff"], 55],
    ["mint-horizon", "Mint Horizon", "rare", 280, ["#042f2e", "#14b8a6", "#ccfbf1"], 15],
    ["noir-gold", "Noir & Gold", "legendary", 540, ["#0a0a0a", "#3f3f46", "#fbbf24"], 25],
    ["plasma-ribbon", "Plasma Ribbon", "legendary", 560, ["#0f172a", "#db2777", "#22d3ee"], 80],
    ["copper-forge", "Copper Forge", "rare", 290, ["#1c1917", "#b45309", "#fdba74"], 10],
    ["glacier-peak", "Glacier Peak", "rare", 300, ["#0c4a6e", "#38bdf8", "#e0f2fe"], 35],
    ["blood-moon", "Blood Moon", "epic", 420, ["#170101", "#7f1d1d", "#fb7185"], 30],
    ["luminous-moss", "Luminous Moss", "rare", 310, ["#052e16", "#65a30d", "#d9f99d"], 20],
    ["ion-circuit", "Ion Circuit", "epic", 430, ["#020617", "#0369a1", "#67e8f9"], 60],
    ["rose-quartz", "Rose Quartz", "common", 230, ["#4c0519", "#db2777", "#fce7f3"], 12],
    ["steel-rain", "Steel Rain", "rare", 270, ["#09090b", "#52525b", "#d4d4d8"], 40],
    ["ember-vault", "Ember Vault", "epic", 400, ["#1c0a00", "#ea580c", "#fde047"], 18],
    ["celestial-ink", "Celestial Ink", "legendary", 550, ["#020617", "#312e81", "#c4b5fd"], 90],
    ["tropical-haze", "Tropical Haze", "rare", 295, ["#134e4a", "#0d9488", "#fcd34d"], 22],
    ["shadow-orchid", "Shadow Orchid", "epic", 415, ["#1a0024", "#86198f", "#f0abfc"], 45],
    ["carbon-pulse", "Carbon Pulse", "rare", 285, ["#09090b", "#27272a", "#22d3ee"], 50],
    ["sunset-arcade", "Sunset Arcade", "epic", 405, ["#3b0764", "#f97316", "#fde047"], 28],
    ["deep-teal", "Deep Teal Abyss", "common", 210, ["#022c22", "#115e59", "#5eead4"], 8],
    ["pearl-fog", "Pearl Fog", "common", 200, ["#1f2937", "#9ca3af", "#f8fafc"], 16],
    ["magma-vein", "Magma Vein", "legendary", 530, ["#0c0a09", "#9a3412", "#facc15"], 36],
    ["neon-harbor", "Neon Harbor", "epic", 425, ["#020617", "#0ea5e9", "#f472b6"], 65],
    ["ivory-dusk", "Ivory Dusk", "rare", 275, ["#292524", "#a8a29e", "#fef3c7"], 10],
    ["quantum-lagoon", "Quantum Lagoon", "legendary", 570, ["#042f2e", "#0891b2", "#a78bfa"], 75],
    ["rust-garden", "Rust Garden", "rare", 265, ["#1c1917", "#9a3412", "#86efac"], 14],
    ["polar-night", "Polar Night", "epic", 395, ["#020617", "#1e3a8a", "#e2e8f0"], 48],
    ["saffron-silk", "Saffron Silk", "rare", 290, ["#422006", "#ca8a04", "#fef9c3"], 6],
    ["void-mirror", "Void Mirror", "legendary", 580, ["#000000", "#111827", "#818cf8"], 100],
    ["coral-reef", "Coral Reef", "common", 225, ["#164e63", "#0891b2", "#fb7185"], 20],
    ["graphite-flare", "Graphite Flare", "rare", 280, ["#18181b", "#3f3f46", "#fbbf24"], 30],
    ["lilac-mist", "Lilac Mist", "common", 215, ["#2e1065", "#a78bfa", "#fae8ff"], 18],
    ["hyperion-gold", "Hyperion Gold", "legendary", 600, ["#1c1917", "#854d0e", "#fde047"], 42],
    ["cyber-marsh", "Cyber Marsh", "epic", 410, ["#052e16", "#16a34a", "#22d3ee"], 55],
    ["opaline-wave", "Opaline Wave", "rare", 305, ["#0f172a", "#6366f1", "#fbcfe8"], 33],
    ["titan-bronze", "Titan Bronze", "epic", 390, ["#1c1917", "#92400e", "#fdba74"], 12],
    ["zenith-blue", "Zenith Blue", "rare", 295, ["#082f49", "#0284c7", "#bae6fd"], 25],
    ["phantom-rose", "Phantom Rose", "epic", 420, ["#19010f", "#9d174d", "#fda4af"], 38],
    ["acid-lattice", "Acid Lattice", "legendary", 545, ["#052e16", "#65a30d", "#a3e635"], 70],
    ["midnight-harbor", "Midnight Harbor", "rare", 270, ["#020617", "#1e293b", "#38bdf8"], 28],
    ["solar-garden", "Solar Garden", "common", 235, ["#365314", "#ca8a04", "#fef08a"], 15],
    ["eclipse-silk", "Eclipse Silk", "legendary", 560, ["#09090b", "#4c1d95", "#f472b6"], 85],
    ["frosted-copper", "Frosted Copper", "rare", 300, ["#1c1917", "#b45309", "#bae6fd"], 22],
    ["verdant-pulse", "Verdant Pulse", "epic", 400, ["#052e16", "#15803d", "#4ade80"], 40],
    ["ion-sand", "Ion Sand", "rare", 285, ["#451a03", "#ea580c", "#67e8f9"], 26],
    ["nocturne-violet", "Nocturne Violet", "epic", 415, ["#0b0218", "#6d28d9", "#ddd6fe"], 50],
    ["chrome-tide", "Chrome Tide", "rare", 310, ["#09090b", "#64748b", "#e2e8f0"], 45],
  ];
  for (const [slug, name, rarity, price, colors, speckles] of banners) {
    const uri = bannerSvg(`b-${slug}`, colors, speckles);
    items.push(
      item(
        {
          sku: `banner-${slug}`,
          name,
          description: `Premium profile banner — ${name}. Crafted gradient with cinematic depth.`,
          category: "banner",
          rarity,
          price_descoin: price,
          asset_url: uri,
          preview_url: uri,
        },
        sort++
      )
    );
  }

  const frames = [
    ["obsidian-halo", "Obsidian Halo", "legendary", 500, ["#111827", "#6b7280", "#f8fafc"], {}],
    ["crimson-orbit", "Crimson Orbit", "epic", 360, ["#7f1d1d", "#ef4444", "#7f1d1d"], {}],
    ["jade-circuit", "Jade Circuit", "rare", 290, ["#065f46", "#34d399", "#065f46"], { dashed: true }],
    ["azure-helix", "Azure Helix", "epic", 370, ["#1d4ed8", "#38bdf8", "#1d4ed8"], { double: true }],
    ["amber-crown", "Amber Crown", "rare", 300, ["#92400e", "#fbbf24", "#92400e"], {}],
    ["violet-pulse", "Violet Pulse", "epic", 380, ["#5b21b6", "#c084fc", "#5b21b6"], {}],
    ["mint-ring", "Mint Ring", "common", 210, ["#0f766e", "#5eead4", "#0f766e"], {}],
    ["noir-gilded", "Noir Gilded", "legendary", 520, ["#18181b", "#fbbf24", "#18181b"], { double: true }],
    ["plasma-coil", "Plasma Coil", "legendary", 540, ["#db2777", "#22d3ee", "#db2777"], { dashed: true }],
    ["copper-band", "Copper Band", "rare", 280, ["#9a3412", "#fdba74", "#9a3412"], {}],
    ["glacier-rim", "Glacier Rim", "rare", 295, ["#0369a1", "#e0f2fe", "#0369a1"], {}],
    ["blood-edge", "Blood Edge", "epic", 365, ["#450a0a", "#fb7185", "#450a0a"], {}],
    ["moss-loop", "Moss Loop", "common", 200, ["#3f6212", "#a3e635", "#3f6212"], {}],
    ["ion-halo", "Ion Halo", "epic", 375, ["#0e7490", "#67e8f9", "#0e7490"], { dashed: true }],
    ["rose-wire", "Rose Wire", "rare", 270, ["#9d174d", "#fbcfe8", "#9d174d"], {}],
    ["steel-ring", "Steel Ring", "common", 190, ["#3f3f46", "#d4d4d8", "#3f3f46"], {}],
    ["ember-arc", "Ember Arc", "epic", 355, ["#9a3412", "#fde047", "#9a3412"], {}],
    ["celestial-orbit", "Celestial Orbit", "legendary", 530, ["#312e81", "#c4b5fd", "#312e81"], { double: true }],
    ["tropical-band", "Tropical Band", "rare", 285, ["#0f766e", "#fcd34d", "#0f766e"], {}],
    ["orchid-ring", "Orchid Ring", "epic", 360, ["#86198f", "#f0abfc", "#86198f"], {}],
    ["carbon-edge", "Carbon Edge", "rare", 275, ["#18181b", "#22d3ee", "#18181b"], { dashed: true }],
    ["arcade-rim", "Arcade Rim", "epic", 370, ["#7c3aed", "#f97316", "#7c3aed"], {}],
    ["teal-loop", "Teal Loop", "common", 205, ["#115e59", "#5eead4", "#115e59"], {}],
    ["pearl-rim", "Pearl Rim", "common", 195, ["#6b7280", "#f8fafc", "#6b7280"], {}],
    ["magma-ring", "Magma Ring", "legendary", 510, ["#7c2d12", "#facc15", "#7c2d12"], {}],
    ["harbor-glow", "Harbor Glow", "epic", 365, ["#0369a1", "#f472b6", "#0369a1"], {}],
    ["ivory-band", "Ivory Band", "rare", 260, ["#78716c", "#fef3c7", "#78716c"], {}],
    ["quantum-rim", "Quantum Rim", "legendary", 550, ["#0e7490", "#a78bfa", "#0e7490"], { double: true }],
    ["rust-halo", "Rust Halo", "rare", 270, ["#9a3412", "#86efac", "#9a3412"], {}],
    ["polar-ring", "Polar Ring", "epic", 350, ["#1e3a8a", "#e2e8f0", "#1e3a8a"], {}],
    ["saffron-arc", "Saffron Arc", "rare", 280, ["#a16207", "#fef9c3", "#a16207"], {}],
    ["void-rim", "Void Rim", "legendary", 560, ["#000000", "#818cf8", "#000000"], { dashed: true }],
    ["coral-loop", "Coral Loop", "common", 215, ["#0e7490", "#fb7185", "#0e7490"], {}],
    ["graphite-edge", "Graphite Edge", "rare", 275, ["#3f3f46", "#fbbf24", "#3f3f46"], {}],
    ["lilac-halo", "Lilac Halo", "common", 205, ["#6d28d9", "#fae8ff", "#6d28d9"], {}],
    ["hyperion-rim", "Hyperion Rim", "legendary", 570, ["#854d0e", "#fde047", "#854d0e"], { double: true }],
    ["marsh-ring", "Marsh Ring", "epic", 355, ["#15803d", "#22d3ee", "#15803d"], {}],
    ["opal-band", "Opal Band", "rare", 300, ["#4f46e5", "#fbcfe8", "#4f46e5"], {}],
    ["bronze-halo", "Bronze Halo", "epic", 345, ["#92400e", "#fdba74", "#92400e"], {}],
    ["zenith-rim", "Zenith Rim", "rare", 290, ["#0284c7", "#bae6fd", "#0284c7"], {}],
    ["phantom-edge", "Phantom Edge", "epic", 365, ["#9d174d", "#fda4af", "#9d174d"], { dashed: true }],
    ["acid-rim", "Acid Rim", "legendary", 525, ["#3f6212", "#a3e635", "#3f6212"], {}],
    ["harbor-ring", "Harbor Ring", "rare", 265, ["#1e293b", "#38bdf8", "#1e293b"], {}],
    ["solar-loop", "Solar Loop", "common", 220, ["#4d7c0f", "#fef08a", "#4d7c0f"], {}],
    ["eclipse-rim", "Eclipse Rim", "legendary", 555, ["#4c1d95", "#f472b6", "#4c1d95"], { double: true }],
  ];
  for (const [slug, name, rarity, price, colors, opts] of frames) {
    const uri = frameSvg(`f-${slug}`, colors, opts);
    items.push(
      item(
        {
          sku: `frame-${slug}`,
          name,
          description: `Precision avatar frame — ${name}. High-contrast premium ring.`,
          category: "avatar_frame",
          rarity,
          price_descoin: price,
          asset_url: uri,
          preview_url: uri,
        },
        sort++
      )
    );
  }

  const backgrounds = [
    ["obsidian-hall", "Obsidian Hall", "legendary", 500, ["#030712", "#111827", "#4c1d95"]],
    ["crimson-atelier", "Crimson Atelier", "epic", 380, ["#1c0000", "#7f1d1d", "#fb7185"]],
    ["jade-sanctum", "Jade Sanctum", "rare", 320, ["#022c22", "#047857", "#6ee7b7"]],
    ["azure-observatory", "Azure Observatory", "epic", 390, ["#020617", "#1d4ed8", "#93c5fd"]],
    ["amber-gallery", "Amber Gallery", "common", 240, ["#451a03", "#b45309", "#fde68a"]],
    ["violet-archive", "Violet Archive", "epic", 400, ["#1e0033", "#6d28d9", "#ddd6fe"]],
    ["mint-lounge", "Mint Lounge", "rare", 300, ["#042f2e", "#0f766e", "#99f6e4"]],
    ["noir-vault", "Noir Vault", "legendary", 520, ["#09090b", "#27272a", "#fbbf24"]],
    ["plasma-chamber", "Plasma Chamber", "legendary", 540, ["#0f172a", "#be185d", "#22d3ee"]],
    ["copper-foundry", "Copper Foundry", "rare", 310, ["#1c1917", "#9a3412", "#fdba74"]],
    ["glacier-lab", "Glacier Lab", "rare", 315, ["#0c4a6e", "#0284c7", "#e0f2fe"]],
    ["blood-theater", "Blood Theater", "epic", 385, ["#170101", "#991b1b", "#fda4af"]],
    ["moss-greenhouse", "Moss Greenhouse", "rare", 305, ["#052e16", "#4d7c0f", "#bef264"]],
    ["ion-hangar", "Ion Hangar", "epic", 395, ["#020617", "#0e7490", "#67e8f9"]],
    ["rose-suite", "Rose Suite", "common", 245, ["#4c0519", "#be185d", "#fce7f3"]],
    ["steel-workshop", "Steel Workshop", "rare", 290, ["#09090b", "#52525b", "#e4e4e7"]],
    ["ember-forge", "Ember Forge", "epic", 375, ["#1c0a00", "#c2410c", "#fde047"]],
    ["celestial-dome", "Celestial Dome", "legendary", 530, ["#020617", "#3730a3", "#c4b5fd"]],
    ["tropical-veranda", "Tropical Veranda", "rare", 300, ["#134e4a", "#0f766e", "#fde047"]],
    ["orchid-salon", "Orchid Salon", "epic", 390, ["#1a0024", "#86198f", "#f5d0fe"]],
    ["carbon-deck", "Carbon Deck", "rare", 295, ["#09090b", "#18181b", "#22d3ee"]],
    ["arcade-lounge", "Arcade Lounge", "epic", 400, ["#3b0764", "#ea580c", "#facc15"]],
    ["teal-basin", "Teal Basin", "common", 235, ["#022c22", "#115e59", "#5eead4"]],
    ["pearl-atrium", "Pearl Atrium", "common", 230, ["#1f2937", "#9ca3af", "#f8fafc"]],
    ["magma-core", "Magma Core", "legendary", 525, ["#0c0a09", "#9a3412", "#facc15"]],
    ["harbor-night", "Harbor Night", "epic", 385, ["#020617", "#0369a1", "#f472b6"]],
    ["ivory-library", "Ivory Library", "rare", 285, ["#292524", "#a8a29e", "#fef3c7"]],
    ["quantum-bay", "Quantum Bay", "legendary", 550, ["#042f2e", "#0e7490", "#a78bfa"]],
    ["rust-conservatory", "Rust Conservatory", "rare", 290, ["#1c1917", "#9a3412", "#86efac"]],
    ["polar-station", "Polar Station", "epic", 370, ["#020617", "#1e3a8a", "#e2e8f0"]],
    ["saffron-terrace", "Saffron Terrace", "rare", 300, ["#422006", "#ca8a04", "#fef9c3"]],
    ["void-gallery", "Void Gallery", "legendary", 560, ["#000000", "#111827", "#818cf8"]],
    ["coral-cove", "Coral Cove", "common", 240, ["#164e63", "#0891b2", "#fb7185"]],
    ["graphite-suite", "Graphite Suite", "rare", 295, ["#18181b", "#3f3f46", "#fbbf24"]],
    ["lilac-parlor", "Lilac Parlor", "common", 235, ["#2e1065", "#a78bfa", "#fae8ff"]],
    ["hyperion-hall", "Hyperion Hall", "legendary", 580, ["#1c1917", "#854d0e", "#fde047"]],
    ["cyber-grove", "Cyber Grove", "epic", 395, ["#052e16", "#16a34a", "#22d3ee"]],
    ["opaline-loft", "Opaline Loft", "rare", 310, ["#0f172a", "#6366f1", "#fbcfe8"]],
    ["bronze-atelier", "Bronze Atelier", "epic", 365, ["#1c1917", "#92400e", "#fdba74"]],
    ["zenith-deck", "Zenith Deck", "rare", 300, ["#082f49", "#0284c7", "#bae6fd"]],
  ];
  for (const [slug, name, rarity, price, colors] of backgrounds) {
    const uri = backgroundSvg(`bg-${slug}`, colors);
    items.push(
      item(
        {
          sku: `background-${slug}`,
          name,
          description: `Immersive profile background — ${name}. Full-bleed atmosphere for your card.`,
          category: "profile_background",
          rarity,
          price_descoin: price,
          asset_url: uri,
          preview_url: uri,
        },
        sort++
      )
    );
  }

  const badges = [
    ["phoenix", "Phoenix", "legendary", 520, "🔥"],
    ["nebula", "Nebula", "epic", 390, "🌌"],
    ["dragon", "Dragon", "legendary", 540, "🐉"],
    ["wolf", "Wolf", "epic", 360, "🐺"],
    ["fox", "Fox", "rare", 260, "🦊"],
    ["owl", "Owl", "rare", 250, "🦉"],
    ["lion", "Lion", "epic", 370, "🦁"],
    ["eagle", "Eagle", "epic", 365, "🦅"],
    ["shark", "Shark", "rare", 270, "🦈"],
    ["cobra", "Cobra", "epic", 350, "🐍"],
    ["unicorn", "Unicorn", "legendary", 500, "🦄"],
    ["robot", "Robot", "rare", 255, "🤖"],
    ["alien", "Alien", "epic", 340, "👽"],
    ["wizard", "Wizard", "legendary", 510, "🧙"],
    ["ninja", "Ninja", "epic", 355, "🥷"],
    ["samurai", "Samurai", "legendary", 530, "⚔️"],
    ["pirate", "Pirate", "rare", 265, "🏴‍☠️"],
    ["astronaut", "Astronaut", "epic", 375, "🧑‍🚀"],
    ["crystal", "Crystal", "rare", 280, "🔮"],
    ["bolt", "Bolt", "common", 180, "⚡"],
    ["heart", "Heart", "common", 170, "❤️"],
    ["moon", "Moon", "rare", 240, "🌙"],
    ["sun", "Sun", "rare", 245, "☀️"],
    ["clover", "Clover", "common", 175, "🍀"],
    ["music", "Music", "rare", 250, "🎵"],
    ["gamepad", "Gamepad", "rare", 255, "🎮"],
    ["target", "Target", "epic", 345, "🎯"],
    ["medal", "Medal", "epic", 360, "🏅"],
    ["gem", "Gem", "legendary", 490, "💠"],
    ["sparkles", "Sparkles", "rare", 260, "✨"],
    ["fireworks", "Fireworks", "epic", 370, "🎆"],
    ["tornado", "Tornado", "epic", 355, "🌪️"],
    ["volcano", "Volcano", "legendary", 505, "🌋"],
    ["rainbow", "Rainbow", "rare", 270, "🌈"],
    ["snowflake", "Snowflake", "common", 185, "❄️"],
    ["wave", "Wave", "common", 180, "🌊"],
    ["leaf", "Leaf", "common", 165, "🍃"],
    ["coffee", "Coffee", "common", 160, "☕"],
    ["camera", "Camera", "rare", 240, "📷"],
    ["mic", "Mic", "rare", 245, "🎙️"],
    ["headphones", "Headphones", "epic", 330, "🎧"],
    ["joystick", "Joystick", "rare", 250, "🕹️"],
    ["key", "Key", "epic", 350, "🔑"],
    ["lock", "Lock", "rare", 255, "🔐"],
    ["shield", "Shield", "legendary", 515, "🛡️"],
  ];
  for (const [slug, name, rarity, price, icon] of badges) {
    items.push(
      item(
        {
          sku: `badge-${slug}`,
          name: `${name} Badge`,
          description: `Premium profile badge — ${icon} ${name}. Shows next to your display name.`,
          category: "profile_badge",
          rarity,
          price_descoin: price,
          badge_icon: icon,
        },
        sort++
      )
    );
  }

  const titles = [
    ["apex-predator", "Apex Predator", "legendary", 520, "🩸 Apex Predator"],
    ["night-architect", "Night Architect", "epic", 380, "🏙️ Night Architect"],
    ["signal-hunter", "Signal Hunter", "rare", 290, "📡 Signal Hunter"],
    ["voidwalker", "Voidwalker", "legendary", 540, "🕳️ Voidwalker"],
    ["stormcaller", "Stormcaller", "epic", 370, "⛈️ Stormcaller"],
    ["codebreaker", "Codebreaker", "rare", 280, "🧩 Codebreaker"],
    ["highroller", "High Roller", "epic", 360, "🎲 High Roller"],
    ["pulse-pilot", "Pulse Pilot", "rare", 275, "🛰️ Pulse Pilot"],
    ["emberlord", "Emberlord", "legendary", 510, "🔥 Emberlord"],
    ["frostbane", "Frostbane", "epic", 365, "🧊 Frostbane"],
    ["shadowdancer", "Shadowdancer", "rare", 285, "🕶️ Shadowdancer"],
    ["goldenspire", "Golden Spire", "legendary", 530, "🏛️ Golden Spire"],
    ["neon-ronin", "Neon Ronin", "epic", 375, "🗡️ Neon Ronin"],
    ["pixel-monarch", "Pixel Monarch", "rare", 295, "👾 Pixel Monarch"],
    ["orbit-king", "Orbit King", "epic", 355, "🪐 Orbit King"],
    ["deep-diver", "Deep Diver", "common", 210, "🤿 Deep Diver"],
    ["skyline", "Skyline", "common", 200, "🌆 Skyline"],
    ["ironwill", "Iron Will", "rare", 270, "🧱 Iron Will"],
    ["silvertongue", "Silver Tongue", "epic", 340, "🗣️ Silver Tongue"],
    ["quietstorm", "Quiet Storm", "rare", 280, "🌫️ Quiet Storm"],
    ["rapidfire", "Rapid Fire", "epic", 350, "⚡ Rapid Fire"],
    ["coldblood", "Cold Blood", "legendary", 500, "❄️ Cold Blood"],
    ["daybreaker", "Daybreaker", "rare", 265, "🌅 Daybreaker"],
    ["nightshift", "Night Shift", "common", 195, "🌃 Night Shift"],
    ["overclocked", "Overclocked", "epic", 360, "🖥️ Overclocked"],
    ["lowlatency", "Low Latency", "rare", 255, "📶 Low Latency"],
    ["fullsend", "Full Send", "epic", 345, "🚀 Full Send"],
    ["clutchgod", "Clutch God", "legendary", 550, "🎯 Clutch God"],
    ["maincharacter", "Main Character", "legendary", 560, "🎬 Main Character"],
    ["sidequest", "Side Quest", "common", 185, "🗺️ Side Quest"],
    ["lorekeeper", "Lorekeeper", "rare", 275, "📚 Lorekeeper"],
    ["raidleader", "Raid Leader", "epic", 370, "🛡️ Raid Leader"],
    ["soloqueue", "Solo Queue", "rare", 260, "🧍 Solo Queue"],
    ["partyup", "Party Up", "common", 190, "🤝 Party Up"],
    ["voicechamp", "Voice Champ", "epic", 355, "🎤 Voice Champ"],
    ["screensage", "Screen Sage", "rare", 270, "🖥️ Screen Sage"],
    ["giflord", "GIF Lord", "rare", 265, "🖼️ GIF Lord"],
    ["memearchitect", "Meme Architect", "epic", 340, "😂 Meme Architect"],
    ["descoinmogul", "DesCoin Mogul", "legendary", 580, "🪙 DesCoin Mogul"],
    ["firstblood", "First Blood", "epic", 365, "🩸 First Blood"],
    ["laststand", "Last Stand", "rare", 285, "🛡️ Last Stand"],
    ["echochamber", "Echo Chamber", "common", 205, "🔊 Echo Chamber"],
    ["quiettype", "Quiet Type", "common", 180, "🤫 Quiet Type"],
    ["hotmic", "Hot Mic", "rare", 250, "🎙️ Hot Mic"],
    ["certified", "Certified", "epic", 380, "✅ Certified"],
  ];
  for (const [slug, name, rarity, price, text] of titles) {
    items.push(
      item(
        {
          sku: `title-${slug}`,
          name,
          description: `Profile title flair — ${text}. Displays under your name.`,
          category: "profile_title",
          rarity,
          price_descoin: price,
          title_text: text,
        },
        sort++
      )
    );
  }

  const nameEffects = [
    ["plasma", "Plasma Sweep", "legendary", 520, "plasma"],
    ["ember", "Ember Drift", "epic", 390, "ember"],
    ["glitch", "Glitch Signal", "legendary", 540, "glitch"],
    ["mintglow", "Mint Glow", "rare", 300, "mintglow"],
    ["sunset", "Sunset Fade", "epic", 370, "sunset"],
    ["ocean", "Ocean Drift", "rare", 290, "ocean"],
    ["chrome", "Chrome Sheen", "epic", 380, "chrome"],
    ["toxic", "Toxic Pulse", "rare", 310, "toxic"],
    ["royal", "Royal Violet", "epic", 360, "royal"],
    ["candy", "Candy Pop", "common", 220, "candy"],
    ["magma", "Magma Flow", "legendary", 510, "magma"],
    ["arctic", "Arctic Beam", "rare", 295, "arctic"],
    ["holo", "Holo Shift", "legendary", 550, "holo"],
    ["embercore", "Ember Core", "epic", 375, "embercore"],
    ["noir", "Noir White", "rare", 280, "noir"],
    ["laser", "Laser Pink", "epic", 365, "laser"],
    ["matrix", "Matrix Green", "legendary", 530, "matrix"],
    ["sand", "Desert Gold", "common", 210, "sand"],
  ];
  for (const [slug, name, rarity, price, key] of nameEffects) {
    items.push(
      item(
        {
          sku: `name-effect-${slug}`,
          name,
          description: `Animated name effect — ${name}. Gradient/glow styling on your display name.`,
          category: "name_effect",
          rarity,
          price_descoin: price,
          effect_key: key,
        },
        sort++
      )
    );
  }

  const avatarEffects = [
    ["halo", "Soft Halo", "rare", 300, "halo"],
    ["ripple", "Ripple Ring", "epic", 380, "ripple"],
    ["comet", "Comet Trail", "legendary", 520, "comet"],
    ["static", "Static Field", "epic", 370, "static"],
    ["petal", "Petal Orbit", "rare", 310, "petal"],
    ["hex", "Hex Grid", "epic", 390, "hex"],
    ["solar", "Solar Crown", "legendary", 540, "solar"],
    ["toxic", "Toxic Mist", "rare", 295, "toxic"],
    ["prism", "Prism Spin", "legendary", 550, "prism"],
    ["ember", "Ember Orbit", "epic", 375, "ember"],
    ["frostbite", "Frostbite", "rare", 305, "frostbite"],
    ["neon", "Neon Dashes", "epic", 360, "neon"],
    ["void", "Void Disk", "legendary", 530, "void"],
    ["bubble", "Bubble Ring", "common", 220, "bubble"],
    ["scan", "Scanline", "rare", 285, "scan"],
    ["royal", "Royal Crest", "epic", 365, "royal"],
    ["holoring", "Holo Ring", "legendary", 560, "holoring"],
    ["pulse2", "Dual Pulse", "rare", 300, "pulse2"],
  ];
  for (const [slug, name, rarity, price, key] of avatarEffects) {
    items.push(
      item(
        {
          sku: `avatar-effect-${slug}`,
          name,
          description: `Avatar aura effect — ${name}. Animated ring/overlay around your avatar.`,
          category: "avatar_effect",
          rarity,
          price_descoin: price,
          effect_key: key,
        },
        sort++
      )
    );
  }

  const bubbles = [
    ["midnight", "Midnight", "rare", 270, "midnight"],
    ["ember", "Ember", "epic", 350, "ember"],
    ["mint", "Mint Frost", "rare", 280, "mint"],
    ["violet", "Violet Ink", "epic", 360, "violet"],
    ["gold", "Gilded", "legendary", 500, "gold"],
    ["ice", "Ice Sheet", "rare", 275, "ice"],
    ["toxic", "Toxic Fill", "epic", 345, "toxic"],
    ["rose", "Rose Glass", "common", 210, "rose"],
    ["cyber", "Cyber Grid", "legendary", 520, "cyber"],
    ["sand", "Desert Sand", "common", 200, "sand"],
    ["ocean", "Ocean Depth", "rare", 285, "ocean"],
    ["lava", "Lava Flow", "legendary", 530, "lava"],
    ["pearl", "Pearl Soft", "common", 195, "pearl"],
    ["matrix", "Matrix", "epic", 370, "matrix"],
    ["arcade", "Arcade Pop", "epic", 355, "arcade"],
    ["noir", "Noir Soft", "rare", 265, "noir"],
    ["prism", "Prism Edge", "legendary", 540, "prism"],
    ["teal", "Teal Soft", "common", 205, "teal"],
  ];
  for (const [slug, name, rarity, price, key] of bubbles) {
    items.push(
      item(
        {
          sku: `chat-bubble-${slug}`,
          name: `${name} Bubble`,
          description: `Chat bubble skin — ${name}. Styles your outgoing message bubbles.`,
          category: "chat_bubble",
          rarity,
          price_descoin: price,
          effect_key: key,
        },
        sort++
      )
    );
  }

  // ── NEW: Presence flares (status indicator cosmetics) ───────────────
  const flares = [
    ["pulse-cyan", "Cyan Pulse", "rare", 280, "pulse-cyan"],
    ["pulse-gold", "Gold Pulse", "epic", 360, "pulse-gold"],
    ["pulse-rose", "Rose Pulse", "rare", 290, "pulse-rose"],
    ["ring-neon", "Neon Ring", "epic", 370, "ring-neon"],
    ["ring-emerald", "Emerald Ring", "rare", 300, "ring-emerald"],
    ["ring-violet", "Violet Ring", "epic", 355, "ring-violet"],
    ["spark-white", "White Spark", "common", 200, "spark-white"],
    ["spark-fire", "Fire Spark", "legendary", 500, "spark-fire"],
    ["orbit-blue", "Blue Orbit", "epic", 380, "orbit-blue"],
    ["orbit-pink", "Pink Orbit", "rare", 310, "orbit-pink"],
    ["halo-soft", "Soft Halo", "common", 210, "halo-soft"],
    ["halo-royal", "Royal Halo", "legendary", 520, "halo-royal"],
    ["glitch-green", "Glitch Green", "epic", 365, "glitch-green"],
    ["glitch-void", "Void Glitch", "legendary", 540, "glitch-void"],
    ["wave-teal", "Teal Wave", "rare", 275, "wave-teal"],
    ["wave-amber", "Amber Wave", "rare", 280, "wave-amber"],
    ["core-crimson", "Crimson Core", "epic", 350, "core-crimson"],
    ["core-ice", "Ice Core", "rare", 295, "core-ice"],
    ["beam-magenta", "Magenta Beam", "legendary", 510, "beam-magenta"],
    ["beam-lime", "Lime Beam", "epic", 340, "beam-lime"],
    ["nova-white", "White Nova", "legendary", 550, "nova-white"],
    ["nova-gold", "Gold Nova", "legendary", 560, "nova-gold"],
    ["pixel-cyan", "Pixel Cyan", "rare", 270, "pixel-cyan"],
    ["pixel-hot", "Hot Pixel", "epic", 345, "pixel-hot"],
    ["aurora-soft", "Aurora Soft", "epic", 375, "aurora-soft"],
    ["aurora-vivid", "Aurora Vivid", "legendary", 530, "aurora-vivid"],
    ["steel-pulse", "Steel Pulse", "common", 205, "steel-pulse"],
    ["toxic-ring", "Toxic Ring", "epic", 355, "toxic-ring"],
    ["moon-glow", "Moon Glow", "rare", 285, "moon-glow"],
    ["sun-flare", "Sun Flare", "epic", 360, "sun-flare"],
  ];
  for (const [slug, name, rarity, price, key] of flares) {
    items.push(
      item(
        {
          sku: `presence-flare-${slug}`,
          name,
          description: `Presence flare — ${name}. Advanced glow around your online status indicator.`,
          category: "presence_flare",
          rarity,
          price_descoin: price,
          effect_key: key,
        },
        sort++
      )
    );
  }

  // ── NEW: Profile auras (card-level atmosphere) ──────────────────────
  const auras = [
    ["void-soft", "Soft Void", "epic", 380, "void-soft"],
    ["void-hard", "Hard Void", "legendary", 540, "void-hard"],
    ["solar-bloom", "Solar Bloom", "epic", 390, "solar-bloom"],
    ["frost-veil", "Frost Veil", "rare", 300, "frost-veil"],
    ["ember-haze", "Ember Haze", "epic", 370, "ember-haze"],
    ["neon-frame", "Neon Frame", "legendary", 520, "neon-frame"],
    ["mint-mist", "Mint Mist", "rare", 285, "mint-mist"],
    ["royal-curtain", "Royal Curtain", "legendary", 550, "royal-curtain"],
    ["cyber-grid", "Cyber Grid", "epic", 400, "cyber-grid"],
    ["rose-bloom", "Rose Bloom", "rare", 295, "rose-bloom"],
    ["gold-dust", "Gold Dust", "legendary", 560, "gold-dust"],
    ["ocean-depth", "Ocean Depth", "rare", 310, "ocean-depth"],
    ["plasma-field", "Plasma Field", "legendary", 570, "plasma-field"],
    ["shadow-rim", "Shadow Rim", "common", 220, "shadow-rim"],
    ["prism-glass", "Prism Glass", "epic", 385, "prism-glass"],
    ["toxic-fog", "Toxic Fog", "epic", 365, "toxic-fog"],
    ["starlight", "Starlight", "legendary", 530, "starlight"],
    ["copper-glow", "Copper Glow", "rare", 280, "copper-glow"],
    ["ice-crystal", "Ice Crystal", "epic", 375, "ice-crystal"],
    ["lava-rim", "Lava Rim", "legendary", 545, "lava-rim"],
    ["pearl-soft", "Pearl Soft", "common", 210, "pearl-soft"],
    ["matrix-veil", "Matrix Veil", "epic", 390, "matrix-veil"],
    ["arcade-pop", "Arcade Pop", "rare", 305, "arcade-pop"],
    ["noir-edge", "Noir Edge", "rare", 290, "noir-edge"],
    ["aurora-wall", "Aurora Wall", "legendary", 555, "aurora-wall"],
    ["sandstorm", "Sandstorm", "common", 225, "sandstorm"],
    ["holo-sheet", "Holo Sheet", "legendary", 580, "holo-sheet"],
    ["crimson-veil", "Crimson Veil", "epic", 360, "crimson-veil"],
    ["jade-glow", "Jade Glow", "rare", 300, "jade-glow"],
    ["ion-haze", "Ion Haze", "epic", 370, "ion-haze"],
  ];
  for (const [slug, name, rarity, price, key] of auras) {
    items.push(
      item(
        {
          sku: `profile-aura-${slug}`,
          name,
          description: `Profile aura — ${name}. Atmospheric glow around your profile card.`,
          category: "profile_aura",
          rarity,
          price_descoin: price,
          effect_key: key,
        },
        sort++
      )
    );
  }

  // ── NEW: Sound packs (notification / call tone themes) ──────────────
  const sounds = [
    ["soft-chime", "Soft Chime", "common", 180, "soft-chime"],
    ["crystal-ping", "Crystal Ping", "rare", 260, "crystal-ping"],
    ["cyber-blip", "Cyber Blip", "epic", 340, "cyber-blip"],
    ["deep-thud", "Deep Thud", "rare", 250, "deep-thud"],
    ["glass-lift", "Glass Lift", "epic", 350, "glass-lift"],
    ["neon-zap", "Neon Zap", "legendary", 480, "neon-zap"],
    ["lofi-tap", "Lo-Fi Tap", "rare", 270, "lofi-tap"],
    ["arcade-coin", "Arcade Coin", "epic", 360, "arcade-coin"],
    ["void-whisper", "Void Whisper", "legendary", 500, "void-whisper"],
    ["ocean-drop", "Ocean Drop", "common", 190, "ocean-drop"],
    ["ember-crackle", "Ember Crackle", "epic", 355, "ember-crackle"],
    ["frost-ting", "Frost Ting", "rare", 255, "frost-ting"],
    ["royal-bell", "Royal Bell", "legendary", 520, "royal-bell"],
    ["matrix-tick", "Matrix Tick", "epic", 345, "matrix-tick"],
    ["pixel-beep", "Pixel Beep", "common", 175, "pixel-beep"],
    ["pulse-kick", "Pulse Kick", "rare", 265, "pulse-kick"],
    ["silk-swipe", "Silk Swipe", "rare", 260, "silk-swipe"],
    ["thunder-tap", "Thunder Tap", "epic", 370, "thunder-tap"],
    ["star-chime", "Star Chime", "legendary", 510, "star-chime"],
    ["copper-clang", "Copper Clang", "rare", 245, "copper-clang"],
    ["holo-ping", "Holo Ping", "legendary", 530, "holo-ping"],
    ["mint-pop", "Mint Pop", "common", 185, "mint-pop"],
    ["laser-chirp", "Laser Chirp", "epic", 365, "laser-chirp"],
    ["quiet-knock", "Quiet Knock", "common", 170, "quiet-knock"],
  ];
  for (const [slug, name, rarity, price, key] of sounds) {
    items.push(
      item(
        {
          sku: `sound-pack-${slug}`,
          name,
          description: `Sound pack — ${name}. Premium ringtone + notification tones (not 8-bit beeps).`,
          category: "sound_pack",
          rarity,
          price_descoin: price,
          effect_key: key,
        },
        sort++
      )
    );
  }

  return items;
}

function toSqlInsert(batch) {
  const values = batch
    .map((it) => {
      return `(${[
        sqlEscape(it.sku),
        sqlEscape(it.name),
        sqlEscape(it.description),
        sqlEscape(it.category),
        sqlEscape(it.asset_url),
        sqlEscape(it.preview_url),
        Number(it.price_descoin) || 0,
        sqlEscape(it.theme_key),
        sqlEscape(it.badge_icon),
        sqlEscape(it.title_text),
        sqlEscape(it.effect_key),
        sqlEscape(it.rarity),
        Number(it.sort_order) || 0,
        it.active === false ? "FALSE" : "TRUE",
      ].join(", ")})`;
    })
    .join(",\n");
  return (
    `INSERT INTO shop_items (sku, name, description, category, asset_url, preview_url, price_descoin, theme_key, badge_icon, title_text, effect_key, rarity, sort_order, active)\n` +
    `VALUES\n${values}\n` +
    `ON CONFLICT (sku) DO NOTHING;`
  );
}

async function seedViaSupabase(items) {
  const { createClient } = require("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key);
  let created = 0;
  let skipped = 0;
  for (const it of items) {
    const { data: existing } = await supabase.from("shop_items").select("id").eq("sku", it.sku).maybeSingle();
    if (existing) {
      skipped += 1;
      continue;
    }
    const { error } = await supabase.from("shop_items").insert({
      sku: it.sku,
      name: it.name,
      description: it.description,
      category: it.category,
      asset_url: it.asset_url,
      preview_url: it.preview_url,
      price_descoin: it.price_descoin,
      theme_key: it.theme_key,
      badge_icon: it.badge_icon,
      title_text: it.title_text,
      effect_key: it.effect_key,
      rarity: it.rarity,
      sort_order: it.sort_order,
      active: true,
    });
    if (error) console.error(`FAILED ${it.sku}: ${error.message}`);
    else created += 1;
  }
  console.log(`Seed complete: ${created} created, ${skipped} skipped. Total defined: ${items.length}`);
}

function writeSqlBatches(items, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const batchSize = 20;
  let batchIndex = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const file = path.join(outDir, `batch-${String(batchIndex).padStart(3, "0")}.sql`);
    fs.writeFileSync(file, toSqlInsert(batch));
    batchIndex += 1;
  }
  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify({ totalItems: items.length, batches: batchIndex, byCategory: countByCategory(items) }, null, 2)
  );
  console.log(`Wrote ${batchIndex} SQL batches (${items.length} items) to ${outDir}`);
}

function countByCategory(items) {
  const map = {};
  for (const it of items) map[it.category] = (map[it.category] || 0) + 1;
  return map;
}

function main() {
  const items = buildCatalog();
  console.log("Catalog size:", items.length);
  console.log("By category:", countByCategory(items));

  const sqlOutIdx = process.argv.indexOf("--sql-out");
  if (sqlOutIdx !== -1) {
    const outDir = process.argv[sqlOutIdx + 1] || "/tmp/shop-mega-batches";
    writeSqlBatches(items, outDir);
    return;
  }

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return seedViaSupabase(items);
  }

  // Default: write SQL batches for MCP / psql apply
  writeSqlBatches(items, "/tmp/shop-mega-batches");
}

module.exports = { buildCatalog, toSqlInsert, countByCategory };

if (require.main === module) {
  Promise.resolve(main()).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
