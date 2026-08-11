import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import SeoLandingShell from "../components/SeoLandingShell";
import { buildBreadcrumbLd, buildFaqLd, buildDiscordAlternativeAppLd } from "../JsonLd";
import { GAMER_FAQ } from "../content/discordSeoContent";
import { useT } from "../../context/LocaleContext";

const crumbs = [
  { label: "Home", to: "/" },
  { label: "Discord alternative", to: "/discord-alternative" },
  { label: "For gamers", to: "/best-discord-alternative-for-gamers" },
];

export default function DiscordAlternativeGamersPage({ onSignIn }) {
  const t = useT();
  return (
    <SeoLandingShell
      breadcrumbs={crumbs}
      kicker={t("For gamers")}
      title={t("Best Discord alternative for gamers & Valorant LFG")}
      lead={t(
        "Gamers don’t need another bloated server — they need voice, screen share, and LFG that actually works. Descall is the Discord alternative built around squads, ranks, and queueing together."
      )}
      faq={GAMER_FAQ}
      jsonLd={[buildBreadcrumbLd(crumbs), buildFaqLd(GAMER_FAQ), buildDiscordAlternativeAppLd()]}
      primaryCta={
        <button type="button" className="mkt-btn mkt-btn-primary" onClick={onSignIn}>
          {t("Open Play / LFG")}
        </button>
      }
      secondaryCta={
        <Link to="/download" className="mkt-btn mkt-btn-soft">
          {t("Download for Windows")}
        </Link>
      }
    >
      <section className="seo-section">
        <h2>{t("Why gamers leave Discord for LFG")}</h2>
        <p>
          {t(
            "Classic Discord LFG means bots, roles, and channel spam. Descall’s Play tab is a first-class Discord alternative for LFG: create a lobby, share a party code, link Riot Name#TAG, and jump to voice with the people who matched you."
          )}
        </p>
      </section>

      <section className="seo-section">
        <h2>{t("Gamer checklist")}</h2>
        <ul className="seo-checklist">
          {[
            "Group voice/video with screen share",
            "Valorant LFG lobbies + party codes",
            "Riot account link for rank on profile",
            "Desktop app for low-friction gaming sessions",
            "Free core — cosmetics optional",
          ].map((item) => (
            <li key={item}>
              <span>✓</span> {t(item)}
            </li>
          ))}
        </ul>
      </section>

      <section className="seo-section">
        <h2>{t("Keep reading")}</h2>
        <ul className="seo-link-list">
          <li>
            <Link to="/blog/best-discord-alternative-for-lfg">{t("Blog: best Discord alternative for LFG")}</Link>
          </li>
          <li>
            <Link to="/compare/discord">Descall vs Discord</Link>
          </li>
          <li>
            <Link to="/features">{t("All features")}</Link>
          </li>
        </ul>
      </section>
    </SeoLandingShell>
  );
}
