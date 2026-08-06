import { NavLink, Link } from "react-router-dom";
import { useT } from "../context/LocaleContext";
import "./site.css";

const NAV = [
  { to: "/features", label: "Features" },
  { to: "/download", label: "Download" },
  { to: "/faq", label: "FAQ" },
  { to: "/security", label: "Security" },
  { to: "/about", label: "About" },
];

export default function MarketingLayout({ children, onSignIn }) {
  const t = useT();

  return (
    <div className="mkt">
      <div className="mkt-bg" aria-hidden>
        <div className="mkt-orb mkt-orb-a" />
        <div className="mkt-orb mkt-orb-b" />
        <div className="mkt-grid" />
      </div>

      <header className="mkt-header">
        <Link to="/" className="mkt-brand" aria-label="Descall home">
          <img src="/icon.png" alt="" width={32} height={32} />
          <span>Descall</span>
        </Link>
        <nav className="mkt-nav" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "mkt-nav-link is-active" : "mkt-nav-link")}
            >
              {t(item.label)}
            </NavLink>
          ))}
        </nav>
        <div className="mkt-header-actions">
          <button type="button" className="mkt-btn mkt-btn-ghost" onClick={onSignIn}>
            {t("Sign In")}
          </button>
          <Link to="/download" className="mkt-btn mkt-btn-primary">
            {t("Download")}
          </Link>
        </div>
      </header>

      <main className="mkt-main">{children}</main>

      <footer className="mkt-footer">
        <div className="mkt-footer-brand">
          <img src="/icon.png" alt="" width={24} height={24} />
          <strong>Descall</strong>
        </div>
        <div className="mkt-footer-links">
          <Link to="/privacy">{t("Privacy Policy")}</Link>
          <Link to="/terms">{t("Terms")}</Link>
          <Link to="/contact">{t("Contact")}</Link>
          <Link to="/compare/discord">vs Discord</Link>
          <a href="/sitemap.html">Sitemap</a>
        </div>
        <p className="mkt-footer-copy">{t("© 2026 Descall. All rights reserved.")}</p>
      </footer>
    </div>
  );
}
