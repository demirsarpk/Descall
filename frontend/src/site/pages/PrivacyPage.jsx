import { useT } from "../../context/LocaleContext";

export default function PrivacyPage() {
  const t = useT();
  return (
    <section className="mkt-section mkt-prose" style={{ marginTop: 12 }}>
      <h2>{t("Privacy Policy")}</h2>
      <p className="lead">{t("Last updated")}: 2026-08-06</p>
      <h3>{t("What we collect")}</h3>
      <p>
        {t(
          "Account details you provide (such as username and email when using Google sign-in), messages and media you send, group membership, and basic technical logs needed to operate the service (IP, device/browser, error diagnostics)."
        )}
      </p>
      <h3>{t("How we use data")}</h3>
      <p>
        {t(
          "We use this data to provide chat and calls, keep the service secure, improve reliability, and communicate important product updates. We do not sell your personal information."
        )}
      </p>
      <h3>{t("Sharing")}</h3>
      <p>
        {t(
          "We use infrastructure providers (hosting, database, authentication) as processors. Content you send is visible to the recipients you choose (DMs, groups)."
        )}
      </p>
      <h3>{t("Your choices")}</h3>
      <p>
        {t(
          "You can update profile settings, leave groups, and request account deletion via Contact. For questions about this policy, use the Contact page."
        )}
      </p>
    </section>
  );
}
