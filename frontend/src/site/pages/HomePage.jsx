import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  MessageCircle,
  Mic,
  MonitorUp,
  Server,
  Shield,
  Layers,
  Hash,
} from "lucide-react";
import { useT } from "../../context/LocaleContext";
import { Funnel, getFeatureFlag, getFeatureFlagPayload } from "../analytics";
import JsonLd, {
  buildOrganizationLd,
  buildSoftwareApplicationLd,
  buildWebSiteLd,
} from "../JsonLd";

const HIGHLIGHTS = [
  {
    icon: Server,
    title: "Servers & channels",
    desc: "Text, voice, and stage channels with categories — Discord-style structure, lighter feel",
  },
  {
    icon: Shield,
    title: "Roles & permissions",
    desc: "Role hierarchy, staff rooms, and per-channel overrides ready for real communities",
  },
  {
    icon: Layers,
    title: "Advanced templates",
    desc: "Gaming, Valorant, friends, community, study & streaming — roles and channels pre-built",
  },
  {
    icon: MessageCircle,
    title: "Real-time Chat",
    desc: "Instant DMs and server chat with typing indicators",
  },
  {
    icon: Mic,
    title: "Voice & video",
    desc: "Crystal-clear group and server calls",
  },
  {
    icon: MonitorUp,
    title: "Screen share",
    desc: "Share your screen in calls with quality presets",
  },
];

const SERVER_POINTS = [
  {
    icon: Hash,
    title: "Channels that match the job",
    desc: "Announcements, LFG, clips, VIP lounges, staff ops — topics and slowmode included in templates.",
  },
  {
    icon: Shield,
    title: "Roles that actually work",
    desc: "Admin, Moderator, Helper, VIP and more — with kick, ban, timeout, and audit logs.",
  },
  {
    icon: Mic,
    title: "Voice built into the server",
    desc: "Lobby, scrim, focus, and stage rooms so your crew can hop in without leaving the app.",
  },
];

export default function HomePage({ onSignIn, onSignUp }) {
  const t = useT();
  const openRegister = onSignUp || onSignIn;
  const [heroVariant, setHeroVariant] = useState("control");
  const [heroPayload, setHeroPayload] = useState(null);

  useEffect(() => {
    const variant = getFeatureFlag("hero_cta_variant", "control");
    const payload = getFeatureFlagPayload("hero_cta_variant", null);
    setHeroVariant(typeof variant === "string" ? variant : "control");
    setHeroPayload(payload && typeof payload === "object" ? payload : null);
    Funnel.landingView({ page: "home", path: "/", hero_cta_variant: variant });
  }, []);

  const trackCta = (placement, label) => {
    Funnel.ctaClick({
      page: "home",
      placement,
      label,
      intent: "register",
      hero_cta_variant: heroVariant,
    });
  };

  const heroCtaLabel = heroPayload?.cta ? String(heroPayload.cta) : t("Start free");

  return (
    <>
      <JsonLd data={[buildOrganizationLd(), buildWebSiteLd(), buildSoftwareApplicationLd()]} />
      <section className="mkt-hero">
        <div className="mkt-kicker">
          {t("Servers")} · {t("Messages")} · {t("Voice")} · {t("Screen share")}
        </div>
        <h1>
          <span className="mkt-brand-word">Descall</span>
        </h1>
        <p>
          {heroPayload?.sub
            ? String(heroPayload.sub)
            : t(
                "A free Discord alternative with real servers — roles, channels, voice, and templates — plus chat, calls, and Valorant LFG."
              )}
        </p>
        <div className="mkt-cta-row">
          <button
            type="button"
            className="mkt-btn mkt-btn-primary"
            onClick={() => {
              trackCta("hero", "start_free");
              openRegister?.({ mode: "register", source: "home_hero" });
            }}
          >
            {heroCtaLabel}
          </button>
          <Link
            to="/download"
            className="mkt-btn mkt-btn-soft"
            onClick={() => Funnel.ctaClick({ page: "home", placement: "hero", label: "download", intent: "download" })}
          >
            {t("Download")} {t("Desktop")}
          </Link>
          <Link
            to="/discord-alternative"
            className="mkt-btn mkt-btn-ghost"
            onClick={() => Funnel.ctaClick({ page: "home", placement: "hero", label: "discord_alternative", intent: "seo" })}
          >
            {t("Discord alternative")}
          </Link>
        </div>
      </section>

      <section className="mkt-section">
        <h2>{t("Why Choose Descall?")}</h2>
        <p className="lead">
          {t("Servers, chat, and calls in one lighter Discord alternative — built for friends, gamers, and communities.")}
        </p>
        <div className="mkt-feature-grid">
          {HIGHLIGHTS.map((item) => (
            <article key={item.title} className="mkt-feature">
              <div className="mkt-icon">
                <item.icon size={20} />
              </div>
              <h3>{t(item.title)}</h3>
              <p>{t(item.desc)}</p>
            </article>
          ))}
        </div>
        <div className="mkt-cta-row" style={{ marginTop: "1.75rem" }}>
          <button
            type="button"
            className="mkt-btn mkt-btn-primary"
            onClick={() => {
              trackCta("mid_page", "start_free");
              openRegister?.({ mode: "register", source: "home_mid" });
            }}
          >
            {t("Create free account")}
          </button>
          <Link to="/compare/discord" className="mkt-btn mkt-btn-ghost">
            {t("Compare with Discord")}
          </Link>
          <Link to="/features" className="mkt-btn mkt-btn-soft">
            {t("See all features")}
          </Link>
        </div>
      </section>

      <section className="mkt-section">
        <h2>{t("Discord-style servers, ready to run")}</h2>
        <p className="lead">
          {t(
            "Create a server from scratch or pick an advanced template. Roles, text & voice channels, and permission overrides come fully prepared."
          )}
        </p>
        <div className="mkt-feature-grid">
          {SERVER_POINTS.map((item) => (
            <article key={item.title} className="mkt-feature">
              <div className="mkt-icon">
                <item.icon size={20} />
              </div>
              <h3>{t(item.title)}</h3>
              <p>{t(item.desc)}</p>
            </article>
          ))}
        </div>
        <div className="mkt-cta-row" style={{ marginTop: "1.75rem" }}>
          <Link to="/features" className="mkt-btn mkt-btn-primary">
            {t("Explore server features")}
          </Link>
          <Link to="/discord-alternative-for-communities" className="mkt-btn mkt-btn-ghost">
            {t("For communities")}
          </Link>
        </div>
      </section>
    </>
  );
}
