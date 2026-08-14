import { useT } from "../../context/localeContextInstance";
import { SITE_OPERATOR } from "../siteIdentity";
import JsonLd, { buildOrganizationLd } from "../JsonLd";

export default function SecurityPage() {
  const t = useT();
  return (
    <>
      <JsonLd data={buildOrganizationLd()} />
      <section className="mkt-section mkt-prose" style={{ marginTop: 12 }}>
        <h1>{t("Security at Descall")}</h1>
        <p className="lead">
          {t(
            "How Descall protects your chats and calls — encryption in transit, account security, and honest limits about what we do not claim."
          )}
        </p>

        <h2>{t("Transport encryption (not default E2E)")}</h2>
        <p>
          {t(
            "Web and API traffic use HTTPS/TLS. Real-time media uses WebRTC with DTLS/SRTP between peers when a call is established. Descall does not claim default end-to-end encryption for all message history stored on the server — messages are encrypted in transit and stored so your devices can load chat history."
          )}
        </p>

        <h2>{t("Voice & video")}</h2>
        <p>
          {t(
            "Call media is transmitted with WebRTC security (DTLS/SRTP). Descall does not record or store call audio/video by default. If a participant records locally on their device, that recording is outside Descall's control."
          )}
        </p>

        <h2>{t("Accounts")}</h2>
        <p>
          {t(
            "Passwords are hashed with bcrypt. Optional email 2FA and Google sign-in are available where configured. Session management lets you revoke devices. Keep credentials private on shared computers."
          )}
        </p>

        <h2>{t("Report an issue")}</h2>
        <p>
          {t("Email")}{" "}
          <a href={`mailto:${SITE_OPERATOR.supportEmail}`}>{SITE_OPERATOR.supportEmail}</a>{" "}
          {t("or open an issue on GitHub. Include enough detail for a safe investigation.")}
        </p>
      </section>
    </>
  );
}
