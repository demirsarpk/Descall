/**
 * Shared empty-state with optional illustration + CTA row.
 */
export default function EmptyState({
  icon: Icon,
  title,
  body,
  illustration = "chat",
  primary,
  secondary,
  className = "",
}) {
  const PrimaryIcon = primary?.icon;
  const SecondaryIcon = secondary?.icon;

  return (
    <div className={`empty-state ${className}`.trim()}>
      <div className={`empty-illustration empty-illu-${illustration}`} aria-hidden="true">
        <div className="empty-illu-blob" />
        <div className="empty-illu-blob secondary" />
        {Icon ? (
          <div className="empty-icon-wrap">
            <Icon size={36} strokeWidth={1.75} />
          </div>
        ) : null}
      </div>
      {title ? <h2>{title}</h2> : null}
      {body ? <p>{body}</p> : null}
      {(primary || secondary) && (
        <div className="empty-cta-row">
          {primary && (
            <button type="button" className="empty-cta primary" onClick={primary.action}>
              {PrimaryIcon ? <PrimaryIcon size={15} /> : null}
              {primary.label}
            </button>
          )}
          {secondary && (
            <button type="button" className="empty-cta" onClick={secondary.action}>
              {SecondaryIcon ? <SecondaryIcon size={15} /> : null}
              {secondary.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
