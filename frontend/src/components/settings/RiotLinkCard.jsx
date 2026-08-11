import { useCallback, useEffect, useState } from "react";
import { Link2, RefreshCw, Unlink } from "lucide-react";
import {
  getRiotStatus,
  linkRiotId,
  refreshRiotRank,
  unlinkRiot,
} from "../../api/riot";
import ValorantBadge from "../social/ValorantBadge";
import { useT } from "../../context/LocaleContext";

const REGION_IDS = [
  { id: "auto", labelKey: "Auto (detect)" },
  { id: "eu", labelKey: "Europe / TR" },
  { id: "na", labelKey: "NA" },
  { id: "ap", labelKey: "APAC" },
  { id: "kr", labelKey: "Korea" },
  { id: "latam", labelKey: "LATAM" },
  { id: "br", labelKey: "Brazil" },
];

export default function RiotLinkCard() {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [henrikConfigured, setHenrikConfigured] = useState(true);
  const [valorant, setValorant] = useState(null);
  const [riotId, setRiotId] = useState("");
  const [region, setRegion] = useState("auto");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getRiotStatus();
      setHenrikConfigured(Boolean(res.henrikConfigured));
      setValorant(res.valorant || null);
      if (res.valorant?.region) setRegion(res.valorant.region);
    } catch (err) {
      setError(err.message || t("Failed to load Valorant link"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleLink = async (e) => {
    e?.preventDefault?.();
    if (!riotId.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await linkRiotId({ riotId: riotId.trim(), region });
      setValorant(res.valorant);
      setRiotId("");
    } catch (err) {
      setError(err.message || t("Link failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await refreshRiotRank();
      setValorant(res.valorant);
    } catch (err) {
      setError(err.message || t("Refresh failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleUnlink = async () => {
    if (busy) return;
    if (!window.confirm(t("Unlink your Valorant account from Descall?"))) return;
    setBusy(true);
    setError("");
    try {
      await unlinkRiot();
      setValorant(null);
    } catch (err) {
      setError(err.message || t("Unlink failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="us-section">
      <h4 className="us-section-label">{t("Valorant")}</h4>
      <div className="us-card riot-link-card">
        {loading ? (
          <div className="riot-link-pad us-muted">{t("Loading…")}</div>
        ) : valorant?.linked ? (
          <div className="riot-link-pad">
            <ValorantBadge valorant={valorant} />
            <div className="riot-link-actions">
              <button type="button" className="us-btn ghost" onClick={handleRefresh} disabled={busy}>
                <RefreshCw size={14} /> {t("Refresh rank")}
              </button>
              <button type="button" className="us-btn ghost-danger" onClick={handleUnlink} disabled={busy}>
                <Unlink size={14} /> {t("Unlink")}
              </button>
            </div>
            <p className="riot-link-hint us-muted">
              {t("Real competitive rank is shown on your profile only after linking Name#TAG.")}
            </p>
          </div>
        ) : (
          <div className="riot-link-pad">
            <p className="riot-link-lead">
              {t("Enter your Riot ID (Name#TAG) to fetch your real Valorant rank. Rank and nick appear on your profile only after linking.")}
            </p>
            {!henrikConfigured && (
              <div className="riot-link-error" style={{ borderTop: "none", borderRadius: 8 }}>
                {t("Server needs")} <code>HENRIK_API_KEY</code> {t("to look up live ranks.")}
              </div>
            )}
            <form className="riot-link-form" onSubmit={handleLink}>
              <label className="us-field">
                <span>
                  <Link2 size={13} /> {t("Riot ID (Name#TAG)")}
                </span>
                <input
                  value={riotId}
                  onChange={(e) => setRiotId(e.target.value)}
                  placeholder="Player#EUW"
                  autoComplete="off"
                  maxLength={40}
                />
              </label>
              <label className="us-field">
                <span>{t("Region")}</span>
                <select value={region} onChange={(e) => setRegion(e.target.value)}>
                  {REGION_IDS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {t(r.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="us-btn primary" disabled={busy || !riotId.includes("#")}>
                {busy ? t("Looking up rank…") : t("Link & fetch rank")}
              </button>
            </form>
          </div>
        )}
        {error && <div className="riot-link-error">{error}</div>}
      </div>
    </section>
  );
}
