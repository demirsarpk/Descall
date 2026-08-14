import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useT } from "../../context/localeContextInstance";
import { API_BASE_URL } from "../../config/api";
import { SITE_OPERATOR } from "../siteIdentity";
import JsonLd, { buildBreadcrumbLd } from "../JsonLd";

/**
 * Public status / trust page — factual Beta note + live API health probe.
 * No fabricated uptime percentages.
 */
export default function StatusPage() {
  const t = useT();
  const [api, setApi] = useState({ state: "checking", detail: "" });

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/status`, { signal: ctrl.signal });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setApi({
            state: "ok",
            detail: body?.status || body?.ok ? "API reachable" : `HTTP ${res.status}`,
          });
        } else {
          setApi({ state: "degraded", detail: `HTTP ${res.status}` });
        }
      } catch (err) {
        if (cancelled) return;
        setApi({
          state: "unreachable",
          detail: err?.name === "AbortError" ? "Timed out" : "Network error",
        });
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      ctrl.abort();
    };
  }, []);

  const crumbs = [
    { label: "Home", to: "/" },
    { label: "Status", to: "/status" },
  ];

  const badge =
    api.state === "ok" ? "ok" : api.state === "checking" ? "checking" : "warn";

  return (
    <div className="mkt-status">
      <JsonLd data={buildBreadcrumbLd(crumbs)} />
      <nav className="seo-crumbs" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <span key={c.to}>
            {i > 0 ? " / " : null}
            <Link to={c.to}>{t(c.label)}</Link>
          </span>
        ))}
      </nav>
      <p className="mkt-kicker">{t("Status")}</p>
      <h1>{t("Descall service status")}</h1>
      <p className="mkt-lead">
        {t(SITE_OPERATOR.statusNote)} {t("Last updated")}: {SITE_OPERATOR.lastUpdatedLabel}.
      </p>

      <div className={`mkt-status-card is-${badge}`} role="status">
        <strong>{t("API / realtime")}</strong>
        <span>
          {api.state === "checking" && t("Checking…")}
          {api.state === "ok" && t("Operational")}
          {api.state === "degraded" && t("Degraded")}
          {api.state === "unreachable" && t("Unreachable from this browser")}
          {api.detail ? ` — ${api.detail}` : ""}
        </span>
      </div>

      <ul className="mkt-status-list">
        <li>
          <strong>{t("Product stage")}</strong>: {t("Beta")}
        </li>
        <li>
          <strong>{t("Transport security")}</strong>: TLS / DTLS-SRTP
        </li>
        <li>
          <strong>{t("Operator")}</strong>: {SITE_OPERATOR.operatorName} · {SITE_OPERATOR.country}
        </li>
        <li>
          <strong>{t("Support")}</strong>:{" "}
          <a href={`mailto:${SITE_OPERATOR.supportEmail}`}>{SITE_OPERATOR.supportEmail}</a>
        </li>
        <li>
          <strong>GitHub</strong>:{" "}
          <a href={SITE_OPERATOR.githubUrl} rel="noopener noreferrer" target="_blank">
            {SITE_OPERATOR.githubUrl.replace("https://", "")}
          </a>
        </li>
      </ul>

      <p className="seo-note">
        <Link to="/security">{t("Security details")}</Link>
        {" · "}
        <Link to="/contact">{t("Contact")}</Link>
      </p>
    </div>
  );
}
