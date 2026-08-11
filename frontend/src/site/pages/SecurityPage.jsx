import { useT } from "../../context/LocaleContext";

export default function SecurityPage() {
  const t = useT();
  return (
    <section className="mkt-section mkt-prose" style={{ marginTop: 12 }}>
      <h2>{t("Security")}</h2>
      <p className="lead">
        {t("How Descall protects your chats and calls — encryption in transit, account security, and responsible practices.")}
      </p>
      <h3>{t("Transport encryption")}</h3>
      <p>
        {t(
          "Web and API traffic use HTTPS/TLS. Real-time media uses WebRTC with DTLS/SRTP between peers when a call is established."
        )}
      </p>
      <h3>{t("Accounts")}</h3>
      <p>
        {t(
          "Passwords are hashed server-side. Google sign-in is available where configured. Keep your credentials private and sign out on shared devices."
        )}
      </p>
      <h3>{t("Responsible use")}</h3>
      <p>
        {t(
          "Report security issues via Contact or GitHub. Do not share invite links publicly if a group should stay private."
        )}
      </p>
    </section>
  );
}
