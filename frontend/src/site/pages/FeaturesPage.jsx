import { MessageCircle, Mic, Video, Users, MonitorUp, Shield, Gamepad2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useT } from "../../context/LocaleContext";
import JsonLd, { buildBreadcrumbLd, buildSoftwareApplicationLd } from "../JsonLd";
import SeoRelatedLinks from "../components/SeoRelatedLinks";

const FEATURES = [
  {
    icon: MessageCircle,
    title: "Real-time Chat",
    desc: "DMs and groups with typing indicators — a Discord alternative that stays focused on people you know.",
  },
  {
    icon: Mic,
    title: "Voice & video calls",
    desc: "Crystal-clear WebRTC voice and HD video for squads, without Nitro-gated quality of life.",
  },
  {
    icon: MonitorUp,
    title: "Screen share",
    desc: "Share a window or tab with quality presets designed for VODs, loadouts, and watch parties.",
  },
  {
    icon: Users,
    title: "Groups & presence",
    desc: "Create groups, invite friends, and see who’s online — less server sprawl, more conversation.",
  },
  {
    icon: Gamepad2,
    title: "Valorant LFG",
    desc: "Play tab lobbies, party codes, and Riot Name#TAG linking so rank can show on your profile.",
  },
  {
    icon: Sparkles,
    title: "DesCoin cosmetics",
    desc: "Themes, frames, and effects via DesCoin. Core chat and calls stay free forever.",
  },
  {
    icon: Video,
    title: "Desktop + web + Android",
    desc: "Windows installer, full browser app, and Android builds — use Descall where you game.",
  },
  {
    icon: Shield,
    title: "Account security",
    desc: "Encryption in transit (TLS / secure WebRTC), optional 2FA, and Google sign-in.",
  },
];

const crumbs = [
  { label: "Home", to: "/" },
  { label: "Features", to: "/features" },
];

export default function FeaturesPage() {
  const t = useT();
  return (
    <>
      <JsonLd data={[buildBreadcrumbLd(crumbs), buildSoftwareApplicationLd()]} />
      <section className="mkt-section seo-features" style={{ marginTop: 12 }}>
        <div className="mkt-kicker">{t("Product")}</div>
        <h1 className="seo-page-h1">{t("Features of a modern Discord alternative")}</h1>
        <p className="lead">
          {t(
            "Everything friend groups and gamers need day to day — messaging, calls, screen share, LFG — without turning your PC into a second operating system."
          )}
        </p>
        <div className="mkt-feature-grid">
          {FEATURES.map((f, i) => (
            <motion.article
              key={f.title}
              className="mkt-feature"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
            >
              <div className="mkt-icon">
                <f.icon size={20} />
              </div>
              <h3>{t(f.title)}</h3>
              <p>{t(f.desc)}</p>
            </motion.article>
          ))}
        </div>
        <div className="mkt-cta-row" style={{ marginTop: 28 }}>
          <Link to="/download" className="mkt-btn mkt-btn-primary">
            {t("Download")}
          </Link>
          <Link to="/discord-alternative" className="mkt-btn mkt-btn-soft">
            {t("Discord alternative")}
          </Link>
          <Link to="/faq" className="mkt-btn mkt-btn-ghost">
            {t("FAQ")}
          </Link>
        </div>
        <SeoRelatedLinks
          title="Explore by use case"
          links={[
            { to: "/discord-alternative-for-voice-chat", label: "Voice chat alternative" },
            { to: "/discord-alternative-for-lfg", label: "LFG platform" },
            { to: "/discord-alternative-for-communities", label: "Communities" },
            { to: "/compare/discord", label: "Descall vs Discord" },
          ]}
        />
      </section>
    </>
  );
}
