import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCookieConsent, setCookieConsent } from "./analyticsGate";
import { Funnel } from "./analytics";
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

  const decide = (choice) => {
    setCookieConsent(choice);
    Funnel.consentDecision({ choice, surface: "react_banner" });
    setVisible(false);
  };

  return (
    <div className="mkt-consent" role="dialog" aria-label={t("Cookie preferences")}>
      <p>
        {t(
          "We use optional analytics cookies to improve Descall. Essential cookies keep the site working."
        )}
      </p>
      <div className="mkt-consent-actions">
        <Link to="/privacy" className="mkt-consent-privacy">
          {t("Privacy Policy")}
        </Link>
        <button type="button" className="mkt-btn mkt-btn-ghost" onClick={() => decide("rejected")}>
          {t("Reject analytics")}
        </button>
        <button type="button" className="mkt-btn mkt-btn-primary" onClick={() => decide("accepted")}>
          {t("Accept analytics")}
        </button>
      </div>
    </div>
  );
}
