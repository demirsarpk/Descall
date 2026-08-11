import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Mic, Video, MonitorUp } from "lucide-react";
import { useT } from "../../context/LocaleContext";
import { Funnel, getFeatureFlag, getFeatureFlagPayload } from "../analytics";
import JsonLd, {
  buildOrganizationLd,
  buildSoftwareApplicationLd,
  buildWebSiteLd,
} from "../JsonLd";

const HIGHLIGHTS = [
  { icon: MessageCircle, title: "Real-time Chat", desc: "Instant messaging with typing indicators" },
  { icon: Mic, title: "Voice & video", desc: "Crystal-clear group calls" },
  { icon: Video, title: "Video Calls", desc: "HD video calling with friends" },
  { icon: MonitorUp, title: "Screen share", desc: "Share your screen in calls" },
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
        <div className="mkt-kicker">{t("Messages")} · {t("Voice")} · {t("Screen share")}</div>
        <h1>
          <span className="mkt-brand-word">Descall</span>
        </h1>
        <p>
          {heroPayload?.sub
            ? String(heroPayload.sub)
            : t(
                "The ultimate chat application for your desktop. Fast, secure, and beautifully designed."
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
        <p className="lead">{t("Experience the next generation of communication")}</p>
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
        </div>
      </section>
    </>
  );
}
