import { useT } from "../../context/localeContextInstance";
import { SITE_OPERATOR } from "../siteIdentity";

export default function ContactPage() {
  const t = useT();
  return (
    <section className="mkt-section mkt-prose" style={{ marginTop: 12 }}>
      <h1>{t("Contact")}</h1>
      <p className="lead">
        {t("Get in touch with the Descall team — support, feedback, and press.")}
      </p>
      <h2>{t("Support & feedback")}</h2>
      <p>
        {t("Email the Descall team:")}{" "}
        <a href={`mailto:${SITE_OPERATOR.supportEmail}`}>{SITE_OPERATOR.supportEmail}</a>
      </p>
      <h2>{t("Operator")}</h2>
      <p>
        {SITE_OPERATOR.operatorName} · {SITE_OPERATOR.country}
      </p>
      <h2>{t("Security")}</h2>
      <p>
        {t(
          "For security reports, contact us by email and include enough detail for us to investigate safely."
        )}
      </p>
    </section>
  );
}
