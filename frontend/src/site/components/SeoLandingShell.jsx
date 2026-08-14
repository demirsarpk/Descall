import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import JsonLd from "../JsonLd";
import { useT } from "../../context/localeContextInstance";
import { Funnel } from "../analytics";

function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Premium long-form SEO landing shell: breadcrumbs, H1, lead, sections, FAQ, CTA.
 * No framer-motion — keeps niche landings off the motion vendor chunk until needed elsewhere.
 */
export default function SeoLandingShell({
  breadcrumbs = [],
  kicker,
  title,
  lead,
  children,
  faq = [],
  jsonLd = [],
  primaryCta,
  secondaryCta,
  heroExtra = null,
}) {
  const t = useT();
  const location = useLocation();

  useEffect(() => {
    Funnel.landingView({ page: "seo", path: location.pathname });
  }, [location.pathname]);

  return (
    <article className="seo-landing">
      {jsonLd?.length > 0 && <JsonLd data={jsonLd} />}

      {breadcrumbs.length > 0 && (
        <nav className="seo-breadcrumbs" aria-label="Breadcrumb">
          <ol>
            {breadcrumbs.map((crumb, i) => (
              <li key={crumb.to || crumb.label}>
                {i > 0 && <Chevron />}
                {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : <span aria-current="page">{crumb.label}</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <header className="seo-hero">
        {kicker && <div className="mkt-kicker">{kicker}</div>}
        <h1>{title}</h1>
        {lead && <p className="seo-lead">{lead}</p>}
        {(primaryCta || secondaryCta) && (
          <div className="mkt-cta-row">
            {primaryCta}
            {secondaryCta}
          </div>
        )}
        {heroExtra}
      </header>

      <div className="seo-body">{children}</div>

      {faq.length > 0 && (
        <section className="seo-faq" aria-labelledby="seo-faq-heading">
          <h2 id="seo-faq-heading">{t("Frequently asked questions")}</h2>
          <div className="seo-faq-list">
            {faq.map((item) => (
              <details key={item.q} className="seo-faq-item">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <section className="seo-bottom-cta">
        <h2>{t("Ready to try a lighter Discord alternative?")}</h2>
        <p>{t("Create a free Descall account — chat, voice, screen share, and Valorant LFG in one place.")}</p>
        <div className="mkt-cta-row">
          {primaryCta || (
            <Link to="/register" className="mkt-btn mkt-btn-primary">
              {t("Start free")}
            </Link>
          )}
          <Link to="/download" className="mkt-btn mkt-btn-soft">
            {t("Download")} Descall
          </Link>
          <Link to="/features" className="mkt-btn mkt-btn-ghost">
            {t("Explore features")}
          </Link>
        </div>
      </section>
    </article>
  );
}
