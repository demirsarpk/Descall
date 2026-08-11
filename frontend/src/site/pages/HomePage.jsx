import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageCircle, Mic, Video, MonitorUp, Gamepad2, Sparkles } from "lucide-react";
import { useT } from "../../context/LocaleContext";
import JsonLd, {
  buildOrganizationLd,
  buildSoftwareApplicationLd,
  buildWebSiteLd,
  buildFaqLd,
} from "../JsonLd";
import { COMPARE_FAQ } from "../content/discordSeoContent";
import SeoProductPreview from "../components/SeoProductPreview";
import SeoRelatedLinks from "../components/SeoRelatedLinks";

const HIGHLIGHTS = [
  { icon: MessageCircle, title: "Real-time Chat", desc: "Instant DMs and groups with typing indicators" },
  { icon: Mic, title: "Voice & video", desc: "Crystal-clear WebRTC calls for squads" },
  { icon: Video, title: "Video Calls", desc: "HD video with friends — no Nitro required" },
  { icon: MonitorUp, title: "Screen share", desc: "Quality presets built for gaming reviews" },
  { icon: Gamepad2, title: "Valorant LFG", desc: "Play tab lobbies + Riot Name#TAG link" },
  { icon: Sparkles, title: "Free core", desc: "Chat and calls stay free — cosmetics optional" },
];

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
};

export default function HomePage({ onSignIn }) {
  const t = useT();
  const homeFaq = COMPARE_FAQ.slice(0, 4);

  return (
    <>
      <JsonLd
        data={[
          buildOrganizationLd(),
          buildWebSiteLd(),
          buildSoftwareApplicationLd(),
          buildFaqLd(homeFaq),
        ]}
      />

      <motion.section className="mkt-hero" {...fadeUp}>
        <div className="mkt-kicker">
          {t("Discord alternative")} · {t("Voice")} · {t("LFG")}
        </div>
        <h1>
          <span className="mkt-brand-word">Descall</span>
        </h1>
        <p>
          {t(
            "The free Discord alternative for friends and gamers — real-time chat, HD voice & video, screen share, and Valorant LFG without Nitro paywalls."
          )}
        </p>
        <div className="mkt-cta-row">
          <button type="button" className="mkt-btn mkt-btn-primary" onClick={onSignIn}>
            {t("Start free")}
          </button>
          <Link to="/download" className="mkt-btn mkt-btn-soft">
            {t("Download")} Windows & Android
          </Link>
          <Link to="/discord-alternative" className="mkt-btn mkt-btn-ghost">
            {t("Why Descall")}
          </Link>
        </div>
        <p className="mkt-hero-seo-note">
          <Link to="/compare/discord">{t("Descall vs Discord")}</Link>
          {" · "}
          <Link to="/alternatives">{t("Discord alternatives")}</Link>
          {" · "}
          <Link to="/apps-like-discord">{t("Apps like Discord")}</Link>
          {" · "}
          <Link to="/best-discord-alternative-for-gamers">{t("For gamers")}</Link>
        </p>
        <SeoProductPreview caption={t("Descall — free Discord alternative UI preview")} />
      </motion.section>

      <section className="mkt-section">
        <h2>{t("Why choose this Discord alternative?")}</h2>
        <p className="lead">
          {t(
            "Descall keeps the parts you love — chat, calls, screen share — and drops the bloat. Built for friend groups and gaming squads who want a lighter daily driver."
          )}
        </p>
        <div className="mkt-feature-grid">
          {HIGHLIGHTS.map((item, i) => (
            <motion.article
              key={item.title}
              className="mkt-feature"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <div className="mkt-icon">
                <item.icon size={20} />
              </div>
              <h3>{t(item.title)}</h3>
              <p>{t(item.desc)}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="mkt-section seo-home-compare">
        <h2>{t("Descall vs Discord — quick take")}</h2>
        <p className="lead">
          {t(
            "Need mega-servers and bots? Discord still wins. Need free voice, screen share, and Valorant LFG for people you actually know? Descall is the Discord alternative built for that."
          )}
        </p>
        <div className="mkt-cta-row">
          <Link to="/compare/discord" className="mkt-btn mkt-btn-primary">
            {t("Full comparison")}
          </Link>
          <Link to="/blog" className="mkt-btn mkt-btn-ghost">
            {t("Read the blog")}
          </Link>
        </div>
      </section>

      <SeoRelatedLinks
        title="Popular Discord alternative searches"
        links={[
          { to: "/discord-alternative", label: "Best free Discord alternative" },
          { to: "/discord-replacement", label: "Discord replacement" },
          { to: "/discord-alternative-for-lfg", label: "LFG platform" },
          { to: "/discord-alternative-for-voice-chat", label: "Voice chat alternative" },
          { to: "/discord-alternative-for-communities", label: "Community chat platform" },
          { to: "/discord-alternative-turkey", label: "Discord alternatifi (TR)" },
        ]}
      />
    </>
  );
}
