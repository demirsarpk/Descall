<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9"
  exclude-result-prefixes="s">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>Descall Sitemap (XML)</title>
        <style>
          :root { color-scheme: dark; }
          body { margin:0; font-family:system-ui,"Segoe UI",sans-serif; background:#0b0c10; color:#f2f3f5;
            background-image: radial-gradient(80% 50% at 50% -10%, rgba(88,101,242,.28), transparent 55%);
            padding: 32px 20px 64px; }
          .wrap { max-width: 960px; margin: 0 auto; }
          h1 { font-family:"Avenir Next",system-ui,sans-serif; font-size: clamp(28px, 5vw, 40px); letter-spacing:-.03em; margin:0 0 8px; }
          p { color:#949ba4; margin:0 0 22px; }
          .chips { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:22px; }
          .chips a { color:#8b9cff; text-decoration:none; font-weight:600; font-size:13px;
            padding:8px 12px; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.04); }
          table { width:100%; border-collapse:collapse; background:rgba(30,31,34,.9); border:1px solid rgba(255,255,255,.08); border-radius:16px; overflow:hidden; }
          th, td { text-align:left; padding:12px 14px; border-bottom:1px solid rgba(255,255,255,.06); font-size:14px; }
          th { color:#b5bac1; font-weight:600; background:#17181c; font-family:Outfit,sans-serif; }
          a { color:#8b9cff; text-decoration:none; word-break:break-all; }
          a:hover { text-decoration:underline; }
          .meta { font-size:12px; color:#949ba4; white-space:nowrap; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1>Descall XML sitemap</h1>
          <p>Styled view of the machine-readable sitemap. Crawlers still receive raw XML.</p>
          <div class="chips">
            <a href="/sitemap.html">Human sitemap</a>
            <a href="/sitemap.xml">XML index</a>
            <a href="/sitemap-pages.xml">Pages XML</a>
            <a href="/">Home</a>
          </div>
          <xsl:choose>
            <xsl:when test="s:sitemapindex">
              <table>
                <tr><th>Sitemap</th><th>Last modified</th></tr>
                <xsl:for-each select="s:sitemapindex/s:sitemap">
                  <tr>
                    <td><a href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
                    <td class="meta"><xsl:value-of select="s:lastmod"/></td>
                  </tr>
                </xsl:for-each>
              </table>
            </xsl:when>
            <xsl:otherwise>
              <table>
                <tr><th>URL</th><th>Priority</th><th>Change</th><th>Last modified</th></tr>
                <xsl:for-each select="s:urlset/s:url">
                  <tr>
                    <td><a href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
                    <td class="meta"><xsl:value-of select="s:priority"/></td>
                    <td class="meta"><xsl:value-of select="s:changefreq"/></td>
                    <td class="meta"><xsl:value-of select="s:lastmod"/></td>
                  </tr>
                </xsl:for-each>
              </table>
            </xsl:otherwise>
          </xsl:choose>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
