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
2. Verify via DNS TXT or the existing HTML file method Vercel/hosting supports
3. Submit sitemap: `https://descall.com/sitemap.xml`
4. Optional Google Indexing API:
   - Create a GCP service account with Indexing API enabled
   - Share the GSC property with that service account email
   - Export JSON key and set env `GOOGLE_INDEXING_CREDENTIALS_JSON` (stringified) when running `npm run seo:index`

## IndexNow

Key file is published at `/4f463b15fd51f502c6bb73abbeb38e3c.txt` (see `scripts/request-indexing.mjs`).

## Host split note (`www` vs `app`)

- Canonical marketing host: `https://descall.com` (www → apex 301 in `vercel.json`)
- API/realtime stays on Render (`des-call.onrender.com`) — see `src/config/api.js`
- Authenticated app routes boot the full bundle; public marketing paths use static-first hydrate
- A full `app.descall.com` DNS cutover is optional later; current hybrid already keeps marketing JS lean
