# SEO indexing & Search Console

Descall ships static sitemaps + an indexing helper. You still need Google Search Console ownership once.

## Already automated in-repo

```bash
cd frontend
npm run seo:index:dry   # preview URL queue
npm run seo:index       # IndexNow + sitemap ping (+ Google Indexing API if creds set)
npm run seo:link-audit  # orphan internal-link check
npm run seo:prod-check  # live HTML/CWV smoke
```

## One-time Google Search Console

1. Open [Google Search Console](https://search.google.com/search-console) → add property `https://descall.com`
2. Verify ownership (pick one):
   - **HTML meta tag (recommended for Vercel):** set `VITE_GSC_VERIFICATION` in Vercel env to the token Google shows (`content="…"` value). Redeploy — Vite injects `<meta name="google-site-verification">` into `index.html`.
   - DNS TXT, or HTML file upload if you prefer those methods
3. Optional Bing Webmaster: set `VITE_BING_SITE_VERIFICATION` (injects `msvalidate.01`)
4. Submit sitemap: `https://descall.com/sitemap.xml`
5. Optional Google Indexing API:
   - Create a GCP service account with Indexing API enabled
   - Share the GSC property with that service account email
   - Export JSON key and set env `GOOGLE_INDEXING_CREDENTIALS_JSON` (stringified) when running `npm run seo:index`

## Mobile LCP notes (DES-50)

- Marketing CSS self-hosts Inter + Outfit (latin subsets only) — no Google Fonts RTT
- Build injects `rel=preload` for Outfit 700 (H1 / brand display face) when the hashed woff2 is emitted
- Homepage LCP is typically text in `#seo-static h1` / hydrated hero — keep hero copy in the static shell
- Track `web_vital` (LCP/INP/CLS) in PostHog after cookie accept

## IndexNow

Key file is published at `/4f463b15fd51f502c6bb73abbeb38e3c.txt` (see `scripts/request-indexing.mjs`).

## Host split note (`www` vs `app`)

- Canonical marketing host: `https://descall.com` (www → apex 301 in `vercel.json`)
- API/realtime stays on Render (`des-call.onrender.com`) — see `src/config/api.js`
- Authenticated app routes boot the full bundle; public marketing paths use static-first hydrate
- A full `app.descall.com` DNS cutover is optional later; current hybrid already keeps marketing JS lean
