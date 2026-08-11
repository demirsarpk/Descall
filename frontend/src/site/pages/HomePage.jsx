import { Link } from "react-router-dom";
import { MessageCircle, Mic, Video, MonitorUp } from "lucide-react";
import { useT } from "../../context/LocaleContext";
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

export default function HomePage({ onSignIn }) {
  const t = useT();

  return (
    <>
      <JsonLd data={[buildOrganizationLd(), buildWebSiteLd(), buildSoftwareApplicationLd()]} />
      <section className="mkt-hero">
        <div className="mkt-kicker">{t("Messages")} · {t("Voice")} · {t("Screen share")}</div>
        <h1>
          <span className="mkt-brand-word">Descall</span>
        </h1>
        <p>
          {t(
            "The ultimate chat application for your desktop. Fast, secure, and beautifully designed."
          )}
        </p>
        <div className="mkt-cta-row">
          <button type="button" className="mkt-btn mkt-btn-primary" onClick={onSignIn}>
            {t("Sign In")}
          </button>
          <Link to="/download" className="mkt-btn mkt-btn-soft">
            {t("Download")} {t("Desktop")}
          </Link>
          <Link to="/features" className="mkt-btn mkt-btn-ghost">
            {t("Features")}
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
      </section>
    </>
  );
}
