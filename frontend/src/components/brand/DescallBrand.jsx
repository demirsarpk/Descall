const LOGO_SRC = "/brand/descall-logo.png";

export default function DescallBrand({ compact = false, className = "" }) {
  return (
    <span className={`descall-brand ${compact ? "is-compact" : ""} ${className}`.trim()}>
      <img
        className="descall-brand-mark"
        src={LOGO_SRC}
        alt=""
        width={64}
        height={64}
        decoding="async"
        draggable={false}
      />
      {!compact && <strong>Descall</strong>}
    </span>
  );
}
