# Sitemap / SEO

Descall exposes an **advanced multi-file sitemap** from the Express backend (not a static Vite file), so invite links and announcements stay fresh.

## Endpoints

| URL | Purpose |
|-----|---------|
| `/robots.txt` | Crawl rules + `Sitemap:` pointer |
| `/sitemap.xml` | Sitemap **index** |
| `/sitemap-pages.xml` | Core public pages (`/`, `/download`, …) + `hreflang` |
| `/sitemap-invites.xml` | Active group invite deep-links (+ optional image tags) |
| `/sitemap-announcements.xml` | Active announcements |
| `/sitemap.html` | Human-readable HTML sitemap |
| `/sitemap.xsl` | Pretty XML stylesheet in browsers |
| `/api/sitemap/stats` | JSON counts for ops/debug |

## Config

- Prefer `PUBLIC_APP_URL` (or `SITE_URL`) for absolute URLs in production.
- Falls back to `X-Forwarded-*` / request host, then `https://des-call.onrender.com`.

## Notes

- Invite entries skip expired / maxed-out codes.
- API and auth prefixes are `Disallow` in robots.
- Mounted in `server.js` **before** the SPA catch-all.
