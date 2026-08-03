import { useCallback, useEffect, useState } from "react";
import { Link2, RefreshCw, Unlink, LogIn } from "lucide-react";
import {
  getRiotStatus,
  linkRiotId,
  refreshRiotRank,
  unlinkRiot,
  startRiotOAuth,
} from "../../api/riot";
import ValorantBadge from "../social/ValorantBadge";

const REGIONS = [
  { id: "eu", label: "Europe" },
  { id: "na", label: "NA" },
  { id: "ap", label: "APAC" },
  { id: "kr", label: "Korea" },
  { id: "latam", label: "LATAM" },
  { id: "br", label: "Brazil" },
];

export default function RiotLinkCard() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rsoEnabled, setRsoEnabled] = useState(false);
  const [valorant, setValorant] = useState(null);
  const [riotId, setRiotId] = useState("");
  const [region, setRegion] = useState("eu");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getRiotStatus();
      setRsoEnabled(Boolean(res.rsoEnabled));
      setValorant(res.valorant || null);
      if (res.valorant?.region) setRegion(res.valorant.region);
    } catch (err) {
      setError(err.message || "Failed to load Valorant link");
    } finally {
      setLoading(false);
    }
  }, []);

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
      setError(err.message || "Link failed");
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
      setError(err.message || "Refresh failed");
    } finally {
      setBusy(false);
    }
  };

  const handleUnlink = async () => {
    if (busy) return;
    if (!window.confirm("Unlink your Valorant account from Descall?")) return;
    setBusy(true);
    setError("");
    try {
      await unlinkRiot();
      setValorant(null);
    } catch (err) {
      setError(err.message || "Unlink failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRso = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await startRiotOAuth();
      if (res.url) {
        window.location.href = res.url;
        return;
      }
      setError(res.error || "Riot Sign-On unavailable");
    } catch (err) {
      setError(err.message || "Riot Sign-On unavailable");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="us-section">
      <h4 className="us-section-label">Valorant</h4>
      <div className="us-card riot-link-card">
        {loading ? (
          <div className="riot-link-pad us-muted">Loading…</div>
        ) : valorant?.linked ? (
          <div className="riot-link-pad">
            <ValorantBadge valorant={valorant} />
            <div className="riot-link-actions">
              <button type="button" className="us-btn ghost" onClick={handleRefresh} disabled={busy}>
                <RefreshCw size={14} /> Refresh rank
              </button>
              <button type="button" className="us-btn ghost-danger" onClick={handleUnlink} disabled={busy}>
                <Unlink size={14} /> Unlink
              </button>
            </div>
            <p className="riot-link-hint us-muted">
              Rank &amp; Riot ID show on your profile when linked.
            </p>
          </div>
        ) : (
          <div className="riot-link-pad">
            <p className="riot-link-lead">
              Link your Valorant account so friends see your rank and Riot ID on your profile.
            </p>
            {rsoEnabled && (
              <button type="button" className="us-btn primary riot-rso-btn" onClick={handleRso} disabled={busy}>
                <LogIn size={14} /> Sign in with Riot
              </button>
            )}
            <form className="riot-link-form" onSubmit={handleLink}>
              <label className="us-field">
                <span>
                  <Link2 size={13} /> Riot ID (Name#TAG)
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
                <span>Region</span>
                <select value={region} onChange={(e) => setRegion(e.target.value)}>
                  {REGIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="us-btn primary" disabled={busy || !riotId.includes("#")}>
                Link account
              </button>
            </form>
            {!rsoEnabled && (
              <p className="riot-link-hint us-muted">
                Full Riot login (RSO) needs Riot production approval. Name#TAG works now and pulls your competitive rank when available.
              </p>
            )}
          </div>
        )}
        {error && <div className="riot-link-error">{error}</div>}
      </div>
    </section>
  );
}
