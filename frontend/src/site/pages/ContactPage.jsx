import { useT } from "../../context/LocaleContext";

const CONTACT_EMAIL = "contact@descall.com";

export default function ContactPage() {
  const t = useT();
  return (
    <section className="mkt-section mkt-prose" style={{ marginTop: 12 }}>
      <h2>{t("Contact")}</h2>
      <p className="lead">
        {t("Get in touch with the Descall team — support, feedback, and press.")}
      </p>
      <h3>{t("Support & feedback")}</h3>
      <p>
        {t("Email the Descall team:")}{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
      </p>
      <h3>{t("Security")}</h3>
      <p>
        {t("For security reports, contact us by email and include enough detail for us to investigate safely.")}
      </p>
    </section>
  );
}
