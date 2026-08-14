import { useState } from "react";
import { API_BASE_URL } from "../../config/api";
import { Funnel } from "../analytics";
import { useT } from "../../context/localeContextInstance";

/**
 * Soft waitlist / product updates capture for marketing pages.
 * Posts to API when available; falls back to mailto so the CTA never dead-ends.
 */
export default function EmailCapture({ source = "marketing_footer" }) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | ok | error
  const [message, setMessage] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const value = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setStatus("error");
      setMessage(t("Enter a valid email"));
      return;
    }
    setStatus("loading");
    setMessage("");
    Funnel.ctaClick({ page: typeof window !== "undefined" ? window.location.pathname : "", placement: source, label: "waitlist", intent: "waitlist" });

    try {
      const res = await fetch(`${API_BASE_URL}/api/marketing/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: value,
          source,
          path: typeof window !== "undefined" ? window.location.pathname : "",
          locale: typeof document !== "undefined" ? document.documentElement.lang || "en" : "en",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setStatus("ok");
      setMessage(t("Thanks — we will email product updates sparingly."));
      setEmail("");
      try {
        localStorage.setItem("descall:waitlist_email", value);
      } catch {
        /* ignore */
      }
    } catch {
      // Mailto fallback when API is cold / misconfigured
      const subject = encodeURIComponent("Descall waitlist");
      const body = encodeURIComponent(`Please add ${value} to product updates.\nSource: ${source}`);
      window.location.href = `mailto:contact@descall.com?subject=${subject}&body=${body}`;
      setStatus("ok");
      setMessage(t("Opening email app as fallback…"));
    }
  };

  return (
    <form className="mkt-waitlist" onSubmit={submit} noValidate>
      <label htmlFor="mkt-waitlist-email">{t("Product updates")}</label>
      <p className="mkt-waitlist-hint">
        {t("Get occasional release notes — no spam, unsubscribe anytime.")}
      </p>
      <div className="mkt-waitlist-row">
        <input
          id="mkt-waitlist-email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          disabled={status === "loading" || status === "ok"}
          required
        />
        <button type="submit" className="mkt-btn mkt-btn-primary" disabled={status === "loading" || status === "ok"}>
          {status === "loading" ? t("Sending…") : t("Notify me")}
        </button>
      </div>
      {message ? (
        <p className={`mkt-waitlist-msg is-${status === "error" ? "error" : "ok"}`} role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
