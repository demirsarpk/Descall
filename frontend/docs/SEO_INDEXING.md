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

## Google Search Console

**Domain property + DNS TXT is enough.** `descall.com` verified as a Domain property already covers `https://`, `http://`, `www`, and other hostnames. Do **not** create a URL-prefix property (`https://descall.com`) just to get an HTML token.

`VITE_GSC_VERIFICATION` is **not required**. Vite injects `<meta name="google-site-verification">` only if that env var is set. Skip it.

Use the HTML meta path only if you later add a *separate* URL-prefix property and choose HTML-tag verification there. That is optional duplication, not a ranking requirement.

Still do in the existing Domain property:

1. Sitemap: `https://descall.com/sitemap.xml`
2. Optional Bing Webmaster: `VITE_BING_SITE_VERIFICATION` (injects `msvalidate.01`) — Bing has no Domain-property DNS equivalent in this repo
3. Optional Google Indexing API: add a GCP service account as a user on the **same Domain property**, set `GOOGLE_INDEXING_CREDENTIALS_JSON` when running `npm run seo:index`

## Mobile LCP notes (DES-50)

- Marketing CSS self-hosts Inter + Outfit (latin subsets only) — no Google Fonts RTT
- Build injects `rel=preload` for Outfit 700 (H1 / brand display face) when the hashed woff2 is emitted
- Homepage LCP is typically text in `#seo-static h1` / hydrated hero — keep hero copy in the static shell
- Track `web_vital` (LCP/INP/CLS) in PostHog after cookie accept

## IndexNow

Bing / Yandex / Seznam / Naver. Google uses Search Console + sitemap, not IndexNow.

- **Key file:** `https://descall.com/4f463b15fd51f502c6bb73abbeb38e3c.txt` (content is the key plus a single trailing newline)
- **Env:** `INDEXNOW_KEY` (scripts fall back to `frontend/public/<32-hex>.txt` if unset)
- **URL source:** `src/site/sitemapCatalog.js` — same list as prerender / sitemaps
- **Manual:** `cd frontend && npm run indexnow:submit` (or `:dry` / `:changed`)
- **Deploy:** `.github/workflows/indexnow.yml` runs after push to `main` (90s wait for Vercel). `vercel-deploy.yml` also submits after a CLI production deploy.
- **Endpoints:** POST `https://api.indexnow.org/indexnow` and `https://www.bing.com/indexnow`, plus a GET ping of the homepage as Bing's wizard documents.
- **Changed URLs:** `--changed` maps git diff → public paths. If the blast radius is the whole catalog (`seoConfig`, prerender, etc.) it sends the full sitemap. Unreliable diffs also fall back to full sitemap (~40 URLs, well under the 10k cap).

Do **not** click **Generate** on [Bing's IndexNow getstarted page](https://www.bing.com/indexnow/getstarted) after this is live. That button mints a *new* random key in the browser. Hosting it would rotate the live file and Bing 403s until it recrawls. Verify in Bing Webmaster Tools → **IndexNow Insights** (submissions appear there; no extra key paste is required).

## GSC playbook (legitimate only)

Do **not** click your own Google results, hire click farms, buy links, or stuff keywords. That can get the site filtered.

What *does* help, using Search Console data:

1. **HTTP leftovers in a Domain property.** Domain properties list `http://descall.com/` and `https://descall.com/` as separate URLs. That is expected, not a missing verification. `vercel.json` 301s HTTP→HTTPS and sends HSTS. Inspect a few `http://` URLs; Google should follow the 301 to the HTTPS canonical.
2. **Exact-match pillar.** `/discord-alternative` owns `discord alternative`. Homepage titles stay brand-first (`Descall — Voice Chat…`) so they do not steal that query.
3. **CTR on pages that already rank.** `/alternatives` (~position 4, 0 clicks) and `/compare/discord` (~position 9, 0 clicks) are snippet problems, not crawl problems — titles/descriptions are written to earn the click.
4. **Turkish queries** (`discord alternatifi`, `muadili`, `benzeri`) consolidate on `/discord-alternative-turkey`. `/tr/discord-alternative` 301s there so the two TR URLs do not compete.
5. **Unique FAQ JSON-LD** per commercial URL. Do not copy the same FAQPage onto hub, compare, list, and blog posts.
6. After a deploy: `npm run seo:index` (IndexNow + sitemap ping). Rankings take days/weeks; judge in GSC, not by searching Google yourself.

## Host split note (`www` vs `app`)

- Canonical marketing host: `https://descall.com` (www → apex 301 in `vercel.json`)
- API/realtime stays on Render (`des-call.onrender.com`) — see `src/config/api.js`
- Authenticated app routes boot the full bundle; public marketing paths use static-first hydrate
- A full `app.descall.com` DNS cutover is optional later; current hybrid already keeps marketing JS lean
