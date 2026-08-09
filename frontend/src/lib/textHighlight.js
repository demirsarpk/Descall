/**
 * Pure text-splitting helper for search highlighting. Kept separate from
 * MessageContent.jsx (which is JSX-only) so the split logic can be covered
 * by a plain Node self-test.
 */
export function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Splits `value` into `{ text, isMatch }` segments around case-insensitive
 * occurrences of `needle`. Returns a single non-matching segment when there
 * is nothing to highlight.
 */
export function splitHighlightRanges(value, needle) {
  const str = String(value ?? "");
  if (!needle) return [{ text: str, isMatch: false }];
  const re = new RegExp(`(${escapeRegExp(needle)})`, "gi");
  const chunks = str.split(re);
  if (chunks.length <= 1) return [{ text: str, isMatch: false }];
  return chunks
    .map((chunk, idx) => ({ text: chunk, isMatch: idx % 2 === 1 }))
    .filter((segment) => segment.text.length > 0);
}
