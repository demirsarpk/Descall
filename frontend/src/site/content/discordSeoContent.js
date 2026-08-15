/** Shared long-form SEO content for Discord-alternative landings (EN source of truth). */

export const COMPARE_ROWS = [
  { feature: "Real-time chat & DMs", descall: "Yes — fast, modern UI", discord: "Yes" },
  { feature: "Servers with channels", descall: "Yes — text, voice, stage + categories", discord: "Yes — mature tree model" },
  { feature: "Roles & permissions", descall: "Yes — role hierarchy + channel overrides", discord: "Yes — deep matrix" },
  { feature: "Server templates", descall: "Yes — gaming, Valorant, community, study & more", discord: "Limited community templates" },
  { feature: "Group voice & video", descall: "Yes — WebRTC + TURN", discord: "Yes" },
  { feature: "Screen share quality control", descall: "Yes — presets & restart-safe", discord: "Yes" },
  { feature: "Valorant LFG / party finder", descall: "Built-in Play tab + Riot link", discord: "Bots / external tools" },
  { feature: "Friends, presence & status", descall: "Yes", discord: "Yes" },
  { feature: "Push notifications", descall: "Web / desktop / mobile FCM", discord: "Yes" },
  { feature: "Desktop app", descall: "Windows installer + web + Android", discord: "All major platforms" },
  { feature: "Mobile", descall: "Android APK + mobile web (+ iOS PWA)", discord: "Native iOS/Android" },
  { feature: "Encryption", descall: "TLS + secure WebRTC in transit", discord: "TLS + secure voice" },
  { feature: "Account security", descall: "Password, Google, optional 2FA", discord: "Password, OAuth, 2FA" },
  { feature: "Moderation", descall: "Kick, ban, timeout, audit log, invites", discord: "Deep tools + bots" },
  { feature: "Cosmetic shop (core free)", descall: "DesCoin cosmetics; core free", discord: "Nitro unlocks extras" },
  { feature: "Bots & integrations", descall: "Not a bot marketplace (yet)", discord: "Huge ecosystem" },
  { feature: "Price for chat + calls", descall: "Free", discord: "Free + Nitro upsell" },
  { feature: "Focus", descall: "Friends, servers, LFG, lightweight calls", discord: "Huge communities + ecosystem" },
];

export const COMPARE_FAQ = [
  {
    q: "Is Descall a Discord alternative?",
    a: "Yes. Descall is a free Discord alternative with real-time chat, servers (roles, channels, voice), group video, screen share, and gamer-focused LFG — without Nitro paywalls for core features.",
  },
  {
    q: "Does Descall have servers like Discord?",
    a: "Yes. Create a server from scratch or pick an advanced template (gaming, Valorant, friends, community, study, streaming). You get categories, text/voice/stage channels, roles, permission overrides, invites, and moderation tools.",
  },
  {
    q: "Can Descall replace Discord for friend groups?",
    a: "For friend groups and small-to-mid communities that need DMs, servers, roles, voice, and screen share, Descall is a strong lighter alternative. Very large bot ecosystems still favor Discord today.",
  },
  {
    q: "Does Descall have roles and channel permissions?",
    a: "Yes. Servers support role hierarchy (Admin, Moderator, and custom roles), plus per-channel allow/deny overrides for staff rooms, announcement channels, and VIP lounges.",
  },
  {
    q: "Does Descall have screen sharing?",
    a: "Yes. Descall supports screen share in DM and group/server calls with quality presets designed for smooth sharing.",
  },
  {
    q: "Is there a desktop app?",
    a: "Yes. Download the Windows desktop client from the Download page. You can also use Descall fully in the browser, plus Android APK builds.",
  },
  {
    q: "Is Descall free?",
    a: "Yes. Messaging, servers, voice, video, and screen share are free. Optional cosmetics use DesCoin — they do not gate core communication.",
  },
  {
    q: "Does Descall support end-to-end encrypted messages?",
    a: "Descall encrypts traffic in transit (TLS / secure WebRTC). It does not currently market full E2E message encryption like a sealed messenger — we stay accurate about that.",
  },
];

/** Unique FAQ for /discord-alternative — do not reuse COMPARE_FAQ (duplicate FAQ schema). */
export const ALTERNATIVE_HUB_FAQ = [
  {
    q: "What is a Discord alternative?",
    a: "A Discord alternative is an app that covers the same jobs — chat, servers, voice, video, and screen share — without copying Discord’s UI or Nitro model. Descall is built as a lighter free option for friends, gamers, and small communities.",
  },
  {
    q: "What is the best free Discord alternative in 2026?",
    a: "It depends on the job. If you need mega-servers and a huge bot store, Discord still leads. If you want free HD voice, screen share, real servers, and Valorant LFG without a Nitro wall, Descall is a strong free Discord alternative.",
  },
  {
    q: "Does a Discord alternative need servers like Discord?",
    a: "Not always — some apps are DM-only. Descall includes Discord-style servers (roles, channels, templates) plus DMs, so friend groups can keep structure without running a second tool.",
  },
  {
    q: "Is there a Discord alternative with screen share and LFG?",
    a: "Yes. Descall includes screen share in calls and a dedicated Play tab for Valorant LFG, so squads can queue and hop into voice in one app.",
  },
  {
    q: "Can I use this Discord alternative on Windows and Android?",
    a: "Yes. Use the Windows desktop app, Android builds, or the full web app in a browser. Create a free account to chat, call, and open servers.",
  },
];

/** Unique FAQ for /alternatives — comparison intent, not a clone of the vs-Discord page. */
export const ALTERNATIVES_FAQ = [
  {
    q: "What are the best Discord alternatives in 2026?",
    a: "Shortlist by job: Descall for free friend/gamer voice + servers, Discord if you still need bots and huge publics, Guilded for structured gaming calendars, TeamSpeak/Mumble for classic voice rooms, Telegram if you only need messengers.",
  },
  {
    q: "Which Discord alternative is free with voice and screen share?",
    a: "Descall keeps messaging, servers, voice, video, and screen share free. Optional cosmetics never lock talking to friends. Always check whether a listed “free” app paywalls calls.",
  },
  {
    q: "Discord alternative vs Discord clone — what’s the difference?",
    a: "A clone copies Discord’s server UI. An alternative solves the same jobs with a different product. Descall is an alternative: servers and calls exist, but the app stays lighter and LFG is built in.",
  },
  {
    q: "Are there Discord alternatives for gamers and LFG?",
    a: "Yes. Look for voice lobbies, screen share, and a party finder. Descall’s Play tab and Valorant server templates are built for that — see the gamers and LFG pages.",
  },
  {
    q: "Should I keep Discord and also use an alternative?",
    a: "Many groups do. Keep Discord for bot-heavy public communities; run nightly voice, DMs, and LFG on a lighter free app like Descall.",
  },
];

export const ALTERNATIVE_PILLARS = [
  {
    title: "Servers ready in minutes",
    body: "Start from scratch or pick a template packed with roles, text & voice channels, topics, slowmode, and staff permission overrides — gaming, Valorant, community, study, friends, or streaming.",
  },
  {
    title: "Roles, channels & moderation",
    body: "Discord-style roles and channel overrides, plus kick, ban, timeout, audit logs, and invites. Run a private hangout or a public-ready community without bot hell for the basics.",
  },
  {
    title: "Built for friends & LFG",
    body: "Descall still prioritizes DMs, presence, and a dedicated Play tab for Valorant LFG — so squads can queue and hop into server voice in one app.",
  },
  {
    title: "Calls without the bloat",
    body: "WebRTC voice/video with TURN support, incoming call UX, PiP, and screen-share quality controls. A lighter Discord alternative when you want clean calls inside servers or DMs.",
  },
  {
    title: "Free core, optional cosmetics",
    body: "Chat, servers, and calls are free. The shop is cosmetic (themes, frames, effects) via DesCoin — not a Nitro-style lock on talking to friends.",
  },
  {
    title: "Desktop + web + Android",
    body: "Install on Windows, open the web app anywhere, or use Android. A practical Discord alternative if your group mixes desktop gaming with mobile chat.",
  },
];

export const GAMER_FAQ = [
  {
    q: "What is the best Discord alternative for gamers in 2026?",
    a: "If you want chat, servers with voice lobbies, screen share, and built-in Valorant LFG without Nitro, Descall is a strong Discord alternative for gaming friend groups.",
  },
  {
    q: "Does Descall have gaming server templates?",
    a: "Yes. Create a Gaming hub or Valorant / competitive server with LFG channels, clip drops, scrim voice rooms, and staff roles already configured.",
  },
  {
    q: "Does Descall support Valorant LFG?",
    a: "Yes. The Play tab lets you create and join LFG lobbies, and you can link your Riot ID (Name#TAG) so rank can show on your profile after a successful link.",
  },
  {
    q: "Can I screen share while gaming?",
    a: "Yes. Use Descall voice/video calls with screen share quality presets — useful for reviewing VODs, showing loadouts, or watching together.",
  },
];

export const TURKEY_FAQ = [
  {
    q: "Discord alternatifi olarak Descall nedir?",
    a: "Descall; sohbet, sunucular (roller, kanallar, ses), ses/görüntülü arama, ekran paylaşımı ve Valorant LFG odaklı ücretsiz bir Discord alternatifidir.",
  },
  {
    q: "Discord muadili ne demek — Descall uygun mu?",
    a: "Discord muadili, aynı işi (sohbet, ses, sunucu) gören başka bir uygulamadır. Descall, Nitro zorunluluğu olmadan ses, ekran paylaşımı ve sunucu seven gruplar için bir Discord muadilidir.",
  },
  {
    q: "Discord benzeri uygulamalar hangileri?",
    a: "İhtiyaca göre değişir: Descall ücretsiz ses + sunucu, Discord büyük bot ekosistemi, Guilded takvimli oyun sunucuları, TeamSpeak klasik ses odaları, Telegram ise mesajlaşma. Ses + ekran paylaşımı + LFG istiyorsan Descall pratik bir Discord benzeri uygulamadır.",
  },
  {
    q: "Türk Discord alternatifi var mı?",
    a: "Descall Türkiye’de geliştirilen, Türkçe arayüzlü bir Discord alternatifidir. Web, Windows ve Android ile klan, sınıf ve oyuncu grupları için tasarlandı.",
  },
  {
    q: "Descall’da Discord gibi sunucu var mı?",
    a: "Evet. Sıfırdan veya hazır şablonlarla sunucu kurabilirsin: yazı/ses kanalları, roller, izinler, davetler ve moderasyon araçları hazır gelir.",
  },
  {
    q: "Türkiye’den Discord alternatifi arıyorum — Descall uygun mu?",
    a: "Evet. Türkçe arayüz desteği, web + Windows istemcisi, Android ve sunucu sistemiyle Descall, Türkiye’deki oyuncu grupları için pratik bir Discord alternatifidir.",
  },
  {
    q: "Descall ücretli mi?",
    a: "Hayır. Temel sohbet, sunucu ve aramalar ücretsizdir. Kozmetikler DesCoin ile alınabilir; Nitro benzeri zorunlu abonelik yoktur.",
  },
  {
    q: "Arkadaşlarımı nasıl davet ederim?",
    a: "Arkadaşlar sekmesinden davet linkini kopyala veya sunucu daveti oluştur. Linkle gelen kişi ücretsiz kayıt olunca seninle bağlanır.",
  },
];

export const BLOG_POSTS = [
  {
    slug: "discord-vs-descall",
    path: "/blog/discord-vs-descall",
    title: "Discord vs Descall: which should your group use in 2026?",
    description:
      "An honest Discord vs Descall comparison for chat, servers, roles, voice, screen share, LFG, and pricing — when a lighter Discord alternative wins.",
    date: "2026-08-11",
    updated: "2026-08-14",
    tags: ["Discord alternative", "Comparison"],
  },
  {
    slug: "best-discord-alternatives-2026",
    path: "/blog/best-discord-alternatives-2026",
    title: "Best Discord alternatives in 2026 — honest shortlist",
    description:
      "Best Discord alternatives in 2026 for friends, servers, voice, and LFG — how Descall, Discord, Guilded, and others actually compare.",
    date: "2026-08-11",
    updated: "2026-08-14",
    tags: ["Discord alternatives", "Roundup"],
  },
  {
    slug: "apps-like-discord",
    path: "/blog/apps-like-discord",
    title: "Apps like Discord — what to use instead in 2026",
    description:
      "Apps like Discord explained by job-to-be-done: friend voice, community servers, or pure voice rooms — and where Descall fits.",
    date: "2026-08-11",
    updated: "2026-08-14",
    tags: ["Apps like Discord", "Comparison"],
  },
  {
    slug: "discord-competitors",
    path: "/blog/discord-competitors",
    title: "Discord competitors in 2026 — who actually competes",
    description:
      "Map of Discord competitors in 2026: lighter friend apps, gaming suites, and voice classics — plus where Descall competes honestly.",
    date: "2026-08-11",
    updated: "2026-08-14",
    tags: ["Discord competitors", "Market"],
  },
  {
    slug: "best-discord-alternative-for-lfg",
    path: "/blog/best-discord-alternative-for-lfg",
    title: "Best Discord alternative for Valorant LFG",
    description:
      "Why gamers looking for a Discord alternative for LFG choose Descall’s Play tab, party codes, and Riot account link.",
    date: "2026-08-11",
    updated: "2026-08-14",
    tags: ["LFG", "Valorant", "Discord alternative"],
  },
  {
    slug: "leave-nitro-keep-voice-chat",
    path: "/blog/leave-nitro-keep-voice-chat",
    title: "Leave Nitro. Keep voice chat.",
    description:
      "How to move a friend group from Discord Nitro habits to a free Discord alternative with servers, voice, video, and screen share.",
    date: "2026-08-11",
    updated: "2026-08-14",
    tags: ["Pricing", "Migration"],
  },
  {
    slug: "discord-alternative-for-communities-guide",
    path: "/blog/discord-alternative-for-communities-guide",
    title: "Discord alternative for communities — practical guide",
    description:
      "How small communities pick a Discord alternative: servers, roles, invites, voice hangouts, and when to stay on Discord.",
    date: "2026-08-11",
    updated: "2026-08-14",
    tags: ["Communities", "Guide"],
  },
  {
    slug: "voice-chat-alternative-to-discord",
    path: "/blog/voice-chat-alternative-to-discord",
    title: "Voice chat alternative to Discord — free calls guide",
    description:
      "Looking for a voice chat alternative to Discord? How Descall handles free WebRTC calls, server voice, screen share, and gaming nights.",
    date: "2026-08-11",
    updated: "2026-08-14",
    tags: ["Voice", "Guide"],
  },
  {
    slug: "migrate-from-discord-to-descall",
    path: "/blog/migrate-from-discord-to-descall",
    title: "Migrate from Discord to Descall — practical checklist",
    description:
      "Step-by-step migration from Discord to Descall: invite friends, recreate servers with templates, move LFG, and keep voice nights free.",
    date: "2026-08-14",
    updated: "2026-08-14",
    tags: ["Migration", "Discord alternative"],
  },

];

/** Per-post FAQ — unique questions so blog pages do not clone COMPARE_FAQ schema. */
export const BLOG_FAQ_BY_SLUG = {
  "discord-vs-descall": [
    {
      q: "Should my group pick Discord or Descall?",
      a: "Pick Descall for nightly friend voice, servers, and LFG without Nitro. Keep Discord if you still depend on a large bot marketplace or huge public servers.",
    },
    {
      q: "Is this Discord vs Descall comparison sponsored?",
      a: "No. Descall makes the product, and the article states where Discord still wins — bots, giant communities, and broader historic client coverage.",
    },
  ],
  "best-discord-alternative-for-lfg": [
    {
      q: "Why use a Discord alternative for Valorant LFG?",
      a: "Most Discord LFG setups are bots and extra servers. Descall’s Play tab, party codes, and Riot Name#TAG link live in the same app as voice.",
    },
    {
      q: "Do I still need a Discord LFG server?",
      a: "Only if that community already lives there. New squads can queue on Descall and jump straight into a call.",
    },
  ],
  "leave-nitro-keep-voice-chat": [
    {
      q: "Can I leave Nitro and still have group voice?",
      a: "Yes. Descall voice, video, and screen share are free. Cosmetics are optional and never lock calls.",
    },
    {
      q: "How long does a friend-group move take?",
      a: "Invite the core squad, recreate a small server from a template, and run voice nights on Descall for two weeks before dropping Discord Nitro habits.",
    },
  ],
  "best-discord-alternatives-2026": [
    {
      q: "How should I shortlist Discord alternatives in 2026?",
      a: "Match the job: friend voice, community servers, or pure voice rooms. Then check whether calls are free and whether LFG is built in.",
    },
    {
      q: "Is Descall on this 2026 shortlist?",
      a: "Yes, for friend groups and gamers who want free calls plus real servers. Discord remains the pick for bot-heavy mega-communities.",
    },
  ],
  "apps-like-discord": [
    {
      q: "What counts as an app like Discord?",
      a: "Anything that combines chat, presence, and group voice. Websites like Discord add servers; some apps are voice-only.",
    },
    {
      q: "Which app like Discord is lightest for friends?",
      a: "If you do not need a bot store, Descall is a lighter app like Discord for DMs, servers, and calls.",
    },
  ],
  "discord-competitors": [
    {
      q: "Who actually competes with Discord in 2026?",
      a: "Lighter friend apps, gaming suites, and classic voice tools. Descall competes on free calls, servers, and LFG — not on Discord’s bot catalog.",
    },
    {
      q: "Is every chat app a Discord competitor?",
      a: "No. Slack, Telegram, and TeamSpeak overlap only on some jobs. Compare by voice, servers, and whether core features are free.",
    },
  ],
  "discord-alternative-for-communities-guide": [
    {
      q: "Can a small community leave Discord?",
      a: "Yes if you need roles, channels, invites, and voice hangouts — not a giant bot list. Descall templates cover that setup.",
    },
    {
      q: "When should a community stay on Discord?",
      a: "Stay if moderation bots, public discovery, or a huge member base are load-bearing. Hybrid setups are common.",
    },
  ],
  "voice-chat-alternative-to-discord": [
    {
      q: "What is a good voice chat alternative to Discord?",
      a: "Look for free WebRTC calls, screen share, and a desktop app. Descall is built for that without paywalling talk time.",
    },
    {
      q: "Does a voice alternative still need text chat?",
      a: "Most groups want both. Descall pairs DMs and servers with the same voice stack so you are not juggling two apps.",
    },
  ],
  "migrate-from-discord-to-descall": [
    {
      q: "How do I migrate from Discord to Descall?",
      a: "Invite friends, recreate a server from a template, move LFG to the Play tab, and keep Discord only for bot-heavy rooms you still need.",
    },
    {
      q: "Will message history import from Discord?",
      a: "There is no bulk Discord history importer today. Pin key links, rebuild channels, and start fresh voice nights on Descall.",
    },
  ],
};
export const BLOG_RELATED = [
  { to: "/discord-alternative", label: "Discord alternative hub" },
  { to: "/compare/discord", label: "Descall vs Discord" },
  { to: "/alternatives", label: "All alternatives" },
  { to: "/apps-like-discord", label: "Apps like Discord" },
  { to: "/discord-alternative-for-lfg", label: "Valorant LFG" },
  { to: "/features", label: "Features — servers & more" },
  { to: "/security", label: "Security & encryption" },
  { to: "/download", label: "Download Descall" },
  { to: "/faq", label: "FAQ" },
  { to: "/blog/migrate-from-discord-to-descall", label: "Migrate from Discord" },
  { to: "/status", label: "Status" },
];
