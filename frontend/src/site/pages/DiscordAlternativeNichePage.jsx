import { Link, Navigate, useLocation } from "react-router-dom";
import { Check } from "lucide-react";
import SeoLandingShell from "../components/SeoLandingShell";
import SeoRelatedLinks from "../components/SeoRelatedLinks";
import SeoProductPreview from "../components/SeoProductPreview";
import { buildBreadcrumbLd, buildFaqLd, buildDiscordAlternativeAppLd } from "../JsonLd";
import { NICHE_LANDINGS } from "../seo/nicheLandings";
import { useT } from "../../context/LocaleContext";

export default function DiscordAlternativeNichePage({ onSignIn }) {
  const t = useT();
  const { pathname } = useLocation();
  const clean = (pathname || "/").replace(/\/+$/, "") || "/";
  const page = NICHE_LANDINGS[clean];
  if (!page) return <Navigate to="/discord-alternative" replace />;

  const crumbs = [
    { label: "Home", to: "/" },
    { label: "Discord alternative", to: "/discord-alternative" },
    { label: page.h1.split("—")[0].trim(), to: page.path },
  ];

  return (
    <SeoLandingShell
      breadcrumbs={crumbs}
      kicker={t(page.kicker)}
      title={t(page.h1)}
      lead={t(page.lead)}
      faq={page.faq}
      jsonLd={[
        buildBreadcrumbLd(crumbs),
        buildFaqLd(page.faq),
        buildDiscordAlternativeAppLd(page.path),
      ]}
      primaryCta={
        <button type="button" className="mkt-btn mkt-btn-primary" onClick={onSignIn}>
          {t("Start free")}
        </button>
      }
      secondaryCta={
        <Link to="/download" className="mkt-btn mkt-btn-soft">
          {t("Download")}
        </Link>
      }
      heroExtra={<SeoProductPreview caption={t(page.h1)} />}
    >
      <section className="seo-section">
        <h2>{t(page.answerTitle)}</h2>
        <p>{t(page.answer)}</p>
        <ul className="seo-checklist">
          {page.bullets.map((item) => (
            <li key={item}>
              <Check size={16} aria-hidden />
              <span>{t(item)}</span>
            </li>
          ))}
        </ul>
      </section>

      {page.sections.map((s) => (
        <section className="seo-section" key={s.h}>
          <h2>{t(s.h)}</h2>
          <p>{t(s.p)}</p>
        </section>
      ))}

      <SeoRelatedLinks links={page.related} />
    </SeoLandingShell>
  );
}
