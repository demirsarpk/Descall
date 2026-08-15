/**
 * Rich crawlable HTML bodies for core marketing pages (used by prerender-seo.mjs).
 * Keep in sync with React pages — this is the bot-visible body, not a thin meta stub.
 */
import { FAQ_ITEMS } from "../faqData.js";
import { PRIVACY_CONTENT, TERMS_CONTENT } from "../../legal/legalContent.js";
import { SITE_OPERATOR } from "../siteIdentity.js";
import {
  ALTERNATIVE_HUB_FAQ,
  ALTERNATIVES_FAQ,
  COMPARE_FAQ,
  TURKEY_FAQ,
} from "../content/discordSeoContent.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function brandBlock() {
  return `<a class="seo-brand" href="/" aria-label="Descall home"><span class="seo-brand-mark" aria-hidden="true">D</span><span>Descall</span><span class="seo-brand-beta">Beta</span></a>`;
}

function ctaRow(extraSoftHref = "/discord-alternative", extraSoftLabel = "Discord alternative") {
  return `<p class="seo-cta-row">
    <a class="seo-cta-primary" href="/download">Download</a>
    <a class="seo-cta-soft" href="${extraSoftHref}">${extraSoftLabel}</a>
  </p>`;
}

function navBlock() {
  // Download lives in the CTA row — not as a purple button mid-nav.
  return `${ctaRow()}
  <p class="seo-explore-label">Explore</p>
  <nav aria-label="Descall">
    <a href="/features">Features</a>
    <a href="/discord-alternative">Discord alternative</a>
    <a href="/alternatives">Alternatives</a>
    <a href="/discord-alternative-for-lfg">Valorant LFG</a>
    <a href="/compare/discord">vs Discord</a>
    <a href="/apps-like-discord">Apps like Discord</a>
    <a href="/faq">FAQ</a>
    <a href="/blog">Blog</a>
  </nav>
  <nav class="seo-legal-nav" aria-label="Legal">
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
    <a href="/about">About</a>
    <a href="/contact">Contact</a>
    <a href="/tr">Türkçe</a>
  </nav>
  <p class="seo-hydrate-row">
    <button type="button" data-hydrate data-auth="register">Start free</button>
    <button type="button" data-hydrate data-auth="login">Sign in</button>
  </p>`;
}

function faqHtml(items) {
  return `<h2>FAQ</h2>
  ${items
    .map(
      (f) =>
        `<section><h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p></section>`
    )
    .join("\n")}`;
}

function legalHtml(data) {
  const sections = (data.sections || [])
    .map(
      (s) =>
        `<h2>${escapeHtml(s.heading)}</h2>${(s.paragraphs || [])
          .map((p) => `<p>${escapeHtml(p)}</p>`)
          .join("\n")}`
    )
    .join("\n");
  return `
<main>
  ${brandBlock()}
  <article>
    <h1>${escapeHtml(data.title)}</h1>
    <p><strong>${escapeHtml(data.updated)}</strong></p>
    <p>${escapeHtml(data.intro)}</p>
    ${sections}
    <p>Contact: <a href="mailto:${SITE_OPERATOR.supportEmail}">${SITE_OPERATOR.supportEmail}</a></p>
  </article>
  ${navBlock()}
</main>`;
}

export function corePageBody(path) {
  const original = path;
  const bare =
    path === "/tr" || path === "/tr/"
      ? "/"
      : path.startsWith("/tr/")
        ? path.slice(3)
        : path;
  switch (bare) {
    case "/":
      return `
<main>
  ${brandBlock()}
  <p><span>Beta</span> — ${escapeHtml(SITE_OPERATOR.statusNote)}</p>
  <h1>Descall</h1>
  <p>HD voice, video, screen share, and Discord-style servers — plus Valorant LFG. Free chat for friends and gamers.</p>
  <h2>Why teams switch</h2>
  <ul>
    <li>Discord-style servers with roles, channel overrides, invites, and moderation</li>
    <li>HD voice/video and screen share without Nitro paywalls on core communication</li>
    <li>Built-in Valorant LFG so squads queue without bot hell</li>
    <li>Windows desktop, Android, and full web app</li>
  </ul>
  <h2>Core features</h2>
  <ul>
    <li>Servers &amp; channels — text, voice, and stage with categories</li>
    <li>Roles &amp; permissions — hierarchy, staff rooms, per-channel allow/deny</li>
    <li>Advanced templates — Gaming, Valorant, Friends, Community, Study, Streaming</li>
    <li>Real-time chat — DMs and server messaging with presence</li>
    <li>Voice, video &amp; screen share — WebRTC calls with quality presets</li>
  </ul>
  <p><a href="/download">Download Descall</a> · <a href="/features">Explore features</a> · <a href="/discord-alternative">Discord alternative</a></p>
  ${navBlock()}
</main>`;

    case "/features":
      return `
<main>
  ${brandBlock()}
  <h1>Descall Features — Free Voice, Screen Share &amp; Servers</h1>
  <p>See what’s included for free: HD voice/video, screen share, Discord-style servers, roles, templates, and Valorant LFG.</p>
  <h2>Servers &amp; community tools</h2>
  <ul>
    <li>Full server structure with categories, text, voice, and stage channels</li>
    <li>Role hierarchy with hoist/mention and per-channel permission overrides</li>
    <li>Kick, ban, timeout, audit logs, community rules, and invite links</li>
    <li>Advanced templates with ready-made roles and staff rooms</li>
  </ul>
  <h2>Chat, calls &amp; screen share</h2>
  <ul>
    <li>Real-time DMs and server chat with typing indicators</li>
    <li>WebRTC voice and HD video for groups and server lobbies</li>
    <li>Screen share with quality presets for games, VODs, and watch parties</li>
  </ul>
  <h2>Gaming extras</h2>
  <ul>
    <li>Valorant LFG lobbies, party codes, and Riot Name#TAG linking</li>
    <li>Optional DesCoin cosmetics — core chat and calls stay free</li>
  </ul>
  <p><a href="/download">Download</a> · <a href="/compare/discord">Descall vs Discord</a></p>
  ${navBlock()}
</main>`;

    case "/faq": {
      const items = FAQ_ITEMS.map(
        (f) =>
          `<section><h2>${escapeHtml(f.q)}</h2><p>${escapeHtml(f.a)}</p></section>`
      ).join("\n");
      return `
<main>
  ${brandBlock()}
  <h1>Frequently asked questions about Descall</h1>
  <p>Answers about accounts, servers, desktop download, calls, screen share, and privacy.</p>
  ${items}
  <p><a href="/contact">Contact support</a> · <a href="/download">Download</a></p>
  ${navBlock()}
</main>`;
    }

    case "/download":
      return `
<main>
  ${brandBlock()}
  <h1>Download Descall for Windows — Free Voice Chat App</h1>
  <p>Get the Windows desktop app, Android builds, or the full web app in your browser.</p>
  <h2>Platforms</h2>
  <ul>
    <li>Windows installer for the native desktop client</li>
    <li>Android APK builds for mobile</li>
    <li>Full-featured web app at descall.com — no install required</li>
  </ul>
  <h2>What you get</h2>
  <ul>
    <li>Servers, roles, channels, and moderation tools</li>
    <li>Chat, voice, video, and screen share</li>
    <li>Valorant LFG and friend presence</li>
  </ul>
  <p>Descall is currently in <strong>Beta</strong>. Core communication features are free.</p>
  <p><a href="/features">See features</a> · <a href="/faq">FAQ</a></p>
  ${navBlock()}
</main>`;

    case "/about":
      return `
<main>
  ${brandBlock()}
  <h1>About Descall</h1>
  <p><strong>Beta</strong> — ${escapeHtml(SITE_OPERATOR.statusNote)}</p>
  <p>Descall is an independent messaging and voice platform built for friends, gaming squads, and small communities who want Discord-style servers without Nitro paywalls on core chat and calls.</p>
  <h2>Operator</h2>
  <ul>
    <li>Product: ${escapeHtml(SITE_OPERATOR.productName)}</li>
    <li>Operator: ${escapeHtml(SITE_OPERATOR.operatorName)}</li>
    <li>Based in: ${escapeHtml(SITE_OPERATOR.country)}</li>
    <li>Support: <a href="mailto:${SITE_OPERATOR.supportEmail}">${SITE_OPERATOR.supportEmail}</a></li>
    <li>Source: <a href="${SITE_OPERATOR.githubUrl}">GitHub</a></li>
  </ul>
  <h2>What we build</h2>
  <p>Real-time messaging, Discord-style servers, WebRTC voice/video, screen share, and Valorant LFG — with privacy policies and security docs you can actually read.</p>
  <p>Last updated: ${escapeHtml(SITE_OPERATOR.lastUpdatedLabel)}</p>
  ${navBlock()}
</main>`;

    case "/security":
      return `
<main>
  ${brandBlock()}
  <h1>Security at Descall</h1>
  <p>How Descall protects chats and calls — encryption in transit, account security, and honest limits.</p>
  <h2>Transport encryption (not default E2E)</h2>
  <p>Web and API traffic use HTTPS/TLS. Real-time media uses WebRTC with DTLS/SRTP between peers when a call is established. Descall does not claim default end-to-end encryption for all message history stored on the server — messages are encrypted in transit and stored to deliver chat history to your devices.</p>
  <h2>Voice &amp; video</h2>
  <p>Call media is transmitted with WebRTC security (DTLS/SRTP). Descall does not record or store call audio/video by default. If a participant records locally, that is outside Descall's control.</p>
  <h2>Accounts</h2>
  <p>Passwords are hashed with bcrypt. Optional email 2FA and Google sign-in are available. Session management lets you revoke devices.</p>
  <h2>Report an issue</h2>
  <p>Email <a href="mailto:${SITE_OPERATOR.supportEmail}">${SITE_OPERATOR.supportEmail}</a> or open an issue on GitHub. Include enough detail for a safe investigation.</p>
  ${navBlock()}
</main>`;

    case "/status":
      return `
<main>
  ${brandBlock()}
  <h1>Descall service status</h1>
  <p>${escapeHtml(SITE_OPERATOR.statusNote)}</p>
  <ul>
    <li>Product stage: Beta</li>
    <li>Transport security: TLS / DTLS-SRTP</li>
    <li>Operator: ${escapeHtml(SITE_OPERATOR.operatorName)} · ${escapeHtml(SITE_OPERATOR.country)}</li>
    <li>Support: <a href="mailto:${SITE_OPERATOR.supportEmail}">${SITE_OPERATOR.supportEmail}</a></li>
    <li>API health: <a href="https://des-call.onrender.com/api/status">/api/status</a></li>
    <li>Source: <a href="${SITE_OPERATOR.githubUrl}">GitHub</a></li>
  </ul>
  <p>Last updated: ${escapeHtml(SITE_OPERATOR.lastUpdatedLabel)}</p>
  ${navBlock()}
</main>`;

    case "/contact":
      return `
<main>
  ${brandBlock()}
  <h1>Contact Descall</h1>
  <p>Support, feedback, press, and security reports.</p>
  <h2>Support &amp; feedback</h2>
  <p>Email the Descall team at <a href="mailto:${SITE_OPERATOR.supportEmail}">${SITE_OPERATOR.supportEmail}</a>.</p>
  <h2>Operator</h2>
  <p>${escapeHtml(SITE_OPERATOR.operatorName)} · ${escapeHtml(SITE_OPERATOR.country)}</p>
  <h2>Security</h2>
  <p>For security reports, contact us by email and include enough detail to investigate safely.</p>
  ${navBlock()}
</main>`;

    case "/privacy":
      return legalHtml(PRIVACY_CONTENT.en);

    case "/terms":
      return legalHtml(TERMS_CONTENT.en);

    case "/discord-alternative":
      return `
<main>
  ${brandBlock()}
  <h1>The best free Discord alternative for friends &amp; gamers</h1>
  <p>A free Discord alternative with real servers, HD voice/video, screen share, and Valorant LFG. Core chat and calls stay free — no Nitro paywall.</p>
  ${ctaRow("/compare/discord", "Discord vs Descall")}
  <h2>What you get</h2>
  <ul>
    <li>Discord-style servers with roles, channels, and templates</li>
    <li>Free real-time chat, group voice/video, and screen share</li>
    <li>Built-in Valorant LFG without bot hell</li>
    <li>Windows, Android, and full web app</li>
  </ul>
  <p><a href="/alternatives">Compare Discord alternatives</a> · <a href="/discord-alternative-turkey">Türkçe</a> · <a href="/download">Download</a></p>
  ${faqHtml(ALTERNATIVE_HUB_FAQ)}
  ${navBlock()}
</main>`;

    case "/alternatives":
      return `
<main>
  ${brandBlock()}
  <h1>Discord alternatives compared — pick by what you actually need</h1>
  <p>Honest 2026 comparison of Discord alternatives: Descall, Discord, Guilded, TeamSpeak, Telegram. Free voice, screen share, and friend-group servers.</p>
  ${ctaRow("/discord-alternative", "Why Descall")}
  <h2>How to choose</h2>
  <ol>
    <li>List must-have features (voice, screen share, LFG, mobile).</li>
    <li>Check whether core chat/calls are free or paywalled.</li>
    <li>Try a week with your actual friend group.</li>
    <li>Keep Discord only if you still need giant community servers.</li>
  </ol>
  <h2>Shortlist</h2>
  <ul>
    <li><a href="/discord-alternative">Descall</a> — free Discord alternative for friends, servers, and LFG</li>
    <li><a href="/compare/discord">Discord</a> — still strongest for bots and huge publics</li>
    <li>Guilded, TeamSpeak/Mumble, Telegram — fit narrower jobs</li>
  </ul>
  ${faqHtml(ALTERNATIVES_FAQ)}
  ${navBlock()}
</main>`;

    case "/compare/discord": {
      const tr = original.startsWith("/tr");
      const h1 = tr
        ? "Discord mu Descall mı — 2026 karşılaştırması"
        : "Discord vs Descall — which fits your group in 2026?";
      const lead = tr
        ? "Discord vs Descall yan yana: sunucular, roller, ses, ekran paylaşımı, LFG ve fiyat. Arkadaş grubu için hangisi daha uygun?"
        : "Side-by-side Discord vs Descall: servers, roles, voice, screen share, LFG, mobile, and price. Clear verdict for friend groups vs mega-communities.";
      const verdictDescall = tr
        ? "Daha hafif bir Discord alternatifi, gerçek sunucular, ses, ekran paylaşımı ve Valorant LFG istiyorsan Descall önde — temel özellikler ücretsiz."
        : "wins if you want a lighter Discord alternative with real servers, friends voice, screen share, and Valorant LFG — with free core features.";
      const verdictDiscord = tr
        ? "Dev bot ekosistemi ve kocaman kamu sunucuları için Discord hâlâ güçlü. Birçok grup ikisini birden kullanır."
        : "still wins for massive bot ecosystems. Many groups run both.";
      return `
<main>
  ${brandBlock()}
  <h1>${escapeHtml(h1)}</h1>
  <p>${escapeHtml(lead)}</p>
  ${ctaRow("/discord-alternative", tr ? "Discord alternatifi" : "Discord alternative overview")}
  <h2>${tr ? "Kısa karar" : "Quick verdict"}</h2>
  <p><strong>Descall</strong> ${escapeHtml(verdictDescall)}</p>
  <p><strong>Discord</strong> ${escapeHtml(verdictDiscord)}</p>
  <p><a href="/alternatives">${tr ? "Tüm alternatifler" : "All Discord alternatives"}</a> · <a href="/blog/discord-vs-descall">${tr ? "Uzun karşılaştırma yazısı" : "Longer comparison article"}</a></p>
  ${faqHtml(COMPARE_FAQ)}
  ${navBlock()}
</main>`;
    }

    case "/discord-alternative-turkey":
      return `
<main>
  ${brandBlock()}
  <h1>Türkiye için en iyi Discord alternatifi: Descall</h1>
  <p>Discord alternatifi, muadili veya benzeri uygulama mı arıyorsun? Descall: ücretsiz sohbet, sesli arama, ekran paylaşımı ve Valorant LFG. Türkçe arayüz.</p>
  ${ctaRow("/download", "Windows / Android indir")}
  <h2>Neden Türkiye’de Discord alternatifi aranıyor?</h2>
  <p>Nitro baskısı, ağır arayüz ve LFG için bot karmaşası istemeyen gruplar daha hafif bir uygulama arıyor. Descall klan, sınıf ve oyuncu toplulukları için tasarlandı.</p>
  <p><a href="/discord-alternative">English hub</a> · <a href="/alternatives">Alternatives list</a> · <a href="/tr">Türkçe ana sayfa</a></p>
  ${faqHtml(TURKEY_FAQ)}
  ${navBlock()}
</main>`;

    default:
      return null;
  }
}
