import { MessageCircle, Mic, Video, Users, MonitorUp, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { useT } from "../../context/LocaleContext";

const FEATURES = [
  { icon: MessageCircle, title: "Real-time Chat", desc: "Instant messaging with typing indicators" },
  { icon: Mic, title: "Voice Messages", desc: "Crystal clear voice recordings" },
  { icon: Video, title: "Video Calls", desc: "HD video calling with screen share" },
  { icon: Users, title: "Group Chats", desc: "Create groups with unlimited members" },
  { icon: MonitorUp, title: "Screen share", desc: "Share a window or browser tab in calls" },
  { icon: Shield, title: "End-to-End Security", desc: "Your conversations are encrypted and secure" },
];

export default function FeaturesPage() {
  const t = useT();
  return (
    <section className="mkt-section" style={{ marginTop: 12 }}>
      <h2>{t("Features")}</h2>
      <p className="lead">{t("Experience the next generation of communication")}</p>
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
        <Link to="/faq" className="mkt-btn mkt-btn-ghost">
          {t("FAQ")}
        </Link>
      </div>
    </section>
  );
}
