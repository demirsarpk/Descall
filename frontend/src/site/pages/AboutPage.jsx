import { Link } from "react-router-dom";
import { useT } from "../../context/localeContextInstance";
import { SITE_OPERATOR } from "../siteIdentity";
import JsonLd, { buildOrganizationLd, buildWebSiteLd } from "../JsonLd";

export default function AboutPage() {
  const t = useT();
  return (
    <>
      <JsonLd data={[buildOrganizationLd(), buildWebSiteLd()]} />
      <section className="mkt-section mkt-prose" style={{ marginTop: 12 }}>
        <p className="mkt-beta-badge" role="status">
          {t("Beta")} — {t(SITE_OPERATOR.statusNote)}
        </p>
        <h1>{t("About Descall")}</h1>
        <p className="lead">
          {t(
            "Descall is an independent messaging and voice platform for friends, gaming squads, and small communities who want Discord-style servers without Nitro paywalls on core chat and calls."
          )}
        </p>
        <h2>{t("Operator")}</h2>
        <ul>
          <li>
            <strong>{t("Product")}:</strong> {SITE_OPERATOR.productName}
          </li>
          <li>
            <strong>{t("Operator")}:</strong> {SITE_OPERATOR.operatorName}
          </li>
          <li>
            <strong>{t("Based in")}:</strong> {SITE_OPERATOR.country}
          </li>
          <li>
            <strong>{t("Support")}:</strong>{" "}
            <a href={`mailto:${SITE_OPERATOR.supportEmail}`}>{SITE_OPERATOR.supportEmail}</a>
          </li>
          <li>
            <strong>{t("Source")}:</strong>{" "}
            <a href={SITE_OPERATOR.githubUrl} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </li>
        </ul>
        <h2>{t("What we build")}</h2>
        <p>
          {t(
            "Real-time messaging, Discord-style servers, WebRTC voice/video, screen share, and Valorant LFG — with privacy policies and security docs you can actually read."
          )}
        </p>
        <p>
          {t("Last updated")}: {SITE_OPERATOR.lastUpdatedLabel}
        </p>
        <div className="mkt-cta-row" style={{ marginTop: 24 }}>
          <Link to="/security" className="mkt-btn mkt-btn-soft">
            {t("Security")}
          </Link>
          <Link to="/contact" className="mkt-btn mkt-btn-soft">
            {t("Contact")}
          </Link>
          <Link to="/download" className="mkt-btn mkt-btn-primary">
            {t("Download")}
          </Link>
        </div>
      </section>
    </>
  );
}
