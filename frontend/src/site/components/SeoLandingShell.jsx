import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import JsonLd from "../JsonLd";
import { useT } from "../../context/LocaleContext";

/**
 * Premium long-form SEO landing shell: breadcrumbs, H1, lead, sections, FAQ, CTA.
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
}) {
  const t = useT();

  return (
    <article className="seo-landing">
      {jsonLd?.length > 0 && <JsonLd data={jsonLd} />}

      {breadcrumbs.length > 0 && (
        <nav className="seo-breadcrumbs" aria-label="Breadcrumb">
          <ol>
            {breadcrumbs.map((crumb, i) => (
              <li key={crumb.to || crumb.label}>
                {i > 0 && <ChevronRight size={12} aria-hidden />}
                {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : <span aria-current="page">{crumb.label}</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <motion.header
        className="seo-hero"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        {kicker && <div className="mkt-kicker">{kicker}</div>}
        <h1>{title}</h1>
        {lead && <p className="seo-lead">{lead}</p>}
        {(primaryCta || secondaryCta) && (
          <div className="mkt-cta-row">
            {primaryCta}
            {secondaryCta}
          </div>
        )}
      </motion.header>

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
          <Link to="/download" className="mkt-btn mkt-btn-primary">
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
