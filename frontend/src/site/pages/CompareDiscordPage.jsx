import { Link } from "react-router-dom";
import SeoLandingShell from "../components/SeoLandingShell";
import SeoRelatedLinks from "../components/SeoRelatedLinks";
import SeoProductPreview from "../components/SeoProductPreview";
import { buildBreadcrumbLd, buildFaqLd, buildDiscordAlternativeAppLd } from "../JsonLd";
import { COMPARE_FAQ, COMPARE_ROWS } from "../content/discordSeoContent";
import { useT } from "../../context/localeContextInstance";

const crumbs = [
  { label: "Home", to: "/" },
  { label: "Compare", to: "/alternatives" },
  { label: "Descall vs Discord", to: "/compare/discord" },
];

export default function CompareDiscordPage({ onSignIn }) {
  const t = useT();

  return (
    <SeoLandingShell
      breadcrumbs={crumbs}
      kicker="Descall vs Discord"
      title={t("Discord vs Descall — which fits your group in 2026?")}
      lead={t(
        "An honest Descall vs Discord comparison for servers, roles, channels, chat, voice, video, screen share, LFG, desktop apps, and pricing. Use this when evaluating Descall as a Discord alternative in 2026."
      )}
      faq={COMPARE_FAQ}
      jsonLd={[
        buildBreadcrumbLd(crumbs),
        buildFaqLd(COMPARE_FAQ),
        buildDiscordAlternativeAppLd(),
      ]}
      primaryCta={
        <button type="button" className="mkt-btn mkt-btn-primary" onClick={onSignIn}>
          {t("Try Descall free")}
        </button>
      }
      secondaryCta={
        <Link to="/discord-alternative" className="mkt-btn mkt-btn-soft">
          {t("Discord alternative overview")}
        </Link>
      }
      heroExtra={<SeoProductPreview caption={t("Descall vs Discord — product preview")} />}
    >
      <section className="seo-section">
        <h2>{t("Quick verdict")}</h2>
        <div className="seo-verdict">
          <p>
            <strong>Descall</strong>{" "}
            {t(
              "wins if you want a lighter Discord alternative with real servers (roles, channels, templates), friends voice, screen share, and Valorant LFG — with free core features."
            )}
          </p>
          <p>
            <strong>Discord</strong>{" "}
            {t(
              "still wins for massive bot ecosystems and the widest platform matrix. Many groups run both: Discord for huge public communities with bots, Descall for the squad server and nightly calls."
            )}
          </p>
        </div>
      </section>

      <section className="seo-section">
        <h2>{t("Feature-by-feature comparison")}</h2>
        <div className="seo-table-wrap">
          <table className="mkt-table">
            <thead>
              <tr>
                <th>{t("Feature")}</th>
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
      </section>

      <section className="seo-section">
        <h2>{t("Where Descall is the better Discord alternative")}</h2>
        <ul className="seo-bullets">
          <li>{t("Real servers with roles, channels, and ready-made templates")}</li>
          <li>{t("Friend-group chat and voice without Nitro friction")}</li>
          <li>{t("Built-in Valorant LFG instead of fragile bot setups")}</li>
          <li>{t("Screen-share quality controls tuned for calls")}</li>
          <li>{t("Modern UI focused on speed — servers without endless chrome")}</li>
        </ul>
      </section>

      <section className="seo-section">
        <h2>{t("Where Discord still leads")}</h2>
        <ul className="seo-bullets">
          <li>{t("Massive bot / integration ecosystem")}</li>
          <li>{t("Huge public communities with decades of ecosystem tooling")}</li>
          <li>{t("Broader native client coverage historically")}</li>
        </ul>
      </section>

      <section className="seo-section">
        <h2>{t("How to migrate a friend group")}</h2>
        <ol className="seo-steps">
          <li>{t("Create a Descall server from a template (or start from scratch) and invite your core squad.")}</li>
          <li>{t("Assign roles and tune channel permissions for staff / announcements.")}</li>
          <li>{t("Pin the Download link for Windows / Android users.")}</li>
          <li>{t("Move nightly voice + LFG to Descall for two weeks.")}</li>
          <li>{t("Keep Discord only for bot-heavy communities you still need.")}</li>
        </ol>
        <p className="seo-note">
          <Link to="/blog/leave-nitro-keep-voice-chat">{t("Read the full migration guide")}</Link>
        </p>
      </section>

      <SeoRelatedLinks
        title="More comparisons"
        links={[
          { to: "/alternatives", label: "Discord alternatives hub" },
          { to: "/apps-like-discord", label: "Apps like Discord" },
          { to: "/blog/discord-competitors", label: "Discord competitors 2026" },
          { to: "/blog/discord-vs-descall", label: "Discord vs Descall article" },
          { to: "/discord-replacement", label: "Discord replacement" },
          { to: "/features", label: "Descall features" },
        ]}
      />
    </SeoLandingShell>
  );
}
