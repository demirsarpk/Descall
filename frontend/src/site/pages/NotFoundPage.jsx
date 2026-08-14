import { Link } from "react-router-dom";
import { useT } from "../../context/localeContextInstance";

export default function NotFoundPage() {
  const t = useT();
  return (
    <section className="mkt-404">
      <h1>404</h1>
      <p className="lead" style={{ margin: "0 auto 24px", color: "var(--mkt-muted)" }}>
        {t("This page does not exist on Descall.")}
      </p>
      <div className="mkt-cta-row" style={{ justifyContent: "center" }}>
        <Link to="/" className="mkt-btn mkt-btn-primary">
          {t("Home")}
        </Link>
        <Link to="/download" className="mkt-btn mkt-btn-ghost">
          {t("Download")}
        </Link>
      </div>
    </section>
  );
}
