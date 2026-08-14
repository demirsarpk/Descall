/**
 * Rich crawlable HTML bodies for core marketing pages (used by prerender-seo.mjs).
 * Keep in sync with React pages — this is the bot-visible body, not a thin meta stub.
 */
import { FAQ_ITEMS } from "../faqData.js";
import { PRIVACY_CONTENT, TERMS_CONTENT } from "../../legal/legalContent.js";
import { SITE_OPERATOR } from "../siteIdentity.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function navBlock() {
  return `<nav aria-label="Descall">
    <a href="/">Home</a>
    <a href="/features">Features</a>
    <a href="/discord-alternative">Discord alternative</a>
    <a href="/compare/discord">vs Discord</a>
    <a href="/download">Download</a>
    <a href="/faq">FAQ</a>
    <a href="/blog">Blog</a>
    <a href="/about">About</a>
    <a href="/security">Security</a>
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
    <a href="/contact">Contact</a>
  </nav>`;
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
  switch (path) {
    case "/":
      return `
<main>
  <p><span>Beta</span> — ${escapeHtml(SITE_OPERATOR.statusNote)}</p>
  <h1>Descall — Free Discord Alternative with Servers, Chat &amp; Voice</h1>
  <p>Descall is a free Discord alternative with real servers (roles, channels, templates), chat, group voice/video, screen share, Valorant LFG, and Windows/Android apps.</p>
  <h2>Why teams switch from Discord</h2>
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
  <h1>Descall Features — Servers, roles, chat, calls &amp; LFG</h1>
  <p>Explore Descall features: Discord-style servers with roles &amp; channels, templates, messaging, group voice/video, screen share, Valorant LFG, and more.</p>
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
  <h1>Download Descall — Discord alternative for Windows &amp; Android</h1>
  <p>Get the Descall desktop app for Windows, use Android builds, or open the full web app in your browser.</p>
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

    case "/contact":
      return `
<main>
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

    default:
      return null;
  }
}
