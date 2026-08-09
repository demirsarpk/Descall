export default function DescallBrand({ compact = false, className = "" }) {
  return (
    <span className={`descall-brand ${compact ? "is-compact" : ""} ${className}`.trim()}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="#292D3D" />
        <path d="M15 24c0-7 5.7-12 12.7-12h17.6C52.3 12 58 17 58 24v15c0 7-5.7 12-12.7 12H29L18 58V48c-2-2.2-3-5.2-3-9V24Z" fill="none" stroke="#627BFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M27 27h19M27 35h13" stroke="#627BFF" strokeWidth="4" strokeLinecap="round" />
      </svg>
      {!compact && <strong>Descall</strong>}
    </span>
  );
}
