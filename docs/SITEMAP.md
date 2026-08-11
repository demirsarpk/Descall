# Sitemap / SEO

Descall exposes sitemap + robots from the Express backend (mounted **before** the SPA catch-all).

## Policy

**Only real, indexable marketing URLs** are published. Group invites and `?announcement=` query URLs are **not** in the sitemap index (they are ephemeral / have no public landing).

Client routes live under `frontend/src/site/` and must stay in sync with `staticPages()` in `frontend/backend/routes/sitemap.js`.

## Endpoints

| URL | Purpose |
|-----|---------|
| `/robots.txt` | Crawl rules + `Sitemap:` pointer |
| `/sitemap.xml` | Sitemap **index** (pages only) |
| `/sitemap-pages.xml` | Canonical public marketing pages |
| `/sitemap.html` | Human-readable HTML sitemap |
| `/sitemap.xsl` | Pretty XML stylesheet |
| `/api/sitemap/stats` | JSON diagnostics |

Legacy empty stubs (not linked from the index): `/sitemap-invites.xml`, `/sitemap-announcements.xml`.

## Config

- Prefer `PUBLIC_APP_URL` (or `SITE_URL`) for absolute URLs in production.
- Falls back to `X-Forwarded-*` / request host, then canonical host `https://descall.com`.

## Notes

- Authenticated app UI is `noindex` via client `SeoHead` (`forceNoindex`).
- Vite web builds use `base: "/"` so deep routes load assets; Electron builds set `ELECTRON_BUILD=1` for `base: "./"`.
