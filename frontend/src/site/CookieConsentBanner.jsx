import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCookieConsent, setCookieConsent } from "./analyticsGate";
import { useT } from "../context/localeContextInstance";

/**
 * Lightweight GDPR/KVKK cookie banner for marketing pages.
 * Reject keeps analytics cold; Accept unlocks PostHog/gtag.
 */
export default function CookieConsentBanner() {
  const t = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!getCookieConsent());
  }, []);

  if (!visible) return null;

  return (
    <div className="mkt-consent" role="dialog" aria-label={t("Cookie preferences")}>
      <p>
        {t(
          "We use optional analytics cookies to improve Descall. Essential cookies keep the site working. See our"
        )}{" "}
        <Link to="/privacy">{t("Privacy Policy")}</Link>.
      </p>
      <div className="mkt-consent-actions">
        <button
          type="button"
          className="mkt-btn mkt-btn-ghost"
          onClick={() => {
            setCookieConsent("rejected");
            setVisible(false);
          }}
        >
          {t("Reject analytics")}
        </button>
        <button
          type="button"
          className="mkt-btn mkt-btn-primary"
          onClick={() => {
            setCookieConsent("accepted");
            setVisible(false);
          }}
        >
          {t("Accept analytics")}
        </button>
      </div>
    </div>
  );
}
