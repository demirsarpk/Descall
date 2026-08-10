import { useT } from "../../context/LocaleContext";

/**
 * Compact Valorant rank / Riot ID badge for profiles & hover cards.
 * Only renders when the user has linked Name#TAG (valorant.linked).
 */
export default function ValorantBadge({ valorant, compact = false }) {
  const t = useT();
  if (!valorant?.linked) return null;

  const riotId =
    valorant.riotId ||
    (valorant.gameName && valorant.tagLine
      ? `${valorant.gameName}#${valorant.tagLine}`
      : null);
  if (!riotId) return null;

  const rank = valorant.rankTier || valorant.rank || null;
  const rr = typeof valorant.rankRr === "number" ? valorant.rankRr : null;
  const rankLabel = rank || t("Unranked");

  if (compact) {
    return (
      <div className="val-badge val-badge--compact" title={`${riotId} · ${rankLabel}`}>
        <span className="val-badge-mark" aria-hidden>
          V
        </span>
        <span className="val-badge-text">
          {rankLabel}
          {rank && rr != null ? ` · ${rr} RR` : ""}
        </span>
      </div>
    );
  }

  // Note: this full variant is only ever rendered underneath a "Valorant"
  // section heading (profile card / settings link card), so it doesn't
  // repeat the "V Valorant" label itself here — that duplication used to
  // make the section look cluttered/redundant.
  return (
    <div className="val-badge">
      <div className="val-badge-top">
        <span className="val-badge-id">{riotId}</span>
        {valorant.verified && <span className="val-badge-verified">{t("Linked")}</span>}
      </div>
      <div className="val-badge-rank">
        {rankLabel}
        {rank && rr != null ? ` · ${rr} RR` : ""}
      </div>
      {valorant.region && (
        <div className="val-badge-region">{String(valorant.region).toUpperCase()}</div>
      )}
    </div>
  );
}
