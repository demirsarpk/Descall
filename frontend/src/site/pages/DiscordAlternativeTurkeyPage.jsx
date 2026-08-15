import { Link } from "react-router-dom";
import SeoLandingShell from "../components/SeoLandingShell";
import { buildBreadcrumbLd, buildFaqLd, buildDiscordAlternativeAppLd } from "../JsonLd";
import { TURKEY_FAQ } from "../content/discordSeoContent";
import { useT } from "../../context/localeContextInstance";

const crumbs = [
  { label: "Home", to: "/" },
  { label: "Discord alternative", to: "/discord-alternative" },
  { label: "Türkiye", to: "/discord-alternative-turkey" },
];

export default function DiscordAlternativeTurkeyPage({ onSignIn, onSignUp }) {
  const t = useT();
  const startFree = () => (onSignUp || onSignIn)?.({ mode: "register", source: "turkey_seo" });
  return (
    <SeoLandingShell
      breadcrumbs={crumbs}
      kicker="Türkiye · Discord alternatifi"
      title="Türkiye için en iyi Discord alternatifi: Descall"
      lead="Discord alternatifi arayan Türk oyuncu ve arkadaş grupları için Descall: gerçek sunucular (roller, kanallar, şablonlar), ücretsiz sohbet, sesli/görüntülü arama, ekran paylaşımı ve Valorant LFG — Nitro zorunluluğu olmadan."
      faq={TURKEY_FAQ}
      jsonLd={[buildBreadcrumbLd(crumbs), buildFaqLd(TURKEY_FAQ), buildDiscordAlternativeAppLd()]}
      primaryCta={
        <button type="button" className="mkt-btn mkt-btn-primary" onClick={startFree}>
          Ücretsiz kayıt ol
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
          Descall, Türkçe arayüz seçeneği, hazır sunucu şablonları ve oyuncu odaklı Play sekmesiyle daha hafif bir Discord alternatifi sunar.
          Özellikle 5–100 kişilik klanlar, okul grupları ve Valorant partileri için roller + kanallar + ses odası ister — bot labirenti olmadan.
        </p>
      </section>

      <section className="seo-section">
        <h2>Descall ile neler yaparsın?</h2>
        <ul className="seo-bullets">
          <li>Sunucular: yazı / ses / stage kanalları, kategoriler ve yavaş mod</li>
          <li>Roller ve kanal izinleri (Admin, Mod, VIP…)</li>
          <li>Hazır şablonlar: oyun, Valorant, arkadaş, topluluk, ders, yayıncı</li>
          <li>Anlık mesajlaşma ve DM’ler</li>
          <li>Sesli / görüntülü arama + ekran paylaşımı</li>
          <li>Valorant LFG lobileri ve parti kodları</li>
          <li>Windows masaüstü, web ve Android</li>
          <li>Ücretsiz temel özellikler — kozmetikler DesCoin ile isteğe bağlı</li>
        </ul>
      </section>

      <section className="seo-section">
        <h2>Türkiye’de Discord alternatifi seçerken nelere bak?</h2>
        <p>
          Ücretsiz ses/görüntü, sunucu rolleri, Türkçe arayüz, mobil erişim ve davetle hızlı ekip toplama çoğu grup için yeterlidir.
          Dev bot ekosistemi veya on binlerce üyeli kamu sunucuları için Discord hâlâ güçlüdür; Descall klan, sınıf ve oyuncu toplulukları için tasarlandı.
        </p>
        <p>
          Discord benzeri uygulamalar veya bir Discord muadili arıyorsan önce işe bak: sadece mesaj mı, yoksa ses + ekran paylaşımı + sunucu mu?
          Descall ikinci grup içindir — klan, sınıf ve Valorant partileri için Türkçe arayüzlü, ücretsiz bir Discord alternatifi.
        </p>
        <p>
          Hemen denemek için{" "}
          <button type="button" className="legal-consent-link" onClick={startFree}>
            ücretsiz hesap aç
          </button>
          ; masaüstü istersen{" "}
          <Link to="/download">Windows kurulumunu</Link> kullan.
        </p>
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
          <li>
            <Link to="/alternatives">Discord alternatives (English list)</Link>
          </li>
          <li>
            <Link to="/tr">Türkçe ana sayfa</Link>
          </li>
        </ul>
      </section>
    </SeoLandingShell>
  );
}
