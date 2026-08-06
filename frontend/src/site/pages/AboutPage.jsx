import { Link } from "react-router-dom";
import { useT } from "../../context/LocaleContext";

export default function AboutPage() {
  const t = useT();
  return (
    <section className="mkt-section mkt-prose" style={{ marginTop: 12 }}>
      <h2>{t("About")}</h2>
      <p className="lead">
        {t("Descall is building a fast, modern place to chat and call with friends and groups.")}
      </p>
      <p>
        {t(
          "We focus on real-time messaging, group voice/video, screen share, and a polished desktop experience — without turning private chats into SEO landings."
        )}
      </p>
      <div className="mkt-cta-row" style={{ marginTop: 24 }}>
        <Link to="/features" className="mkt-btn mkt-btn-soft">
          {t("Features")}
        </Link>
        <Link to="/download" className="mkt-btn mkt-btn-primary">
          {t("Download")}
        </Link>
      </div>
    </section>
  );
}
