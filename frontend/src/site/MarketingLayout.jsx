import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useLocale, useT } from "../context/LocaleContext";
import DescallBrand from "../components/brand/DescallBrand";
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
  const { locale, setLocale } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);
  const nav = (
    <nav
      id="marketing-navigation"
      className={`mkt-nav${menuOpen ? " is-open" : ""}`}
      aria-label={t("Primary navigation")}
    >
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={closeMenu}
          className={({ isActive }) => (isActive ? "mkt-nav-link is-active" : "mkt-nav-link")}
        >
          {t(item.label)}
        </NavLink>
      ))}
      <Link to="/download" onClick={closeMenu} className="mkt-mobile-download">
        {t("Download")}
      </Link>
      <div className="mkt-mobile-language">
        <span>{t("Language")}</span>
        <LanguageToggle locale={locale} setLocale={setLocale} />
      </div>
    </nav>
  );

  return (
    <div className="mkt">
      <div className="mkt-bg" aria-hidden>
        <div className="mkt-orb mkt-orb-a" />
        <div className="mkt-orb mkt-orb-b" />
        <div className="mkt-grid" />
      </div>

      <header className="mkt-header">
        <Link to="/" className="mkt-brand" aria-label="Descall home">
          <DescallBrand />
        </Link>
        {nav}
        <div className="mkt-header-actions">
          <div className="mkt-desktop-language">
            <LanguageToggle locale={locale} setLocale={setLocale} />
          </div>
          <button type="button" className="mkt-btn mkt-btn-ghost" onClick={onSignIn}>
            {t("Sign In")}
          </button>
          <Link to="/download" className="mkt-btn mkt-btn-primary">
            {t("Download")}
          </Link>
          <button
            type="button"
            className="mkt-menu-toggle"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="marketing-navigation"
            aria-label={menuOpen ? t("Close menu") : t("Open menu")}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <main className="mkt-main">{children}</main>

      <footer className="mkt-footer">
        <div className="mkt-footer-brand">
          <DescallBrand />
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

function LanguageToggle({ locale, setLocale }) {
  const t = useT();
  return (
    <div className="mkt-language-toggle" aria-label={t("Language")}>
      <button
        type="button"
        className={locale === "tr" ? "is-active" : ""}
        onClick={() => setLocale("tr")}
        aria-pressed={locale === "tr"}
      >
        TR
      </button>
      <button
        type="button"
        className={locale === "en" ? "is-active" : ""}
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
    </div>
  );
}
