import { Link } from "react-router-dom";
import { Check, Zap, Users, Gamepad2, Monitor } from "lucide-react";
import SeoLandingShell from "../components/SeoLandingShell";
import SeoProductPreview from "../components/SeoProductPreview";
import SeoRelatedLinks from "../components/SeoRelatedLinks";
import {
  buildBreadcrumbLd,
  buildFaqLd,
  buildDiscordAlternativeAppLd,
} from "../JsonLd";
import { ALTERNATIVE_PILLARS, COMPARE_FAQ, COMPARE_ROWS } from "../content/discordSeoContent";
import { useT } from "../../context/LocaleContext";

const crumbs = [
  { label: "Home", to: "/" },
  { label: "Discord alternative", to: "/discord-alternative" },
];

export default function DiscordAlternativePage({ onSignIn }) {
  const t = useT();
  const faq = COMPARE_FAQ;

  return (
    <SeoLandingShell
      breadcrumbs={crumbs}
      kicker={t("Discord alternative · 2026")}
      title={t("The best free Discord alternative for friends & gamers")}
      lead={t(
        "Descall is a free Discord alternative with real-time chat, crystal-clear voice/video, screen share, and built-in Valorant LFG — without Nitro paywalls for the features you actually use."
      )}
      faq={faq}
      jsonLd={[
        buildBreadcrumbLd(crumbs),
        buildFaqLd(faq),
        buildDiscordAlternativeAppLd(),
      ]}
      primaryCta={
        <button type="button" className="mkt-btn mkt-btn-primary" onClick={onSignIn}>
          {t("Start free")}
        </button>
      }
      secondaryCta={
        <Link to="/compare/discord" className="mkt-btn mkt-btn-soft">
          {t("Compare with Discord")}
        </Link>
      }
      heroExtra={
        <SeoProductPreview caption={t("Descall UI — chat, voice calls, and LFG in one app")} />
      }
    >
      <section className="seo-section">
        <h2>{t("Why people search for a Discord alternative")}</h2>
        <p>
          {t(
            "Discord is powerful — and heavy. Friend groups often want a lighter Discord alternative: fewer Nitro prompts, faster calls with people they know, and tools for gaming LFG without installing a dozen bots. Descall is built for that niche."
          )}
        </p>
        <ul className="seo-checklist">
          {[
            "Free chat, voice, video, and screen share",
            "Groups & presence without server sprawl",
            "Valorant LFG in a dedicated Play tab",
            "Windows desktop + web + Android",
            "Cosmetics via DesCoin — core stays free",
          ].map((item) => (
            <li key={item}>
              <Check size={16} aria-hidden />
              <span>{t(item)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="seo-section">
        <h2>{t("What makes Descall a stronger Discord alternative")}</h2>
        <div className="seo-pillar-grid">
          {ALTERNATIVE_PILLARS.map((p) => (
            <article key={p.title} className="seo-pillar">
              <h3>{t(p.title)}</h3>
              <p>{t(p.body)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="seo-section">
        <h2>{t("Descall vs Discord at a glance")}</h2>
        <div className="seo-table-wrap">
          <table className="mkt-table">
            <thead>
              <tr>
                <th>{t("Capability")}</th>
                <th>Descall</th>
                <th>Discord</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.feature}>
                  <td>{t(row.feature)}</td>
                  <td>{t(row.descall)}</td>
                  <td>{t(row.discord)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="seo-note">
          <Link to="/compare/discord">{t("Read the full Descall vs Discord comparison")}</Link>
        </p>
      </section>

      <section className="seo-section">
        <h2>{t("Who should switch to this Discord alternative?")}</h2>
        <div className="seo-audience-grid">
          <article>
            <Users size={20} />
            <h3>{t("Friend groups")}</h3>
            <p>{t("DMs, group chat, and voice without maintaining a giant server tree.")}</p>
          </article>
          <article>
            <Gamepad2 size={20} />
            <h3>{t("Gamers & LFG")}</h3>
            <p>{t("Queue with rank-aware Valorant LFG and jump into voice in one app.")}</p>
          </article>
          <article>
            <Monitor size={20} />
            <h3>{t("Desktop-first users")}</h3>
            <p>{t("Windows installer, screen share quality presets, and a fast web fallback.")}</p>
          </article>
          <article>
            <Zap size={20} />
            <h3>{t("Anyone tired of Nitro pressure")}</h3>
            <p>{t("Keep premium cosmetics optional. Communication stays free.")}</p>
          </article>
        </div>
      </section>

      <SeoRelatedLinks
        title="Related Discord alternative guides"
        links={[
          { to: "/alternatives", label: "All Discord alternatives — hub" },
          { to: "/apps-like-discord", label: "Apps like Discord" },
          { to: "/discord-replacement", label: "Discord replacement" },
          { to: "/best-discord-alternative-for-gamers", label: "Best Discord alternative for gamers" },
          { to: "/discord-alternative-for-lfg", label: "Discord alternative for LFG" },
          { to: "/discord-alternative-for-communities", label: "For communities" },
          { to: "/discord-alternative-for-voice-chat", label: "Voice chat alternative" },
          { to: "/discord-alternative-for-friends", label: "For friends" },
          { to: "/discord-alternative-turkey", label: "Discord alternatifi (Türkiye)" },
          { to: "/blog", label: "Descall blog" },
        ]}
      />
    </SeoLandingShell>
  );
}
