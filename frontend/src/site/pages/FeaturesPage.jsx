import {
  MessageCircle,
  Mic,
  Video,
  Users,
  MonitorUp,
  Shield,
  Gamepad2,
  Sparkles,
  Server,
  Layers,
  Hash,
  ScrollText,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useT } from "../../context/LocaleContext";
import JsonLd, { buildBreadcrumbLd, buildSoftwareApplicationLd } from "../JsonLd";
import SeoRelatedLinks from "../components/SeoRelatedLinks";

const FEATURES = [
  {
    icon: Server,
    title: "Servers & channels",
    desc: "Full server structure with categories, text, voice, and stage channels — topics, slowmode, and NSFW flags included.",
  },
  {
    icon: Shield,
    title: "Roles & permissions",
    desc: "Role hierarchy with hoist/mention, plus per-channel allow/deny overrides for staff rooms, announcements, and VIP spaces.",
  },
  {
    icon: Layers,
    title: "Advanced server templates",
    desc: "Gaming, Valorant, friends, community, study, and streaming templates — roles and channels ready the moment you create.",
  },
  {
    icon: ScrollText,
    title: "Moderation & invites",
    desc: "Kick, ban, timeout, audit logs, community rules, and invite links so servers stay organized as they grow.",
  },
  {
    icon: MessageCircle,
    title: "Real-time Chat",
    desc: "DMs and server chat with typing indicators — a Discord alternative that stays focused on people you know.",
  },
  {
    icon: Mic,
    title: "Voice & video calls",
    desc: "Crystal-clear WebRTC voice and HD video for squads and server lobbies, without Nitro-gated quality of life.",
  },
  {
    icon: MonitorUp,
    title: "Screen share",
    desc: "Share a window or tab with quality presets designed for VODs, loadouts, and watch parties.",
  },
  {
    icon: Users,
    title: "Friends & presence",
    desc: "Friend list, online status, and invites — jump from DMs into a server voice channel in one flow.",
  },
  {
    icon: Gamepad2,
    title: "Valorant LFG",
    desc: "Play tab lobbies, party codes, and Riot Name#TAG linking so rank can show on your profile.",
  },
  {
    icon: Hash,
    title: "Channel controls",
    desc: "Slowmode, topics, permission overrides, and staff-only channels — the day-to-day tools communities actually use.",
  },
  {
    icon: Sparkles,
    title: "DesCoin cosmetics",
    desc: "Themes, frames, and effects via DesCoin. Core chat, servers, and calls stay free forever.",
  },
  {
    icon: Video,
    title: "Desktop + web + Android",
    desc: "Windows installer, full browser app, and Android builds — use Descall where you game.",
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
            "Servers with roles and channels, messaging, calls, screen share, and LFG — everything friend groups and communities need, without turning your PC into a second operating system."
          )}
        </p>
        <div className="mkt-feature-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="mkt-feature">
              <div className="mkt-icon">
                <f.icon size={20} />
              </div>
              <h3>{t(f.title)}</h3>
              <p>{t(f.desc)}</p>
            </article>
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
            { to: "/discord-alternative-for-communities", label: "Communities & servers" },
            { to: "/discord-alternative-for-voice-chat", label: "Voice chat alternative" },
            { to: "/discord-alternative-for-lfg", label: "LFG platform" },
            { to: "/compare/discord", label: "Descall vs Discord" },
          ]}
        />
      </section>
    </>
  );
}
