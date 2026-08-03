/**
 * Compact Valorant rank / Riot ID badge for profiles & hover cards.
 */
export default function ValorantBadge({ valorant, compact = false }) {
  if (!valorant?.linked && !valorant?.riotId && !valorant?.gameName) return null;

  const riotId =
    valorant.riotId ||
    (valorant.gameName && valorant.tagLine
      ? `${valorant.gameName}#${valorant.tagLine}`
      : null);
  const rank = valorant.rankTier || valorant.rank || null;
  const rr = typeof valorant.rankRr === "number" ? valorant.rankRr : null;

  if (compact) {
    return (
      <div className="val-badge val-badge--compact" title={riotId || "Valorant"}>
        <span className="val-badge-mark" aria-hidden>
          V
        </span>
        <span className="val-badge-text">
          {rank || riotId || "Valorant"}
          {rank && rr != null ? ` · ${rr} RR` : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="val-badge">
      <div className="val-badge-top">
        <span className="val-badge-mark" aria-hidden>
          V
        </span>
        <span className="val-badge-label">Valorant</span>
        {valorant.verified && <span className="val-badge-verified">Verified</span>}
      </div>
      {riotId && <div className="val-badge-id">{riotId}</div>}
      {(rank || rr != null) && (
        <div className="val-badge-rank">
          {rank || "Unranked"}
          {rr != null ? ` · ${rr} RR` : ""}
        </div>
      )}
      {valorant.region && (
        <div className="val-badge-region">{String(valorant.region).toUpperCase()}</div>
      )}
    </div>
  );
}
