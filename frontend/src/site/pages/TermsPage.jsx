import { useT } from "../../context/LocaleContext";

export default function TermsPage() {
  const t = useT();
  return (
    <section className="mkt-section mkt-prose" style={{ marginTop: 12 }}>
      <h2>{t("Terms of Service")}</h2>
      <p className="lead">{t("Last updated")}: 2026-08-06</p>
      <h3>{t("Acceptance")}</h3>
      <p>
        {t(
          "By creating an account or using Descall (web or desktop), you agree to these Terms and our Privacy Policy."
        )}
      </p>
      <h3>{t("Acceptable use")}</h3>
      <p>
        {t(
          "Do not abuse the service, harass others, distribute illegal content, attempt unauthorized access, or interfere with infrastructure. We may suspend accounts that violate these rules."
        )}
      </p>
      <h3>{t("Availability")}</h3>
      <p>
        {t(
          "Descall is provided as-is. Features may change. We aim for high availability but do not guarantee uninterrupted service."
        )}
      </p>
      <h3>{t("Contact")}</h3>
      <p>{t("Questions about these Terms can be sent via the Contact page.")}</p>
    </section>
  );
}
