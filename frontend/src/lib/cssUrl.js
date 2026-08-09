// An unquoted CSS url() token cannot contain '"', "'", "(", ")", whitespace,
// or control characters — if it does, the whole url() (and often the entire
// declaration) is silently dropped by the browser. Inline SVG data URIs
// (e.g. shop cosmetics: banners, avatar frames, profile backgrounds) are
// full of literal double quotes from their own markup attributes, so any
// `background: url(${assetUrl})` built with a bare template string breaks
// exactly for that content. Always build such backgrounds through this
// helper instead of interpolating raw URLs into `url(...)`.
export function cssUrl(url) {
  if (!url) return null;
  const escaped = String(url).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `url("${escaped}")`;
}
