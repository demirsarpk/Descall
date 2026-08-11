"use strict";

/**
 * Hand-crafted premium catalog for three advanced interactive categories:
 *   - typing_flare    (typing indicator skins)
 *   - reaction_burst  (reaction chip / burst styles)
 *   - call_overlay    (voice/call UI overlay themes)
 *
 * Every item is authored individually — unique name, lore-like description,
 * rarity, pricing, and effect_key. Idempotent by `sku`.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seedPremiumCategories.js
 */

const { createClient } = require("@supabase/supabase-js");

/** @type {Array<Record<string, any>>} */
const ITEMS = [
  // ── Typing flares ────────────────────────────────────────────────────
  {
    sku: "typing-neon-pulse",
    name: "Neon Pulse Ribbon",
    category: "typing_flare",
    rarity: "epic",
    price_descoin: 420,
    effect_key: "neon-pulse",
    description:
      "Your typing indicator breathes in electric cyan — three pulses that feel like a live signal, not a default spinner.",
  },
  {
    sku: "typing-liquid-mercury",
    name: "Liquid Mercury",
    category: "typing_flare",
    rarity: "legendary",
    price_descoin: 560,
    effect_key: "liquid-mercury",
    description:
      "Silvery orbs stretch and reform as you type — a mercury morph that looks almost physical.",
  },
  {
    sku: "typing-aurora-wave",
    name: "Aurora Wave",
    category: "typing_flare",
    rarity: "epic",
    price_descoin: 440,
    effect_key: "aurora-wave",
    description:
      "A soft teal-to-violet ribbon undulates under the typing label, like northern lights under glass.",
  },
  {
    sku: "typing-ember-cascade",
    name: "Ember Cascade",
    category: "typing_flare",
    rarity: "legendary",
    price_descoin: 580,
    effect_key: "ember-cascade",
    description:
      "Warm coals rise and die in sequence — a typing cue that feels like sitting by a forge.",
  },
  {
    sku: "typing-crystal-chime",
    name: "Crystal Chime",
    category: "typing_flare",
    rarity: "rare",
    price_descoin: 320,
    effect_key: "crystal-chime",
    description:
      "Faceted ice-blue dots refract light as they bounce — delicate, precise, unmistakably premium.",
  },
  {
    sku: "typing-void-signal",
    name: "Void Signal",
    category: "typing_flare",
    rarity: "legendary",
    price_descoin: 600,
    effect_key: "void-signal",
    description:
      "A violet static bar glitches in and out of phase — for people who type like they're hacking reality.",
  },
  {
    sku: "typing-golden-morse",
    name: "Golden Morse",
    category: "typing_flare",
    rarity: "epic",
    price_descoin: 450,
    effect_key: "golden-morse",
    description:
      "Gold dashes blink in a coded rhythm — elegant telegraph energy for late-night conversations.",
  },
  {
    sku: "typing-cyber-hex",
    name: "Cyber Hex Stream",
    category: "typing_flare",
    rarity: "epic",
    price_descoin: 460,
    effect_key: "cyber-hex",
    description:
      "Hex shards cascade sideways with a hard neon edge — pure cyberpunk keystroke theater.",
  },
  {
    sku: "typing-sakura-drift",
    name: "Sakura Drift",
    category: "typing_flare",
    rarity: "rare",
    price_descoin: 340,
    effect_key: "sakura-drift",
    description:
      "Petal-soft pink orbs drift upward while you type — calm, romantic, and impossibly smooth.",
  },
  {
    sku: "typing-plasma-arc",
    name: "Plasma Arc",
    category: "typing_flare",
    rarity: "legendary",
    price_descoin: 590,
    effect_key: "plasma-arc",
    description:
      "Magenta-cyan arcs leap between dots like a miniature fusion reactor under your name.",
  },
  {
    sku: "typing-frost-breathe",
    name: "Frost Breath",
    category: "typing_flare",
    rarity: "rare",
    price_descoin: 310,
    effect_key: "frost-breathe",
    description:
      "Icy dots fog and clear in a slow breath cycle — winter quiet for thoughtful typers.",
  },
  {
    sku: "typing-royal-ink",
    name: "Royal Ink Drip",
    category: "typing_flare",
    rarity: "epic",
    price_descoin: 430,
    effect_key: "royal-ink",
    description:
      "Deep purple ink drops form, swell, and fall — calligraphic motion for a regal presence.",
  },
  {
    sku: "typing-quantum-blink",
    name: "Quantum Blink",
    category: "typing_flare",
    rarity: "legendary",
    price_descoin: 610,
    effect_key: "quantum-blink",
    description:
      "Dots teleport between positions with a soft photonic flash — physics-breaking typing flair.",
  },
  {
    sku: "typing-mosaic-tap",
    name: "Mosaic Tap",
    category: "typing_flare",
    rarity: "rare",
    price_descoin: 300,
    effect_key: "mosaic-tap",
    description:
      "Tile fragments assemble into the typing cue — artisan glass energy, never generic dots.",
  },
  {
    sku: "typing-starfall",
    name: "Starfall Typing",
    category: "typing_flare",
    rarity: "epic",
    price_descoin: 470,
    effect_key: "starfall",
    description:
      "Micro-stars streak downward behind the label — a personal meteor shower for every keystroke.",
  },
  {
    sku: "typing-holo-ribbon",
    name: "Holographic Ribbon",
    category: "typing_flare",
    rarity: "legendary",
    price_descoin: 620,
    effect_key: "holo-ribbon",
    description:
      "An iridescent ribbon folds under the typing text, shifting through every spectral color.",
  },

  // ── Reaction bursts ──────────────────────────────────────────────────
  {
    sku: "reaction-nova-pop",
    name: "Nova Pop",
    category: "reaction_burst",
    rarity: "epic",
    price_descoin: 400,
    effect_key: "nova-pop",
    description:
      "Your reactions bloom with a soft stellar nova — bright core, fading corona, zero clutter.",
  },
  {
    sku: "reaction-glass-shatter",
    name: "Glass Shatter",
    category: "reaction_burst",
    rarity: "legendary",
    price_descoin: 540,
    effect_key: "glass-shatter",
    description:
      "Chips fracture into crystalline shards when you react — sharp, luxurious, unforgettable.",
  },
  {
    sku: "reaction-confetti-storm",
    name: "Confetti Storm",
    category: "reaction_burst",
    rarity: "epic",
    price_descoin: 390,
    effect_key: "confetti-storm",
    description:
      "Celebratory micro-confetti bursts from the chip — party energy without looking childish.",
  },
  {
    sku: "reaction-ripple-ink",
    name: "Ripple Ink",
    category: "reaction_burst",
    rarity: "rare",
    price_descoin: 300,
    effect_key: "ripple-ink",
    description:
      "Ink ripples expand from the emoji like a drop in still water — quiet, artistic impact.",
  },
  {
    sku: "reaction-ember-bloom",
    name: "Ember Bloom",
    category: "reaction_burst",
    rarity: "epic",
    price_descoin: 410,
    effect_key: "ember-bloom",
    description:
      "Warm embers unfold around your reaction — heat without chaos, fire without noise.",
  },
  {
    sku: "reaction-frost-crack",
    name: "Frost Crack",
    category: "reaction_burst",
    rarity: "rare",
    price_descoin: 310,
    effect_key: "frost-crack",
    description:
      "Ice veins spider across the chip when you react — cold precision for icy takes.",
  },
  {
    sku: "reaction-neon-stamp",
    name: "Neon Stamp",
    category: "reaction_burst",
    rarity: "epic",
    price_descoin: 420,
    effect_key: "neon-stamp",
    description:
      "A hard neon brand stamps onto the reaction — cyber seal of approval.",
  },
  {
    sku: "reaction-void-implode",
    name: "Void Implode",
    category: "reaction_burst",
    rarity: "legendary",
    price_descoin: 560,
    effect_key: "void-implode",
    description:
      "The chip briefly collapses into a violet singularity, then snaps back — dramatic and rare.",
  },
  {
    sku: "reaction-prism-split",
    name: "Prism Split",
    category: "reaction_burst",
    rarity: "legendary",
    price_descoin: 570,
    effect_key: "prism-split",
    description:
      "Light splits into spectral bands around your emoji — museum-grade reaction chrome.",
  },
  {
    sku: "reaction-gold-rain",
    name: "Gold Rain",
    category: "reaction_burst",
    rarity: "epic",
    price_descoin: 450,
    effect_key: "gold-rain",
    description:
      "Micro gold flakes fall from the chip — opulent without being loud.",
  },
  {
    sku: "reaction-pixel-burst",
    name: "Pixel Burst",
    category: "reaction_burst",
    rarity: "rare",
    price_descoin: 290,
    effect_key: "pixel-burst",
    description:
      "Retro pixels explode outward then reassemble — arcade soul in a modern chip.",
  },
  {
    sku: "reaction-petal-burst",
    name: "Petal Burst",
    category: "reaction_burst",
    rarity: "rare",
    price_descoin: 295,
    effect_key: "petal-burst",
    description:
      "Soft petals radiate from the reaction — elegant, romantic, never sticky-sweet.",
  },
  {
    sku: "reaction-thunderclap",
    name: "Thunderclap",
    category: "reaction_burst",
    rarity: "legendary",
    price_descoin: 580,
    effect_key: "thunderclap",
    description:
      "A brief electric flash rings the chip — the reaction that feels like a mic drop.",
  },
  {
    sku: "reaction-soft-bloom",
    name: "Soft Bloom",
    category: "reaction_burst",
    rarity: "common",
    price_descoin: 220,
    effect_key: "soft-bloom",
    description:
      "A gentle pastel bloom expands and fades — understated luxury for everyday reactions.",
  },
  {
    sku: "reaction-holo-flash",
    name: "Holo Flash",
    category: "reaction_burst",
    rarity: "epic",
    price_descoin: 430,
    effect_key: "holo-flash",
    description:
      "Iridescent flash washes the chip — holographic chrome that never looks default.",
  },
  {
    sku: "reaction-magnetic-pulse",
    name: "Magnetic Pulse",
    category: "reaction_burst",
    rarity: "epic",
    price_descoin: 415,
    effect_key: "magnetic-pulse",
    description:
      "Concentric magnetic rings pull inward then release — engineered motion, not a cheap bounce.",
  },

  // ── Call overlays ────────────────────────────────────────────────────
  {
    sku: "call-midnight-ops",
    name: "Midnight Operations",
    category: "call_overlay",
    rarity: "legendary",
    price_descoin: 650,
    effect_key: "midnight-ops",
    description:
      "Command-center call UI: deep navy glass, amber telemetry lines, and a tactical HUD frame.",
  },
  {
    sku: "call-neon-stadium",
    name: "Neon Stadium",
    category: "call_overlay",
    rarity: "epic",
    price_descoin: 520,
    effect_key: "neon-stadium",
    description:
      "Arena energy for voice calls — magenta rim lights, cyan scoreboard accents, crowd-ready drama.",
  },
  {
    sku: "call-glass-atrium",
    name: "Glass Atrium",
    category: "call_overlay",
    rarity: "epic",
    price_descoin: 500,
    effect_key: "glass-atrium",
    description:
      "Frosted architectural glass with soft daylight beams — the most refined call canvas we ship.",
  },
  {
    sku: "call-ember-theater",
    name: "Ember Theater",
    category: "call_overlay",
    rarity: "legendary",
    price_descoin: 640,
    effect_key: "ember-theater",
    description:
      "Velvet dark with molten amber curtains — your calls feel like a private premiere.",
  },
  {
    sku: "call-arctic-bridge",
    name: "Arctic Bridge",
    category: "call_overlay",
    rarity: "rare",
    price_descoin: 380,
    effect_key: "arctic-bridge",
    description:
      "Ice-blue steel and glacial gradients — crisp, cold, and surgically clean for focus calls.",
  },
  {
    sku: "call-void-chamber",
    name: "Void Chamber",
    category: "call_overlay",
    rarity: "legendary",
    price_descoin: 670,
    effect_key: "void-chamber",
    description:
      "Near-black void with violet event-horizon rings — cinematic silence between every word.",
  },
  {
    sku: "call-royal-lounge",
    name: "Royal Lounge",
    category: "call_overlay",
    rarity: "epic",
    price_descoin: 530,
    effect_key: "royal-lounge",
    description:
      "Deep plum and brushed gold rails — a lounge, not a meeting. Soft luxury for late talks.",
  },
  {
    sku: "call-cyber-deck",
    name: "Cyber Deck",
    category: "call_overlay",
    rarity: "epic",
    price_descoin: 510,
    effect_key: "cyber-deck",
    description:
      "Hard-edged cyan grid, hot-pink accents, scanline haze — jacked-in call aesthetics.",
  },
  {
    sku: "call-golden-hall",
    name: "Golden Hall",
    category: "call_overlay",
    rarity: "legendary",
    price_descoin: 680,
    effect_key: "golden-hall",
    description:
      "Warm champagne light on dark marble — the most expensive-feeling call room in Descall.",
  },
  {
    sku: "call-aurora-dome",
    name: "Aurora Dome",
    category: "call_overlay",
    rarity: "epic",
    price_descoin: 540,
    effect_key: "aurora-dome",
    description:
      "A living aurora canopy over the call stage — teal, violet, and soft star dust.",
  },
  {
    sku: "call-carbon-cockpit",
    name: "Carbon Cockpit",
    category: "call_overlay",
    rarity: "rare",
    price_descoin: 370,
    effect_key: "carbon-cockpit",
    description:
      "Matte carbon weave with instrument-glow cyan — pilot energy for high-stakes voice chats.",
  },
  {
    sku: "call-sakura-suite",
    name: "Sakura Suite",
    category: "call_overlay",
    rarity: "rare",
    price_descoin: 360,
    effect_key: "sakura-suite",
    description:
      "Blush gradients and soft petal light — intimate, modern, never saccharine.",
  },
  {
    sku: "call-plasma-arena",
    name: "Plasma Arena",
    category: "call_overlay",
    rarity: "legendary",
    price_descoin: 690,
    effect_key: "plasma-arena",
    description:
      "Dual plasma rails (magenta ↔ cyan) frame the call — arena intensity with studio polish.",
  },
  {
    sku: "call-ocean-bridge",
    name: "Ocean Bridge",
    category: "call_overlay",
    rarity: "epic",
    price_descoin: 490,
    effect_key: "ocean-bridge",
    description:
      "Deep-sea blues with bioluminescent edge light — calm depth for long conversations.",
  },
  {
    sku: "call-mosaic-stage",
    name: "Mosaic Stage",
    category: "call_overlay",
    rarity: "epic",
    price_descoin: 505,
    effect_key: "mosaic-stage",
    description:
      "Artisan glass mosaic borders catch light as you talk — gallery vibes on a call stage.",
  },
  {
    sku: "call-titan-forge",
    name: "Titan Forge",
    category: "call_overlay",
    rarity: "legendary",
    price_descoin: 700,
    effect_key: "titan-forge",
    description:
      "Forged steel plates, molten copper seams, and heat shimmer — industrial mythos for legends.",
  },
];

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  const supabase = createClient(url, key);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i];
    const { data: existing } = await supabase.from("shop_items").select("id").eq("sku", item.sku).maybeSingle();
    if (existing) {
      skipped += 1;
      continue;
    }
    const { error } = await supabase.from("shop_items").insert({
      sku: item.sku,
      name: item.name,
      description: item.description,
      category: item.category,
      asset_url: "data:,",
      preview_url: null,
      price_descoin: item.price_descoin,
      effect_key: item.effect_key,
      rarity: item.rarity,
      sort_order: 5000 + i,
      active: true,
    });
    if (error) {
      failed += 1;
      console.error(`FAILED ${item.sku}: ${error.message}`);
    } else {
      created += 1;
      console.log(`+ ${item.sku}`);
    }
  }

  console.log(`Done. created=${created} skipped=${skipped} failed=${failed} total=${ITEMS.length}`);
}

module.exports = { ITEMS };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
