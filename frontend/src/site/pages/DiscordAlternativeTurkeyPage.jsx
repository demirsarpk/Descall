import { Link } from "react-router-dom";
import SeoLandingShell from "../components/SeoLandingShell";
import { buildBreadcrumbLd, buildFaqLd, buildDiscordAlternativeAppLd } from "../JsonLd";
import { TURKEY_FAQ } from "../content/discordSeoContent";
import { useT } from "../../context/LocaleContext";

const crumbs = [
  { label: "Home", to: "/" },
  { label: "Discord alternative", to: "/discord-alternative" },
  { label: "Türkiye", to: "/discord-alternative-turkey" },
];

export default function DiscordAlternativeTurkeyPage({ onSignIn }) {
  const t = useT();
  return (
    <SeoLandingShell
      breadcrumbs={crumbs}
      kicker="Türkiye · Discord alternatifi"
      title="Türkiye için en iyi Discord alternatifi: Descall"
      lead="Discord alternatifi arayan Türk oyuncu ve arkadaş grupları için Descall: ücretsiz sohbet, sesli/görüntülü arama, ekran paylaşımı ve Valorant LFG — Nitro zorunluluğu olmadan."
      faq={TURKEY_FAQ}
      jsonLd={[buildBreadcrumbLd(crumbs), buildFaqLd(TURKEY_FAQ), buildDiscordAlternativeAppLd()]}
      primaryCta={
        <button type="button" className="mkt-btn mkt-btn-primary" onClick={onSignIn}>
          Ücretsiz başla
        </button>
      }
      secondaryCta={
        <Link to="/download" className="mkt-btn mkt-btn-soft">
          Windows / Android indir
        </Link>
      }
    >
      <section className="seo-section">
        <h2>Neden Türkiye’de Discord alternatifi aranıyor?</h2>
        <p>
          Birçok ekip Discord’u seviyor ama Nitro baskısı, ağır arayüz ve LFG için bot karmaşası istemiyor.
          Descall, Türkçe arayüz seçeneği ve oyuncu odaklı Play sekmesiyle daha hafif bir Discord alternatifi sunar.
        </p>
      </section>

      <section className="seo-section">
        <h2>Descall ile neler yaparsın?</h2>
        <ul className="seo-bullets">
          <li>Anlık mesajlaşma ve grup sohbetleri</li>
          <li>Sesli / görüntülü arama + ekran paylaşımı</li>
          <li>Valorant LFG lobileri ve parti kodları</li>
          <li>Windows masaüstü, web ve Android</li>
          <li>Ücretsiz temel özellikler</li>
        </ul>
      </section>

      <section className="seo-section">
        <h2>İlgili sayfalar</h2>
        <ul className="seo-link-list">
          <li>
            <Link to="/discord-alternative">English: Discord alternative</Link>
          </li>
          <li>
            <Link to="/compare/discord">Descall vs Discord</Link>
          </li>
          <li>
            <Link to="/best-discord-alternative-for-gamers">Gamers / LFG</Link>
          </li>
        </ul>
      </section>
    </SeoLandingShell>
  );
}
